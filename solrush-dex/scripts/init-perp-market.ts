/**
 * Setup Perps Market for SOL/USDC on Localnet
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
const SOL_PRICE_SCALED = 145_000_000;  // $145.00 (6 decimal scaled)
const MAX_LEVERAGE = 20;                // 20x max leverage
const MAINTENANCE_MARGIN_BPS = 1000;    // 10% maintenance margin
const FEE_BPS = 10;                     // 0.1% trading fee

function findPerpsGlobalPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("perps_global")], programId);
}
function findPerpsOraclePda(admin: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("perps_oracle"), admin.toBuffer()], programId);
}
function findPerpsMarketPda(baseMint: PublicKey, quoteMint: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("perps_market"), baseMint.toBuffer(), quoteMint.toBuffer()], programId);
}

async function main() {
  console.log("⚙️ Initializing SOL/USDC Perp Market...");
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

  const configPath = path.resolve(__dirname, "../../localnet-config.json");
  const configInfo = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const baseMint = new PublicKey(configInfo.mints.SOL);
  const quoteMint = new PublicKey(configInfo.mints.USDC);

  console.log("  Base (SOL):", baseMint.toBase58());
  console.log("  Quote (USDC):", quoteMint.toBase58());

  const [globalPda] = findPerpsGlobalPda(programId);
  const globalInfo = await connection.getAccountInfo(globalPda);
  if (!globalInfo) {
    console.log("  Initializing Global State...");
    await program.methods.initializePerpsGlobal(FEE_BPS).accounts({
      admin: admin.publicKey,
      global: globalPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
  }

  const [oraclePda] = findPerpsOraclePda(admin.publicKey, programId);
  const oracleInfo = await connection.getAccountInfo(oraclePda);
  if (oracleInfo) {
    console.log("  Updating Mock Oracle Price...");
    await program.methods.setPerpsOraclePrice(new anchor.BN(SOL_PRICE_SCALED)).accounts({
      admin: admin.publicKey,
      global: globalPda,
      oracle: oraclePda,
    } as any).rpc();
  } else {
    console.log("  Initializing Mock Oracle...");
    await program.methods.initializePerpsOracle(new anchor.BN(SOL_PRICE_SCALED)).accounts({
      admin: admin.publicKey,
      global: globalPda,
      oracle: oraclePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
  }

  const [marketPda] = findPerpsMarketPda(baseMint, quoteMint, programId);
  const marketInfo = await connection.getAccountInfo(marketPda);
  if (!marketInfo) {
    const collateralVault = Keypair.generate();
    console.log("  Creating SOL/USDC Market...");
    const pythFeedId = Array(32).fill(0);
    await program.methods
      .createPerpsMarket(pythFeedId, MAX_LEVERAGE, MAINTENANCE_MARGIN_BPS, new BN(10_000), new BN(3600))
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
    console.log("  ✅ Market initialized:", marketPda.toBase58());
  } else {
    console.log("  Market already initialized:", marketPda.toBase58());
  }

  // Save perp addresses to localnet-config.json so the frontend can find them
  configInfo.perps = {
    globalState: globalPda.toBase58(),
    oracle: oraclePda.toBase58(),
    market: marketPda.toBase58(),
    oraclePrice: SOL_PRICE_SCALED,
    maxLeverage: MAX_LEVERAGE,
    maintenanceMarginBps: MAINTENANCE_MARGIN_BPS,
  };
  fs.writeFileSync(configPath, JSON.stringify(configInfo, null, 2));
  console.log("  ✅ Saved perp config to localnet-config.json");
}

main().catch(console.error);
