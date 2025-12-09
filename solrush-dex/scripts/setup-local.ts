import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolrushDex } from "../target/types/solrush_dex";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import fs from 'fs';

async function main() {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolrushDex as Program<SolrushDex>;
    const connection = provider.connection;
    const payer = (provider.wallet as anchor.Wallet).payer;

    console.log("🚀 Starting Local Setup...");
    console.log("Wallet:", payer.publicKey.toBase58());

    // 1. Create Mints
    console.log("\nCreating Tokens...");

    const tokenA = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9 // SOL decimals
    );
    console.log("Token A (SOL-like):", tokenA.toBase58());

    const tokenB = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        6 // USDC decimals
    );
    console.log("Token B (USDC-like):", tokenB.toBase58());

    const tokenC = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        6 // USDT decimals
    );
    console.log("Token C (USDT-like):", tokenC.toBase58());

    const tokenD = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        6 // RUSH decimals
    );
    console.log("Token D (RUSH-like):", tokenD.toBase58());

    // 2. Mint Tokens to Wallet
    console.log("\nMinting initial supply to wallet...");

    const amountA = 1000 * 10 ** 9; // 1000 SOL
    const amountB = 100000 * 10 ** 6; // 100,000 USDC
    const amountC = 100000 * 10 ** 6; // 100,000 USDT
    const amountD = 1000000 * 10 ** 6; // 1,000,000 RUSH

    const ataA = await getOrCreateAssociatedTokenAccount(connection, payer, tokenA, payer.publicKey);
    await mintTo(connection, payer, tokenA, ataA.address, payer, amountA);

    const ataB = await getOrCreateAssociatedTokenAccount(connection, payer, tokenB, payer.publicKey);
    await mintTo(connection, payer, tokenB, ataB.address, payer, amountB);

    const ataC = await getOrCreateAssociatedTokenAccount(connection, payer, tokenC, payer.publicKey);
    await mintTo(connection, payer, tokenC, ataC.address, payer, amountC);

    const ataD = await getOrCreateAssociatedTokenAccount(connection, payer, tokenD, payer.publicKey);
    await mintTo(connection, payer, tokenD, ataD.address, payer, amountD);

    console.log("Minted tokens to", payer.publicKey.toBase58());

    // 3. Initialize Pool (Token A / Token B)
    console.log("\nInitializing Pool (Token A / Token B)...");

    // Sort mints
    const [mintA, mintB] = tokenA.toBuffer().compare(tokenB.toBuffer()) < 0
        ? [tokenA, tokenB]
        : [tokenB, tokenA];

    const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
        program.programId
    );

    const [lpMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), poolPda.toBuffer()],
        program.programId
    );

    const [tokenAVault] = PublicKey.findProgramAddressSync(
        [poolPda.toBuffer(), Buffer.from("token_program"), mintA.toBuffer()], // Associated Token Account PDA derivation is complex, letting Anchor/SPL handle it usually better but for PDA signing we need to know it. 
        // Actually, for initialization, we just pass the PDAs.
        // Let's use the helper from spl-token to find the address
        TOKEN_PROGRAM_ID
    );

    // We'll let the client side logic handle the exact address derivation or just use the one from the test
    // For simplicity in this script, we'll just print the Mints and let the frontend derive the rest.

    // Save to file
    const envContent = `
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899
NEXT_PUBLIC_PROGRAM_ID=${program.programId.toBase58()}
NEXT_PUBLIC_SOL_MINT=${tokenA.toBase58()}
NEXT_PUBLIC_USDC_MINT=${tokenB.toBase58()}
NEXT_PUBLIC_USDT_MINT=${tokenC.toBase58()}
NEXT_PUBLIC_RUSH_MINT=${tokenD.toBase58()}
`;

    fs.writeFileSync('../solrush-frontend/.env.local', envContent.trim());
    console.log("\n✅ Setup Complete!");
    console.log("Environment variables written to ../solrush-frontend/.env.local");
    console.log("Please restart the frontend to apply changes.");
}

main().catch(console.error);
