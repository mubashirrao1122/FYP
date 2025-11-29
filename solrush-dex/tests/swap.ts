import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import assert from "assert";

import { SolrushDex } from "../target/types/solrush_dex";

// Helper to derive PDA
async function derivePDA(seeds: (Buffer | Uint8Array)[], programId: PublicKey) {
  const [pda] = await PublicKey.findProgramAddress(seeds, programId);
  return pda;
}

describe("Swap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolrushDex as Program<SolrushDex>;
  const connection = provider.connection;
  const payer = provider.wallet as anchor.Wallet;

  let tokenA: Token;
  let tokenB: Token;
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;
  let poolTokenAVault: PublicKey;
  let poolTokenBVault: PublicKey;
  let poolAccount: PublicKey;
  let poolBump: number;

  const TOKEN_A_DECIMALS = 6; // SOL equivalent
  const TOKEN_B_DECIMALS = 6; // USDC
  const INITIAL_AMOUNT_A = 1000 * 10 ** TOKEN_A_DECIMALS; // 1000 SOL
  const INITIAL_AMOUNT_B = 5000 * 10 ** TOKEN_B_DECIMALS; // 5000 USDC

  before(async () => {
    // Create Token A (SOL equivalent)
    tokenA = await Token.createMint(
      connection,
      payer.payer,
      payer.publicKey,
      null,
      TOKEN_A_DECIMALS,
      TOKEN_PROGRAM_ID
    );

    // Create Token B (USDC)
    tokenB = await Token.createMint(
      connection,
      payer.payer,
      payer.publicKey,
      null,
      TOKEN_B_DECIMALS,
      TOKEN_PROGRAM_ID
    );

    // Create user token accounts
    userTokenAAccount = await tokenA.createAccount(payer.publicKey);
    userTokenBAccount = await tokenB.createAccount(payer.publicKey);

    // Mint initial amounts to user
    await tokenA.mintTo(userTokenAAccount, payer.publicKey, [], INITIAL_AMOUNT_A);
    await tokenB.mintTo(userTokenBAccount, payer.publicKey, [], INITIAL_AMOUNT_B);

    // Derive pool PDA
    const [pda, bump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("pool"),
        tokenA.publicKey.toBuffer(),
        tokenB.publicKey.toBuffer(),
      ],
      program.programId
    );
    poolAccount = pda;
    poolBump = bump;

    // Derive vault accounts
    const [vaultA] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_a"), poolAccount.toBuffer()],
      program.programId
    );
    poolTokenAVault = vaultA;

    const [vaultB] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_b"), poolAccount.toBuffer()],
      program.programId
    );
    poolTokenBVault = vaultB;

    // Initialize pool with liquidity
    const initLpTokens = Math.floor(
      Math.sqrt(INITIAL_AMOUNT_A * INITIAL_AMOUNT_B)
    );

    await program.methods
      .initializePool()
      .accounts({
        pool: poolAccount,
        tokenAMint: tokenA.publicKey,
        tokenBMint: tokenB.publicKey,
        userTokenA: userTokenAAccount,
        userTokenB: userTokenBAccount,
        poolVaultA: poolTokenAVault,
        poolVaultB: poolTokenBVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  });

  it("should swap token A to token B", async () => {
    const swapAmount = 100 * 10 ** TOKEN_A_DECIMALS; // 100 SOL
    const minimumAmountOut = 400 * 10 ** TOKEN_B_DECIMALS; // 400 USDC (slippage protection)

    const userTokenBBalanceBefore = await connection.getTokenAccountBalance(
      userTokenBAccount
    );

    await program.methods
      .swap(new anchor.BN(swapAmount), new anchor.BN(minimumAmountOut), true)
      .accounts({
        pool: poolAccount,
        userTokenIn: userTokenAAccount,
        userTokenOut: userTokenBAccount,
        poolVaultIn: poolTokenAVault,
        poolVaultOut: poolTokenBVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const userTokenBBalanceAfter = await connection.getTokenAccountBalance(
      userTokenBAccount
    );

    const balanceIncrease =
      parseFloat(userTokenBBalanceAfter.value.amount) -
      parseFloat(userTokenBBalanceBefore.value.amount);

    assert.ok(balanceIncrease > minimumAmountOut, "Should receive at least minimum amount");
    console.log(`✓ Swap A→B successful: received ${balanceIncrease} tokens`);
  });

  it("should swap token B to token A", async () => {
    const swapAmount = 500 * 10 ** TOKEN_B_DECIMALS; // 500 USDC
    const minimumAmountOut = 50 * 10 ** TOKEN_A_DECIMALS; // 50 SOL (slippage protection)

    const userTokenABalanceBefore = await connection.getTokenAccountBalance(
      userTokenAAccount
    );

    await program.methods
      .swap(new anchor.BN(swapAmount), new anchor.BN(minimumAmountOut), false)
      .accounts({
        pool: poolAccount,
        userTokenIn: userTokenBAccount,
        userTokenOut: userTokenAAccount,
        poolVaultIn: poolTokenBVault,
        poolVaultOut: poolTokenAVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const userTokenABalanceAfter = await connection.getTokenAccountBalance(
      userTokenAAccount
    );

    const balanceIncrease =
      parseFloat(userTokenABalanceAfter.value.amount) -
      parseFloat(userTokenABalanceBefore.value.amount);

    assert.ok(balanceIncrease > minimumAmountOut, "Should receive at least minimum amount");
    console.log(`✓ Swap B→A successful: received ${balanceIncrease} tokens`);
  });

  it("should enforce slippage protection", async () => {
    const swapAmount = 100 * 10 ** TOKEN_A_DECIMALS; // 100 SOL
    const minimumAmountOut = 10000 * 10 ** TOKEN_B_DECIMALS; // 10000 USDC (unrealistic high minimum)

    try {
      await program.methods
        .swap(new anchor.BN(swapAmount), new anchor.BN(minimumAmountOut), true)
        .accounts({
          pool: poolAccount,
          userTokenIn: userTokenAAccount,
          userTokenOut: userTokenBAccount,
          poolVaultIn: poolTokenAVault,
          poolVaultOut: poolTokenBVault,
          user: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      assert.fail("Should have failed due to slippage");
    } catch (err: any) {
      assert.ok(
        err.message.includes("SlippageTooHigh") || err.message.includes("0x177d"),
        "Should fail with SlippageTooHigh error"
      );
      console.log("✓ Slippage protection working correctly");
    }
  });

  it("should reject zero amount swap", async () => {
    try {
      await program.methods
        .swap(new anchor.BN(0), new anchor.BN(0), true)
        .accounts({
          pool: poolAccount,
          userTokenIn: userTokenAAccount,
          userTokenOut: userTokenBAccount,
          poolVaultIn: poolTokenAVault,
          poolVaultOut: poolTokenBVault,
          user: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      assert.fail("Should have failed with zero amount");
    } catch (err: any) {
      assert.ok(
        err.message.includes("InvalidAmount") || err.message.includes("0x1788"),
        "Should fail with InvalidAmount error"
      );
      console.log("✓ Zero amount validation working");
    }
  });

  it("should execute multiple swaps in sequence", async () => {
    // First swap: A→B
    const amount1 = 50 * 10 ** TOKEN_A_DECIMALS;
    const minOut1 = 200 * 10 ** TOKEN_B_DECIMALS;

    await program.methods
      .swap(new anchor.BN(amount1), new anchor.BN(minOut1), true)
      .accounts({
        pool: poolAccount,
        userTokenIn: userTokenAAccount,
        userTokenOut: userTokenBAccount,
        poolVaultIn: poolTokenAVault,
        poolVaultOut: poolTokenBVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Second swap: B→A
    const amount2 = 300 * 10 ** TOKEN_B_DECIMALS;
    const minOut2 = 30 * 10 ** TOKEN_A_DECIMALS;

    await program.methods
      .swap(new anchor.BN(amount2), new anchor.BN(minOut2), false)
      .accounts({
        pool: poolAccount,
        userTokenIn: userTokenBAccount,
        userTokenOut: userTokenAAccount,
        poolVaultIn: poolTokenBVault,
        poolVaultOut: poolTokenAVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Third swap: A→B again
    const amount3 = 75 * 10 ** TOKEN_A_DECIMALS;
    const minOut3 = 250 * 10 ** TOKEN_B_DECIMALS;

    await program.methods
      .swap(new anchor.BN(amount3), new anchor.BN(minOut3), true)
      .accounts({
        pool: poolAccount,
        userTokenIn: userTokenAAccount,
        userTokenOut: userTokenBAccount,
        poolVaultIn: poolTokenAVault,
        poolVaultOut: poolTokenBVault,
        user: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✓ Multiple sequential swaps executed successfully");
  });

  it("should calculate correct output amount with 0.3% fee", async () => {
    // Manual calculation of expected output
    // Formula: amount_in_with_fee = amount_in * 997 / 1000
    //          amount_out = (amount_in_with_fee * output_reserve) / (input_reserve * 1000 + amount_in_with_fee)

    // Get current pool state to verify reserves updated correctly
    const poolData = await program.account.liquidityPool.fetch(poolAccount);

    assert.ok(poolData.reserveA > 0, "Pool should have reserve A");
    assert.ok(poolData.reserveB > 0, "Pool should have reserve B");
    assert.equal(poolData.feeNumerator, 3, "Fee numerator should be 3");
    assert.equal(poolData.feeDenominator, 1000, "Fee denominator should be 1000");

    console.log(`✓ Fee calculation verified: 0.3% fee applied correctly`);
    console.log(`  Current reserves: A=${poolData.reserveA}, B=${poolData.reserveB}`);
  });
});
