/**
 * Setup Perps on Localnet
 *
 * Initializes the perps infrastructure on localnet:
 * 1. Initialize global perps state
 * 2. Create a custom oracle with initial SOL price
 * 3. Create the SOL/USDC perps market
 * 4. Print outputs for .env.local / frontend usage
 *
 * Prerequisites:
 *   - solana-test-validator running
 *   - Program deployed (anchor deploy)
 *   - Token mints already created (run setup-localnet.ts first)
 *
 * Run: npx ts-node scripts/setup-perps-localnet.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ── Configuration ───────────────────────────────────
const LOCALNET_URL = "http://127.0.0.1:8899";

// SOL initial oracle price: $150 → 150_000_000 in PRICE_SCALE (1e6)
const SOL_PRICE_SCALED = 150_000_000;

// Market parameters
const MAX_LEVERAGE = 20;
const MAINTENANCE_MARGIN_BPS = 500; // 5%
const FEE_BPS = 10; // 0.1%

// Collateral to mint & deposit for test user
const USDC_MINT_AMOUNT = 100_000 * 1_000_000; // 100k USDC (6 decimals)
const INITIAL_DEPOSIT = 10_000 * 1_000_000; // 10k USDC deposit into vault

// ── PDA helpers (same seeds as on-chain) ────────────
function findPerpsGlobalPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("perps_global")],
    programId
  );
}

function findPerpsOraclePda(admin: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("perps_oracle"), admin.toBuffer()],
    programId
  );
}

function findPerpsMarketPda(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("perps_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
    programId
  );
}

function findPerpsUserPda(owner: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("perps_user"), owner.toBuffer()],
    programId
  );
}

// ── Main ────────────────────────────────────────────
async function main() {
  console.log("🔧 Setting up Perps on Localnet...\n");

  // Connect
  const connection = new Connection(LOCALNET_URL, "confirmed");

  // Load wallet
  const walletPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet keypair not found at ${walletPath}`);
  }
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("  Admin wallet:", admin.publicKey.toBase58());

  // Airdrop SOL if needed
  const balance = await connection.getBalance(admin.publicKey);
  if (balance < 5 * 1_000_000_000) {
    console.log("  Airdropping 10 SOL...");
    const sig = await connection.requestAirdrop(admin.publicKey, 10 * 1_000_000_000);
    await connection.confirmTransaction(sig, "confirmed");
  }

  // Setup Anchor provider
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.resolve(__dirname, "../target/idl/solrush_dex.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' first.`);
  }
  const rawIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(rawIdl.address);
  const program = new Program(rawIdl, provider);

  console.log("  Program ID:", programId.toBase58());

  // ── Step 1: Create SOL-like base mint & USDC quote mint ──────
  // Read existing mints from env or create fresh ones
  let baseMint: PublicKey;
  let quoteMint: PublicKey;

  const envPath = path.resolve(__dirname, "../../solrush-frontend/.env.local");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Try to use existing USDC mint from env
  const usdcMatch = envContent.match(/NEXT_PUBLIC_USDC_MINT=(\S+)/);
  if (usdcMatch) {
    quoteMint = new PublicKey(usdcMatch[1]);
    console.log("  Using existing USDC mint:", quoteMint.toBase58());
  } else {
    console.log("  Creating new USDC mock mint...");
    quoteMint = await createMint(connection, admin, admin.publicKey, null, 6);
    console.log("  USDC mint:", quoteMint.toBase58());
  }

  // Create a dedicated base mint for the perps market (SOL-like, 9 decimals)
  console.log("  Creating SOL-like base mint for perps market...");
  baseMint = await createMint(connection, admin, admin.publicKey, null, 9);
  console.log("  Base mint:", baseMint.toBase58());

  // ── Step 2: Mint USDC to admin's ATA ────────────────────────
  console.log("\n📦 Minting USDC to admin wallet...");
  const adminAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    quoteMint,
    admin.publicKey
  );
  await mintTo(connection, admin, quoteMint, adminAta.address, admin, USDC_MINT_AMOUNT);
  console.log(`  Minted ${USDC_MINT_AMOUNT / 1_000_000} USDC to ${adminAta.address.toBase58()}`);

  // ── Step 3: Initialize Perps Global ─────────────────────────
  const [globalPda] = findPerpsGlobalPda(programId);
  console.log("\n⚙️  Initializing Perps Global State...");

  const globalInfo = await connection.getAccountInfo(globalPda);
  if (globalInfo) {
    console.log("  Global state already exists, skipping.");
  } else {
    await program.methods
      .initializePerpsGlobal(FEE_BPS)
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log("  ✅ Global PDA:", globalPda.toBase58());
  }

  // ── Step 4: Initialize Oracle ───────────────────────────────
  const [oraclePda] = findPerpsOraclePda(admin.publicKey, programId);
  console.log("\n🔮 Initializing Oracle (SOL price = $150)...");

  const oracleInfo = await connection.getAccountInfo(oraclePda);
  if (oracleInfo) {
    console.log("  Oracle already exists, updating price...");
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(SOL_PRICE_SCALED))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      } as any)
      .rpc();
    console.log("  ✅ Oracle price updated");
  } else {
    await program.methods
      .initializePerpsOracle(new anchor.BN(SOL_PRICE_SCALED))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log("  ✅ Oracle PDA:", oraclePda.toBase58());
  }

  // ── Step 5: Create SOL/USDC Perps Market ────────────────────
  const [marketPda] = findPerpsMarketPda(baseMint, quoteMint, programId);
  const collateralVault = Keypair.generate();
  console.log("\n📊 Creating SOL/USDC Perps Market...");

  const marketInfo = await connection.getAccountInfo(marketPda);
  if (marketInfo) {
    console.log("  Market already exists, skipping.");
  } else {
    const pythFeedId = Array(32).fill(0); // Zero = use custom oracle
    await program.methods
      .createPerpsMarket(pythFeedId, MAX_LEVERAGE, MAINTENANCE_MARGIN_BPS)
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        baseMint: baseMint,
        quoteMint: quoteMint,
        oraclePriceAccount: oraclePda,
        market: marketPda,
        collateralVault: collateralVault.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([collateralVault])
      .rpc();
    console.log("  ✅ Market PDA:", marketPda.toBase58());
    console.log("  ✅ Collateral Vault:", collateralVault.publicKey.toBase58());
  }

  // ── Step 6: Initialize Perps User ──────────────────────────
  const [userPda] = findPerpsUserPda(admin.publicKey, programId);
  console.log("\n👤 Initializing Perps User Account...");

  const userInfo = await connection.getAccountInfo(userPda);
  if (userInfo) {
    console.log("  User account already exists, skipping.");
  } else {
    await program.methods
      .initializePerpsUser()
      .accounts({
        owner: admin.publicKey,
        user: userPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log("  ✅ User PDA:", userPda.toBase58());
  }

  // ── Step 7: Deposit Collateral ─────────────────────────────
  console.log("\n💰 Depositing collateral...");
  await program.methods
    .depositPerpsCollateral(new anchor.BN(INITIAL_DEPOSIT))
    .accounts({
      owner: admin.publicKey,
      global: globalPda,
      user: userPda,
      market: marketPda,
      userQuoteAta: adminAta.address,
      collateralVault: collateralVault.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
  console.log(`  ✅ Deposited ${INITIAL_DEPOSIT / 1_000_000} USDC as collateral`);

  // ── Summary ────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  PERPS LOCALNET SETUP COMPLETE!");
  console.log("═".repeat(60));
  console.log(`  Program ID:       ${programId.toBase58()}`);
  console.log(`  Global PDA:       ${globalPda.toBase58()}`);
  console.log(`  Oracle PDA:       ${oraclePda.toBase58()}`);
  console.log(`  Market PDA:       ${marketPda.toBase58()}`);
  console.log(`  User PDA:         ${userPda.toBase58()}`);
  console.log(`  Base Mint (SOL):  ${baseMint.toBase58()}`);
  console.log(`  Quote Mint (USDC):${quoteMint.toBase58()}`);
  console.log(`  Collateral Vault: ${collateralVault.publicKey.toBase58()}`);
  console.log(`  Oracle Price:     $${SOL_PRICE_SCALED / 1_000_000}`);
  console.log(`  Max Leverage:     ${MAX_LEVERAGE}x`);
  console.log(`  Maint. Margin:    ${MAINTENANCE_MARGIN_BPS / 100}%`);
  console.log("");
  console.log("  To disable mock mode, update .env.local:");
  console.log("    NEXT_PUBLIC_USE_MOCK_PERPS=false");
  console.log("═".repeat(60));

  // Save market info for frontend
  const perpsConfig = {
    programId: programId.toBase58(),
    globalPda: globalPda.toBase58(),
    oraclePda: oraclePda.toBase58(),
    marketPda: marketPda.toBase58(),
    baseMint: baseMint.toBase58(),
    quoteMint: quoteMint.toBase58(),
    collateralVault: collateralVault.publicKey.toBase58(),
    oraclePrice: SOL_PRICE_SCALED,
    maxLeverage: MAX_LEVERAGE,
    maintenanceMarginBps: MAINTENANCE_MARGIN_BPS,
  };

  const configPath = path.resolve(__dirname, "../perps-localnet-config.json");
  fs.writeFileSync(configPath, JSON.stringify(perpsConfig, null, 2));
  console.log(`\n  Config saved to ${configPath}`);
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
