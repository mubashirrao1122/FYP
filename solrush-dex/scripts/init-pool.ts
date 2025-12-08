/**
 * Initialize Pool Script
 * 
 * Creates a liquidity pool with initial liquidity
 * 
 * Usage:
 *   npx ts-node scripts/init-pool.ts <tokenA> <tokenB> <amountA> <amountB>
 *   
 * Examples:
 *   npx ts-node scripts/init-pool.ts SOL USDC 10 1000
 *   npx ts-node scripts/init-pool.ts USDC USDT 10000 10000
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    createMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    NATIVE_MINT,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const LOCALNET_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("HCkVnLDL76FR8JJ9fbWg67kr48AtNqDgsivSt19Dnu9c");

interface LocalnetConfig {
    mints: Record<string, string>;
    decimals: Record<string, number>;
    walletPublicKey: string;
}

async function loadConfig(): Promise<LocalnetConfig> {
    const configPath = path.join(__dirname, "..", "..", "localnet-config.json");
    if (!fs.existsSync(configPath)) {
        throw new Error(
            "localnet-config.json not found. Run setup-localnet.ts first."
        );
    }
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

async function loadWallet(): Promise<Keypair> {
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

async function loadIdl(): Promise<anchor.Idl> {
    const idlPath = path.join(__dirname, "..", "target", "idl", "solrush_dex.json");
    if (!fs.existsSync(idlPath)) {
        throw new Error(
            "IDL not found. Run 'anchor build' first."
        );
    }
    return JSON.parse(fs.readFileSync(idlPath, "utf-8"));
}

function getMintAddress(symbol: string, config: LocalnetConfig): PublicKey {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol === "SOL") {
        return NATIVE_MINT;
    }
    if (!config.mints[upperSymbol]) {
        throw new Error(`Unknown token: ${symbol}`);
    }
    return new PublicKey(config.mints[upperSymbol]);
}

async function initializePool(
    tokenASymbol: string,
    tokenBSymbol: string,
    amountA: number,
    amountB: number
): Promise<void> {
    console.log(`\n🏊 Initializing ${tokenASymbol}/${tokenBSymbol} Pool...\n`);

    const connection = new Connection(LOCALNET_URL, "confirmed");
    const config = await loadConfig();
    const wallet = await loadWallet();
    const idl = await loadIdl();

    // Setup Anchor provider
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(wallet),
        { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    const program = new Program(idl, provider);

    // Get mint addresses
    const tokenAMint = getMintAddress(tokenASymbol, config);
    const tokenBMint = getMintAddress(tokenBSymbol, config);
    
    // Ensure tokenA < tokenB for consistent PDA derivation
    let [mintA, mintB] = [tokenAMint, tokenBMint];
    let [symA, symB] = [tokenASymbol, tokenBSymbol];
    let [amtA, amtB] = [amountA, amountB];
    
    if (tokenAMint.toBase58() > tokenBMint.toBase58()) {
        [mintA, mintB] = [tokenBMint, tokenAMint];
        [symA, symB] = [tokenBSymbol, tokenASymbol];
        [amtA, amtB] = [amountB, amountA];
    }

    const decimalsA = config.decimals[symA.toUpperCase()] || 9;
    const decimalsB = config.decimals[symB.toUpperCase()] || 6;

    // Calculate raw amounts
    const rawAmountA = new BN(Math.floor(amtA * 10 ** decimalsA));
    const rawAmountB = new BN(Math.floor(amtB * 10 ** decimalsB));

    console.log(`📋 Token A: ${symA} (${mintA.toBase58()})`);
    console.log(`📋 Token B: ${symB} (${mintB.toBase58()})`);
    console.log(`📋 Amount A: ${amtA} (${rawAmountA.toString()} raw)`);
    console.log(`📋 Amount B: ${amtB} (${rawAmountB.toString()} raw)`);

    // Derive PDAs
    const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        PROGRAM_ID
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolPda.toBuffer()],
        PROGRAM_ID
    );

    console.log(`\n📍 Pool PDA: ${poolPda.toBase58()}`);
    console.log(`📍 LP Mint: ${lpMint.toBase58()}`);

    // Get token accounts
    const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mintA,
        wallet.publicKey
    );
    const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mintB,
        wallet.publicKey
    );

    // Derive vault PDAs
    const vaultA = await getAssociatedTokenAddress(mintA, poolPda, true);
    const vaultB = await getAssociatedTokenAddress(mintB, poolPda, true);
    const userLpToken = await getAssociatedTokenAddress(lpMint, wallet.publicKey);

    console.log(`\n📦 Vault A: ${vaultA.toBase58()}`);
    console.log(`📦 Vault B: ${vaultB.toBase58()}`);
    console.log(`📦 User Token A: ${userTokenA.address.toBase58()}`);
    console.log(`📦 User Token B: ${userTokenB.address.toBase58()}`);

    try {
        // Initialize pool
        const tx = await program.methods
            .initializePool(rawAmountA, rawAmountB)
            .accounts({
                pool: poolPda,
                tokenAMint: mintA,
                tokenBMint: mintB,
                lpMint: lpMint,
                vaultA: vaultA,
                vaultB: vaultB,
                userTokenA: userTokenA.address,
                userTokenB: userTokenB.address,
                userLpToken: userLpToken,
                authority: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log(`\n✅ Pool initialized successfully!`);
        console.log(`🔗 Transaction: ${tx}`);

        // Fetch and display pool info
        const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);
        console.log(`\n📊 Pool Info:`);
        console.log(`   Reserve A: ${poolAccount.reserveA.toString()}`);
        console.log(`   Reserve B: ${poolAccount.reserveB.toString()}`);

    } catch (error: any) {
        if (error.message?.includes("already in use")) {
            console.log(`\n⚠️ Pool already exists!`);
            
            // Try to fetch existing pool
            try {
                const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);
                console.log(`\n📊 Existing Pool Info:`);
                console.log(`   Reserve A: ${poolAccount.reserveA.toString()}`);
                console.log(`   Reserve B: ${poolAccount.reserveB.toString()}`);
            } catch (e) {
                console.log("Could not fetch pool info.");
            }
        } else {
            throw error;
        }
    }
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.length < 4) {
    console.log(`
Usage: npx ts-node scripts/init-pool.ts <tokenA> <tokenB> <amountA> <amountB>

Arguments:
  tokenA  - First token symbol: SOL, USDC, USDT, WETH, RUSH
  tokenB  - Second token symbol
  amountA - Amount of token A for initial liquidity
  amountB - Amount of token B for initial liquidity

Examples:
  npx ts-node scripts/init-pool.ts SOL USDC 10 1000
  npx ts-node scripts/init-pool.ts USDC USDT 10000 10000
`);
    process.exit(1);
}

const [tokenA, tokenB, amountAStr, amountBStr] = args;
const amountA = parseFloat(amountAStr);
const amountB = parseFloat(amountBStr);

if (isNaN(amountA) || amountA <= 0 || isNaN(amountB) || amountB <= 0) {
    console.error("Invalid amounts. Must be positive numbers.");
    process.exit(1);
}

initializePool(tokenA, tokenB, amountA, amountB)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
