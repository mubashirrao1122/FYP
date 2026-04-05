/**
 * Push a SOL price to the Mock Oracle on localnet.
 *
 * Usage:
 *   npx ts-node scripts/push-price.ts 145        # sets $145.00
 *   npx ts-node scripts/push-price.ts 152.37     # sets $152.37
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const LOCALNET_URL = "http://127.0.0.1:8899";
const PRICE_SCALE = 1_000_000; // 6 decimal fixed-point

function findPerpsGlobalPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("perps_global")], programId);
}

function findPerpsOraclePda(admin: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("perps_oracle"), admin.toBuffer()], programId);
}

async function main() {
  const priceArg = process.argv[2];
  if (!priceArg) {
    console.error("Usage: npx ts-node scripts/push-price.ts <price>");
    console.error("  e.g. npx ts-node scripts/push-price.ts 145");
    process.exit(1);
  }

  const priceFloat = parseFloat(priceArg);
  if (isNaN(priceFloat) || priceFloat <= 0) {
    console.error(`Invalid price: "${priceArg}". Must be a positive number.`);
    process.exit(1);
  }

  const priceScaled = Math.round(priceFloat * PRICE_SCALE);
  console.log(`💰 Pushing SOL price: $${priceFloat} (scaled: ${priceScaled})`);

  const connection = new Connection(LOCALNET_URL, "confirmed");

  const walletPath = path.resolve(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = path.resolve(__dirname, "../target/idl/solrush_dex.json");
  const rawIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(rawIdl.address);
  const program = new Program(rawIdl, provider);

  const [globalPda] = findPerpsGlobalPda(programId);
  const [oraclePda] = findPerpsOraclePda(admin.publicKey, programId);

  const oracleInfo = await connection.getAccountInfo(oraclePda);
  if (oracleInfo) {
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(priceScaled))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      } as any)
      .rpc();
    console.log(`  ✅ Oracle updated: $${priceFloat}`);
  } else {
    await program.methods
      .initializePerpsOracle(new anchor.BN(priceScaled))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`  ✅ Oracle initialized: $${priceFloat}`);
  }

  // Update localnet-config.json with the new price
  const configPath = path.resolve(__dirname, "../../localnet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!config.perps) config.perps = {};
    config.perps.oraclePrice = priceScaled;
    config.perps.oracle = oraclePda.toBase58();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

main().catch((err) => {
  console.error("❌ push-price failed:", err.message || err);
  process.exit(1);
});
