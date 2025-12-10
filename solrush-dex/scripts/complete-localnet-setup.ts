/**
 * Complete Localnet Setup Script
 * 
 * This script performs a complete setup for local development:
 * 1. Airdrops SOL to the target wallet
 * 2. Creates token mints (USDC, USDT, WETH, RUSH, SOL wrapped)
 * 3. Mints tokens to the target wallet
 * 4. Saves configuration for frontend use
 * 
 * Run: npx ts-node scripts/complete-localnet-setup.ts
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Configuration
const LOCALNET_URL = "http://127.0.0.1:8899";

// Target wallet to fund (from user request)
const TARGET_WALLET = "8Qmx5CZtR22YRKvjXkCgfMXfg5n9BHMmJmwCAno4cxrf";

// Token decimals
const TOKEN_DECIMALS = {
    SOL: 9,
    USDC: 6,
    USDT: 6,
    WETH: 8,
    RUSH: 6,
};

// Mint amounts for testing
const MINT_AMOUNTS = {
    USDC: 1_000_000,  // 1M USDC
    USDT: 1_000_000,  // 1M USDT
    WETH: 100,        // 100 WETH
    RUSH: 10_000_000, // 10M RUSH
    SOL: 1000,        // 1000 SOL
};

interface TokenMints {
    SOL: PublicKey;
    USDC: PublicKey;
    USDT: PublicKey;
    WETH: PublicKey;
    RUSH: PublicKey;
}

async function loadOrCreateMintAuthority(): Promise<Keypair> {
    const walletPath = process.env.HOME + "/.config/solana/id.json";
    try {
        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
        return Keypair.fromSecretKey(Uint8Array.from(walletData));
    } catch (error) {
        console.log("⚠️ No wallet found at ~/.config/solana/id.json");
        console.log("Creating new mint authority keypair...");
        const newWallet = Keypair.generate();
        
        // Ensure directory exists
        const dir = path.dirname(walletPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(newWallet.secretKey)));
        return newWallet;
    }
}

async function airdropSol(
    connection: Connection,
    wallet: PublicKey,
    amount: number,
    maxRetries: number = 5
): Promise<void> {
    console.log(`\n💰 Airdropping ${amount} SOL to ${wallet.toBase58()}`);

    for (let i = 0; i < maxRetries; i++) {
        try {
            const signature = await connection.requestAirdrop(
                wallet,
                amount * LAMPORTS_PER_SOL
            );
            await connection.confirmTransaction(signature, "confirmed");
            console.log(`✅ Airdrop successful! Signature: ${signature.slice(0, 20)}...`);
            return;
        } catch (error: any) {
            if (i < maxRetries - 1) {
                console.log(`   Retry ${i + 1}/${maxRetries}...`);
                await new Promise((r) => setTimeout(r, 2000));
            } else {
                throw error;
            }
        }
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

async function mintTokensToWallet(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    targetWallet: PublicKey,
    amount: number,
    decimals: number,
    tokenName: string
): Promise<PublicKey> {
    console.log(`\n🎁 Minting ${amount.toLocaleString()} ${tokenName} to ${targetWallet.toBase58().slice(0, 8)}...`);

    // Get or create associated token account for target wallet
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        targetWallet
    );

    // Calculate raw amount with decimals
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    // Mint tokens
    await mintTo(
        connection,
        payer,
        mint,
        tokenAccount.address,
        payer, // mint authority
        rawAmount
    );

    console.log(`✅ Minted to: ${tokenAccount.address.toBase58()}`);
    return tokenAccount.address;
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║           SOLRUSH DEX - Complete Localnet Setup              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Connect to localnet
    const connection = new Connection(LOCALNET_URL, "confirmed");
    console.log(`📡 Connecting to: ${LOCALNET_URL}`);

    // Check if validator is running
    try {
        const version = await connection.getVersion();
        console.log(`✅ Validator version: ${version["solana-core"]}`);
    } catch (error) {
        console.error("\n❌ ERROR: Cannot connect to local validator!");
        console.error("   Please start the validator first:");
        console.error("   $ solana-test-validator");
        process.exit(1);
    }

    // Load or create mint authority
    const mintAuthority = await loadOrCreateMintAuthority();
    console.log(`\n👛 Mint Authority: ${mintAuthority.publicKey.toBase58()}`);

    // Target wallet
    const targetWallet = new PublicKey(TARGET_WALLET);
    console.log(`🎯 Target Wallet: ${targetWallet.toBase58()}`);

    // ========================================
    // Step 1: Airdrop SOL to both wallets
    // ========================================
    console.log("\n" + "═".repeat(60));
    console.log("Step 1: Airdropping SOL...");
    console.log("═".repeat(60));

    // Airdrop to mint authority first (for transaction fees)
    await airdropSol(connection, mintAuthority.publicKey, 100);

    // Airdrop to target wallet
    await airdropSol(connection, targetWallet, MINT_AMOUNTS.SOL);

    // Check balances
    const mintAuthorityBalance = await connection.getBalance(mintAuthority.publicKey);
    const targetBalance = await connection.getBalance(targetWallet);
    console.log(`\n💵 Mint Authority balance: ${mintAuthorityBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💵 Target wallet balance: ${targetBalance / LAMPORTS_PER_SOL} SOL`);

    // ========================================
    // Step 2: Create Token Mints
    // ========================================
    console.log("\n" + "═".repeat(60));
    console.log("Step 2: Creating Token Mints...");
    console.log("═".repeat(60));

    const usdcMint = await createTokenMint(
        connection,
        mintAuthority,
        TOKEN_DECIMALS.USDC,
        "USDC"
    );
    const usdtMint = await createTokenMint(
        connection,
        mintAuthority,
        TOKEN_DECIMALS.USDT,
        "USDT"
    );
    const wethMint = await createTokenMint(
        connection,
        mintAuthority,
        TOKEN_DECIMALS.WETH,
        "WETH"
    );
    const rushMint = await createTokenMint(
        connection,
        mintAuthority,
        TOKEN_DECIMALS.RUSH,
        "RUSH"
    );

    // Create wrapped SOL mint for consistency (though native SOL is used)
    const solMint = await createTokenMint(
        connection,
        mintAuthority,
        TOKEN_DECIMALS.SOL,
        "wSOL"
    );

    const mints: TokenMints = {
        SOL: solMint,
        USDC: usdcMint,
        USDT: usdtMint,
        WETH: wethMint,
        RUSH: rushMint,
    };

    // ========================================
    // Step 3: Mint Tokens to Target Wallet
    // ========================================
    console.log("\n" + "═".repeat(60));
    console.log("Step 3: Minting Tokens to Target Wallet...");
    console.log("═".repeat(60));

    const tokenAccounts: Record<string, PublicKey> = {};

    tokenAccounts.SOL = await mintTokensToWallet(
        connection,
        mintAuthority,
        solMint,
        targetWallet,
        MINT_AMOUNTS.SOL,
        TOKEN_DECIMALS.SOL,
        "wSOL"
    );

    tokenAccounts.USDC = await mintTokensToWallet(
        connection,
        mintAuthority,
        usdcMint,
        targetWallet,
        MINT_AMOUNTS.USDC,
        TOKEN_DECIMALS.USDC,
        "USDC"
    );

    tokenAccounts.USDT = await mintTokensToWallet(
        connection,
        mintAuthority,
        usdtMint,
        targetWallet,
        MINT_AMOUNTS.USDT,
        TOKEN_DECIMALS.USDT,
        "USDT"
    );

    tokenAccounts.WETH = await mintTokensToWallet(
        connection,
        mintAuthority,
        wethMint,
        targetWallet,
        MINT_AMOUNTS.WETH,
        TOKEN_DECIMALS.WETH,
        "WETH"
    );

    tokenAccounts.RUSH = await mintTokensToWallet(
        connection,
        mintAuthority,
        rushMint,
        targetWallet,
        MINT_AMOUNTS.RUSH,
        TOKEN_DECIMALS.RUSH,
        "RUSH"
    );

    // ========================================
    // Step 4: Save Configuration
    // ========================================
    console.log("\n" + "═".repeat(60));
    console.log("Step 4: Saving Configuration...");
    console.log("═".repeat(60));

    const config = {
        network: "localnet",
        rpcUrl: LOCALNET_URL,
        targetWallet: TARGET_WALLET,
        mintAuthority: mintAuthority.publicKey.toBase58(),
        mints: {
            SOL: solMint.toBase58(),
            USDC: usdcMint.toBase58(),
            USDT: usdtMint.toBase58(),
            WETH: wethMint.toBase58(),
            RUSH: rushMint.toBase58(),
        },
        tokenAccounts: {
            SOL: tokenAccounts.SOL.toBase58(),
            USDC: tokenAccounts.USDC.toBase58(),
            USDT: tokenAccounts.USDT.toBase58(),
            WETH: tokenAccounts.WETH.toBase58(),
            RUSH: tokenAccounts.RUSH.toBase58(),
        },
        decimals: TOKEN_DECIMALS,
        mintedAmounts: MINT_AMOUNTS,
    };

    // Save to project root
    const configPath = path.join(__dirname, "..", "..", "localnet-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`📝 Configuration saved to: ${configPath}`);

    // Generate .env.local content for frontend
    const envContent = `# SolRush DEX - Localnet Configuration
# Generated on ${new Date().toISOString()}

NEXT_PUBLIC_NETWORK=localnet
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899

# Program ID (update after deployment)
NEXT_PUBLIC_PROGRAM_ID=FZ25GUwrX9W5PxBe5Ep8fR1F3HzoSeGH61YvW8sBA8J1

# Token Mints
NEXT_PUBLIC_SOL_MINT=${solMint.toBase58()}
NEXT_PUBLIC_USDC_MINT=${usdcMint.toBase58()}
NEXT_PUBLIC_USDT_MINT=${usdtMint.toBase58()}
NEXT_PUBLIC_WETH_MINT=${wethMint.toBase58()}
NEXT_PUBLIC_RUSH_MINT=${rushMint.toBase58()}
`;

    const envPath = path.join(__dirname, "..", "..", "solrush-frontend", ".env.local");
    fs.writeFileSync(envPath, envContent);
    console.log(`📝 Environment file saved to: ${envPath}`);

    // ========================================
    // Summary
    // ========================================
    console.log("\n" + "═".repeat(60));
    console.log("✅ SETUP COMPLETE!");
    console.log("═".repeat(60));

    console.log("\n📊 Token Mints:");
    console.log(`   SOL (wrapped):  ${solMint.toBase58()}`);
    console.log(`   USDC:           ${usdcMint.toBase58()}`);
    console.log(`   USDT:           ${usdtMint.toBase58()}`);
    console.log(`   WETH:           ${wethMint.toBase58()}`);
    console.log(`   RUSH:           ${rushMint.toBase58()}`);

    console.log("\n💰 Funded Wallet:");
    console.log(`   Address: ${TARGET_WALLET}`);
    console.log(`   SOL:     ${MINT_AMOUNTS.SOL.toLocaleString()}`);
    console.log(`   USDC:    ${MINT_AMOUNTS.USDC.toLocaleString()}`);
    console.log(`   USDT:    ${MINT_AMOUNTS.USDT.toLocaleString()}`);
    console.log(`   WETH:    ${MINT_AMOUNTS.WETH.toLocaleString()}`);
    console.log(`   RUSH:    ${MINT_AMOUNTS.RUSH.toLocaleString()}`);

    console.log("\n📋 Next Steps:");
    console.log("   1. Build the program: cd solrush-dex && anchor build");
    console.log("   2. Deploy to localnet: anchor deploy");
    console.log("   3. Start frontend: cd solrush-frontend && npm run dev");
    console.log("   4. Connect wallet in browser and switch to Localhost network");
    console.log("   5. Create pools, add liquidity, and start trading!");

    console.log("\n🔗 Resources:");
    console.log(`   Frontend: http://localhost:3000`);
    console.log(`   RPC: ${LOCALNET_URL}`);
}

main()
    .then(() => {
        console.log("\n🎉 All done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Setup failed:", error);
        process.exit(1);
    });
