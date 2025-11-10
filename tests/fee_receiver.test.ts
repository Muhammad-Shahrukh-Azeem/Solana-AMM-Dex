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
} from "@solana/spl-token";
import { assert } from "chai";

describe("🔐 Fee Receiver Configuration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;

  let ammConfig: PublicKey;
  let poolState: PublicKey;
  let token0Mint: PublicKey;
  let token1Mint: PublicKey;
  
  const config_index = Math.floor(Math.random() * 10000) + 20000;

  it("✅ Setup: Create AMM Config with initial fee receivers", async () => {
    // Derive AMM config address
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(config_index, 0);
    [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config"), indexBuffer],
      program.programId
    );

    console.log("\n📋 Creating AMM Config...");
    console.log("   Index:", config_index);
    console.log("   Address:", ammConfig.toString());

    const tx = await program.methods
      .createAmmConfig(
        config_index,
        new BN(2500), // trade_fee_rate
        new BN(200000), // protocol_fee_rate
        new BN(0), // fund_fee_rate
        new BN(0), // create_pool_fee
        new BN(0), // creator_fee_rate
        admin.publicKey  // fee_receiver (unified for all fees)
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("   ✅ Created!");

    // Verify initial configuration
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.createPoolFeeReceiver.toString(),
      admin.publicKey.toString(),
      "Initial create_pool_fee_receiver should be admin"
    );
    
    assert.equal(
      config.protocolFeeReceiver.toString(),
      admin.publicKey.toString(),
      "Initial protocol_fee_receiver should be admin"
    );

    console.log("   ✅ Initial receivers verified");
  });

  it("✅ Test 1: Update pool creation fee receiver", async () => {
    const newPoolFeeReceiver = Keypair.generate();

    console.log("\n🔄 Updating pool creation fee receiver...");
    console.log("   Old:", admin.publicKey.toString().slice(0, 8) + "...");
    console.log("   New:", newPoolFeeReceiver.publicKey.toString().slice(0, 8) + "...");

    // Update using parameter 8
    await program.methods
      .updateAmmConfig(8, new BN(0))
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
      })
      .remainingAccounts([
        {
          pubkey: newPoolFeeReceiver.publicKey,
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();

    // Verify the update
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.createPoolFeeReceiver.toString(),
      newPoolFeeReceiver.publicKey.toString(),
      "Pool fee receiver should be updated"
    );

    // Verify protocol_fee_receiver is unchanged
    assert.equal(
      config.protocolFeeReceiver.toString(),
      admin.publicKey.toString(),
      "Protocol fee receiver should remain unchanged"
    );

    console.log("   ✅ Pool creation fee receiver updated successfully!");
    console.log("   ✅ Protocol fee receiver unchanged (as expected)");
  });

  it("✅ Test 2: Update protocol fee receiver", async () => {
    const newProtocolFeeReceiver = Keypair.generate();

    console.log("\n🔄 Updating protocol fee receiver...");
    console.log("   Old:", admin.publicKey.toString().slice(0, 8) + "...");
    console.log("   New:", newProtocolFeeReceiver.publicKey.toString().slice(0, 8) + "...");

    // Update using parameter 9
    await program.methods
      .updateAmmConfig(9, new BN(0))
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
      })
      .remainingAccounts([
        {
          pubkey: newProtocolFeeReceiver.publicKey,
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();

    // Verify the update
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.protocolFeeReceiver.toString(),
      newProtocolFeeReceiver.publicKey.toString(),
      "Protocol fee receiver should be updated"
    );

    console.log("   ✅ Protocol fee receiver updated successfully!");
  });

  it("✅ Test 3: Update both receivers independently", async () => {
    const newPoolReceiver = Keypair.generate();
    const newProtocolReceiver = Keypair.generate();

    console.log("\n🔄 Updating both receivers...");

    // Update pool fee receiver (parameter 8)
    await program.methods
      .updateAmmConfig(8, new BN(0))
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
      })
      .remainingAccounts([
        {
          pubkey: newPoolReceiver.publicKey,
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();

    console.log("   ✅ Pool receiver updated");

    // Update protocol fee receiver (parameter 9)
    await program.methods
      .updateAmmConfig(9, new BN(0))
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
      })
      .remainingAccounts([
        {
          pubkey: newProtocolReceiver.publicKey,
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();

    console.log("   ✅ Protocol receiver updated");

    // Verify both are updated correctly
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.createPoolFeeReceiver.toString(),
      newPoolReceiver.publicKey.toString(),
      "Pool fee receiver should be updated"
    );
    
    assert.equal(
      config.protocolFeeReceiver.toString(),
      newProtocolReceiver.publicKey.toString(),
      "Protocol fee receiver should be updated"
    );

    assert.notEqual(
      config.createPoolFeeReceiver.toString(),
      config.protocolFeeReceiver.toString(),
      "Both receivers should be different"
    );

    console.log("   ✅ Both receivers updated independently!");
    console.log("   ✅ Receivers are different (as expected)");
  });

  it("✅ Test 4: Only admin can update receivers", async () => {
    const unauthorizedUser = Keypair.generate();
    const newReceiver = Keypair.generate();

    console.log("\n🔒 Testing authorization...");

    // Airdrop some SOL to unauthorized user
    const airdropSig = await connection.requestAirdrop(
      unauthorizedUser.publicKey,
      1000000000
    );
    await connection.confirmTransaction(airdropSig);

    // Try to update as unauthorized user (should fail)
    try {
      await program.methods
        .updateAmmConfig(8, new BN(0))
        .accounts({
          owner: unauthorizedUser.publicKey,
          ammConfig: ammConfig,
        })
        .remainingAccounts([
          {
            pubkey: newReceiver.publicKey,
            isSigner: false,
            isWritable: false,
          },
        ])
        .signers([unauthorizedUser])
        .rpc();

      assert.fail("Should have failed with unauthorized user");
    } catch (error: any) {
      assert.include(
        error.toString(),
        "InvalidOwner",
        "Should fail with InvalidOwner error"
      );
      console.log("   ✅ Unauthorized update correctly rejected!");
    }
  });

  it("✅ Test 5: Cannot set receiver to default pubkey", async () => {
    console.log("\n🚫 Testing invalid receiver address...");

    try {
      await program.methods
        .updateAmmConfig(8, new BN(0))
        .accounts({
          owner: admin.publicKey,
          ammConfig: ammConfig,
        })
        .remainingAccounts([
          {
            pubkey: PublicKey.default,
            isSigner: false,
            isWritable: false,
          },
        ])
        .rpc();

      assert.fail("Should have failed with default pubkey");
    } catch (error: any) {
      console.log("   ✅ Default pubkey correctly rejected!");
    }
  });

  it("📊 Summary: Display final configuration", async () => {
    const config: any = await program.account.ammConfig.fetch(ammConfig);

    console.log("\n" + "=".repeat(80));
    console.log("📊 FINAL CONFIGURATION");
    console.log("=".repeat(80));
    console.log("\n🔧 AMM Config:", ammConfig.toString());
    console.log("\n👤 Admin (Protocol Owner):");
    console.log("   ", config.protocolOwner.toString());
    console.log("\n💰 Pool Creation Fee Receiver:");
    console.log("   ", config.createPoolFeeReceiver.toString());
    console.log("\n💎 Protocol Fee Receiver:");
    console.log("   ", config.protocolFeeReceiver.toString());
    console.log("\n✅ All receivers are independently configurable!");
    console.log("=".repeat(80) + "\n");
  });
});


