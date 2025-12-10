import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import type { SolrushDex } from "../target/types/solrush_dex";
import idl from "../target/idl/solrush_dex.json";

const PROGRAM_ID = new PublicKey("FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1");

// Token mints from localnet
const TOKENS = {
    SOL: new PublicKey("3vMqwHGJz235mid7qDi3wBvY2Sa5gKequm3twF1Q2Sm1"),
    USDC: new PublicKey("4cvUrvooQFEKf4JBDfWL7HbckG7a8ddnsZ8nmDUMkCgi"),
    USDT: new PublicKey("8rmNvwfZvu6Ys6DpxXpH7pxdfzcmFVzK7NN3YrBb5UB"),
    WETH: new PublicKey("3bGyQHL2MYJpncPZbW1kXufrdrTf3nA1TRUpnRcAjFFb"),
    RUSH: new PublicKey("2Bj61yXFCVaAP6STf91uLMd4p2fR3ziDW4dD5c2AGt8X"),
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

async function main() {
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    
    // Create a dummy wallet for read-only operations
    const dummyKeypair = Keypair.generate();
    const wallet = new Wallet(dummyKeypair);
    
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    
    const program = new Program<SolrushDex>(idl as SolrushDex, provider);

    console.log("=== Checking Pools ===");
    console.log("Program ID:", PROGRAM_ID.toBase58());
    console.log("\nToken Mints:");
    Object.entries(TOKENS).forEach(([symbol, mint]) => {
        console.log(`  ${symbol}: ${mint.toBase58()}`);
    });

    // Check all possible pool pairs
    const pairs = [
        ["SOL", "USDC"],
        ["SOL", "USDT"],
        ["SOL", "WETH"],
        ["SOL", "RUSH"],
        ["USDC", "USDT"],
        ["USDC", "WETH"],
        ["USDC", "RUSH"],
        ["USDT", "WETH"],
        ["USDT", "RUSH"],
        ["WETH", "RUSH"],
    ];

    console.log("\n=== Pool Status ===");
    for (const [tokenA, tokenB] of pairs) {
        const mintA = TOKENS[tokenA as keyof typeof TOKENS];
        const mintB = TOKENS[tokenB as keyof typeof TOKENS];
        const [poolPda] = findPoolAddress(mintA, mintB);

        try {
            const poolAccount = await (program.account as any).liquidityPool.fetch(poolPda);
            console.log(`✅ ${tokenA}/${tokenB}: EXISTS`);
            console.log(`   Pool: ${poolPda.toBase58()}`);
            console.log(`   Pool Token A Mint: ${poolAccount.tokenAMint.toBase58()}`);
            console.log(`   Pool Token B Mint: ${poolAccount.tokenBMint.toBase58()}`);
            console.log(`   Reserve A: ${poolAccount.reserveA.toString()}`);
            console.log(`   Reserve B: ${poolAccount.reserveB.toString()}`);
            console.log(`   Token A Vault: ${poolAccount.tokenAVault.toBase58()}`);
            console.log(`   Token B Vault: ${poolAccount.tokenBVault.toBase58()}`);
        } catch (err: any) {
            console.log(`❌ ${tokenA}/${tokenB}: NOT FOUND`);
            console.log(`   Expected PDA: ${poolPda.toBase58()}`);
        }
    }
}

main().catch(console.error);
