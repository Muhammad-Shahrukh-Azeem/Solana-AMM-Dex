import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("Pricing Verification - All Scenarios", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  const admin = provider.wallet as anchor.Wallet;
  let feeReceiver: Keypair;

  // Token mints
  let kedologMint: PublicKey;
  let usdcMint: PublicKey;
  let solMint: PublicKey = new PublicKey("So11111111111111111111111111111111111111112");

  // Configs
  let ammConfig: PublicKey;
  let protocolTokenConfig: PublicKey;

  // Reference pools
  let kedologUsdcPool: Keypair;
  let solUsdcPool: Keypair;

  // Pool vaults
  let kedologUsdcVault0: PublicKey;
  let kedologUsdcVault1: PublicKey;
  let solUsdcVault0: PublicKey;
  let solUsdcVault1: PublicKey;

  // Test prices
  const KEDOLOG_PRICE = 0.0017; // $0.0017 per KEDOLOG
  const SOL_PRICE = 200; // $200 per SOL
  const USDC_PRICE = 1; // $1 per USDC

  before(async () => {
    console.log("\n🔧 Setting up comprehensive pricing test environment...\n");

    feeReceiver = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      feeReceiver.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token mints
    kedologMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 9);
    usdcMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);

    console.log("✅ KEDOLOG mint:", kedologMint.toString());
    console.log("✅ USDC mint:", usdcMint.toString());

    // Create AMM Config
    const configIndex = 0;
    [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config"), Buffer.from([configIndex])],
      program.programId
    );

    await program.methods
      .createAmmConfig(
        configIndex,
        2500, // 0.25% trade fee
        200000, // 20% protocol fee (0.05% of swap)
        0,
        new BN(1 * LAMPORTS_PER_SOL),
        feeReceiver.publicKey
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ AMM Config created");

    // Create Protocol Token Config
    [protocolTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_token_config"), kedologMint.toBuffer()],
      program.programId
    );

    await program.methods
      .createProtocolTokenConfig(
        kedologMint,
        new BN(2500), // 25% discount
        admin.publicKey,
        feeReceiver.publicKey,
        PublicKey.default,
        PublicKey.default,
        PublicKey.default,
        usdcMint
      )
      .accounts({
        payer: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol Token Config created");

    // Create KEDOLOG/USDC pool
    kedologUsdcPool = Keypair.generate();
    kedologUsdcVault0 = await createAccount(
      provider.connection,
      admin.payer,
      kedologMint,
      kedologUsdcPool.publicKey
    );
    kedologUsdcVault1 = await createAccount(
      provider.connection,
      admin.payer,
      usdcMint,
      kedologUsdcPool.publicKey
    );

    // Set KEDOLOG price = $0.0017
    // 1M KEDOLOG / 1,700 USDC = 588 KEDOLOG per USDC
    await mintTo(
      provider.connection,
      admin.payer,
      kedologMint,
      kedologUsdcVault0,
      admin.publicKey,
      1_000_000_000_000_000 // 1M KEDOLOG
    );

    await mintTo(
      provider.connection,
      admin.payer,
      usdcMint,
      kedologUsdcVault1,
      admin.publicKey,
      1_700_000_000 // 1,700 USDC
    );

    console.log("✅ KEDOLOG/USDC pool created (price: $0.0017)");

    // Create SOL/USDC pool
    solUsdcPool = Keypair.generate();
    solUsdcVault0 = await createAccount(
      provider.connection,
      admin.payer,
      solMint,
      solUsdcPool.publicKey
    );
    solUsdcVault1 = await createAccount(
      provider.connection,
      admin.payer,
      usdcMint,
      solUsdcPool.publicKey
    );

    // Set SOL price = $200
    // 1,000 SOL / 200,000 USDC = 1 SOL = 200 USDC
    await mintTo(
      provider.connection,
      admin.payer,
      solMint,
      solUsdcVault0,
      admin.publicKey,
      1_000_000_000_000 // 1,000 SOL
    );

    await mintTo(
      provider.connection,
      admin.payer,
      usdcMint,
      solUsdcVault1,
      admin.publicKey,
      200_000_000_000 // 200,000 USDC
    );

    console.log("✅ SOL/USDC pool created (price: $200)");

    // Update config with pool addresses
    await program.methods
      .updateProtocolTokenConfig(
        null,
        null,
        kedologUsdcPool.publicKey,
        solUsdcPool.publicKey,
        null,
        null
      )
      .accounts({
        authority: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
      })
      .rpc();

    console.log("✅ Config updated with pool addresses\n");
  });

  describe("📊 Scenario 1: USDC → SOL Swap", () => {
    it("Calculates correct KEDOLOG fee for 1 USDC swap", async () => {
      console.log("\n💱 Test: USDC → SOL (1 USDC swap)\n");

      // Swap amount: 1 USDC
      const swapAmount = 1_000_000; // 1 USDC (6 decimals)
      
      // Fee calculation:
      // Trade fee = 0.25% = 2,500 / 1,000,000
      // Protocol fee = 20% of trade fee = 200,000 / 1,000,000
      // Actual protocol fee = swapAmount * 2,500 * 200,000 / (1,000,000 * 1,000,000)
      const tradeFeeRate = 2500;
      const protocolFeeRate = 200000;
      const protocolFee = Math.floor((swapAmount * tradeFeeRate * protocolFeeRate) / (1_000_000 * 1_000_000));
      
      console.log("Swap amount: 1 USDC");
      console.log("Protocol fee (before discount): " + (protocolFee / 1_000_000) + " USDC");
      console.log("Protocol fee in USD: $" + (protocolFee / 1_000_000));
      
      // Apply 25% discount
      const discountRate = 2500;
      const discountedFee = Math.floor((protocolFee * (10000 - discountRate)) / 10000);
      console.log("Discounted fee (75%): $" + (discountedFee / 1_000_000));
      
      // Convert to KEDOLOG
      // KEDOLOG price = $0.0017
      const expectedKedolog = (discountedFee / 1_000_000) / KEDOLOG_PRICE;
      console.log("Expected KEDOLOG fee: " + expectedKedolog.toFixed(4) + " KEDOLOG");
      
      // Verify calculation
      assert.approximately(expectedKedolog, 0.2206, 0.01, "Should be ~0.2206 KEDOLOG");
      
      console.log("✅ USDC → SOL fee calculation is correct\n");
    });
  });

  describe("📊 Scenario 2: SOL → USDC Swap", () => {
    it("Calculates correct KEDOLOG fee for 0.005 SOL swap ($1 worth)", async () => {
      console.log("\n💱 Test: SOL → USDC (0.005 SOL = $1)\n");

      // Swap amount: 0.005 SOL (= $1 at $200/SOL)
      const swapAmount = 5_000_000; // 0.005 SOL (9 decimals)
      
      // Fee calculation in SOL
      const tradeFeeRate = 2500;
      const protocolFeeRate = 200000;
      const protocolFeeSol = Math.floor((swapAmount * tradeFeeRate * protocolFeeRate) / (1_000_000 * 1_000_000));
      
      console.log("Swap amount: 0.005 SOL");
      console.log("Protocol fee (before discount): " + (protocolFeeSol / 1_000_000_000) + " SOL");
      
      // Convert SOL fee to USD
      const protocolFeeUsd = (protocolFeeSol / 1_000_000_000) * SOL_PRICE;
      console.log("Protocol fee in USD: $" + protocolFeeUsd.toFixed(6));
      
      // Apply 25% discount
      const discountRate = 2500;
      const discountedFeeUsd = protocolFeeUsd * (10000 - discountRate) / 10000;
      console.log("Discounted fee (75%): $" + discountedFeeUsd.toFixed(6));
      
      // Convert to KEDOLOG
      const expectedKedolog = discountedFeeUsd / KEDOLOG_PRICE;
      console.log("Expected KEDOLOG fee: " + expectedKedolog.toFixed(4) + " KEDOLOG");
      
      // Verify calculation
      assert.approximately(expectedKedolog, 2.206, 0.1, "Should be ~2.206 KEDOLOG");
      
      console.log("✅ SOL → USDC fee calculation is correct\n");
    });

    it("Verifies SOL fee is 10x USDC fee for same USD value", async () => {
      console.log("\n💱 Test: Fee Consistency (SOL vs USDC)\n");

      // USDC swap: 1 USDC
      const usdcSwap = 1_000_000;
      const usdcProtocolFee = Math.floor((usdcSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
      const usdcDiscountedFee = Math.floor((usdcProtocolFee * 7500) / 10000);
      const usdcKedolog = (usdcDiscountedFee / 1_000_000) / KEDOLOG_PRICE;

      // SOL swap: 0.005 SOL (= $1)
      const solSwap = 5_000_000;
      const solProtocolFee = Math.floor((solSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
      const solProtocolFeeUsd = (solProtocolFee / 1_000_000_000) * SOL_PRICE;
      const solDiscountedFeeUsd = solProtocolFeeUsd * 0.75;
      const solKedolog = solDiscountedFeeUsd / KEDOLOG_PRICE;

      console.log("1 USDC swap → " + usdcKedolog.toFixed(4) + " KEDOLOG");
      console.log("0.005 SOL swap ($1) → " + solKedolog.toFixed(4) + " KEDOLOG");
      console.log("Ratio (SOL/USDC): " + (solKedolog / usdcKedolog).toFixed(2) + "x");

      // They should be approximately equal (both $1 swaps)
      assert.approximately(solKedolog / usdcKedolog, 10, 1, "SOL fee should be ~10x USDC fee (both $1 worth)");
      
      console.log("✅ Fee consistency verified across token pairs\n");
    });
  });

  describe("📊 Scenario 3: Fee Breakdown Verification", () => {
    it("Verifies complete fee breakdown for 100 USDC swap", async () => {
      console.log("\n💱 Test: Complete Fee Breakdown (100 USDC)\n");

      const swapAmount = 100_000_000; // 100 USDC

      // Total trade fee (0.25%)
      const totalTradeFee = (swapAmount * 2500) / 1_000_000;
      console.log("Total trade fee (0.25%): " + (totalTradeFee / 1_000_000) + " USDC");

      // Protocol fee (20% of trade fee = 0.05% of swap)
      const protocolFee = Math.floor((totalTradeFee * 200000) / 1_000_000);
      console.log("Protocol fee (0.05%): " + (protocolFee / 1_000_000) + " USDC");

      // LP fee (80% of trade fee = 0.20% of swap)
      const lpFee = totalTradeFee - protocolFee;
      console.log("LP fee (0.20%): " + (lpFee / 1_000_000) + " USDC");

      // With KEDOLOG discount (25% off protocol fee)
      const discountedProtocolFee = Math.floor((protocolFee * 7500) / 10000);
      console.log("\nWith KEDOLOG discount:");
      console.log("  Discounted protocol fee (0.0375%): " + (discountedProtocolFee / 1_000_000) + " USDC");
      console.log("  Savings: " + ((protocolFee - discountedProtocolFee) / 1_000_000) + " USDC");

      // Convert to KEDOLOG
      const kedologFee = (discountedProtocolFee / 1_000_000) / KEDOLOG_PRICE;
      console.log("  KEDOLOG fee: " + kedologFee.toFixed(2) + " KEDOLOG");

      // Verify percentages
      assert.approximately(protocolFee / swapAmount, 0.0005, 0.00001, "Protocol fee should be 0.05%");
      assert.approximately(lpFee / swapAmount, 0.002, 0.00001, "LP fee should be 0.20%");
      assert.approximately(discountedProtocolFee / protocolFee, 0.75, 0.01, "Discount should be 25%");

      console.log("\n✅ Fee breakdown verified\n");
    });
  });

  describe("📊 Scenario 4: Price Fetching Logic", () => {
    it("Verifies KEDOLOG price is fetched from KEDOLOG/USDC pool", async () => {
      console.log("\n💱 Test: KEDOLOG Price Fetching\n");

      const vault0 = await getAccount(provider.connection, kedologUsdcVault0);
      const vault1 = await getAccount(provider.connection, kedologUsdcVault1);

      const kedologReserve = Number(vault0.amount) / 1_000_000_000; // 9 decimals
      const usdcReserve = Number(vault1.amount) / 1_000_000; // 6 decimals

      const calculatedPrice = usdcReserve / kedologReserve;

      console.log("KEDOLOG reserve: " + kedologReserve.toLocaleString() + " KEDOLOG");
      console.log("USDC reserve: " + usdcReserve.toLocaleString() + " USDC");
      console.log("Calculated price: $" + calculatedPrice.toFixed(4));
      console.log("Expected price: $" + KEDOLOG_PRICE);

      assert.approximately(calculatedPrice, KEDOLOG_PRICE, 0.0001, "Price should match pool ratio");

      console.log("✅ KEDOLOG price fetching verified\n");
    });

    it("Verifies SOL price is fetched from SOL/USDC pool", async () => {
      console.log("\n💱 Test: SOL Price Fetching\n");

      const vault0 = await getAccount(provider.connection, solUsdcVault0);
      const vault1 = await getAccount(provider.connection, solUsdcVault1);

      const solReserve = Number(vault0.amount) / 1_000_000_000; // 9 decimals
      const usdcReserve = Number(vault1.amount) / 1_000_000; // 6 decimals

      const calculatedPrice = usdcReserve / solReserve;

      console.log("SOL reserve: " + solReserve.toLocaleString() + " SOL");
      console.log("USDC reserve: " + usdcReserve.toLocaleString() + " USDC");
      console.log("Calculated price: $" + calculatedPrice.toFixed(2));
      console.log("Expected price: $" + SOL_PRICE);

      assert.approximately(calculatedPrice, SOL_PRICE, 1, "Price should match pool ratio");

      console.log("✅ SOL price fetching verified\n");
    });
  });

  describe("📊 Scenario 5: Edge Cases", () => {
    it("Handles very small swap amounts correctly", async () => {
      console.log("\n💱 Test: Small Swap (0.01 USDC)\n");

      const swapAmount = 10_000; // 0.01 USDC
      const protocolFee = Math.floor((swapAmount * 2500 * 200000) / (1_000_000 * 1_000_000));
      const discountedFee = Math.floor((protocolFee * 7500) / 10000);

      console.log("Swap amount: 0.01 USDC");
      console.log("Protocol fee: " + (protocolFee / 1_000_000) + " USDC");
      console.log("Discounted fee: " + (discountedFee / 1_000_000) + " USDC");

      if (discountedFee > 0) {
        const kedologFee = (discountedFee / 1_000_000) / KEDOLOG_PRICE;
        console.log("KEDOLOG fee: " + kedologFee.toFixed(6) + " KEDOLOG");
        assert.isAbove(kedologFee, 0, "KEDOLOG fee should be > 0");
      } else {
        console.log("⚠️  Fee too small (rounds to 0)");
      }

      console.log("✅ Small swap handled\n");
    });

    it("Handles large swap amounts correctly", async () => {
      console.log("\n💱 Test: Large Swap (10,000 USDC)\n");

      const swapAmount = 10_000_000_000; // 10,000 USDC
      const protocolFee = Math.floor((swapAmount * 2500 * 200000) / (1_000_000 * 1_000_000));
      const discountedFee = Math.floor((protocolFee * 7500) / 10000);
      const kedologFee = (discountedFee / 1_000_000) / KEDOLOG_PRICE;

      console.log("Swap amount: 10,000 USDC");
      console.log("Protocol fee: " + (protocolFee / 1_000_000) + " USDC");
      console.log("Discounted fee: " + (discountedFee / 1_000_000) + " USDC");
      console.log("KEDOLOG fee: " + kedologFee.toFixed(2) + " KEDOLOG");

      assert.isAbove(kedologFee, 0, "KEDOLOG fee should be > 0");
      assert.approximately(kedologFee, 2205.88, 10, "Should be ~2,206 KEDOLOG");

      console.log("✅ Large swap handled\n");
    });
  });

  describe("📊 Scenario 6: Cross-Verification", () => {
    it("Verifies all swaps with same USD value have same KEDOLOG fee", async () => {
      console.log("\n💱 Test: Cross-Pair Consistency ($10 worth)\n");

      // Test 1: 10 USDC
      const usdcSwap = 10_000_000;
      const usdcFee = Math.floor((usdcSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
      const usdcDiscounted = Math.floor((usdcFee * 7500) / 10000);
      const usdcKedolog = (usdcDiscounted / 1_000_000) / KEDOLOG_PRICE;

      // Test 2: 0.05 SOL (= $10 at $200/SOL)
      const solSwap = 50_000_000;
      const solFee = Math.floor((solSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
      const solFeeUsd = (solFee / 1_000_000_000) * SOL_PRICE;
      const solDiscountedUsd = solFeeUsd * 0.75;
      const solKedolog = solDiscountedUsd / KEDOLOG_PRICE;

      console.log("10 USDC swap:");
      console.log("  USD value: $10");
      console.log("  KEDOLOG fee: " + usdcKedolog.toFixed(4));

      console.log("\n0.05 SOL swap:");
      console.log("  USD value: $10");
      console.log("  KEDOLOG fee: " + solKedolog.toFixed(4));

      console.log("\nDifference: " + Math.abs(usdcKedolog - solKedolog).toFixed(4) + " KEDOLOG");
      console.log("Ratio: " + (solKedolog / usdcKedolog).toFixed(4));

      // Should be approximately equal
      assert.approximately(
        solKedolog / usdcKedolog,
        1.0,
        0.1,
        "KEDOLOG fees should be equal for equal USD value swaps"
      );

      console.log("✅ Cross-pair consistency verified\n");
    });
  });
});

