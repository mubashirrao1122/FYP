import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import {
  findPerpsGlobalAddress,
  findPerpsOracleAddress,
  findPerpsMarketAddress,
  findPerpsUserAddress,
  findPerpsPositionAddress,
  findInsuranceVaultAddress,
} from "../target/types/pda";

describe("liquidation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolrushDex as Program;

  const admin = provider.wallet;

  // The liquidator is a separate keypair
  let liquidator: anchor.web3.Keypair;

  let baseMint: anchor.web3.PublicKey;
  let quoteMint: anchor.web3.PublicKey;
  let collateralVault: anchor.web3.Keypair;
  let insuranceVaultAta: anchor.web3.Keypair;

  let globalPda: anchor.web3.PublicKey;
  let oraclePda: anchor.web3.PublicKey;
  let marketPda: anchor.web3.PublicKey;
  let userPda: anchor.web3.PublicKey;
  let positionPda: anchor.web3.PublicKey;
  let insuranceVaultPda: anchor.web3.PublicKey;

  let userQuoteAta: anchor.web3.PublicKey;
  let liquidatorQuoteAta: anchor.web3.PublicKey;
  let liquidatorUserPda: anchor.web3.PublicKey;

  // Initial oracle price: $100 (PRICE_SCALE = 1e6)
  const INITIAL_PRICE = 100_000_000; // 100 * 1e6

  before(async () => {
    // ── Create mints ──
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

    // ── Derive PDAs ──
    [globalPda] = findPerpsGlobalAddress(program.programId);
    [oraclePda] = findPerpsOracleAddress(admin.publicKey, program.programId);
    [marketPda] = findPerpsMarketAddress(baseMint, quoteMint, program.programId);
    [userPda] = findPerpsUserAddress(admin.publicKey, program.programId);
    [positionPda] = findPerpsPositionAddress(admin.publicKey, marketPda, program.programId);
    [insuranceVaultPda] = findInsuranceVaultAddress(marketPda, program.programId);

    collateralVault = anchor.web3.Keypair.generate();
    insuranceVaultAta = anchor.web3.Keypair.generate();

    // ── Create liquidator ──
    liquidator = anchor.web3.Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      liquidator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // ── Fund admin's quote ATA ──
    const adminAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      quoteMint,
      admin.publicKey
    );
    userQuoteAta = adminAta.address;
    await mintTo(
      provider.connection,
      admin.payer,
      quoteMint,
      userQuoteAta,
      admin.publicKey,
      100_000_000 // 100 USDC
    );

    // ── Fund liquidator's quote ATA ──
    const liqAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      quoteMint,
      liquidator.publicKey
    );
    liquidatorQuoteAta = liqAta.address;
    await mintTo(
      provider.connection,
      admin.payer,
      quoteMint,
      liquidatorQuoteAta,
      admin.publicKey,
      10_000_000 // 10 USDC (for insurance deposit)
    );

    // ── Initialize global ──
    await program.methods
      .initializePerpsGlobal(50) // 0.5% trading fee
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // ── Initialize oracle at $100 ──
    await program.methods
      .initializePerpsOracle(new anchor.BN(INITIAL_PRICE))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // ── Create market with 10x max leverage, 5% maintenance margin ──
    await program.methods
      .createPerpsMarket(
        Array(32).fill(0),
        10,   // max leverage 10x
        500,  // maintenance margin 5% = 500 bps
        new anchor.BN(10_000),
        new anchor.BN(3600)
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

    // ── Initialize insurance vault ──
    await program.methods
      .initializeInsuranceVault()
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        market: marketPda,
        insuranceVault: insuranceVaultPda,
        insuranceVaultAta: insuranceVaultAta.publicKey,
        quoteMint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([insuranceVaultAta])
      .rpc();

    // ── Initialize user + deposit collateral ──
    await program.methods
      .initializePerpsUser()
      .accounts({
        owner: admin.publicKey,
        user: userPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .depositPerpsCollateral(new anchor.BN(50_000_000)) // deposit 50 USDC
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

    // ── Deposit into insurance fund (admin deposits 5 USDC) ──
    await program.methods
      .depositInsurance(new anchor.BN(5_000_000))
      .accounts({
        depositor: admin.publicKey,
        market: marketPda,
        insuranceVault: insuranceVaultPda,
        insuranceVaultAta: insuranceVaultAta.publicKey,
        depositorAta: userQuoteAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

  it("rejects liquidation when position is healthy", async () => {
    // Open a long 1 unit @ $100, 5x leverage
    await program.methods
      .openPerpsPosition({ long: {} }, new anchor.BN(1_000_000), 5, { market: {} })
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

    // Try to liquidate — should fail because position is healthy
    try {
      await program.methods
        .liquidatePosition()
        .accounts({
          liquidator: liquidator.publicKey,
          global: globalPda,
          user: userPda,
          positionOwner: admin.publicKey,
          market: marketPda,
          oraclePriceAccount: oraclePda,
          position: positionPda,
          insuranceVault: insuranceVaultPda,
          insuranceVaultAta: insuranceVaultAta.publicKey,
          collateralVault: collateralVault.publicKey,
          liquidatorAta: liquidatorQuoteAta,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([liquidator])
        .rpc();
      expect.fail("Expected NotLiquidatable error");
    } catch (error: any) {
      expect(error.toString()).to.include("not liquidatable");
    }

    // Clean up — close the position
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
  });

  it("liquidates after a price crash", async () => {
    // Open a long 10 units @ $100, 10x leverage
    // Required margin = notional / leverage = (10 * 100) / 10 = 100 USDC = 100_000_000
    // Maintenance margin = notional * 5% = 50 USDC
    await program.methods
      .openPerpsPosition({ long: {} }, new anchor.BN(10_000_000), 10, { market: {} })
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

    const positionBefore = await program.account.perpsPosition.fetch(positionPda);
    expect(positionBefore.basePositionI64.toNumber()).to.not.eq(0);

    // Record liquidator balance before
    const liqBalanceBefore = (await getAccount(provider.connection, liquidatorQuoteAta)).amount;

    // ── Crash price to $91 ── (loss = 10 * (91-100) = -90 USDC)
    // equity = 100 - 90 = 10 USDC
    // mm = 10 * 91 * 5% = 45.5 USDC
    // 10 < 45.5 → liquidatable!
    const CRASH_PRICE = 91_000_000; // $91
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(CRASH_PRICE))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      })
      .rpc();

    // ── Liquidate ──
    await program.methods
      .liquidatePosition()
      .accounts({
        liquidator: liquidator.publicKey,
        global: globalPda,
        user: userPda,
        positionOwner: admin.publicKey,
        market: marketPda,
        oraclePriceAccount: oraclePda,
        position: positionPda,
        insuranceVault: insuranceVaultPda,
        insuranceVaultAta: insuranceVaultAta.publicKey,
        collateralVault: collateralVault.publicKey,
        liquidatorAta: liquidatorQuoteAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([liquidator])
      .rpc();

    // ── Verify position was closed or reduced ──
    const positionAfter = await program.account.perpsPosition.fetch(positionPda);
    // The position should have been at least partially liquidated
    const baseBefore = positionBefore.basePositionI64.toNumber();
    const baseAfter = positionAfter.basePositionI64.toNumber();
    expect(Math.abs(baseAfter)).to.be.lessThan(Math.abs(baseBefore));

    // ── Verify liquidator received a fee ──
    const liqBalanceAfter = (await getAccount(provider.connection, liquidatorQuoteAta)).amount;
    expect(Number(liqBalanceAfter)).to.be.greaterThan(Number(liqBalanceBefore));
    console.log(`  Liquidator fee received: ${Number(liqBalanceAfter) - Number(liqBalanceBefore)} lamports`);

    // ── Verify insurance vault was updated ──
    const ivAfter = await program.account.insuranceVault.fetch(insuranceVaultPda);
    console.log(`  Insurance vault balance: ${ivAfter.balanceU64.toNumber()}`);
  });

  it("handles bad-debt liquidation and sets emergency flag", async () => {
    // Reset oracle price for new scenario
    const HIGH_PRICE = 100_000_000;
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(HIGH_PRICE))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      })
      .rpc();

    // Check current position — if fully closed, open a new one
    const posBefore = await program.account.perpsPosition.fetch(positionPda);
    if (posBefore.basePositionI64.toNumber() === 0) {
      // Open a new highly leveraged position
      await program.methods
        .openPerpsPosition({ long: {} }, new anchor.BN(10_000_000), 10, { market: {} })
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

    // Extreme crash: price drops from $100 to $5
    // unrealized PnL = 10 * (5 - 100) = -950 USDC
    // equity = collateral + (-950) → deeply negative → bad debt
    const EXTREME_CRASH = 5_000_000; // $5
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(EXTREME_CRASH))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      })
      .rpc();

    const ivBefore = await program.account.insuranceVault.fetch(insuranceVaultPda);
    console.log(`  Insurance vault before extreme crash: ${ivBefore.balanceU64.toNumber()}`);

    // Liquidate — this should result in bad debt
    await program.methods
      .liquidatePosition()
      .accounts({
        liquidator: liquidator.publicKey,
        global: globalPda,
        user: userPda,
        positionOwner: admin.publicKey,
        market: marketPda,
        oraclePriceAccount: oraclePda,
        position: positionPda,
        insuranceVault: insuranceVaultPda,
        insuranceVaultAta: insuranceVaultAta.publicKey,
        collateralVault: collateralVault.publicKey,
        liquidatorAta: liquidatorQuoteAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([liquidator])
      .rpc();

    // Position should be fully closed
    const posAfter = await program.account.perpsPosition.fetch(positionPda);
    expect(posAfter.basePositionI64.toNumber()).to.eq(0);

    // Check market emergency flag
    const marketAfter = await program.account.perpsMarket.fetch(marketPda);
    console.log(`  Market emergency flag: ${marketAfter.emergency}`);
    // The insurance fund was likely insufficient for the massive bad debt
    // so the market should be in emergency mode
    expect(marketAfter.emergency).to.eq(true);

    const ivAfter = await program.account.insuranceVault.fetch(insuranceVaultPda);
    console.log(`  Insurance vault after extreme crash: ${ivAfter.balanceU64.toNumber()}`);
    expect(ivAfter.balanceU64.toNumber()).to.eq(0);
  });

  it("prevents self-liquidation", async () => {
    // Reset price
    await program.methods
      .setPerpsOraclePrice(new anchor.BN(INITIAL_PRICE))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
      })
      .rpc();

    // Open a position
    const pos = await program.account.perpsPosition.fetch(positionPda);
    if (pos.basePositionI64.toNumber() === 0) {
      await program.methods
        .openPerpsPosition({ long: {} }, new anchor.BN(1_000_000), 5, { market: {} })
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

    // Admin tries to liquidate their own position
    try {
      await program.methods
        .liquidatePosition()
        .accounts({
          liquidator: admin.publicKey,
          global: globalPda,
          user: userPda,
          positionOwner: admin.publicKey,
          market: marketPda,
          oraclePriceAccount: oraclePda,
          position: positionPda,
          insuranceVault: insuranceVaultPda,
          insuranceVaultAta: insuranceVaultAta.publicKey,
          collateralVault: collateralVault.publicKey,
          liquidatorAta: userQuoteAta,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Expected self-liquidation error");
    } catch (error: any) {
      expect(error.toString()).to.include("liquidate own position");
    }

    // Cleanup
    const posCheck = await program.account.perpsPosition.fetch(positionPda);
    if (posCheck.basePositionI64.toNumber() !== 0) {
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
  });
});
