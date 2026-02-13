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

describe("perps v1", () => {
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

    const [globalKey] = findPerpsGlobalAddress(program.programId);
    globalPda = globalKey;

    const [oracleKey] = findPerpsOracleAddress(admin.publicKey, program.programId);
    oraclePda = oracleKey;

    const [marketKey] = findPerpsMarketAddress(baseMint, quoteMint, program.programId);
    marketPda = marketKey;

    const [userKey] = findPerpsUserAddress(admin.publicKey, program.programId);
    userPda = userKey;

    const [positionKey] = findPerpsPositionAddress(admin.publicKey, marketPda, program.programId);
    positionPda = positionKey;

    collateralVault = anchor.web3.Keypair.generate();

    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      quoteMint,
      admin.publicKey
    );
    userQuoteAta = userAta.address;

    await mintTo(
      provider.connection,
      admin.payer,
      quoteMint,
      userQuoteAta,
      admin.publicKey,
      5_000_000
    );
  });

  it("initializes global + oracle + market", async () => {
    await program.methods
      .initializePerpsGlobal(50)
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializePerpsOracle(new anchor.BN(100_000))
      .accounts({
        admin: admin.publicKey,
        global: globalPda,
        oracle: oraclePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

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

    const market = await program.account.perpsMarket.fetch(marketPda);
    expect(market.maxLeverage).to.eq(10);
  });

  it("deposits collateral, opens, closes, withdraws", async () => {
    await program.methods
      .initializePerpsUser()
      .accounts({
        owner: admin.publicKey,
        user: userPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .depositPerpsCollateral(new anchor.BN(1_000_000))
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

    await program.methods
      .openPerpsPosition({ long: {} }, new anchor.BN(10), 5, { market: {} })
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

    await program.methods
      .withdrawPerpsCollateral(new anchor.BN(500_000))
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

    const user = await program.account.perpsUserAccount.fetch(userPda);
    expect(user.collateralQuoteU64.toNumber()).to.be.greaterThan(0);
  });

  it("fails with leverage too high", async () => {
    try {
      await program.methods
        .openPerpsPosition({ long: {} }, new anchor.BN(10), 50, { market: {} })
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
      expect.fail("Expected leverage failure");
    } catch (error: any) {
      expect(error.toString()).to.include("Invalid leverage");
    }
  });

  it("fails with insufficient collateral", async () => {
    try {
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
      expect.fail("Expected collateral failure");
    } catch (error: any) {
      expect(error.toString()).to.include("Insufficient collateral");
    }
  });

  it("fails withdrawing while position open", async () => {
    await program.methods
      .openPerpsPosition({ long: {} }, new anchor.BN(10), 5, { market: {} })
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

    try {
      await program.methods
        .withdrawPerpsCollateral(new anchor.BN(100))
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
      expect.fail("Expected maintenance margin failure");
    } catch (error: any) {
      expect(error.toString()).to.include("Maintenance margin violation");
    }

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
});
