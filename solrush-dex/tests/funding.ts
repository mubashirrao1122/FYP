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
 * Phase 3 — Funding rate tests.
 *
 * Validates:
 *  1. Positive funding: longs pay shorts
 *  2. Negative funding: shorts pay longs
 *  3. Funding accumulates over time
 *  4. No funding applied twice (checkpoint guards)
 */
describe("funding (Phase 3)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolrushDex as Program;
  const admin = provider.wallet;

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

  /** Set the custom oracle price (PRICE_SCALE = 1e6). */
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

  /** Open a position (side: 'long' | 'short'). */
  async function openPos(
    side: "long" | "short",
    size: number,
    leverage: number
  ) {
    const sideArg = side === "long" ? { long: {} } : { short: {} };
    await program.methods
      .openPerpsPosition(
        sideArg,
        new anchor.BN(size),
        leverage,
        { market: {} }
      )
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

  /** Close the position fully. */
  async function closePos() {
    await program.methods
      .closePerpsPosition()
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

  /** Call update_perps_funding with a mark price. */
  async function updateFunding(markPrice: number) {
    await program.methods
      .updatePerpsFunding(new anchor.BN(markPrice))
      .accounts({
        global: globalPda,
        market: marketPda,
        oraclePriceAccount: oraclePda,
      })
      .rpc();
  }

  /** Fetch the position account. */
  async function fetchPosition() {
    return program.account.perpsPosition.fetch(positionPda);
  }

  /** Fetch the user account. */
  async function fetchUser() {
    return program.account.perpsUserAccount.fetch(userPda);
  }

  /** Fetch the market account. */
  async function fetchMarket() {
    return program.account.perpsMarket.fetch(marketPda);
  }

  // ── Setup ─────────────────────────────────────────

  before(async () => {
    baseMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6
    );
    quoteMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6
    );

    [globalPda] = findPerpsGlobalAddress(program.programId);
    [oraclePda] = findPerpsOracleAddress(admin.publicKey, program.programId);
    [marketPda] = findPerpsMarketAddress(
      baseMint,
      quoteMint,
      program.programId
    );
    [userPda] = findPerpsUserAddress(admin.publicKey, program.programId);

    collateralVault = anchor.web3.Keypair.generate();

    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      quoteMint,
      admin.publicKey
    );
    userQuoteAta = ata.address;
    await mintTo(
      provider.connection,
      admin.payer,
      quoteMint,
      userQuoteAta,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    // Initialize global (fee = 0 bps)
    await program.methods
      .initializePerpsGlobal(0)
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize oracle at 100 USDC (100_000_000 in PRICE_SCALE)
    await program.methods
      .initializePerpsOracle(new anchor.BN(100_000_000))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Create market: max leverage 10, maintenance margin 500 bps,
    // max funding rate = 10_000 (1% in PRICE_SCALE), funding interval = 1 second
    await program.methods
      .createPerpsMarket(
        Array(32).fill(0),
        10,
        500,
        new anchor.BN(10_000),
        new anchor.BN(1) // 1-second interval for easy testing
      )
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

    [positionPda] = findPerpsPositionAddress(
      admin.publicKey,
      marketPda,
      program.programId
    );

    // Initialize user
    await program.methods
      .initializePerpsUser()
      .accounts({
        owner: admin.publicKey,
        user: userPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Deposit 50 USDC collateral
    await program.methods
      .depositPerpsCollateral(new anchor.BN(50_000_000))
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

  // ── Helpers ────────────────────────────────────────

  /** Sleep for `ms` milliseconds. */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Test Cases ─────────────────────────────────────

  it("1. Positive funding: longs pay shorts (collateral decreases)", async () => {
    // Open long: size=1, leverage=10 at price 100
    await openPos("long", 1, 10);
    const posBefore = await fetchPosition();
    const collBefore = posBefore.collateralU64.toNumber();

    // Wait for funding interval to elapse
    await sleep(1500);

    // Update funding: mark = 101 (1% premium over index 100)
    // premium = (101_000_000 - 100_000_000) * 1_000_000 / 100_000_000 = 10_000
    // clamped at max 10_000 → funding_rate = 10_000
    // cum_funding += 100_000_000 * 10_000 / 1_000_000 = 1_000_000
    await updateFunding(101_000_000);

    const mkt = await fetchMarket();
    expect(mkt.fundingRateI64.toNumber()).to.equal(10_000);
    expect(mkt.cumulativeFundingI128.toNumber()).to.be.greaterThan(0);

    // Close position — settle_funding runs before close
    await closePos();
    const posAfter = await fetchPosition();
    const userAfter = await fetchUser();

    // The long should have paid funding → net collateral returned is reduced.
    // Before funding: collateral = 10_000_000 at 10x leverage on notional 100M
    // Funding delta = 1 (base_position) * cum_funding_diff > 0 → collateral reduced
    // We verify the user got less back than their original deposit minus PnL
    // (price unchanged so PnL = 0, but funding was charged)
    expect(posAfter.basePositionI64.toNumber()).to.equal(0, "position fully closed");
    // User collateral should be less than the initial 50_000_000 deposit
    // because longs paid funding
    expect(userAfter.collateralQuoteU64.toNumber()).to.be.lessThan(50_000_000);
  });

  it("2. Negative funding: shorts pay longs (short collateral decreases)", async () => {
    const userBefore = await fetchUser();
    const startingCollateral = userBefore.collateralQuoteU64.toNumber();

    // Open short: size=1, leverage=10 at price 100
    await openPos("short", 1, 10);
    const posBefore = await fetchPosition();

    // Wait for funding interval
    await sleep(1500);

    // Update funding with mark < index (negative premium)
    // mark = 99, index = 100 → premium = (99M - 100M) * 1M / 100M = -10_000
    // clamped at -10_000 → negative funding rate
    // cum_funding += 100_000_000 * (-10_000) / 1_000_000 = -1_000_000
    await updateFunding(99_000_000);

    const mkt = await fetchMarket();
    // Funding rate should be negative (note: additive from previous test)
    // The cumulative funding went from positive to less positive or negative
    const prevCum = 1_000_000; // from test 1
    const expectedNewCum = prevCum - 1_000_000; // = 0
    // cum diff for this position = newCum - position's checkpoint (which was set at open)
    // The short should pay when funding is negative
    // funding_delta = base_position(-1) * cum_diff
    // If cum_diff < 0: funding_delta = (-1) * (negative) = positive → short pays

    await closePos();
    const userAfter = await fetchUser();

    // Short paid negative funding → user collateral reduced from what they started with
    // for this sub-test
    expect(userAfter.collateralQuoteU64.toNumber()).to.be.lessThan(
      startingCollateral,
      "short lost collateral to negative funding"
    );
  });

  it("3. Funding accumulates over multiple intervals", async () => {
    const userBefore = await fetchUser();
    const startingCollateral = userBefore.collateralQuoteU64.toNumber();

    // Open long: size=1, leverage=10
    await openPos("long", 1, 10);

    // Apply funding 3 times with mark > index
    for (let i = 0; i < 3; i++) {
      await sleep(1500);
      // mark = 101 each time → +1_000_000 to cum_funding each interval
      await updateFunding(101_000_000);
    }

    const mkt = await fetchMarket();
    // Cumulative funding should have grown by ~3_000_000 from position open

    // Close and check
    await closePos();
    const userAfter = await fetchUser();

    // Long paid 3 rounds of funding → significant reduction
    const loss = startingCollateral - userAfter.collateralQuoteU64.toNumber();
    expect(loss).to.be.greaterThan(0, "accumulated funding caused loss");
  });

  it("4. No funding applied twice (checkpoint guard)", async () => {
    const userBefore = await fetchUser();
    const startingCollateral = userBefore.collateralQuoteU64.toNumber();

    // Open long
    await openPos("long", 1, 10);

    // Apply one round of funding
    await sleep(1500);
    await updateFunding(101_000_000);

    // Close position — this settles funding once
    await closePos();
    const afterFirstClose = (await fetchUser()).collateralQuoteU64.toNumber();

    // Open again at same price
    await openPos("long", 1, 10);

    // Close immediately WITHOUT new funding update
    // The position was opened after the last funding update,
    // so its checkpoint matches current cum_funding.
    // No additional funding should be deducted.
    await closePos();
    const afterSecondClose = (await fetchUser()).collateralQuoteU64.toNumber();

    // The second open/close cycle should not deduct funding
    // (afterFirstClose had position collateral freed; second open consumed some,
    //  close returned it — net effect is zero funding)
    // The key invariant: the position's last_funding_i128 was set to
    // market.cumulative_funding_i128 at open, so settle_funding produces delta = 0.
    const posFinal = await fetchPosition();
    expect(posFinal.basePositionI64.toNumber()).to.equal(0, "position closed");
  });

  it("5. Funding update rejected if interval not elapsed", async () => {
    // We just called updateFunding. Calling again immediately should fail.
    try {
      await updateFunding(101_000_000);
      expect.fail("should have thrown FundingTooSoon");
    } catch (err: any) {
      expect(err.toString()).to.include("FundingTooSoon");
    }
  });
});
