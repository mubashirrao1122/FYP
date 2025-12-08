/**
 * Setup Localnet Script
 * 
 * This script sets up a local Solana environment with:
 * 1. Token mints for USDC, USDT, WETH (SOL is native)
 * 2. Mint tokens to the user wallet
 * 3. Initialize liquidity pools
 * 
 * Run: npx ts-node scripts/setup-localnet.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    LAMPORTS_PER_SOL,
    SystemProgram 
} from "@solana/web3.js";
import {
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Configuration
const LOCALNET_URL = "http://127.0.0.1:8899";
const TOKEN_DECIMALS = {
    USDC: 6,
    USDT: 6,
    WETH: 8,
    RUSH: 6,
};

// Mint amounts for testing
const MINT_AMOUNTS = {
    USDC: 1_000_000 * 10 ** TOKEN_DECIMALS.USDC,  // 1M USDC
    USDT: 1_000_000 * 10 ** TOKEN_DECIMALS.USDT,  // 1M USDT
    WETH: 100 * 10 ** TOKEN_DECIMALS.WETH,         // 100 WETH
    RUSH: 10_000_000 * 10 ** TOKEN_DECIMALS.RUSH,  // 10M RUSH
    SOL: 100 * LAMPORTS_PER_SOL,                   // 100 SOL
};

interface TokenMints {
    USDC: PublicKey;
    USDT: PublicKey;
    WETH: PublicKey;
    RUSH: PublicKey;
}

interface SetupResult {
    mints: TokenMints;
    userTokenAccounts: Record<string, PublicKey>;
    wallet: Keypair;
}

async function loadWallet(): Promise<Keypair> {
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    try {
        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
        return Keypair.fromSecretKey(Uint8Array.from(walletData));
    } catch (error) {
        console.log("Creating new wallet...");
        const newWallet = Keypair.generate();
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(newWallet.secretKey)));
        return newWallet;
    }
}

async function airdropSol(connection: Connection, wallet: PublicKey, amount: number): Promise<void> {
    console.log(`\n💰 Airdropping ${amount / LAMPORTS_PER_SOL} SOL to ${wallet.toBase58()}`);
    
    try {
        const signature = await connection.requestAirdrop(wallet, amount);
        await connection.confirmTransaction(signature, "confirmed");
        console.log(`✅ Airdrop successful!`);
    } catch (error) {
        console.log(`⚠️ Airdrop failed (might have enough SOL already):`, error);
    }
}

async function createTokenMint(
    connection: Connection,
    payer: Keypair,
    decimals: number,
    tokenName: string
): Promise<PublicKey> {
    console.log(`\n🪙 Creating ${tokenName} mint with ${decimals} decimals...`);
    
    const mint = await createMint(
        connection,
        payer,
        payer.publicKey, // mint authority
        payer.publicKey, // freeze authority
        decimals
    );
    
    console.log(`✅ ${tokenName} Mint: ${mint.toBase58()}`);
    return mint;
}

async function mintTokensToUser(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    userWallet: PublicKey,
    amount: number,
    tokenName: string
): Promise<PublicKey> {
    console.log(`\n🎁 Minting ${tokenName} to user...`);
    
    // Get or create associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        userWallet
    );
    
    // Mint tokens
    await mintTo(
        connection,
        payer,
        mint,
        tokenAccount.address,
        payer, // mint authority
        amount
    );
    
    console.log(`✅ Minted ${amount} ${tokenName} to ${tokenAccount.address.toBase58()}`);
    return tokenAccount.address;
}

async function setupLocalnet(): Promise<SetupResult> {
    console.log("🚀 Setting up SOLRUSH DEX on Localnet\n");
    console.log("=".repeat(60));
    
    // Connect to localnet
    const connection = new Connection(LOCALNET_URL, "confirmed");
    console.log(`📡 Connected to: ${LOCALNET_URL}`);
    
    // Load or create wallet
    const wallet = await loadWallet();
    console.log(`👛 Wallet: ${wallet.publicKey.toBase58()}`);
    
    // Airdrop SOL for transaction fees and testing
    await airdropSol(connection, wallet.publicKey, MINT_AMOUNTS.SOL);
    
    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💵 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    // Create token mints
    console.log("\n" + "=".repeat(60));
    console.log("Creating Token Mints...");
    console.log("=".repeat(60));
    
    const usdcMint = await createTokenMint(connection, wallet, TOKEN_DECIMALS.USDC, "USDC");
    const usdtMint = await createTokenMint(connection, wallet, TOKEN_DECIMALS.USDT, "USDT");
    const wethMint = await createTokenMint(connection, wallet, TOKEN_DECIMALS.WETH, "WETH");
    const rushMint = await createTokenMint(connection, wallet, TOKEN_DECIMALS.RUSH, "RUSH");
    
    const mints: TokenMints = {
        USDC: usdcMint,
        USDT: usdtMint,
        WETH: wethMint,
        RUSH: rushMint,
    };
    
    // Mint tokens to user wallet
    console.log("\n" + "=".repeat(60));
    console.log("Minting Tokens to User...");
    console.log("=".repeat(60));
    
    const userTokenAccounts: Record<string, PublicKey> = {};
    
    userTokenAccounts.USDC = await mintTokensToUser(
        connection, wallet, usdcMint, wallet.publicKey, MINT_AMOUNTS.USDC, "USDC"
    );
    userTokenAccounts.USDT = await mintTokensToUser(
        connection, wallet, usdtMint, wallet.publicKey, MINT_AMOUNTS.USDT, "USDT"
    );
    userTokenAccounts.WETH = await mintTokensToUser(
        connection, wallet, wethMint, wallet.publicKey, MINT_AMOUNTS.WETH, "WETH"
    );
    userTokenAccounts.RUSH = await mintTokensToUser(
        connection, wallet, rushMint, wallet.publicKey, MINT_AMOUNTS.RUSH, "RUSH"
    );
    
    // Save configuration for frontend
    const configPath = path.join(__dirname, "..", "..", "localnet-config.json");
    const config = {
        network: "localnet",
        rpcUrl: LOCALNET_URL,
        walletPublicKey: wallet.publicKey.toBase58(),
        mints: {
            USDC: usdcMint.toBase58(),
            USDT: usdtMint.toBase58(),
            WETH: wethMint.toBase58(),
            RUSH: rushMint.toBase58(),
            SOL: "So11111111111111111111111111111111111111112",
        },
        tokenAccounts: {
            USDC: userTokenAccounts.USDC.toBase58(),
            USDT: userTokenAccounts.USDT.toBase58(),
            WETH: userTokenAccounts.WETH.toBase58(),
            RUSH: userTokenAccounts.RUSH.toBase58(),
        },
        decimals: TOKEN_DECIMALS,
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n📝 Configuration saved to: ${configPath}`);
    
    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ SETUP COMPLETE!");
    console.log("=".repeat(60));
    console.log("\nToken Mints:");
    console.log(`  USDC: ${usdcMint.toBase58()}`);
    console.log(`  USDT: ${usdtMint.toBase58()}`);
    console.log(`  WETH: ${wethMint.toBase58()}`);
    console.log(`  RUSH: ${rushMint.toBase58()}`);
    console.log(`  SOL:  So11111111111111111111111111111111111111112 (native)`);
    
    console.log("\n📋 Next Steps:");
    console.log("1. Build the program: anchor build");
    console.log("2. Deploy to localnet: anchor deploy");
    console.log("3. Update frontend .env.local with mint addresses");
    console.log("4. Run frontend: npm run dev");
    
    return { mints, userTokenAccounts, wallet };
}

// Run setup
setupLocalnet()
    .then((result) => {
        console.log("\n🎉 Localnet setup completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Setup failed:", error);
        process.exit(1);
    });
