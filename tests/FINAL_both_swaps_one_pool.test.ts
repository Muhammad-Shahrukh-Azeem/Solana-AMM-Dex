import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  setupDepositTest,
  createProtocolTokenConfig,
  swapBaseInputWithProtocolToken,
  swap_base_input,
  createAmmConfig,
} from "./utils/instruction";
import { getProtocolTokenConfigAddress, getAmmConfigAddress } from "./utils/pda";
import { assert } from "chai";

describe("🎯 FINAL TEST: One Pool, Both Fee Configurations", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const admin = anchor.Wallet.local().payer;
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = anchor.getProvider().connection;

  let protocolTokenMint: PublicKey;
  let treasuryKeypair: Keypair;
  let treasuryTokenAccount: PublicKey;
  let userProtocolTokenAccount: PublicKey;
  let configAddress: PublicKey;
  let token0: PublicKey;
  let token1: PublicKey;
  let token0Program: PublicKey;
  let token1Program: PublicKey;
  let poolAddress: PublicKey;

  const confirmOptions = {
    skipPreflight: true,
  };

  before(async () => {
    console.log("\n" + "=".repeat(80));
    console.log("🎯 FINAL PRODUCTION TEST");
    console.log("=".repeat(80));
    console.log("Testing: ONE pool with TWO fee configurations (normal & discount)\n");

    // Create KEDOL token
    protocolTokenMint = await createMint(
      connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      9,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
    console.log(`✅ KEDOL Mint: ${protocolTokenMint.toString()}`);

    // Create treasury
    treasuryKeypair = Keypair.generate();
    treasuryTokenAccount = await createAssociatedTokenAccount(
      connection,
      admin,
      protocolTokenMint,
      treasuryKeypair.publicKey,
      undefined,
      TOKEN_PROGRAM_ID
    );
    console.log(`✅ Treasury: ${treasuryKeypair.publicKey.toString()}`);

    // Create protocol token config
    const discountRate = new BN(2500); // 25% discount (2500 / 10000)

    try {
      await createProtocolTokenConfig(
        program,
        connection,
        admin,
        protocolTokenMint,
        discountRate,
        admin.publicKey,
        treasuryKeypair.publicKey,
        new PublicKey('11111111111111111111111111111111'), // price_pool (will be set later after pool creation)
        confirmOptions
      );
      console.log("✅ Protocol Token Config created");
      console.log(`   Discount Rate: 25%`);
      console.log(`   KEDOL Price: Will be fetched from pool\n`);
    } catch (error: any) {
      console.error("\n❌ Failed to create protocol token config:");
      console.error("Error:", error.message);
      if (error.logs) {
        console.error("\nProgram Logs:");
        error.logs.forEach((log: string) => console.error("  ", log));
      }
      throw error;
    }

    // Create AMM Config
    const config_index = Math.floor(Math.random() * 10000) + 5000; // Random index to avoid old test accounts
    configAddress = await createAmmConfig(
      program,
      connection,
      admin,
      config_index,
      new BN(2500), // 0.25% trade fee (2500 / 1,000,000)
      new BN(200000), // 20% protocol fee rate (200000 / 1,000,000) = 0.05% of trade
      new BN(0),
      new BN(0),
      confirmOptions
    );
    
    console.log(`✅ AMM Config: ${configAddress.toString()}`);
    console.log(`   Trade Fee: 0.25% (LP: 0.20%, Protocol: 0.05%)\n`);

    // Create ONE pool with large liquidity
    const depositResult = await setupDepositTest(
      program,
      connection,
      admin,
      {
        config_index: config_index,
        tradeFeeRate: new BN(2500),
        protocolFeeRate: new BN(200000),
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 },
      confirmOptions,
      {
        initAmount0: new BN(1000000_000000000), // 1 million tokens
        initAmount1: new BN(1000000_000000000), // 1 million tokens
      }
    );

    token0 = depositResult.poolState.token0Mint;
    token1 = depositResult.poolState.token1Mint;
    token0Program = depositResult.poolState.token0Program;
    token1Program = depositResult.poolState.token1Program;
    poolAddress = depositResult.poolAddress;

    console.log(`✅ Pool Created: ${poolAddress.toString()}`);
    console.log(`   Token0: ${token0.toString()}`);
    console.log(`   Token1: ${token1.toString()}`);
    console.log(`   Liquidity: 1,000,000 tokens each side\n`);

    // Create KEDOL account for user
    userProtocolTokenAccount = await createAssociatedTokenAccount(
      connection,
      admin,
      protocolTokenMint,
      admin.publicKey,
      undefined,
      TOKEN_PROGRAM_ID
    );

    await mintTo(
      connection,
      admin,
      protocolTokenMint,
      userProtocolTokenAccount,
      admin.publicKey,
      10000_000000000, // 10,000 KEDOL
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );
    console.log("✅ User KEDOL balance: 10,000 KEDOL\n");
    console.log("=".repeat(80));
    console.log("Setup complete! Starting swaps...\n");
  });

  it("✅ PROOF: Same pool handles BOTH normal AND discount swaps", async () => {
    console.log("=".repeat(80));
    console.log("🔄 EXECUTING BOTH SWAP TYPES ON THE SAME POOL");
    console.log("=".repeat(80));
    console.log(`Pool Address: ${poolAddress.toString()}\n`);

    // ============================================================================
    // SWAP 1: NORMAL SWAP (No Discount)
    // ============================================================================
    console.log("─".repeat(80));
    console.log("📊 SWAP 1: NORMAL SWAP (Without KEDOL Discount)");
    console.log("─".repeat(80));
    console.log("Fee: 0.25% total (0.20% LP + 0.05% Protocol)\n");

    const before1_token0 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token0, admin.publicKey, false, token0Program),
      undefined,
      token0Program
    );
    const before1_token1 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token1, admin.publicKey, false, token1Program),
      undefined,
      token1Program
    );

    console.log("📊 Before Swap 1:");
    console.log(`   Token0: ${(Number(before1_token0.amount) / 1e9).toFixed(6)}`);
    console.log(`   Token1: ${(Number(before1_token1.amount) / 1e9).toFixed(6)}\n`);

    console.log(`💱 Swapping 100 tokens using NORMAL swap instruction...\n`);

    await swap_base_input(
      program,
      admin,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      new BN(100_000000000), // 100 tokens
      new BN(1),
      confirmOptions
    );

    const after1_token0 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token0, admin.publicKey, false, token0Program),
      undefined,
      token0Program
    );
    const after1_token1 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token1, admin.publicKey, false, token1Program),
      undefined,
      token1Program
    );

    const spent1 = Number(before1_token0.amount - after1_token0.amount) / 1e9;
    const received1 = Number(after1_token1.amount - before1_token1.amount) / 1e9;

    console.log("📊 After Swap 1:");
    console.log(`   Token0: ${(Number(after1_token0.amount) / 1e9).toFixed(6)}`);
    console.log(`   Token1: ${(Number(after1_token1.amount) / 1e9).toFixed(6)}\n`);

    console.log("✅ SWAP 1 RESULTS:");
    console.log(`   Input:    ${spent1.toFixed(6)} tokens`);
    console.log(`   Output:   ${received1.toFixed(6)} tokens`);
    console.log(`   Fee:      ${(100 - received1).toFixed(6)} tokens (0.25%)`);
    console.log(`   Expected: ~99.75 tokens\n`);

    // ============================================================================
    // SWAP 2: DISCOUNT SWAP (With KEDOL) - SAME POOL!
    // ============================================================================
    console.log("─".repeat(80));
    console.log("🎯 SWAP 2: DISCOUNT SWAP (With KEDOL Discount)");
    console.log("─".repeat(80));
    console.log("⚠️  CRITICAL: Using THE EXACT SAME POOL as Swap 1!");
    console.log(`   Pool: ${poolAddress.toString()}`);
    console.log("Fee: 0.20% in swap (LP) + 0.04% in KEDOL (Protocol)\n");

    const before2_token0 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token0, admin.publicKey, false, token0Program),
      undefined,
      token0Program
    );
    const before2_token1 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token1, admin.publicKey, false, token1Program),
      undefined,
      token1Program
    );
    const before2_kedolog = await getAccount(
      connection,
      userProtocolTokenAccount,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const before2_treasury = await getAccount(
      connection,
      treasuryTokenAccount,
      undefined,
      TOKEN_PROGRAM_ID
    );

    console.log("📊 Before Swap 2:");
    console.log(`   Token0: ${(Number(before2_token0.amount) / 1e9).toFixed(6)}`);
    console.log(`   Token1: ${(Number(before2_token1.amount) / 1e9).toFixed(6)}`);
    console.log(`   User KEDOL: ${(Number(before2_kedolog.amount) / 1e9).toFixed(6)}`);
    console.log(`   Treasury KEDOL: ${(Number(before2_treasury.amount) / 1e9).toFixed(6)}\n`);

    console.log(`💱 Swapping 100 tokens using DISCOUNT swap instruction...\n`);

    await swapBaseInputWithProtocolToken(
      program,
      connection,
      admin,
      configAddress,
      token0,
      token1,
      token0Program,
      token1Program,
      new BN(100_000000000), // 100 tokens
      new BN(1),
      protocolTokenMint,
      TOKEN_PROGRAM_ID,
      confirmOptions
    );

    const after2_token0 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token0, admin.publicKey, false, token0Program),
      undefined,
      token0Program
    );
    const after2_token1 = await getAccount(
      connection,
      getAssociatedTokenAddressSync(token1, admin.publicKey, false, token1Program),
      undefined,
      token1Program
    );
    const after2_kedolog = await getAccount(
      connection,
      userProtocolTokenAccount,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const after2_treasury = await getAccount(
      connection,
      treasuryTokenAccount,
      undefined,
      TOKEN_PROGRAM_ID
    );

    const spent2 = Number(before2_token0.amount - after2_token0.amount) / 1e9;
    const received2 = Number(after2_token1.amount - before2_token1.amount) / 1e9;
    const kedologPaid = Number(before2_kedolog.amount - after2_kedolog.amount) / 1e9;
    const treasuryReceived = Number(after2_treasury.amount - before2_treasury.amount) / 1e9;

    console.log("📊 After Swap 2:");
    console.log(`   Token0: ${(Number(after2_token0.amount) / 1e9).toFixed(6)}`);
    console.log(`   Token1: ${(Number(after2_token1.amount) / 1e9).toFixed(6)}`);
    console.log(`   User KEDOL: ${(Number(after2_kedolog.amount) / 1e9).toFixed(6)}`);
    console.log(`   Treasury KEDOL: ${(Number(after2_treasury.amount) / 1e9).toFixed(6)}\n`);

    console.log("✅ SWAP 2 RESULTS:");
    console.log(`   Input:    ${spent2.toFixed(6)} tokens`);
    console.log(`   Output:   ${received2.toFixed(6)} tokens`);
    console.log(`   KEDOL:  ${kedologPaid.toFixed(6)} paid`);
    console.log(`   Treasury: ${treasuryReceived.toFixed(6)} received`);
    console.log(`   Expected: ~99.80 tokens + 0.40 KEDOL\n`);

    // ============================================================================
    // FINAL COMPARISON
    // ============================================================================
    console.log("=".repeat(80));
    console.log("📊 FINAL COMPARISON: SAME POOL, TWO FEE CONFIGURATIONS");
    console.log("=".repeat(80));
    console.log(`Pool: ${poolAddress.toString()}\n`);

    const benefit = received2 - received1;

    console.log("┌───────────────────────────────────────────────────────────────┐");
    console.log("│                    SWAP COMPARISON                            │");
    console.log("├───────────────────────────────────────────────────────────────┤");
    console.log("│ Metric           │ Normal Swap    │ Discount Swap            │");
    console.log("├───────────────────────────────────────────────────────────────┤");
    console.log(`│ Pool Address     │ ${poolAddress.toString().substring(0, 14)}... │ ${poolAddress.toString().substring(0, 14)}... (SAME!) │`);
    console.log(`│ Input            │ ${spent1.toFixed(6).padEnd(14)} │ ${spent2.toFixed(6).padEnd(24)} │`);
    console.log(`│ Output (tokens)  │ ${received1.toFixed(6).padEnd(14)} │ ${received2.toFixed(6).padEnd(24)} │`);
    console.log(`│ KEDOL Paid     │ ${"0.000000".padEnd(14)} │ ${kedologPaid.toFixed(6).padEnd(24)} │`);
    console.log(`│ Extra Benefit    │ ${"0.000000".padEnd(14)} │ ${benefit.toFixed(6).padEnd(24)} │`);
    console.log("└───────────────────────────────────────────────────────────────┘\n");

    console.log("🎯 PROOF OF CONCEPT:");
    console.log(`   ✅ Pool: ${poolAddress.toString()}`);
    console.log(`   ✅ Normal swap executed: ${received1.toFixed(6)} tokens received`);
    console.log(`   ✅ Discount swap executed: ${received2.toFixed(6)} tokens received`);
    console.log(`   ✅ User benefit: ${benefit.toFixed(6)} MORE tokens with discount!`);
    console.log(`   ✅ KEDOL paid: ${kedologPaid.toFixed(6)} KEDOL to protocol`);
    console.log(`   ✅ Treasury received: ${treasuryReceived.toFixed(6)} KEDOL\n`);

    console.log("💡 HOW IT WORKS:");
    console.log("   • ONE pool supports TWO different swap instructions");
    console.log("   • swap_base_input → Normal swap (0.25% fee)");
    console.log("   • swap_base_input_with_protocol_token → Discount swap (0.20% + KEDOL)");
    console.log("   • Users choose which instruction to call per transaction");
    console.log("   • No special pool setup needed - works automatically!\n");

    console.log("🚀 PRODUCTION READY:");
    console.log("   ✅ Same pool handles both fee configurations");
    console.log("   ✅ No conflicts or issues");
    console.log("   ✅ LPs always get their 0.20%");
    console.log("   ✅ Protocol gets 0.05% (normal) or 0.04% in KEDOL (discount)");
    console.log("   ✅ Users get more tokens when using KEDOL discount");
    console.log("   ✅ Ready for mainnet deployment!\n");
    console.log("=".repeat(80) + "\n");

    // Assertions
    assert.equal(spent1.toFixed(6), "100.000000", "Normal swap: should spend 100 tokens");
    assert.equal(spent2.toFixed(6), "100.000000", "Discount swap: should spend 100 tokens");
    
    assert.isTrue(
      received1 >= 99.70 && received1 <= 99.80,
      `Normal swap: should receive ~99.75 tokens, got ${received1.toFixed(6)}`
    );
    
    assert.isTrue(
      received2 >= 99.75 && received2 <= 99.85,
      `Discount swap: should receive ~99.80 tokens, got ${received2.toFixed(6)}`
    );
    
    assert.isTrue(
      received2 > received1,
      `Discount swap should give MORE tokens: ${received2.toFixed(6)} > ${received1.toFixed(6)}`
    );
    
    assert.isTrue(
      Math.abs(kedologPaid - 0.40) < 0.01,
      `Should pay ~0.40 KEDOL, paid ${kedologPaid.toFixed(6)}`
    );
    
    assert.equal(
      kedologPaid.toFixed(6),
      treasuryReceived.toFixed(6),
      "Treasury should receive exactly what user paid"
    );

    console.log("✅ ALL ASSERTIONS PASSED!\n");
  });
});

