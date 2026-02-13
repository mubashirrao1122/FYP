/**
 * PDA cross-verification test
 *
 * Derives every perps PDA using the shared helpers in target/types/pda.ts and
 * confirms they match the addresses Anchor would produce from the on-chain
 * seed definitions. This guarantees the frontend and program agree.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  findPerpsGlobalAddress,
  findPerpsOracleAddress,
  findPerpsMarketAddress,
  findPerpsUserAddress,
  findPerpsPositionAddress,
  findPoolAddress,
  findLpMintAddress,
  findPositionAddress,
  findRushConfigAddress,
  findLimitOrderAddress,
} from "../target/types/pda";

describe("PDA cross-verification", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolrushDex as Program;
  const programId = program.programId;

  // Deterministic sample keys for testing
  const admin = provider.wallet.publicKey;
  const sampleBaseMint = new PublicKey(
    "4K4BTsa8jfwwF8UpJoftuhPKQbM5g8d3PqB7wytuEK8a"
  );
  const sampleQuoteMint = new PublicKey(
    "CnBcjXBqAVrJDh9BUsAxfVpprWyU6MoD7Kcq13qYUhzn"
  );
  const sampleUser = new PublicKey(
    "11111111111111111111111111111112"
  );

  // ── Perps PDAs ─────────────────────────────

  it("perps_global PDA matches raw derivation", () => {
    const [fromHelper, bump] = findPerpsGlobalAddress(programId);
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("perps_global")],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("perps_market PDA matches raw derivation", () => {
    const [fromHelper, bump] = findPerpsMarketAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("perps_market"),
        sampleBaseMint.toBuffer(),
        sampleQuoteMint.toBuffer(),
      ],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("perps_oracle PDA matches raw derivation", () => {
    const [fromHelper, bump] = findPerpsOracleAddress(admin, programId);
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("perps_oracle"), admin.toBuffer()],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("perps_user PDA matches raw derivation", () => {
    const [fromHelper, bump] = findPerpsUserAddress(sampleUser, programId);
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("perps_user"), sampleUser.toBuffer()],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("perps_position PDA matches raw derivation", () => {
    // First derive the market PDA, then the position using it
    const [marketPda] = findPerpsMarketAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const [fromHelper, bump] = findPerpsPositionAddress(
      sampleUser,
      marketPda,
      programId
    );
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("perps_position"),
        sampleUser.toBuffer(),
        marketPda.toBuffer(),
      ],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("perps_position PDA is deterministic across calls", () => {
    const [marketPda] = findPerpsMarketAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const [a] = findPerpsPositionAddress(admin, marketPda, programId);
    const [b] = findPerpsPositionAddress(admin, marketPda, programId);
    expect(a.toBase58()).to.equal(b.toBase58());
  });

  // ── AMM / Pool PDAs ───────────────────────

  it("pool PDA matches raw derivation (canonical mint sort)", () => {
    const [fromHelper, bump] = findPoolAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    // Manually sort
    const [sortedA, sortedB] =
      sampleBaseMint.toBuffer().compare(sampleQuoteMint.toBuffer()) < 0
        ? [sampleBaseMint, sampleQuoteMint]
        : [sampleQuoteMint, sampleBaseMint];
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), sortedA.toBuffer(), sortedB.toBuffer()],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("pool PDA is the same regardless of mint order", () => {
    const [a] = findPoolAddress(sampleBaseMint, sampleQuoteMint, programId);
    const [b] = findPoolAddress(sampleQuoteMint, sampleBaseMint, programId);
    expect(a.toBase58()).to.equal(b.toBase58());
  });

  it("lp_mint PDA matches raw derivation", () => {
    const [poolPda] = findPoolAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const [fromHelper, bump] = findLpMintAddress(poolPda, programId);
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), poolPda.toBuffer()],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("user lp position PDA matches raw derivation", () => {
    const [poolPda] = findPoolAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const [fromHelper, bump] = findPositionAddress(
      poolPda,
      sampleUser,
      programId
    );
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), poolPda.toBuffer(), sampleUser.toBuffer()],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("rush_config PDA matches raw derivation", () => {
    const [fromHelper, bump] = findRushConfigAddress(programId);
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("rush_config")],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });

  it("limit_order PDA matches raw derivation", () => {
    const [poolPda] = findPoolAddress(
      sampleBaseMint,
      sampleQuoteMint,
      programId
    );
    const orderId = 42;
    const [fromHelper, bump] = findLimitOrderAddress(
      poolPda,
      sampleUser,
      orderId,
      programId
    );

    const orderIdBuffer = Buffer.alloc(8);
    orderIdBuffer.writeBigUInt64LE(BigInt(orderId));
    const [fromRaw, rawBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("limit_order"),
        poolPda.toBuffer(),
        sampleUser.toBuffer(),
        orderIdBuffer,
      ],
      programId
    );
    expect(fromHelper.toBase58()).to.equal(fromRaw.toBase58());
    expect(bump).to.equal(rawBump);
  });
});
