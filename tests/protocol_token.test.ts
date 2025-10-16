import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  setupInitializeTest,
  setupDepositTest,
  createProtocolTokenConfig,
  updateProtocolTokenConfig,
  swapBaseInputWithProtocolToken,
} from "./utils/instruction";
import { getProtocolTokenConfigAddress, getAmmConfigAddress } from "./utils/pda";
import { assert } from "chai";

describe("Protocol Token Fee Payment Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const admin = anchor.Wallet.local().payer;
  console.log("admin: ", admin.publicKey.toString());
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = anchor.getProvider().connection;

  let protocolTokenMint: PublicKey;
  let treasuryKeypair: Keypair;
  let treasuryTokenAccount: PublicKey;
  let userKeypair: Keypair;
  let userProtocolTokenAccount: PublicKey;
  let configAddress: PublicKey;
  let token0: PublicKey;
  let token1: PublicKey;
  let token0Program: PublicKey;
  let token1Program: PublicKey;

  const confirmOptions = {
    skipPreflight: true,
  };

  describe("Create Protocol Token Config", () => {
    it("Creates protocol token config successfully", async () => {
      // Create protocol token (KEDOLOG)
      protocolTokenMint = await createMint(
        connection,
        admin,
        admin.publicKey,
        admin.publicKey,
        9, // 9 decimals
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );

      // Create treasury keypair and token account
      treasuryKeypair = Keypair.generate();
      treasuryTokenAccount = await createAssociatedTokenAccount(
        connection,
        admin,
        protocolTokenMint,
        treasuryKeypair.publicKey,
        undefined,
        TOKEN_PROGRAM_ID
      );

      // Create protocol token config
      // 20% discount (2000 basis points)
      // 10 KEDOLOG per 1 USD (scaled by 10^6)
      const discountRate = new BN(2000);
      const protocolTokenPerUsd = new BN(10_000_000);

      const { tx, protocolTokenConfig } = await createProtocolTokenConfig(
        program,
        connection,
        admin,
        protocolTokenMint,
        discountRate,
        admin.publicKey, // authority
        treasuryKeypair.publicKey,
        protocolTokenPerUsd,
        confirmOptions
      );

      console.log("Protocol token config created:", tx);

      // Verify the config
      const configData = await program.account.protocolTokenConfig.fetch(
        protocolTokenConfig
      );
      assert.equal(
        configData.protocolTokenMint.toString(),
        protocolTokenMint.toString()
      );
      assert.equal(configData.discountRate.toString(), "2000");
      assert.equal(
        configData.treasury.toString(),
        treasuryKeypair.publicKey.toString()
      );
      assert.equal(
        configData.protocolTokenPerUsd.toString(),
        "10000000"
      );
      assert.equal(
        configData.authority.toString(),
        admin.publicKey.toString()
      );
    });

    it("Updates protocol token config successfully", async () => {
      // Update discount rate to 25% (2500 basis points)
      const newDiscountRate = new BN(2500);
      const newProtocolTokenPerUsd = new BN(15_000_000); // 15 KEDOLOG per 1 USD

      const tx = await updateProtocolTokenConfig(
        program,
        connection,
        admin,
        newDiscountRate,
        null,
        newProtocolTokenPerUsd,
        null,
        confirmOptions
      );

      console.log("Protocol token config updated:", tx);

      // Verify the update
      const [protocolTokenConfig] = await getProtocolTokenConfigAddress(
        program.programId
      );
      const configData = await program.account.protocolTokenConfig.fetch(
        protocolTokenConfig
      );
      assert.equal(configData.discountRate.toString(), "2500");
      assert.equal(
        configData.protocolTokenPerUsd.toString(),
        "15000000"
      );

      // Reset to 20% for subsequent tests
      await updateProtocolTokenConfig(
        program,
        connection,
        admin,
        new BN(2000),
        null,
        new BN(10_000_000),
        null,
        confirmOptions
      );
    });
  });

  describe("Swap with Protocol Token Payment", () => {
    before(async () => {
      // Setup a pool for testing with liquidity
      const depositResult = await setupDepositTest(
        program,
        connection,
        admin,
        {
          config_index: 0,
          tradeFeeRate: new BN(10000000), // 1% fee
          protocolFeeRate: new BN(10000000000), // 100% of trade fee goes to protocol
          fundFeeRate: new BN(0),
          create_fee: new BN(0),
        },
        { transferFeeBasisPoints: 0, MaxFee: 0 },
        confirmOptions,
        {
          initAmount0: new BN(10000000000),
          initAmount1: new BN(10000000000),
        }
      );

      // Get tokens and config from pool state
      const [ammConfig] = await getAmmConfigAddress(0, program.programId);
      configAddress = ammConfig;
      token0 = depositResult.poolState.token0Mint;
      token1 = depositResult.poolState.token1Mint;
      token0Program = depositResult.poolState.token0Program;
      token1Program = depositResult.poolState.token1Program;

      // Use admin as the swapper since they have the tokens from pool setup
      userKeypair = admin;

      // Create protocol token account for admin and mint KEDOLOG tokens
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
        10000000000, // 10,000 KEDOLOG tokens
        [],
        undefined,
        TOKEN_PROGRAM_ID
      );
    });

    it("Performs swap with protocol token payment and applies discount", async () => {
      // Get initial balances
      const initialUserToken0 = await getAccount(
        connection,
        getAssociatedTokenAddressSync(
          token0,
          userKeypair.publicKey,
          false,
          token0Program
        ),
        undefined,
        token0Program
      );
      const initialUserToken1 = await getAccount(
        connection,
        getAssociatedTokenAddressSync(
          token1,
          userKeypair.publicKey,
          false,
          token1Program
        ),
        undefined,
        token1Program
      );
      const initialUserKedolog = await getAccount(
        connection,
        userProtocolTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      const initialTreasuryKedolog = await getAccount(
        connection,
        treasuryTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );

      console.log("Initial user token0:", initialUserToken0.amount.toString());
      console.log("Initial user token1:", initialUserToken1.amount.toString());
      console.log("Initial user KEDOLOG:", initialUserKedolog.amount.toString());
      console.log("Initial treasury KEDOLOG:", initialTreasuryKedolog.amount.toString());

      // Perform swap: 100 token0 -> token1
      const amountIn = new BN(100000000); // 100 tokens (6 decimals)
      const minAmountOut = new BN(1); // Allow any output for test

      let tx;
      try {
        tx = await swapBaseInputWithProtocolToken(
          program,
          connection,
          userKeypair,
          configAddress,
          token0,
          token1,
          token0Program,
          token1Program,
          amountIn,
          minAmountOut,
          protocolTokenMint,
          TOKEN_PROGRAM_ID,
          confirmOptions
        );
        console.log("Swap with protocol token completed:", tx);
      } catch (error) {
        console.log("Swap error:", error);
        console.log("Error message:", error.message);
        console.log("Error logs:", error.logs);
        throw error;
      }

      // Get final balances
      const finalUserToken0 = await getAccount(
        connection,
        getAssociatedTokenAddressSync(
          token0,
          userKeypair.publicKey,
          false,
          token0Program
        ),
        undefined,
        token0Program
      );
      const finalUserToken1 = await getAccount(
        connection,
        getAssociatedTokenAddressSync(
          token1,
          userKeypair.publicKey,
          false,
          token1Program
        ),
        undefined,
        token1Program
      );
      const finalUserKedolog = await getAccount(
        connection,
        userProtocolTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      const finalTreasuryKedolog = await getAccount(
        connection,
        treasuryTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );

      console.log("Final user token0:", finalUserToken0.amount.toString());
      console.log("Final user token1:", finalUserToken1.amount.toString());
      console.log("Final user KEDOLOG:", finalUserKedolog.amount.toString());
      console.log("Final treasury KEDOLOG:", finalTreasuryKedolog.amount.toString());

      // Verify token0 was deducted
      const token0Spent =
        initialUserToken0.amount - finalUserToken0.amount;
      assert.equal(
        token0Spent.toString(),
        amountIn.toString(),
        "Token0 should be deducted"
      );

      // Verify token1 was received
      const token1Received =
        finalUserToken1.amount - initialUserToken1.amount;
      assert.isTrue(
        token1Received > 0n,
        "Should receive token1"
      );

      // Verify KEDOLOG was deducted from user
      const kedologSpent =
        initialUserKedolog.amount - finalUserKedolog.amount;
      assert.isTrue(
        kedologSpent > 0n,
        "User should pay KEDOLOG tokens"
      );

      // Verify KEDOLOG was received by treasury
      const kedologReceived =
        finalTreasuryKedolog.amount - initialTreasuryKedolog.amount;
      assert.equal(
        kedologReceived.toString(),
        kedologSpent.toString(),
        "Treasury should receive the same amount user paid"
      );

      console.log("\n=== Swap Summary ===");
      console.log("Input:", token0Spent.toString(), "token0");
      console.log("Output:", token1Received.toString(), "token1");
      console.log("Fee paid in KEDOLOG:", kedologSpent.toString());
      console.log("Expected fee calculation:");
      console.log("  - Trade fee rate: 1% of input");
      console.log("  - Protocol fee: 100% of trade fee");
      console.log("  - Original fee: ~1 token0");
      console.log("  - With 20% discount: ~0.8 token0 equivalent");
      console.log("  - In KEDOLOG (10 per USD): ~8 KEDOLOG");
      console.log("===================\n");
    });

  });

  describe("Integration Tests", () => {
    it("Multiple swaps with protocol token payment work correctly", async () => {
      const initialTreasuryKedolog = await getAccount(
        connection,
        treasuryTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );

      // Perform 3 swaps
      for (let i = 0; i < 3; i++) {
        await swapBaseInputWithProtocolToken(
          program,
          connection,
          userKeypair,
          configAddress,
          token0,
          token1,
          token0Program,
          token1Program,
          new BN(10000000), // 10 tokens
          new BN(1),
          protocolTokenMint,
          TOKEN_PROGRAM_ID,
          confirmOptions
        );
      }

      const finalTreasuryKedolog = await getAccount(
        connection,
        treasuryTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );

      const totalKedologCollected =
        finalTreasuryKedolog.amount - initialTreasuryKedolog.amount;

      console.log(
        "Total KEDOLOG collected from 3 swaps:",
        totalKedologCollected.toString()
      );
      assert.isTrue(
        totalKedologCollected > 0n,
        "Treasury should accumulate KEDOLOG from multiple swaps"
      );
    });
  });
});

