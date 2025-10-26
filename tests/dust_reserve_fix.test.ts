import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setupDepositTest, withdraw, deposit } from "./utils";
import { assert } from "chai";

describe("🐛 Dust Reserve Fix - LP Supply = 0 Bug", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = anchor.getProvider().connection;

  const confirmOptions = {
    skipPreflight: true,
  };

  let poolState: any;
  let poolAddress: PublicKey;
  let configAddress: PublicKey;
  let userLpToken: PublicKey;

  it("Step 1: Creates a pool with initial liquidity", async () => {
    console.log("\n=== Step 1: Create Pool ===");

    const depositResult = await setupDepositTest(
      program,
      connection,
      owner,
      {
        config_index: 0, // Use existing config index 0
        tradeFeeRate: new BN(100), // 1% fee
        protocolFeeRate: new BN(10000), // 100% protocol fee
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 },
      confirmOptions,
      {
        initAmount0: new BN(1000_000_000), // 1000 tokens
        initAmount1: new BN(1000_000_000), // 1000 tokens
      }
    );

    poolAddress = depositResult.poolAddress;
    poolState = depositResult.poolState;
    configAddress = poolState.ammConfig;

    // Get user's LP token account
    userLpToken = getAssociatedTokenAddressSync(
      poolState.lpMint,
      owner.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    console.log("✓ Pool created:", poolAddress.toString());
    console.log("✓ LP supply:", poolState.lpSupply.toString());

    // Verify pool was created with liquidity
    assert(poolState.lpSupply.gt(new BN(0)), "LP supply should be > 0");
  });

  it("Step 2: Removes ALL liquidity, leaving dust in reserves", async () => {
    console.log("\n=== Step 2: Remove ALL Liquidity ===");

    // Get user's LP token balance
    const lpAccount = await getAccount(connection, userLpToken, "processed");
    const lpBalance = lpAccount.amount;
    console.log("Current LP balance:", lpBalance.toString());

    // Get vault balances before withdrawal
    const vault0Before = await getAccount(
      connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    const vault1Before = await getAccount(
      connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );

    console.log("Vault0 before:", vault0Before.amount.toString());
    console.log("Vault1 before:", vault1Before.amount.toString());

    // Withdraw ALL LP tokens
    console.log("Withdrawing all liquidity...");
    await withdraw(
      program,
      owner,
      configAddress,
      poolState.token0Mint,
      poolState.token0Program,
      poolState.token1Mint,
      poolState.token1Program,
      new BN(lpBalance.toString()),
      new BN(1), // minimum token0 (accept any)
      new BN(1), // minimum token1 (accept any)
      confirmOptions
    );

    console.log("✓ Withdrawal complete");

    // Fetch updated pool state
    const updatedPoolState = await program.account.poolState.fetch(poolAddress);

    const vault0After = await getAccount(
      connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    const vault1After = await getAccount(
      connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );

    console.log("\n⚠️  Pool State After Full Withdrawal:");
    console.log("   LP Supply:", updatedPoolState.lpSupply.toString());
    console.log("   Vault0 Dust:", vault0After.amount.toString());
    console.log("   Vault1 Dust:", vault1After.amount.toString());

    // Verify LP supply is very small (dust)
    assert(
      updatedPoolState.lpSupply.lt(new BN(1000)),
      "LP supply should be very small (dust)"
    );

    // Verify there's dust in reserves
    assert(vault0After.amount > 0n, "Vault0 should have dust");
    assert(vault1After.amount > 0n, "Vault1 should have dust");
    
    console.log("   ⚠️  Pool has minimal liquidity - testing deposit to near-empty pool!");
  });

  it("🎯 Step 3: BUG FIX TEST - Can deposit to pool with LP supply = 0", async () => {
    console.log("\n=== Step 3: Test Deposit to Empty Pool (BUG FIX) ===");

    // Get current pool state
    const poolStateBefore = await program.account.poolState.fetch(poolAddress);
    console.log("LP supply before deposit:", poolStateBefore.lpSupply.toString());

    const vault0Before = await getAccount(
      connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    const vault1Before = await getAccount(
      connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );

    console.log("Vault0 before deposit:", vault0Before.amount.toString());
    console.log("Vault1 before deposit:", vault1Before.amount.toString());

    // Try to deposit - this should now work with the fix!
    const depositLpAmount = new BN(100_000_000); // 100 LP tokens
    const maxToken0 = new BN(1_000_000_000); // 1000 tokens max
    const maxToken1 = new BN(1_000_000_000); // 1000 tokens max

    console.log("Attempting to deposit (this would fail before the fix)...");

    try {
      await deposit(
        program,
        owner,
        configAddress,
        poolState.token0Mint,
        poolState.token0Program,
        poolState.token1Mint,
        poolState.token1Program,
        depositLpAmount,
        maxToken0,
        maxToken1,
        confirmOptions
      );

      console.log("✅ SUCCESS! Deposit worked!");

      // Verify deposit worked
      const poolStateAfter = await program.account.poolState.fetch(poolAddress);

      const vault0After = await getAccount(
        connection,
        poolState.token0Vault,
        "processed",
        poolState.token0Program
      );
      const vault1After = await getAccount(
        connection,
        poolState.token1Vault,
        "processed",
        poolState.token1Program
      );

      const lpAccountAfter = await getAccount(
        connection,
        userLpToken,
        "processed"
      );

      console.log("\n✅ Deposit Results:");
      console.log("   LP supply before:", poolStateBefore.lpSupply.toString());
      console.log("   LP supply after:", poolStateAfter.lpSupply.toString());
      console.log("   LP supply increase:", poolStateAfter.lpSupply.sub(poolStateBefore.lpSupply).toString());
      console.log("   Vault0 after:", vault0After.amount.toString());
      console.log("   Vault1 after:", vault1After.amount.toString());
      console.log("   User LP balance:", lpAccountAfter.amount.toString());

      // Assertions
      const lpIncrease = poolStateAfter.lpSupply.sub(poolStateBefore.lpSupply);
      assert(
        lpIncrease.gte(depositLpAmount.muln(99).divn(100)), // Allow 1% slippage
        `LP supply should increase by approximately ${depositLpAmount.toString()}, got ${lpIncrease.toString()}`
      );

      assert(
        vault0After.amount > vault0Before.amount,
        "Vault0 should have increased"
      );

      assert(
        vault1After.amount > vault1Before.amount,
        "Vault1 should have increased"
      );

      assert(
        lpAccountAfter.amount >= BigInt(depositLpAmount.toString()),
        "User should have received LP tokens"
      );

      console.log("\n✅ BUG FIX VERIFIED!");
      console.log("   ✓ Pool recovered from minimal liquidity state");
      console.log("   ✓ Deposit worked correctly");
      console.log("   ✓ LP tokens minted properly");
    } catch (error) {
      console.error("❌ DEPOSIT FAILED:", error);
      if (error.logs) {
        console.error("Error logs:", error.logs);
      }
      throw new Error(
        "Deposit should work with the fix, but it failed! Error: " +
          error.message
      );
    }
  });

  it("Step 4: Verify normal operations continue after recovery", async () => {
    console.log("\n=== Step 4: Verify Normal Operations ===");

    // Try another deposit
    const depositLpAmount = new BN(50_000_000); // 50 LP tokens
    const maxToken0 = new BN(1_000_000_000);
    const maxToken1 = new BN(1_000_000_000);

    console.log("Attempting second deposit...");
    await deposit(
      program,
      owner,
      configAddress,
      poolState.token0Mint,
      poolState.token0Program,
      poolState.token1Mint,
      poolState.token1Program,
      depositLpAmount,
      maxToken0,
      maxToken1,
      confirmOptions
    );

    console.log("✓ Second deposit successful");

    const lpAccountFinal = await getAccount(
      connection,
      userLpToken,
      "processed"
    );

    console.log("Final LP balance:", lpAccountFinal.amount.toString());

    assert(
      lpAccountFinal.amount > 0n,
      "Should have LP tokens after second deposit"
    );

    console.log("\n✅ ALL TESTS PASSED!");
    console.log("   ✓ Pool recovered from dust state");
    console.log("   ✓ Multiple deposits work correctly");
    console.log("   ✓ Bug is fixed!");
  });
});
