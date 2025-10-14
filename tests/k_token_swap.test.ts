import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  createAmmConfig,
  createPool,
  getPoolAuthPda,
  getAmmConfigPda,
  getLpMintPda,
  getOrcleAccountPda,
  getPdaPoolId,
  getPdaPoolVaultId,
} from "./utils/pda";
import { calcFee } from "./utils/fee";

describe("K Token Swap Fee Discount", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const owner = provider.wallet;

  let ammConfig: PublicKey;
  let poolId: PublicKey;
  let poolAuth: PublicKey;
  let lpMint: PublicKey;
  let oracleAccount: PublicKey;

  // Token mints
  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;
  let kTokenMint: PublicKey; // K token for fee payment

  // Pool vaults
  let tokenAVault: PublicKey;
  let tokenBVault: PublicKey;
  let kTokenVault: PublicKey;

  // User accounts
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;
  let userKTokenAccount: PublicKey;
  let userLpAccount: PublicKey;

  // Mock Pyth price feed accounts
  let tokenAPriceFeed: PublicKey;
  let kTokenPriceFeed: PublicKey;

  const FEE_RATE_DENOMINATOR = 1000000;
  const TRADE_FEE_RATE = 2500; // 0.25%
  const PROTOCOL_FEE_RATE = 10000; // 1%
  const FUND_FEE_RATE = 10000; // 1%
  const CREATOR_FEE_RATE = 0;
  const K_TOKEN_DISCOUNT_RATE = 2000; // 20% discount

  before(async () => {
    // Create token mints
    tokenAMint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      6,
      Keypair.generate(),
      null,
      TOKEN_PROGRAM_ID
    );

    tokenBMint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      6,
      Keypair.generate(),
      null,
      TOKEN_PROGRAM_ID
    );

    kTokenMint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      9, // K token has 9 decimals
      Keypair.generate(),
      null,
      TOKEN_PROGRAM_ID
    );

    // Create AMM config with K token fee discount
    const configIndex = 0;
    ammConfig = await getAmmConfigPda(configIndex, program.programId);

    await createAmmConfig(
      program,
      owner,
      ammConfig,
      configIndex,
      TRADE_FEE_RATE,
      PROTOCOL_FEE_RATE,
      FUND_FEE_RATE,
      CREATOR_FEE_RATE,
      kTokenMint, // Enable K token
      K_TOKEN_DISCOUNT_RATE
    );

    // Create pool
    poolId = await getPdaPoolId(
      ammConfig,
      tokenAMint,
      tokenBMint,
      program.programId
    );
    poolAuth = await getPoolAuthPda(poolId, program.programId);
    lpMint = await getLpMintPda(poolId, program.programId);
    oracleAccount = await getOrcleAccountPda(poolId, program.programId);
    tokenAVault = await getPdaPoolVaultId(
      poolId,
      tokenAMint,
      program.programId
    );
    tokenBVault = await getPdaPoolVaultId(
      poolId,
      tokenBMint,
      program.programId
    );
    kTokenVault = await getPdaPoolVaultId(
      poolId,
      kTokenMint,
      program.programId
    );

    // Initialize pool with liquidity
    const initAmount0 = new BN(10000 * 10 ** 6); // 10,000 tokens
    const initAmount1 = new BN(20000 * 10 ** 6); // 20,000 tokens

    // Create user token accounts
    userTokenAAccount = await createAccount(
      provider.connection,
      owner.payer,
      tokenAMint,
      owner.publicKey,
      Keypair.generate()
    );

    userTokenBAccount = await createAccount(
      provider.connection,
      owner.payer,
      tokenBMint,
      owner.publicKey,
      Keypair.generate()
    );

    userKTokenAccount = await createAccount(
      provider.connection,
      owner.payer,
      kTokenMint,
      owner.publicKey,
      Keypair.generate()
    );

    userLpAccount = await createAccount(
      provider.connection,
      owner.payer,
      lpMint,
      owner.publicKey,
      Keypair.generate()
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      owner.payer,
      tokenAMint,
      userTokenAAccount,
      owner.publicKey,
      initAmount0.toNumber() + 100000 * 10 ** 6
    );

    await mintTo(
      provider.connection,
      owner.payer,
      tokenBMint,
      userTokenBAccount,
      owner.publicKey,
      initAmount1.toNumber()
    );

    // Mint K tokens to user for fee payment
    await mintTo(
      provider.connection,
      owner.payer,
      kTokenMint,
      userKTokenAccount,
      owner.publicKey,
      1000 * 10 ** 9 // 1,000 K tokens
    );

    // Create mock Pyth price feeds (for testing, these would be real Pyth accounts)
    tokenAPriceFeed = Keypair.generate().publicKey;
    kTokenPriceFeed = Keypair.generate().publicKey;

    // Initialize pool
    await createPool(
      program,
      owner,
      ammConfig,
      poolId,
      poolAuth,
      tokenAMint,
      tokenBMint,
      lpMint,
      userTokenAAccount,
      userTokenBAccount,
      userLpAccount,
      tokenAVault,
      tokenBVault,
      oracleAccount,
      TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      initAmount0,
      initAmount1,
      new BN(Date.now() / 1000)
    );
  });

  it("Swap with K token fee payment - 20% discount", async () => {
    const swapAmount = new BN(1000 * 10 ** 6); // 1,000 tokens
    const minAmountOut = new BN(0);

    // Get balances before swap
    const userTokenABefore = await getAccount(
      provider.connection,
      userTokenAAccount
    );
    const userTokenBBefore = await getAccount(
      provider.connection,
      userTokenBAccount
    );
    const userKTokenBefore = await getAccount(
      provider.connection,
      userKTokenAccount
    );
    const vaultABefore = await getAccount(provider.connection, tokenAVault);
    const vaultBBefore = await getAccount(provider.connection, tokenBVault);
    const kVaultBefore = await getAccount(provider.connection, kTokenVault);

    console.log("Before swap:");
    console.log("  User Token A:", userTokenABefore.amount.toString());
    console.log("  User Token B:", userTokenBBefore.amount.toString());
    console.log("  User K Token:", userKTokenBefore.amount.toString());
    console.log("  Vault A:", vaultABefore.amount.toString());
    console.log("  Vault B:", vaultBBefore.amount.toString());
    console.log("  K Vault:", kVaultBefore.amount.toString());

    // Calculate expected fees
    const tradeFee = calcFee(swapAmount, TRADE_FEE_RATE, FEE_RATE_DENOMINATOR);
    const discountedFee = tradeFee.mul(new BN(K_TOKEN_DISCOUNT_RATE)).div(new BN(10000));

    console.log("\nFee calculation:");
    console.log("  Trade fee:", tradeFee.toString());
    console.log("  Discounted fee (20%):", discountedFee.toString());

    // Perform swap with K token fee payment
    try {
      await program.methods
        .swapWithKToken(swapAmount, minAmountOut)
        .accounts({
          payer: owner.publicKey,
          ammConfig,
          poolState: poolId,
          inputTokenAccount: userTokenAAccount,
          outputTokenAccount: userTokenBAccount,
          inputVault: tokenAVault,
          outputVault: tokenBVault,
          inputTokenMint: tokenAMint,
          outputTokenMint: tokenBMint,
          observationState: oracleAccount,
          kTokenAccount: userKTokenAccount,
          kTokenVault: kTokenVault,
          inputTokenPriceFeed: tokenAPriceFeed,
          kTokenPriceFeed: kTokenPriceFeed,
          inputTokenProgram: TOKEN_PROGRAM_ID,
          outputTokenProgram: TOKEN_PROGRAM_ID,
          kTokenProgram: TOKEN_PROGRAM_ID,
          memoProgram: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .rpc();

      // Get balances after swap
      const userTokenAAfter = await getAccount(
        provider.connection,
        userTokenAAccount
      );
      const userTokenBAfter = await getAccount(
        provider.connection,
        userTokenBAccount
      );
      const userKTokenAfter = await getAccount(
        provider.connection,
        userKTokenAccount
      );
      const vaultAAfter = await getAccount(provider.connection, tokenAVault);
      const vaultBAfter = await getAccount(provider.connection, tokenBVault);
      const kVaultAfter = await getAccount(provider.connection, kTokenVault);

      console.log("\nAfter swap:");
      console.log("  User Token A:", userTokenAAfter.amount.toString());
      console.log("  User Token B:", userTokenBAfter.amount.toString());
      console.log("  User K Token:", userKTokenAfter.amount.toString());
      console.log("  Vault A:", vaultAAfter.amount.toString());
      console.log("  Vault B:", vaultBAfter.amount.toString());
      console.log("  K Vault:", kVaultAfter.amount.toString());

      // Verify user paid with tokens
      assert.equal(
        userTokenAAfter.amount.toString(),
        userTokenABefore.amount.sub(swapAmount).toString(),
        "User should have paid swap amount in Token A"
      );

      // Verify user received tokens
      assert.ok(
        userTokenBAfter.amount.gt(userTokenBBefore.amount),
        "User should have received Token B"
      );

      // Verify K tokens were paid
      const kTokensPaid = userKTokenBefore.amount.sub(userKTokenAfter.amount);
      console.log("\nK tokens paid:", kTokensPaid.toString());
      assert.ok(
        kTokensPaid.gt(new BN(0)),
        "User should have paid K tokens for discounted fee"
      );

      // Verify K token vault received the fee
      assert.equal(
        kVaultAfter.amount.toString(),
        kVaultBefore.amount.add(kTokensPaid).toString(),
        "K token vault should have received the fee payment"
      );

      console.log("\n✅ K token fee discount swap successful!");
    } catch (error) {
      console.error("Swap failed:", error);
      throw error;
    }
  });

  it("Swap fails with insufficient K tokens", async () => {
    const swapAmount = new BN(100000 * 10 ** 6); // Large swap requiring many K tokens

    try {
      await program.methods
        .swapWithKToken(swapAmount, new BN(0))
        .accounts({
          payer: owner.publicKey,
          ammConfig,
          poolState: poolId,
          inputTokenAccount: userTokenAAccount,
          outputTokenAccount: userTokenBAccount,
          inputVault: tokenAVault,
          outputVault: tokenBVault,
          inputTokenMint: tokenAMint,
          outputTokenMint: tokenBMint,
          observationState: oracleAccount,
          kTokenAccount: userKTokenAccount,
          kTokenVault: kTokenVault,
          inputTokenPriceFeed: tokenAPriceFeed,
          kTokenPriceFeed: kTokenPriceFeed,
          inputTokenProgram: TOKEN_PROGRAM_ID,
          outputTokenProgram: TOKEN_PROGRAM_ID,
          kTokenProgram: TOKEN_PROGRAM_ID,
          memoProgram: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .rpc();

      assert.fail("Should have failed with insufficient K token balance");
    } catch (error) {
      assert.ok(
        error.toString().includes("InsufficientFeeTokenBalance"),
        "Should fail with InsufficientFeeTokenBalance error"
      );
      console.log("✅ Correctly rejected swap with insufficient K tokens");
    }
  });

  it("Normal swap still works (without K token discount)", async () => {
    const swapAmount = new BN(1000 * 10 ** 6);
    const minAmountOut = new BN(0);

    const userTokenABefore = await getAccount(
      provider.connection,
      userTokenAAccount
    );
    const userTokenBBefore = await getAccount(
      provider.connection,
      userTokenBAccount
    );

    // Use normal swap_base_input (without K token discount)
    await program.methods
      .swapBaseInput(swapAmount, minAmountOut)
      .accounts({
        payer: owner.publicKey,
        ammConfig,
        poolState: poolId,
        inputTokenAccount: userTokenAAccount,
        outputTokenAccount: userTokenBAccount,
        inputVault: tokenAVault,
        outputVault: tokenBVault,
        inputTokenMint: tokenAMint,
        outputTokenMint: tokenBMint,
        observationState: oracleAccount,
        inputTokenProgram: TOKEN_PROGRAM_ID,
        outputTokenProgram: TOKEN_PROGRAM_ID,
        memoProgram: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .rpc();

    const userTokenAAfter = await getAccount(
      provider.connection,
      userTokenAAccount
    );
    const userTokenBAfter = await getAccount(
      provider.connection,
      userTokenBAccount
    );

    assert.equal(
      userTokenAAfter.amount.toString(),
      userTokenABefore.amount.sub(swapAmount).toString(),
      "Normal swap should work without K token"
    );

    assert.ok(
      userTokenBAfter.amount.gt(userTokenBBefore.amount),
      "User should have received tokens from normal swap"
    );

    console.log("✅ Normal swap (without K token discount) works");
  });

  it("Compares fees: K token discount vs normal swap", async () => {
    const swapAmount = new BN(5000 * 10 ** 6);

    // Calculate expected fees for both methods
    const tradeFee = calcFee(swapAmount, TRADE_FEE_RATE, FEE_RATE_DENOMINATOR);
    const discountedFee = tradeFee.mul(new BN(K_TOKEN_DISCOUNT_RATE)).div(new BN(10000));
    const savings = tradeFee.sub(discountedFee);

    console.log("\nFee comparison for swap amount:", swapAmount.toString());
    console.log("  Normal trade fee:", tradeFee.toString());
    console.log("  Discounted fee (with K token):", discountedFee.toString());
    console.log("  Savings (20%):", savings.toString());

    const savingsPercentage = savings.mul(new BN(10000)).div(tradeFee).toNumber() / 100;
    console.log(`  Savings percentage: ${savingsPercentage}%`);

    assert.equal(savingsPercentage, 20, "Should save exactly 20% on fees");
    console.log("✅ K token provides 20% fee discount");
  });
});

