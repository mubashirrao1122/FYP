/**
 * Initialize RUSH Rewards System on Localnet
 *
 * 1. Calls initializeRushToken → creates RushConfig PDA + new RUSH mint (authority = PDA)
 * 2. Calls updateRushApy(200) → 200% APY so numbers move fast during demo
 * 3. Saves new RUSH rewards mint into localnet-config.json
 *
 * NOTE: In production, rewards accrue per-second at a sustainable rate.
 * For this demo, we set a high reward rate so evaluators can see real-time
 * accrual of the RUSH utility token.
 */

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const LOCALNET_URL = "http://127.0.0.1:8899";
const DEMO_APY = 200; // 200% APY — high for demo visibility

function findRushConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rush_config")],
    programId
  );
}

async function main() {
  console.log("⚙️  Initializing RUSH Rewards System...\n");

  // ── Connection & wallet ──
  const connection = new Connection(LOCALNET_URL, "confirmed");
  const walletPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // ── Load program from IDL ──
  const idlPath = path.resolve(__dirname, "../target/idl/solrush_dex.json");
  const rawIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(rawIdl.address);
  const program = new Program(rawIdl, provider);

  // ── Config file ──
  const configPath = path.resolve(__dirname, "../../localnet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // ── Derive RushConfig PDA ──
  const [rushConfigPda] = findRushConfigPda(programId);
  console.log("  RushConfig PDA:", rushConfigPda.toBase58());

  // ── Check if already initialized ──
  const existingAccount = await connection.getAccountInfo(rushConfigPda);
  let rushMintPubkey: PublicKey;

  if (existingAccount) {
    console.log("  ✅ RushConfig already exists — skipping initializeRushToken");
    const rushConfig = await (program.account as any).rushConfig.fetch(
      rushConfigPda
    );
    rushMintPubkey = rushConfig.mint as PublicKey;
    console.log("  Existing RUSH Mint:", rushMintPubkey.toBase58());
  } else {
    // ── Generate a fresh Keypair for the RUSH reward mint ──
    const rushMintKeypair = Keypair.generate();
    rushMintPubkey = rushMintKeypair.publicKey;
    console.log("  New RUSH Rewards Mint:", rushMintPubkey.toBase58());

    // ── Call initializeRushToken ──
    const txInit = await program.methods
      .initializeRushToken()
      .accounts({
        rushMint: rushMintKeypair.publicKey,
        authority: admin.publicKey,
      } as any)
      .signers([rushMintKeypair])
      .rpc();

    console.log("  ✅ initializeRushToken tx:", txInit);

    // Verify
    const rushConfig = await (program.account as any).rushConfig.fetch(
      rushConfigPda
    );
    console.log(
      "  Total Supply:",
      (rushConfig.totalSupply as BN).toString(),
      "base units"
    );
    console.log("  Default APY:", (rushConfig.apyNumerator as BN).toString() + "%");
    console.log(
      "  Rewards/sec:",
      (rushConfig.rewardsPerSecond as BN).toString(),
      "base units"
    );
  }

  // ── Boost APY for demo ──
  console.log(`\n  Setting APY to ${DEMO_APY}% for demo visibility...`);
  try {
    const txApy = await program.methods
      .updateRushApy(new BN(DEMO_APY))
      .accounts({
        rushConfig: rushConfigPda,
        authority: admin.publicKey,
      } as any)
      .rpc();

    console.log("  ✅ updateRushApy tx:", txApy);

    const updatedConfig = await (program.account as any).rushConfig.fetch(
      rushConfigPda
    );
    const rps = (updatedConfig.rewardsPerSecond as BN).toNumber();
    const rushPerSec = rps / 1_000_000;
    console.log(`  New rewards rate: ~${rushPerSec.toFixed(2)} RUSH/sec`);
    console.log(
      `  At 100% pool share → ~${(rushPerSec * 60).toFixed(1)} RUSH/min`
    );
  } catch (err: any) {
    console.error("  ⚠️  updateRushApy failed:", err.message);
  }

  // ── Update localnet-config.json ──
  config.mints.RUSH = rushMintPubkey.toBase58();
  config.rushConfig = rushConfigPda.toBase58();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("\n  ✅ Updated localnet-config.json:");
  console.log("     mints.RUSH =", config.mints.RUSH);
  console.log("     rushConfig  =", config.rushConfig);

  console.log("\n🎉 RUSH Rewards System is live!");
  console.log(
    "   NOTE: For demo, reward rate is set to " +
      DEMO_APY +
      "% APY so numbers move visibly."
  );
  console.log(
    '   In production, rewards accrue at a sustainable rate with epoch-based halving.\n'
  );
}

main().catch((err) => {
  console.error("❌ init-rewards failed:", err);
  process.exit(1);
});
