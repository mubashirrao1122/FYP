/**
 * Setup SOL/USDT Pool Script
 * 
 * This script properly initializes a SOL/USDT pool with the correct ratio:
 * - 100 SOL : 10,000 USDT (= 100 USDT per SOL)
 * 
 * Usage: npx ts-node scripts/setup-sol-usdt-pool.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    createSyncNativeInstruction,
} from "@solana/spl-token";
import type { SolrushDex } from "../target/types/solrush_dex";
import idl from "../target/idl/solrush_dex.json";
import * as fs from "fs";
import * as path from "path";

// Read Program ID from IDL (updated by `anchor build`) — never hardcode.
const PROGRAM_ID = new PublicKey((idl as any).address);
const LOCALNET_URL = "http://127.0.0.1:8899";

// Target pool configuration
const TARGET_SOL_AMOUNT = 100;      // 100 SOL
const TARGET_USDT_AMOUNT = 10000;   // 10,000 USDT (= 100 USDT per SOL)

interface TokenConfig {
    mint: PublicKey;
    decimals: number;
    symbol: string;
}

function loadTokensFromConfig(): { SOL: TokenConfig; USDT: TokenConfig } {
    const configPath = path.join(__dirname, "..", "..", "localnet-config.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("localnet-config.json not found. Run setup-localnet.ts first.");
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    if (!config.mints?.USDT) {
        throw new Error("USDT mint not found in localnet-config.json");
    }
    
    return {
        SOL: { mint: new PublicKey("So11111111111111111111111111111111111111112"), decimals: 9, symbol: "SOL" },
        USDT: { mint: new PublicKey(config.mints.USDT), decimals: config.decimals?.USDT ?? 6, symbol: "USDT" },
    };
}

function loadWallet(): Keypair {
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

function findPoolAddress(mintA: PublicKey, mintB: PublicKey): [PublicKey, number] {
    const [sorted1, sorted2] = mintA.toBuffer().compare(mintB.toBuffer()) < 0
        ? [mintA, mintB]
        : [mintB, mintA];
    
    return PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), sorted1.toBuffer(), sorted2.toBuffer()],
        PROGRAM_ID
    );
}

function findLpMintAddress(poolAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolAddress.toBuffer()],
        PROGRAM_ID
    );
}

function findPositionAddress(poolAddress: PublicKey, userAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("position"), poolAddress.toBuffer(), userAddress.toBuffer()],
        PROGRAM_ID
    );
}

async function main() {
    console.log("=".repeat(60));
    console.log("🏊 SOL/USDT Pool Setup");
    console.log("=".repeat(60));
    
    const tokens = loadTokensFromConfig();
    const wallet = loadWallet();
    
    console.log("\n📋 Configuration:");
    console.log(`   SOL Mint: ${tokens.SOL.mint.toBase58()}`);
    console.log(`   USDT Mint: ${tokens.USDT.mint.toBase58()}`);
    console.log(`   Target: ${TARGET_SOL_AMOUNT} SOL : ${TARGET_USDT_AMOUNT} USDT`);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    
    const connection = new Connection(LOCALNET_URL, "confirmed");
    const provider = new AnchorProvider(
        connection,
        new Wallet(wallet),
        { commitment: "confirmed" }
    );
    anchor.setProvider(provider);
    
    const program = new Program<SolrushDex>(idl as SolrushDex, provider);
    
    // Sort tokens for consistent PDA derivation
    const [mintA, mintB] = tokens.SOL.mint.toBuffer().compare(tokens.USDT.mint.toBuffer()) < 0
        ? [tokens.SOL, tokens.USDT]
        : [tokens.USDT, tokens.SOL];
    
    const isSolFirst = mintA.mint.equals(tokens.SOL.mint);
    const amountA = isSolFirst ? TARGET_SOL_AMOUNT : TARGET_USDT_AMOUNT;
    const amountB = isSolFirst ? TARGET_USDT_AMOUNT : TARGET_SOL_AMOUNT;
    
    console.log("\n📍 Sorted Order:");
    console.log(`   Token A: ${mintA.symbol} (${amountA})`);
    console.log(`   Token B: ${mintB.symbol} (${amountB})`);
    
    const [poolPda] = findPoolAddress(mintA.mint, mintB.mint);
    const [lpMintPda] = findLpMintAddress(poolPda);
    const [positionPda] = findPositionAddress(poolPda, wallet.publicKey);
    
    console.log("\n📍 PDAs:");
    console.log(`   Pool: ${poolPda.toBase58()}`);
    console.log(`   LP Mint: ${lpMintPda.toBase58()}`);
    console.log(`   Position: ${positionPda.toBase58()}`);
    
    // Check if pool exists
    const existingPool = await (program.account as any).liquidityPool.fetchNullable(poolPda);
    
    if (existingPool) {
        console.log("\n⚠️  Pool already exists!");
        console.log(`   Reserve A: ${existingPool.reserveA.toString()} (${Number(existingPool.reserveA) / Math.pow(10, mintA.decimals)} ${mintA.symbol})`);
        console.log(`   Reserve B: ${existingPool.reserveB.toString()} (${Number(existingPool.reserveB) / Math.pow(10, mintB.decimals)} ${mintB.symbol})`);
        
        if (existingPool.reserveA.toNumber() > 0) {
            console.log("\n   Pool has liquidity. Adding more to reach target ratio...");
            await addLiquidity(program, connection, wallet, poolPda, lpMintPda, positionPda,
                              existingPool, mintA, mintB, amountA, amountB);
        }
        return;
    }
    
    // Generate vault keypairs
    const vaultA = Keypair.generate();
    const vaultB = Keypair.generate();
    
    // Get user token accounts
    const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection, wallet, mintA.mint, wallet.publicKey
    );
    const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection, wallet, mintB.mint, wallet.publicKey
    );
    const userLpToken = await getAssociatedTokenAddress(lpMintPda, wallet.publicKey);
    
    console.log("\n📦 Accounts:");
    console.log(`   Vault A: ${vaultA.publicKey.toBase58()}`);
    console.log(`   Vault B: ${vaultB.publicKey.toBase58()}`);
    console.log(`   User Token A: ${userTokenA.address.toBase58()}`);
    console.log(`   User Token B: ${userTokenB.address.toBase58()}`);
    
    // Ensure user has enough tokens
    console.log("\n💰 Checking balances and funding if needed...");
    
    const balanceA = Number((await connection.getTokenAccountBalance(userTokenA.address)).value.amount);
    const neededA = Math.floor(amountA * Math.pow(10, mintA.decimals));
    if (balanceA < neededA) {
        if (mintA.mint.equals(NATIVE_MINT)) {
            console.log(`   Wrapping ${amountA} SOL into WSOL ATA...`);
            const wrapTx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: userTokenA.address,
                    lamports: neededA - balanceA,
                }),
                createSyncNativeInstruction(userTokenA.address)
            );
            wrapTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            wrapTx.feePayer = wallet.publicKey;
            wrapTx.sign(wallet);
            const wrapSig = await connection.sendRawTransaction(wrapTx.serialize(), { skipPreflight: false });
            await connection.confirmTransaction(wrapSig, "confirmed");
        } else {
            console.log(`   Minting ${amountA} ${mintA.symbol}...`);
            await mintTo(connection, wallet, mintA.mint, userTokenA.address, wallet, BigInt(neededA));
        }
    }
    
    const balanceB = Number((await connection.getTokenAccountBalance(userTokenB.address)).value.amount);
    const neededB = Math.floor(amountB * Math.pow(10, mintB.decimals));
    if (balanceB < neededB) {
        if (mintB.mint.equals(NATIVE_MINT)) {
            console.log(`   Wrapping ${amountB} SOL into WSOL ATA...`);
            const wrapTx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: userTokenB.address,
                    lamports: neededB - balanceB,
                }),
                createSyncNativeInstruction(userTokenB.address)
            );
            wrapTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            wrapTx.feePayer = wallet.publicKey;
            wrapTx.sign(wallet);
            const wrapSig = await connection.sendRawTransaction(wrapTx.serialize(), { skipPreflight: false });
            await connection.confirmTransaction(wrapSig, "confirmed");
        } else {
            console.log(`   Minting ${amountB} ${mintB.symbol}...`);
            await mintTo(connection, wallet, mintB.mint, userTokenB.address, wallet, BigInt(neededB));
        }
    }
    
    // Initialize pool
    console.log("\n🚀 Initializing pool...");
    
    try {
        const initTx = await (program.methods
            .initializePool() as any)
            .accounts({
                pool: poolPda,
                tokenAMint: mintA.mint,
                tokenBMint: mintB.mint,
                lpTokenMint: lpMintPda,
                tokenAVault: vaultA.publicKey,
                tokenBVault: vaultB.publicKey,
                lpTokenAccount: userLpToken,
                authority: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([vaultA, vaultB])
            .rpc();
        
        console.log(`✅ Pool initialized: ${initTx}`);
    } catch (err: any) {
        if (err.message?.includes("already in use")) {
            console.log("   Pool already initialized, skipping...");
        } else {
            throw err;
        }
    }
    
    // Fetch pool to add liquidity
    const pool = await (program.account as any).liquidityPool.fetch(poolPda);
    
    // Add liquidity
    await addLiquidity(program, connection, wallet, poolPda, lpMintPda, positionPda,
                      pool, mintA, mintB, amountA, amountB);
    
    // Final verification
    const finalPool = await (program.account as any).liquidityPool.fetch(poolPda);
    console.log("\n" + "=".repeat(60));
    console.log("✅ Pool Setup Complete!");
    console.log("=".repeat(60));
    console.log(`   Reserve A: ${Number(finalPool.reserveA) / Math.pow(10, mintA.decimals)} ${mintA.symbol}`);
    console.log(`   Reserve B: ${Number(finalPool.reserveB) / Math.pow(10, mintB.decimals)} ${mintB.symbol}`);
    
    const price = mintA.symbol === "USDT"
        ? (Number(finalPool.reserveA) / Math.pow(10, mintA.decimals)) / (Number(finalPool.reserveB) / Math.pow(10, mintB.decimals))
        : (Number(finalPool.reserveB) / Math.pow(10, mintB.decimals)) / (Number(finalPool.reserveA) / Math.pow(10, mintA.decimals));
    console.log(`   Price: 1 SOL = ${price.toFixed(2)} USDT`);
}

async function addLiquidity(
    program: Program<SolrushDex>,
    connection: Connection,
    wallet: Keypair,
    poolPda: PublicKey,
    lpMintPda: PublicKey,
    positionPda: PublicKey,
    pool: any,
    mintA: TokenConfig,
    mintB: TokenConfig,
    targetAmountA: number,
    targetAmountB: number
) {
    console.log("\n💧 Adding liquidity...");
    
    const userTokenA = await getAssociatedTokenAddress(pool.tokenAMint, wallet.publicKey);
    const userTokenB = await getAssociatedTokenAddress(pool.tokenBMint, wallet.publicKey);
    const userLpToken = await getOrCreateAssociatedTokenAccount(
        connection, wallet, lpMintPda, wallet.publicKey
    );
    
    const rawAmountA = new BN(Math.floor(targetAmountA * Math.pow(10, mintA.decimals)));
    const rawAmountB = new BN(Math.floor(targetAmountB * Math.pow(10, mintB.decimals)));
    
    console.log(`   Adding ${targetAmountA} ${mintA.symbol} + ${targetAmountB} ${mintB.symbol}`);
    
    try {
        const tx = await (program.methods
            .addLiquidity(rawAmountA, rawAmountB, new BN(0)) as any)
            .accounts({
                pool: poolPda,
                lpTokenMint: lpMintPda,
                userPosition: positionPda,
                tokenAVault: pool.tokenAVault,
                tokenBVault: pool.tokenBVault,
                userTokenA: userTokenA,
                userTokenB: userTokenB,
                userLpTokenAccount: userLpToken.address,
                user: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
        
        console.log(`✅ Liquidity added: ${tx}`);
    } catch (err: any) {
        console.error("❌ Failed to add liquidity:", err.message);
        if (err.logs) {
            console.error("   Logs:", err.logs.slice(-10));
        }
    }
}

main().catch(console.error);
