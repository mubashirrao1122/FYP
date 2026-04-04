import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  findPerpsGlobalAddress,
  findPerpsOracleAddress,
  findPerpsMarketAddress,
  findPerpsUserAddress,
  findPerpsPositionAddress,
} from "../target/types/pda";

/**
 * Partial close tests.
 *
 * Validates:
 *  1. 25% close — position reduced proportionally, collateral returned
 *  2. 50% close — correct pnl realized, entry price preserved
 *  3. 100% close — full close via amount_base, position zeroed
 *  4. Over-close rejection — amount_base > abs(base_position)
 *  5. Short position partial close
 */
describe("partial-close", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolrushDex as Program;
  const admin = provider.wallet;

  const PRICE_SCALE = 1_000_000;

  let baseMint: anchor.web3.PublicKey;
  let quoteMint: anchor.web3.PublicKey;
  let collateralVault: anchor.web3.Keypair;

  let globalPda: anchor.web3.PublicKey;
  let oraclePda: anchor.web3.PublicKey;
  let marketPda: anchor.web3.PublicKey;
  let userPda: anchor.web3.PublicKey;
  let positionPda: anchor.web3.PublicKey;
  let userQuoteAta: anchor.web3.PublicKey;

  // ── Helpers ───────────────────────────────────────

  async function setPrice(price: number) {
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(price))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      })
      .rpc();
  }

  async function openPos(side: "long" | "short", size: number, leverage: number) {
    const sideArg = side === "long" ? { long: {} } : { short: {} };
    await program.methods
      .openPerpsPosition(sideArg, new anchor.BN(size), leverage, { market: {} })
      .accounts({
        owner: admin.publicKey,
        global: globalPda,
        user: userPda,
        market: marketPda,
        oraclePriceAccount: oraclePda,
        position: positionPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  }

  async function closePos(amountBase: number) {
    await program.methods
      .closePerpsPosition(new anchor.BN(amountBase))
      .accounts({
        owner: admin.publicKey,
        global: globalPda,
        user: userPda,
        market: marketPda,
        oraclePriceAccount: oraclePda,
        position: positionPda,
      })
      .rpc();
  }

  async function fetchPosition() {
    return program.account.perpsPosition.fetch(positionPda);
  }

  async function fetchUser() {
    return program.account.perpsUserAccount.fetch(userPda);
  }

  // ── Setup ─────────────────────────────────────────

  before(async () => {
    baseMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);
    quoteMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);

    [globalPda] = findPerpsGlobalAddress(program.programId);
    [oraclePda] = findPerpsOracleAddress(admin.publicKey, program.programId);
    [marketPda] = findPerpsMarketAddress(baseMint, quoteMint, program.programId);
    [userPda] = findPerpsUserAddress(admin.publicKey, program.programId);

    collateralVault = anchor.web3.Keypair.generate();

    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      quoteMint,
      admin.publicKey
    );
    userQuoteAta = ata.address;
    await mintTo(provider.connection, admin.payer, quoteMint, userQuoteAta, admin.publicKey, 50_000_000);

    // Initialize global (fee = 0 bps for clean math)
    await program.methods
      .initializePerpsGlobal(0)
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize oracle at $100
    await program.methods
      .initializePerpsOracle(new anchor.BN(100 * PRICE_SCALE))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Create market (max leverage = 10, maintenance margin = 500 bps = 5%)
    await program.methods
      .createPerpsMarket(Array(32).fill(0), 10, 500, new anchor.BN(10_000), new anchor.BN(3600))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        baseMint,
        quoteMint,
        oraclePriceAccount: oraclePda,
        market: marketPda,
        collateralVault: collateralVault.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([collateralVault])
      .rpc();

    [positionPda] = findPerpsPositionAddress(admin.publicKey, marketPda, program.programId);

    // Initialize user
    await program.methods
      .initializePerpsUser()
      .accounts({
        owner: admin.publicKey,
        user: userPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Deposit 20 USDC collateral
    await program.methods
      .depositPerpsCollateral(new anchor.BN(20_000_000))
      .accounts({
        owner: admin.publicKey,
        global: globalPda,
        user: userPda,
        market: marketPda,
        userQuoteAta,
        collateralVault: collateralVault.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

  // ── Test Cases ────────────────────────────────────

  it("25% partial close — reduces position, returns proportional collateral", async () => {
    // Open LONG 100 base units @ $100, 5x leverage
    // notional = 100 * 100_000_000 = 10_000_000_000
    // margin = 10_000_000_000 / 5 = 2_000_000_000
    await setPrice(100 * PRICE_SCALE);
    await openPos("long", 100, 5);

    const posBefore = await fetchPosition();
    const userBefore = await fetchUser();
    expect(posBefore.basePositionI64.toNumber()).to.eq(100);
    const collateralBefore = posBefore.collateralU64.toNumber();

    // Close 25% = 25 base units at same price (no PnL)
    await closePos(25);

    const posAfter = await fetchPosition();
    const userAfter = await fetchUser();

    // Remaining position = 75
    expect(posAfter.basePositionI64.toNumber()).to.eq(75);
    // Entry price preserved
    expect(posAfter.entryPriceI64.toNumber()).to.eq(100 * PRICE_SCALE);
    // Collateral reduced by ~25%
    const collateralAfter = posAfter.collateralU64.toNumber();
    const collateralReturned = collateralBefore - collateralAfter;
    const expectedReturn = Math.floor(collateralBefore * 25 / 100);
    expect(collateralReturned).to.eq(expectedReturn);
    // User gets the returned collateral back
    expect(userAfter.collateralQuoteU64.toNumber()).to.be.greaterThan(
      userBefore.collateralQuoteU64.toNumber()
    );
    // Positions count unchanged (position still open)
    expect(posAfter.basePositionI64.toNumber()).to.not.eq(0);

    // Full close remaining
    await closePos(75);
    const posFinal = await fetchPosition();
    expect(posFinal.basePositionI64.toNumber()).to.eq(0);
  });

  it("50% partial close — realizes PnL on closed portion only", async () => {
    await setPrice(100 * PRICE_SCALE);
    await openPos("long", 100, 5);

    const posBefore = await fetchPosition();
    const userBefore = await fetchUser();
    const collateralBefore = posBefore.collateralU64.toNumber();

    // Move price up 10% to $110 — then close 50%
    await setPrice(110 * PRICE_SCALE);
    await closePos(50);

    const posAfter = await fetchPosition();
    const userAfter = await fetchUser();

    // Remaining position = 50 base units
    expect(posAfter.basePositionI64.toNumber()).to.eq(50);
    // Entry price should still be $100 (weighted average = original, since partial close)
    expect(posAfter.entryPriceI64.toNumber()).to.eq(100 * PRICE_SCALE);

    // Collateral released = 50% of original collateral
    const collateralAfter = posAfter.collateralU64.toNumber();
    const expectedCollateralReturn = Math.floor(collateralBefore * 50 / 100);
    expect(collateralBefore - collateralAfter).to.eq(expectedCollateralReturn);

    // PnL: close 50 units with price diff of +10 PRICE_SCALE per unit
    // pnl_delta = 50 * (110_000_000 - 100_000_000) * 1 = 50 * 10_000_000 = 500_000_000
    // User collateral should increase by collateral_return + pnl_delta
    const userCollateralDelta =
      userAfter.collateralQuoteU64.toNumber() - userBefore.collateralQuoteU64.toNumber();
    // pnl_delta is in scaled units — but it's added to the user as quote atomic units
    // Since PRICE_SCALE math: 500_000_000 is the raw pnl in scaled units
    // The pnl is added raw to user collateral, so user should gain > just the collateral portion
    expect(userCollateralDelta).to.be.greaterThan(expectedCollateralReturn);

    // Realized PnL updated
    expect(posAfter.realizedPnlI128.toNumber()).to.not.eq(0);

    // Clean up
    await closePos(50);
    const posFinal = await fetchPosition();
    expect(posFinal.basePositionI64.toNumber()).to.eq(0);
  });

  it("100% close via amount_base — full close zeroes position", async () => {
    await setPrice(100 * PRICE_SCALE);
    await openPos("long", 100, 5);

    const userBefore = await fetchUser();
    const posBefore = await fetchPosition();
    const collateralInPosition = posBefore.collateralU64.toNumber();

    // Full close at same price — no PnL expected
    await closePos(100);

    const posAfter = await fetchPosition();
    const userAfter = await fetchUser();

    // Position fully reset
    expect(posAfter.basePositionI64.toNumber()).to.eq(0);
    expect(posAfter.entryPriceI64.toNumber()).to.eq(0);
    expect(posAfter.collateralU64.toNumber()).to.eq(0);
    expect(posAfter.leverageU16).to.eq(0);

    // User collateral restored (collateral returned = all position collateral)
    const userCollateralDelta =
      userAfter.collateralQuoteU64.toNumber() - userBefore.collateralQuoteU64.toNumber();
    expect(userCollateralDelta).to.eq(collateralInPosition);
  });

  it("rejects close amount exceeding position size", async () => {
    await setPrice(100 * PRICE_SCALE);
    await openPos("long", 100, 5);

    try {
      // Try to close 150 when only 100 units open
      await closePos(150);
      expect.fail("Expected CloseAmountExceedsPosition error");
    } catch (error: any) {
      expect(error.toString()).to.include("Close amount exceeds position size");
    }

    // Clean up
    await closePos(100);
  });

  it("partial close on short position works correctly", async () => {
    await setPrice(100 * PRICE_SCALE);
    await openPos("short", 80, 5);

    const posBefore = await fetchPosition();
    expect(posBefore.basePositionI64.toNumber()).to.eq(-80);

    // Close 50% of short (40 units)
    await closePos(40);

    const posAfter = await fetchPosition();
    // Remaining = -40 (still short)
    expect(posAfter.basePositionI64.toNumber()).to.eq(-40);
    // Entry price preserved
    expect(posAfter.entryPriceI64.toNumber()).to.eq(100 * PRICE_SCALE);

    // Full close remaining
    await closePos(40);
    const posFinal = await fetchPosition();
    expect(posFinal.basePositionI64.toNumber()).to.eq(0);
  });

  it("rejects zero amount_base", async () => {
    await setPrice(100 * PRICE_SCALE);
    await openPos("long", 50, 5);

    try {
      await closePos(0);
      expect.fail("Expected InvalidAmount error");
    } catch (error: any) {
      expect(error.toString()).to.include("Invalid amount");
    }

    // Clean up
    await closePos(50);
  });
});
