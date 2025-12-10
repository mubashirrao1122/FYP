import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import type { SolrushDex } from "../target/types/solrush_dex";
import idl from "../target/idl/solrush_dex.json";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1");

// Token mints from localnet
const TOKENS: Record<string, PublicKey> = {
    SOL: new PublicKey("3vMqwHGJz235mid7qDi3wBvY2Sa5gKequm3twF1Q2Sm1"),
    USDC: new PublicKey("4cvUrvooQFEKf4JBDfWL7HbckG7a8ddnsZ8nmDUMkCgi"),
    USDT: new PublicKey("8rmNvwfZvu6Ys6DpxXpH7pxdfzcmFVzK7NN3YrBb5UB"),
    WETH: new PublicKey("3bGyQHL2MYJpncPZbW1kXufrdrTf3nA1TRUpnRcAjFFb"),
    RUSH: new PublicKey("2Bj61yXFCVaAP6STf91uLMd4p2fR3ziDW4dD5c2AGt8X"),
};

const TOKEN_DECIMALS: Record<string, number> = {
    SOL: 9,
    USDC: 6,
    USDT: 6,
    WETH: 8,
    RUSH: 6,
};

function findPoolAddress(tokenAMint: PublicKey, tokenBMint: PublicKey): [PublicKey, number] {
    // Sort mints
    const [mintA, mintB] = tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) < 0
        ? [tokenAMint, tokenBMint]
        : [tokenBMint, tokenAMint];

    return PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
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
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");

    // Load payer keypair (the id.json is the default solana keypair)
    const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
    const payer = Keypair.fromSecretKey(secretKey);

    const wallet = new Wallet(payer);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const program = new Program<SolrushDex>(idl as SolrushDex, provider);

    console.log("=== Adding Liquidity ===");
    console.log("Payer:", payer.publicKey.toBase58());

    // Add liquidity to SOL/USDC pool
    await addLiquidityToPool(program, connection, payer, "SOL", "USDC", 100, 10000);
    
    // Add liquidity to SOL/USDT pool
    await addLiquidityToPool(program, connection, payer, "SOL", "USDT", 100, 10000);
    
    console.log("\n=== Done! ===");
}

async function addLiquidityToPool(
    program: Program<SolrushDex>,
    connection: Connection,
    payer: Keypair,
    tokenASymbol: string,
    tokenBSymbol: string,
    amountA: number,
    amountB: number
) {
    console.log(`\n=== Adding Liquidity to ${tokenASymbol}/${tokenBSymbol} Pool ===`);
    
    const mintA = TOKENS[tokenASymbol];
    const mintB = TOKENS[tokenBSymbol];

    // Sort mints - pools store them in sorted order
    const aFirst = mintA.toBuffer().compare(mintB.toBuffer()) < 0;
    const [sortedMintA, sortedMintB] = aFirst ? [mintA, mintB] : [mintB, mintA];
    const [sortedAmountA, sortedAmountB] = aFirst ? [amountA, amountB] : [amountB, amountA];
    const [sortedSymbolA, sortedSymbolB] = aFirst ? [tokenASymbol, tokenBSymbol] : [tokenBSymbol, tokenASymbol];

    console.log(`Sorted order: ${sortedSymbolA}/${sortedSymbolB}`);

    const [poolPda] = findPoolAddress(sortedMintA, sortedMintB);
    const [lpMintPda] = findLpMintAddress(poolPda);
    const [positionPda] = findPositionAddress(poolPda, payer.publicKey);

    console.log("Pool PDA:", poolPda.toBase58());
    console.log("LP Mint PDA:", lpMintPda.toBase58());
    console.log("Position PDA:", positionPda.toBase58());

    // Fetch pool to get vault addresses
    const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);
    console.log("\nPool Account:");
    console.log("  Token A Mint:", poolAccount.tokenAMint.toBase58());
    console.log("  Token B Mint:", poolAccount.tokenBMint.toBase58());
    console.log("  Token A Vault:", poolAccount.tokenAVault.toBase58());
    console.log("  Token B Vault:", poolAccount.tokenBVault.toBase58());
    console.log("  Reserve A:", poolAccount.reserveA.toString());
    console.log("  Reserve B:", poolAccount.reserveB.toString());

    // Get user token accounts based on pool's actual mint order
    const userTokenA = await getAssociatedTokenAddress(poolAccount.tokenAMint, payer.publicKey);
    const userTokenB = await getAssociatedTokenAddress(poolAccount.tokenBMint, payer.publicKey);
    
    // Ensure user has LP token account
    const userLpToken = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        lpMintPda,
        payer.publicKey
    );

    console.log("\nUser Token Accounts:");
    console.log("  Token A:", userTokenA.toBase58());
    console.log("  Token B:", userTokenB.toBase58());
    console.log("  LP Token:", userLpToken.address.toBase58());

    // Check user balances
    try {
        const balanceA = await connection.getTokenAccountBalance(userTokenA);
        console.log(`  Balance A: ${balanceA.value.uiAmountString}`);
    } catch (e) {
        console.log("  Balance A: No token account");
    }
    
    try {
        const balanceB = await connection.getTokenAccountBalance(userTokenB);
        console.log(`  Balance B: ${balanceB.value.uiAmountString}`);
    } catch (e) {
        console.log("  Balance B: No token account");
    }

    // Calculate amounts based on pool's actual mint order
    const decimalsA = getDecimals(poolAccount.tokenAMint);
    const decimalsB = getDecimals(poolAccount.tokenBMint);
    
    // Determine the amounts based on pool's mint order
    let finalAmountA: number, finalAmountB: number;
    if (poolAccount.tokenAMint.equals(mintA)) {
        finalAmountA = amountA;
        finalAmountB = amountB;
    } else {
        finalAmountA = amountB;
        finalAmountB = amountA;
    }
    
    const amountABN = new BN(Math.floor(finalAmountA * Math.pow(10, decimalsA)));
    const amountBBN = new BN(Math.floor(finalAmountB * Math.pow(10, decimalsB)));
    const minLpTokens = new BN(0);

    console.log(`\nAdding liquidity: ${finalAmountA} (raw: ${amountABN.toString()}) + ${finalAmountB} (raw: ${amountBBN.toString()})`);

    try {
        // Use camelCase for account names as expected by Anchor TS SDK
        const tx = await (program.methods
            .addLiquidity(amountABN, amountBBN, minLpTokens) as any)
            .accounts({
                pool: poolPda,
                lpTokenMint: lpMintPda,
                userPosition: positionPda,
                tokenAVault: poolAccount.tokenAVault,
                tokenBVault: poolAccount.tokenBVault,
                userTokenA: userTokenA,
                userTokenB: userTokenB,
                userLpTokenAccount: userLpToken.address,
                user: payer.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Liquidity added! TX:", tx);

        // Check new pool state
        const updatedPool = await (program.account as any).liquidityPool.fetch(poolPda);
        console.log("\nUpdated Pool State:");
        console.log("  Reserve A:", updatedPool.reserveA.toString());
        console.log("  Reserve B:", updatedPool.reserveB.toString());

    } catch (err: any) {
        console.error("❌ Failed to add liquidity:", err.message || err);
        if (err.logs) {
            console.error("Logs:", err.logs.slice(-15));
        }
    }
}

function getDecimals(mint: PublicKey): number {
    for (const [symbol, tokenMint] of Object.entries(TOKENS)) {
        if (tokenMint.equals(mint)) {
            return TOKEN_DECIMALS[symbol] || 9;
        }
    }
    return 9;
}

main().catch(console.error);
