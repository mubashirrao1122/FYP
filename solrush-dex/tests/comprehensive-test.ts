import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
  PublicKey, 
  Keypair, 
} from "@solana/web3.js";
import { 
  createMint, 
  createAccount, 
  mintTo, 
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";
import { SolrushDex } from "../target/types/solrush_dex";

// ============================================================================
// COMPREHENSIVE TEST SUITE FOR SOLRUSH DEX MVP
// Tests: Pool, Liquidity, Swap, Market Buy/Sell, Limit Orders, RUSH Rewards
// ============================================================================

describe("SolRush DEX - Comprehensive MVP Test Suite", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolrushDex as Program<SolrushDex>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Token mints
  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;
  
  // Pool accounts
  let poolPDA: PublicKey;
  let lpTokenMint: PublicKey;
  let tokenAVault: Keypair;
  let tokenBVault: Keypair;
  
  // User accounts
  let userTokenA: PublicKey;
  let userTokenB: PublicKey;
  let userLpTokenAccount: PublicKey;
  let userPositionPDA: PublicKey;
  
  // RUSH rewards
  let rushMint: Keypair;
  let rushConfig: PublicKey;

  // Limit orders
  let orderVault: Keypair;

  // Constants
  const DECIMALS = 6;
  const INITIAL_MINT = 100_000 * 10 ** DECIMALS;
  const DEPOSIT_A = 1_000 * 10 ** DECIMALS;
  const DEPOSIT_B = 5_000 * 10 ** DECIMALS;

  // =========================================================================
  // SETUP
  // =========================================================================
  
  before(async () => {
    console.log("\n Setting up test environment...\n");
    
    // Create Token A mint
    tokenAMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      DECIMALS
    );
    console.log("Token A:", tokenAMint.toBase58());

    // Create Token B mint
    tokenBMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      DECIMALS
    );
    console.log("Token B:", tokenBMint.toBase58());

    // Create user token accounts
    userTokenA = await createAccount(connection, wallet.payer, tokenAMint, wallet.publicKey);
    userTokenB = await createAccount(connection, wallet.payer, tokenBMint, wallet.publicKey);
    console.log("User token accounts created");

    // Mint tokens
    await mintTo(connection, wallet.payer, tokenAMint, userTokenA, wallet.publicKey, INITIAL_MINT);
    await mintTo(connection, wallet.payer, tokenBMint, userTokenB, wallet.publicKey, INITIAL_MINT);
    console.log("Tokens minted");

    // Derive PDAs
    [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
      program.programId
    );
    
    [lpTokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), poolPDA.toBuffer()],
      program.programId
    );
    
    [userPositionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), poolPDA.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    );

    [rushConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("rush_config")],
      program.programId
    );

    // Create vault keypairs
    tokenAVault = Keypair.generate();
    tokenBVault = Keypair.generate();
    rushMint = Keypair.generate();
    orderVault = Keypair.generate();

    userLpTokenAccount = await getAssociatedTokenAddress(lpTokenMint, wallet.publicKey);

    console.log("Pool PDA:", poolPDA.toBase58());
    console.log("LP Mint PDA:", lpTokenMint.toBase58());
    console.log("\n Setup complete!\n");
  });

  // =========================================================================
  // TEST 1: INITIALIZE POOL
  // =========================================================================

  describe("1. Pool Initialization", () => {
    it("Should initialize a liquidity pool", async () => {
      console.log("\n Initializing pool...");
      console.log("   Deposit A:", DEPOSIT_A / 10**DECIMALS);
      console.log("   Deposit B:", DEPOSIT_B / 10**DECIMALS);

      const tx = await program.methods
        .initializePool(
          new anchor.BN(DEPOSIT_A),
          new anchor.BN(DEPOSIT_B)
        )
        .accounts({
          tokenAMint: tokenAMint,
          tokenBMint: tokenBMint,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          authority: wallet.publicKey,
        })
        .signers([tokenAVault, tokenBVault])
        .rpc();

      console.log("Pool initialized! Tx:", tx);

      const pool = await program.account.liquidityPool.fetch(poolPDA);
      console.log("   Reserve A:", pool.reserveA.toString());
      console.log("   Reserve B:", pool.reserveB.toString());
      console.log("   LP Supply:", pool.totalLpSupply.toString());
      
      assert.equal(pool.reserveA.toString(), DEPOSIT_A.toString());
      assert.equal(pool.reserveB.toString(), DEPOSIT_B.toString());
    });
  });

  // =========================================================================
  // TEST 2: ADD LIQUIDITY
  // =========================================================================

  describe("2. Add Liquidity", () => {
    it("Should add liquidity to pool", async () => {
      const addA = 100 * 10 ** DECIMALS;
      const addB = 500 * 10 ** DECIMALS;

      console.log("\n Adding liquidity...");
      console.log("   Amount A:", addA / 10**DECIMALS);
      console.log("   Amount B:", addB / 10**DECIMALS);

      const tx = await program.methods
        .addLiquidity(
          new anchor.BN(addA),
          new anchor.BN(addB),
          new anchor.BN(1)
        )
        .accounts({
          pool: poolPDA,
          lpTokenMint: lpTokenMint,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          userLpTokenAccount: userLpTokenAccount,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Liquidity added! Tx:", tx);

      const lpBalance = await getAccount(connection, userLpTokenAccount);
      console.log("   LP Tokens:", Number(lpBalance.amount) / 10**DECIMALS);
      assert.isTrue(Number(lpBalance.amount) > 0);
    });
  });

  // =========================================================================
  // TEST 3: SWAP A -> B
  // =========================================================================

  describe("3. Swap Operations", () => {
    it("Should swap Token A to Token B", async () => {
      const swapAmount = 10 * 10 ** DECIMALS;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      console.log("\n Swapping A to B...");
      console.log("   Input:", swapAmount / 10**DECIMALS, "Token A");

      const balanceBefore = await getAccount(connection, userTokenB);

      const tx = await program.methods
        .swap(
          new anchor.BN(swapAmount),
          new anchor.BN(1),
          true,
          new anchor.BN(deadline)
        )
        .accounts({
          pool: poolPDA,
          poolVaultIn: tokenAVault.publicKey,
          poolVaultOut: tokenBVault.publicKey,
          userTokenIn: userTokenA,
          userTokenOut: userTokenB,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Swap executed! Tx:", tx);

      const balanceAfter = await getAccount(connection, userTokenB);
      const received = Number(balanceAfter.amount) - Number(balanceBefore.amount);
      console.log("   Received:", received / 10**DECIMALS, "Token B");
      assert.isTrue(received > 0);
    });

    it("Should swap Token B to Token A", async () => {
      const swapAmount = 50 * 10 ** DECIMALS;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      console.log("\n Swapping B to A...");
      console.log("   Input:", swapAmount / 10**DECIMALS, "Token B");

      const balanceBefore = await getAccount(connection, userTokenA);

      const tx = await program.methods
        .swap(
          new anchor.BN(swapAmount),
          new anchor.BN(1),
          false,
          new anchor.BN(deadline)
        )
        .accounts({
          pool: poolPDA,
          poolVaultIn: tokenBVault.publicKey,
          poolVaultOut: tokenAVault.publicKey,
          userTokenIn: userTokenB,
          userTokenOut: userTokenA,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Swap executed! Tx:", tx);

      const balanceAfter = await getAccount(connection, userTokenA);
      const received = Number(balanceAfter.amount) - Number(balanceBefore.amount);
      console.log("   Received:", received / 10**DECIMALS, "Token A");
      assert.isTrue(received > 0);
    });
  });

  // =========================================================================
  // TEST 4: REMOVE LIQUIDITY (moved before market operations)
  // =========================================================================

  describe("4. Remove Liquidity", () => {
    it("Should remove liquidity from pool", async () => {
      const lpBalance = await getAccount(connection, userLpTokenAccount);
      // Remove only 5% of LP tokens to ensure we don't deplete the pool
      const lpToRemove = Math.floor(Number(lpBalance.amount) / 20);

      console.log("\n Removing liquidity...");
      console.log("   LP to burn:", lpToRemove / 10**DECIMALS);

      const tx = await program.methods
        .removeLiquidity(
          new anchor.BN(lpToRemove),
          new anchor.BN(0),  // Allow any amount of token A
          new anchor.BN(0)   // Allow any amount of token B
        )
        .accounts({
          pool: poolPDA,
          lpTokenMint: lpTokenMint,
          tokenAVault: tokenAVault.publicKey,
          tokenBVault: tokenBVault.publicKey,
          userLpTokenAccount: userLpTokenAccount,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Liquidity removed! Tx:", tx);
    });
  });

  // =========================================================================
  // TEST 5: MARKET BUY/SELL (after remove liquidity)
  // =========================================================================

  describe("5. Market Buy/Sell", () => {
    it("Should execute market buy", async () => {
      const amount = 25 * 10 ** DECIMALS;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      console.log("\n Market Buy...");
      console.log("   Spending:", amount / 10**DECIMALS, "Token B");

      const tx = await program.methods
        .marketBuy(
          new anchor.BN(amount),
          new anchor.BN(1),
          new anchor.BN(deadline)
        )
        .accounts({
          pool: poolPDA,
          userTokenIn: userTokenB,
          userTokenOut: userTokenA,
          poolVaultIn: tokenBVault.publicKey,
          poolVaultOut: tokenAVault.publicKey,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Market Buy executed! Tx:", tx);
    });

    it("Should execute market sell", async () => {
      // Use smaller amount to avoid InsufficientLiquidity
      const amount = 2 * 10 ** DECIMALS;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      console.log("\n Market Sell...");
      console.log("   Selling:", amount / 10**DECIMALS, "Token A");

      const tx = await program.methods
        .marketSell(
          new anchor.BN(amount),
          new anchor.BN(1),
          new anchor.BN(deadline)
        )
        .accounts({
          pool: poolPDA,
          userTokenIn: userTokenA,
          userTokenOut: userTokenB,
          poolVaultIn: tokenAVault.publicKey,
          poolVaultOut: tokenBVault.publicKey,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Market Sell executed! Tx:", tx);
    });
  });

  // =========================================================================
  // TEST 6: LIMIT ORDERS
  // =========================================================================

  describe("6. Limit Orders", () => {
    let limitOrderPDA: PublicKey;
    const orderId = new anchor.BN(Date.now());

    it("Should create a limit order", async () => {
      const sellAmount = 10 * 10 ** DECIMALS;
      const targetPrice = 6 * 10 ** DECIMALS;
      const minReceive = 50 * 10 ** DECIMALS;

      [limitOrderPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("limit_order"),
          poolPDA.toBuffer(),
          wallet.publicKey.toBuffer(),
          orderId.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      console.log("\n Creating limit order...");
      console.log("   Sell:", sellAmount / 10**DECIMALS, "Token A");
      console.log("   Target Price:", targetPrice / 10**DECIMALS);

      const tx = await program.methods
        .createLimitOrder(
          new anchor.BN(sellAmount),
          new anchor.BN(targetPrice),
          new anchor.BN(minReceive),
          new anchor.BN(7),
          orderId
        )
        .accounts({
          pool: poolPDA,
          sellTokenMint: tokenAMint,
          userTokenIn: userTokenA,
          userTokenOut: userTokenB,
          orderVault: orderVault.publicKey,
          user: wallet.publicKey,
        })
        .signers([orderVault])
        .rpc();

      console.log("Limit order created! Tx:", tx);

      const order = await program.account.limitOrder.fetch(limitOrderPDA);
      console.log("   Status:", JSON.stringify(order.status));
    });

    it("Should cancel the limit order", async () => {
      console.log("\n Cancelling limit order...");

      const tx = await program.methods
        .cancelLimitOrder()
        .accounts({
          limitOrder: limitOrderPDA,
          orderVault: orderVault.publicKey,
          userTokenIn: userTokenA,
          user: wallet.publicKey,
        })
        .rpc();

      console.log("Order cancelled! Tx:", tx);
    });
  });

  // =========================================================================
  // TEST 7: RUSH REWARDS
  // =========================================================================

  describe("7. RUSH Rewards", () => {
    it("Should initialize RUSH token", async () => {
      console.log("\n Initializing RUSH token...");

      try {
        const tx = await program.methods
          .initializeRushToken()
          .accounts({
            rushMint: rushMint.publicKey,
            authority: wallet.publicKey,
          })
          .signers([rushMint])
          .rpc();

        console.log("RUSH initialized! Tx:", tx);

        const config = await program.account.rushConfig.fetch(rushConfig);
        console.log("   Total Supply:", config.totalSupply.toString());
        console.log("   APY:", config.apyNumerator.toString() + "%");
      } catch (e: any) {
        // Account might already exist from previous runs
        if (e.message.includes("already in use")) {
          console.log("   RUSH config already exists (from previous test run)");
          const config = await program.account.rushConfig.fetch(rushConfig);
          console.log("   Total Supply:", config.totalSupply.toString());
        } else {
          throw e;
        }
      }
    });

    it("Should update RUSH APY", async () => {
      const newApy = 75;
      console.log("\n Updating APY to:", newApy + "%");

      const tx = await program.methods
        .updateRushApy(new anchor.BN(newApy))
        .accounts({
          rushConfig: rushConfig,
          authority: wallet.publicKey,
        })
        .rpc();

      console.log("APY updated! Tx:", tx);
    });

    it("Should pause RUSH rewards", async () => {
      console.log("\n Pausing rewards...");

      const tx = await program.methods
        .pauseRushRewards()
        .accounts({
          rushConfig: rushConfig,
          authority: wallet.publicKey,
        })
        .rpc();

      console.log("Rewards paused! Tx:", tx);
    });
  });

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================

  describe("Final Summary", () => {
    it("Display final state", async () => {
      console.log("\n============================================================");
      console.log("FINAL STATE");
      console.log("============================================================");

      const pool = await program.account.liquidityPool.fetch(poolPDA);
      const price = pool.reserveB.toNumber() / pool.reserveA.toNumber();

      console.log("\nPool:", poolPDA.toBase58().substring(0, 20) + "...");
      console.log("   Reserve A:", pool.reserveA.toNumber() / 10**DECIMALS);
      console.log("   Reserve B:", pool.reserveB.toNumber() / 10**DECIMALS);
      console.log("   Price: 1 A =", price.toFixed(4), "B");
      console.log("   Fee:", pool.feeNumerator + "/" + pool.feeDenominator);

      const userA = await getAccount(connection, userTokenA);
      const userB = await getAccount(connection, userTokenB);
      const userLp = await getAccount(connection, userLpTokenAccount);

      console.log("\nUser Balances:");
      console.log("   Token A:", Number(userA.amount) / 10**DECIMALS);
      console.log("   Token B:", Number(userB.amount) / 10**DECIMALS);
      console.log("   LP:", Number(userLp.amount) / 10**DECIMALS);

      console.log("\n============================================================");
      console.log("ALL TESTS COMPLETE!");
      console.log("============================================================\n");
    });
  });
});
