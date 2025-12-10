import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
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
    const [mintA, mintB] = tokenAMint.toBuffer().compare(tokenBMint.toBuffer()) < 0
        ? [tokenAMint, tokenBMint]
        : [tokenBMint, tokenAMint];

    return PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        PROGRAM_ID
    );
}

function findTokenVault(poolAddress: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), poolAddress.toBuffer(), mint.toBuffer()],
        PROGRAM_ID
    );
}

function getDecimals(mint: PublicKey): number {
    for (const [symbol, tokenMint] of Object.entries(TOKENS)) {
        if (tokenMint.equals(mint)) {
            return TOKEN_DECIMALS[symbol] || 9;
        }
    }
    return 9;
}

function getSymbol(mint: PublicKey): string {
    for (const [symbol, tokenMint] of Object.entries(TOKENS)) {
        if (tokenMint.equals(mint)) {
            return symbol;
        }
    }
    return "UNKNOWN";
}

async function swap(
    program: Program<SolrushDex>,
    connection: Connection,
    payer: Keypair,
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    amountIn: number
) {
    console.log(`\n=== Swapping ${amountIn} ${inputTokenSymbol} for ${outputTokenSymbol} ===`);
    
    const inputMint = TOKENS[inputTokenSymbol];
    const outputMint = TOKENS[outputTokenSymbol];
    
    // Find the pool
    const [poolAddress] = findPoolAddress(inputMint, outputMint);
    console.log(`Pool Address: ${poolAddress.toBase58()}`);
    
    // Fetch pool data
    const poolAccount = await (program.account as any).liquidityPool.fetch(poolAddress);
    const poolTokenAMint = poolAccount.tokenAMint as PublicKey;
    const poolTokenBMint = poolAccount.tokenBMint as PublicKey;
    
    console.log(`Pool Token A: ${getSymbol(poolTokenAMint)} (${poolTokenAMint.toBase58()})`);
    console.log(`Pool Token B: ${getSymbol(poolTokenBMint)} (${poolTokenBMint.toBase58()})`);
    console.log(`Reserve A: ${poolAccount.reserveA.toString()}`);
    console.log(`Reserve B: ${poolAccount.reserveB.toString()}`);
    
    // Determine swap direction: is_a_to_b means swapping token A for token B
    const isAToB = inputMint.equals(poolTokenAMint);
    console.log(`Direction: ${isAToB ? 'A->B' : 'B->A'} (is_a_to_b: ${isAToB})`);
    
    // Get user token accounts
    const userTokenIn = await getAssociatedTokenAddress(inputMint, payer.publicKey);
    const userTokenOut = await getAssociatedTokenAddress(outputMint, payer.publicKey);
    
    // Get pool vaults based on swap direction
    // pool_vault_in = vault for the token being swapped IN
    // pool_vault_out = vault for the token being swapped OUT
    const poolVaultIn = isAToB ? poolAccount.tokenAVault : poolAccount.tokenBVault;
    const poolVaultOut = isAToB ? poolAccount.tokenBVault : poolAccount.tokenAVault;
    
    console.log(`User Token In: ${userTokenIn.toBase58()}`);
    console.log(`User Token Out: ${userTokenOut.toBase58()}`);
    console.log(`Pool Vault In: ${poolVaultIn.toBase58()}`);
    console.log(`Pool Vault Out: ${poolVaultOut.toBase58()}`);
    
    // Check balances before
    try {
        const balanceIn = await connection.getTokenAccountBalance(userTokenIn);
        const balanceOut = await connection.getTokenAccountBalance(userTokenOut);
        console.log(`\nBefore swap:`);
        console.log(`  ${inputTokenSymbol} balance: ${balanceIn.value.uiAmountString}`);
        console.log(`  ${outputTokenSymbol} balance: ${balanceOut.value.uiAmountString}`);
    } catch (e) {
        console.log(`Error checking balances: ${e}`);
    }
    
    // Calculate swap amounts
    const inputDecimals = TOKEN_DECIMALS[inputTokenSymbol];
    const amountInBN = new BN(Math.floor(amountIn * Math.pow(10, inputDecimals)));
    const minimumAmountOut = new BN(0); // No slippage protection for testing
    const deadline = new BN(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
    
    console.log(`\nSwap parameters:`);
    console.log(`  Amount In: ${amountIn} ${inputTokenSymbol} (${amountInBN.toString()} raw)`);
    console.log(`  Min Amount Out: ${minimumAmountOut.toString()}`);
    console.log(`  Deadline: ${deadline.toString()}`);
    
    try {
        const tx = await (program.methods
            .swap(amountInBN, minimumAmountOut, isAToB, deadline) as any)
            .accounts({
                pool: poolAddress,
                userTokenIn: userTokenIn,
                userTokenOut: userTokenOut,
                poolVaultIn: poolVaultIn,
                poolVaultOut: poolVaultOut,
                user: payer.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        
        console.log(`\n✅ Swap successful! TX: ${tx}`);
        
        // Check balances after
        const balanceInAfter = await connection.getTokenAccountBalance(userTokenIn);
        const balanceOutAfter = await connection.getTokenAccountBalance(userTokenOut);
        console.log(`\nAfter swap:`);
        console.log(`  ${inputTokenSymbol} balance: ${balanceInAfter.value.uiAmountString}`);
        console.log(`  ${outputTokenSymbol} balance: ${balanceOutAfter.value.uiAmountString}`);
        
        // Check updated pool reserves
        const updatedPool = await (program.account as any).liquidityPool.fetch(poolAddress);
        console.log(`\nUpdated pool reserves:`);
        console.log(`  Reserve A: ${updatedPool.reserveA.toString()}`);
        console.log(`  Reserve B: ${updatedPool.reserveB.toString()}`);
        
    } catch (err: any) {
        console.error(`\n❌ Swap failed:`, err.message || err);
        if (err.logs) {
            console.error("Logs:", err.logs.slice(-15));
        }
    }
}

async function main() {
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");

    // Load payer keypair
    const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
    const payer = Keypair.fromSecretKey(secretKey);

    const wallet = new Wallet(payer);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const program = new Program<SolrushDex>(idl as any, provider);

    console.log("=== Swap Test ===");
    console.log("Payer:", payer.publicKey.toBase58());
    
    // Test 1: Swap SOL for USDC
    await swap(program, connection, payer, "SOL", "USDC", 10);
    
    // Test 2: Swap USDC for SOL
    await swap(program, connection, payer, "USDC", "SOL", 500);
    
    console.log("\n=== Swap Tests Complete! ===");
}

main().catch(console.error);
