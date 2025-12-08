/**
 * Mint Tokens Script
 * 
 * Utility script to mint additional test tokens to any wallet
 * 
 * Usage:
 *   npx ts-node scripts/mint-tokens.ts <token> <amount> [wallet]
 *   
 * Examples:
 *   npx ts-node scripts/mint-tokens.ts USDC 10000
 *   npx ts-node scripts/mint-tokens.ts USDT 5000 <wallet-address>
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const LOCALNET_URL = "http://127.0.0.1:8899";

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

async function mintTokens(
    tokenSymbol: string,
    amount: number,
    recipientAddress?: string
): Promise<void> {
    console.log(`\n🪙 Minting ${amount} ${tokenSymbol}...\n`);

    const connection = new Connection(LOCALNET_URL, "confirmed");
    const config = await loadConfig();
    const wallet = await loadWallet();

    // Validate token
    const symbol = tokenSymbol.toUpperCase();
    if (symbol === "SOL") {
        // Airdrop SOL
        const recipient = recipientAddress
            ? new PublicKey(recipientAddress)
            : wallet.publicKey;
        
        console.log(`💰 Airdropping ${amount} SOL to ${recipient.toBase58()}`);
        const signature = await connection.requestAirdrop(
            recipient,
            amount * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature, "confirmed");
        console.log(`✅ Airdrop successful! Signature: ${signature}`);
        return;
    }

    if (!config.mints[symbol]) {
        throw new Error(
            `Unknown token: ${symbol}. Available: ${Object.keys(config.mints).join(", ")}`
        );
    }

    const mintAddress = new PublicKey(config.mints[symbol]);
    const decimals = config.decimals[symbol] || 6;
    const rawAmount = amount * 10 ** decimals;
    const recipient = recipientAddress
        ? new PublicKey(recipientAddress)
        : wallet.publicKey;

    console.log(`📋 Token: ${symbol}`);
    console.log(`📋 Mint: ${mintAddress.toBase58()}`);
    console.log(`📋 Recipient: ${recipient.toBase58()}`);
    console.log(`📋 Amount: ${amount} (${rawAmount} raw)`);

    // Get or create token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mintAddress,
        recipient
    );

    // Mint tokens
    const signature = await mintTo(
        connection,
        wallet,
        mintAddress,
        tokenAccount.address,
        wallet, // mint authority
        rawAmount
    );

    console.log(`\n✅ Minted ${amount} ${symbol}!`);
    console.log(`📍 Token Account: ${tokenAccount.address.toBase58()}`);
    console.log(`🔗 Signature: ${signature}`);
}

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log(`
Usage: npx ts-node scripts/mint-tokens.ts <token> <amount> [wallet]

Arguments:
  token   - Token symbol: SOL, USDC, USDT, WETH, RUSH
  amount  - Amount to mint (in human-readable format)
  wallet  - (Optional) Recipient wallet address

Examples:
  npx ts-node scripts/mint-tokens.ts USDC 10000
  npx ts-node scripts/mint-tokens.ts SOL 100
  npx ts-node scripts/mint-tokens.ts USDT 5000 <wallet-address>
`);
    process.exit(1);
}

const [token, amountStr, recipientWallet] = args;
const amount = parseFloat(amountStr);

if (isNaN(amount) || amount <= 0) {
    console.error("Invalid amount. Must be a positive number.");
    process.exit(1);
}

mintTokens(token, amount, recipientWallet)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error.message);
        process.exit(1);
    });
