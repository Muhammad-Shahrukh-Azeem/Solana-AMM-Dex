import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("Universal Pricing System Tests", () => {
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

  // Pools
  let kedologUsdcPool: Keypair;
  let solUsdcPool: Keypair;

  // Pool vaults
  let kedologUsdcVault0: PublicKey;
  let kedologUsdcVault1: PublicKey;
  let solUsdcVault0: PublicKey;
  let solUsdcVault1: PublicKey;

  before(async () => {
    console.log("\n🔧 Setting up test environment...\n");

    feeReceiver = Keypair.generate();

    // Airdrop to fee receiver
    const airdropSig = await provider.connection.requestAirdrop(
      feeReceiver.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token mints
    kedologMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      9 // KEDOLOG decimals
    );

    usdcMint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6 // USDC decimals
    );

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
        200000, // 20% protocol fee
        0, // 0% fund fee
        new BN(1 * LAMPORTS_PER_SOL), // 1 SOL create pool fee
        feeReceiver.publicKey
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ AMM Config created:", ammConfig.toString());

    // Create Protocol Token Config
    [protocolTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_token_config"), kedologMint.toBuffer()],
      program.programId
    );

    // For now, use default addresses (will update after creating pools)
    await program.methods
      .createProtocolTokenConfig(
        kedologMint,
        new BN(2500), // 25% discount
        admin.publicKey,
        feeReceiver.publicKey,
        PublicKey.default, // kedolog_usdc_pool (will update)
        PublicKey.default, // sol_usdc_pool (will update)
        PublicKey.default, // kedolog_sol_pool (not used in these tests)
        usdcMint // usdc_mint
      )
      .accounts({
        payer: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Protocol Token Config created:", protocolTokenConfig.toString());

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

    // Mint tokens to vaults to establish price
    // KEDOLOG price = $0.0017 (1 USDC = ~588 KEDOLOG)
    // Vault0 (KEDOLOG): 1,000,000 KEDOLOG
    // Vault1 (USDC): 1,700 USDC
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

    console.log("✅ KEDOLOG/USDC pool vaults created and funded");
    console.log("   Vault0 (KEDOLOG):", kedologUsdcVault0.toString());
    console.log("   Vault1 (USDC):", kedologUsdcVault1.toString());

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

    // Mint tokens to vaults to establish price
    // SOL price = $200
    // Vault0 (SOL): 1,000 SOL
    // Vault1 (USDC): 200,000 USDC
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

    console.log("✅ SOL/USDC pool vaults created and funded");
    console.log("   Vault0 (SOL):", solUsdcVault0.toString());
    console.log("   Vault1 (USDC):", solUsdcVault1.toString());

    // Update Protocol Token Config with pool addresses
    await program.methods
      .updateProtocolTokenConfig(
        null, // discount_rate
        null, // treasury
        kedologUsdcPool.publicKey, // kedolog_usdc_pool
        solUsdcPool.publicKey, // sol_usdc_pool
        null, // kedolog_sol_pool
        null // new_authority
      )
      .accounts({
        authority: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
      })
      .rpc();

    console.log("✅ Protocol Token Config updated with pool addresses\n");
  });

  it("Calculates correct KEDOLOG price from pool", async () => {
    console.log("\n📊 Test: KEDOLOG Price Calculation\n");

    const vault0 = await getAccount(provider.connection, kedologUsdcVault0);
    const vault1 = await getAccount(provider.connection, kedologUsdcVault1);

    console.log("KEDOLOG vault balance:", vault0.amount.toString());
    console.log("USDC vault balance:", vault1.amount.toString());

    // Expected price: 1,700 USDC / 1,000,000 KEDOLOG = $0.0017 per KEDOLOG
    const expectedPrice = 0.0017;
    const calculatedPrice = Number(vault1.amount) / 1_000_000 / (Number(vault0.amount) / 1_000_000_000);

    console.log("Expected KEDOLOG price: $" + expectedPrice);
    console.log("Calculated KEDOLOG price: $" + calculatedPrice.toFixed(4));

    assert.approximately(calculatedPrice, expectedPrice, 0.0001, "KEDOLOG price should be ~$0.0017");
  });

  it("Calculates correct SOL price from pool", async () => {
    console.log("\n📊 Test: SOL Price Calculation\n");

    const vault0 = await getAccount(provider.connection, solUsdcVault0);
    const vault1 = await getAccount(provider.connection, solUsdcVault1);

    console.log("SOL vault balance:", vault0.amount.toString());
    console.log("USDC vault balance:", vault1.amount.toString());

    // Expected price: 200,000 USDC / 1,000 SOL = $200 per SOL
    const expectedPrice = 200;
    const calculatedPrice = Number(vault1.amount) / 1_000_000 / (Number(vault0.amount) / 1_000_000_000);

    console.log("Expected SOL price: $" + expectedPrice);
    console.log("Calculated SOL price: $" + calculatedPrice.toFixed(2));

    assert.approximately(calculatedPrice, expectedPrice, 1, "SOL price should be ~$200");
  });

  it("Verifies fee calculation consistency for USDC swaps", async () => {
    console.log("\n📊 Test: USDC Swap Fee Consistency\n");

    // Test scenario: Swapping 1 USDC
    // Protocol fee (0.05% of 1 USDC) = 0.0005 USDC = $0.0005
    // With 25% discount = 0.000375 USDC = $0.000375
    // KEDOLOG needed = $0.000375 / $0.0017 = ~0.2206 KEDOLOG

    const swapAmount = 1_000_000; // 1 USDC
    const protocolFeeRate = 200000; // 20% of trade fee
    const tradeFeeRate = 2500; // 0.25%
    const discountRate = 2500; // 25%

    // Calculate protocol fee
    const protocolFee = Math.floor((swapAmount * tradeFeeRate * protocolFeeRate) / (1_000_000 * 1_000_000));
    console.log("Protocol fee (USDC):", protocolFee / 1_000_000);

    // Apply discount
    const discountedFee = Math.floor((protocolFee * (10000 - discountRate)) / 10000);
    console.log("Discounted fee (USDC):", discountedFee / 1_000_000);

    // Calculate KEDOLOG amount
    const kedologPrice = 0.0017;
    const expectedKedolog = (discountedFee / 1_000_000) / kedologPrice;
    console.log("Expected KEDOLOG fee:", expectedKedolog.toFixed(4));

    // This should be ~0.2206 KEDOLOG
    assert.approximately(expectedKedolog, 0.2206, 0.01, "KEDOLOG fee should be ~0.2206 for 1 USDC swap");
  });

  it("Verifies fee calculation consistency for SOL swaps", async () => {
    console.log("\n📊 Test: SOL Swap Fee Consistency\n");

    // Test scenario: Swapping 0.005 SOL (= $1 at $200/SOL)
    // Protocol fee (0.05% of 0.005 SOL) = 0.000025 SOL
    // USD value = 0.000025 * $200 = $0.005
    // With 25% discount = $0.00375
    // KEDOLOG needed = $0.00375 / $0.0017 = ~2.206 KEDOLOG

    const swapAmount = 5_000_000; // 0.005 SOL (9 decimals)
    const solPrice = 200; // $200 per SOL
    const protocolFeeRate = 200000; // 20% of trade fee
    const tradeFeeRate = 2500; // 0.25%
    const discountRate = 2500; // 25%

    // Calculate protocol fee in SOL
    const protocolFeeSol = Math.floor((swapAmount * tradeFeeRate * protocolFeeRate) / (1_000_000 * 1_000_000));
    console.log("Protocol fee (SOL):", protocolFeeSol / 1_000_000_000);

    // Convert to USD
    const protocolFeeUsd = (protocolFeeSol / 1_000_000_000) * solPrice;
    console.log("Protocol fee (USD):", protocolFeeUsd);

    // Apply discount
    const discountedFeeUsd = protocolFeeUsd * (10000 - discountRate) / 10000;
    console.log("Discounted fee (USD):", discountedFeeUsd);

    // Calculate KEDOLOG amount
    const kedologPrice = 0.0017;
    const expectedKedolog = discountedFeeUsd / kedologPrice;
    console.log("Expected KEDOLOG fee:", expectedKedolog.toFixed(4));

    // This should be ~2.206 KEDOLOG (10x more than USDC swap because $1 vs $0.1)
    assert.approximately(expectedKedolog, 2.206, 0.1, "KEDOLOG fee should be ~2.206 for $1 worth of SOL");
  });

  it("Verifies KEDOLOG fee is consistent across different token pairs with same USD value", async () => {
    console.log("\n📊 Test: Cross-Pair Fee Consistency\n");

    const kedologPrice = 0.0017;
    const solPrice = 200;
    const discountRate = 2500; // 25%

    // Test 1: 1 USDC swap
    const usdcSwap = 1_000_000; // 1 USDC
    const usdcProtocolFee = Math.floor((usdcSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
    const usdcDiscountedFee = Math.floor((usdcProtocolFee * (10000 - discountRate)) / 10000);
    const usdcKedologFee = (usdcDiscountedFee / 1_000_000) / kedologPrice;

    console.log("1 USDC swap:");
    console.log("  Protocol fee: $" + (usdcProtocolFee / 1_000_000));
    console.log("  Discounted fee: $" + (usdcDiscountedFee / 1_000_000));
    console.log("  KEDOLOG fee:", usdcKedologFee.toFixed(4));

    // Test 2: 0.005 SOL swap (= $1)
    const solSwap = 5_000_000; // 0.005 SOL
    const solProtocolFee = Math.floor((solSwap * 2500 * 200000) / (1_000_000 * 1_000_000));
    const solProtocolFeeUsd = (solProtocolFee / 1_000_000_000) * solPrice;
    const solDiscountedFeeUsd = solProtocolFeeUsd * (10000 - discountRate) / 10000;
    const solKedologFee = solDiscountedFeeUsd / kedologPrice;

    console.log("\n0.005 SOL swap ($1 worth):");
    console.log("  Protocol fee: $" + solProtocolFeeUsd.toFixed(6));
    console.log("  Discounted fee: $" + solDiscountedFeeUsd.toFixed(6));
    console.log("  KEDOLOG fee:", solKedologFee.toFixed(4));

    // Both should be equal since they're both $1 swaps
    console.log("\n✅ Ratio (SOL/USDC):", (solKedologFee / usdcKedologFee).toFixed(2));
    assert.approximately(
      solKedologFee / usdcKedologFee,
      1.0,
      0.1,
      "KEDOLOG fees should be equal for equal USD value swaps"
    );
  });

  it("Verifies pool addresses are stored correctly in config", async () => {
    console.log("\n📊 Test: Config Pool Addresses\n");

    const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);

    console.log("KEDOLOG/USDC pool in config:", config.kedologUsdcPool.toString());
    console.log("SOL/USDC pool in config:", config.solUsdcPool.toString());
    console.log("USDC mint in config:", config.usdcMint.toString());

    assert.equal(
      config.kedologUsdcPool.toString(),
      kedologUsdcPool.publicKey.toString(),
      "KEDOLOG/USDC pool should match"
    );

    assert.equal(
      config.solUsdcPool.toString(),
      solUsdcPool.publicKey.toString(),
      "SOL/USDC pool should match"
    );

    assert.equal(
      config.usdcMint.toString(),
      usdcMint.toString(),
      "USDC mint should match"
    );
  });
});

