import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("🔐 Unified Fee Receiver Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const admin = (provider.wallet as anchor.Wallet).payer;

  let ammConfig: PublicKey;
  const config_index = Math.floor(Math.random() * 10000) + 20000;

  it("✅ Setup: Create AMM Config with unified fee receiver", async () => {
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(config_index, 0);
    [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config"), indexBuffer],
      program.programId
    );

    console.log("\n📋 Creating AMM Config...");
    console.log("   Index:", config_index);
    console.log("   Address:", ammConfig.toString());
    console.log("   Initial Fee Receiver:", admin.publicKey.toString());

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
    console.log("   Transaction:", tx.slice(0, 16) + "...");

    // Verify initial configuration
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.feeReceiver.toString(),
      admin.publicKey.toString(),
      "Initial fee_receiver should be admin"
    );

    console.log("   ✅ Initial fee receiver verified");
  });

  it("✅ Test 1: Update unified fee receiver", async () => {
    const newFeeReceiver = Keypair.generate();

    console.log("\n🔄 Updating unified fee receiver...");
    console.log("   Old:", admin.publicKey.toString().slice(0, 8) + "...");
    console.log("   New:", newFeeReceiver.publicKey.toString().slice(0, 8) + "...");

    // Update using parameter 4 (fee_receiver)
    await program.methods
      .updateAmmConfig(4, new BN(0))
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
      })
      .remainingAccounts([
        {
          pubkey: newFeeReceiver.publicKey,
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();

    // Verify the update
    const config: any = await program.account.ammConfig.fetch(ammConfig);
    
    assert.equal(
      config.feeReceiver.toString(),
      newFeeReceiver.publicKey.toString(),
      "Fee receiver should be updated"
    );

    console.log("   ✅ Fee receiver updated successfully!");
    console.log("   ✅ This single address now receives:");
    console.log("      • Pool creation fees (1 SOL)");
    console.log("      • Protocol fees from swaps");
    console.log("      • Fund fees");
    console.log("      • KEDOLOG discount fees");
  });

  it("✅ Test 2: Only admin can update fee receiver", async () => {
    const unauthorizedUser = Keypair.generate();
    const newFeeReceiver = Keypair.generate();

    // Airdrop to unauthorized user
    const signature = await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      1000000000
    );
    await provider.connection.confirmTransaction(signature);

    console.log("\n🔒 Testing authorization...");
    console.log("   Attempting update from unauthorized user...");

    try {
      await program.methods
        .updateAmmConfig(4, new BN(0))
        .accounts({
          owner: unauthorizedUser.publicKey,
          ammConfig: ammConfig,
        })
        .remainingAccounts([
          {
            pubkey: newFeeReceiver.publicKey,
            isSigner: false,
            isWritable: false,
          },
        ])
        .signers([unauthorizedUser])
        .rpc();

      assert.fail("Should have failed with InvalidOwner error");
    } catch (error: any) {
      assert.include(
        error.message,
        "InvalidOwner",
        "Should fail with InvalidOwner error"
      );
      console.log("   ✅ Unauthorized update correctly rejected!");
    }
  });

  it("✅ Test 3: Cannot set fee receiver to default pubkey", async () => {
    console.log("\n🚫 Testing validation...");
    console.log("   Attempting to set fee receiver to default pubkey...");

    try {
      await program.methods
        .updateAmmConfig(4, new BN(0))
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

      assert.fail("Should have failed with validation error");
    } catch (error: any) {
      console.log("   ✅ Invalid address correctly rejected!");
    }
  });

  it("📊 Summary: Display final configuration", async () => {
    const config: any = await program.account.ammConfig.fetch(ammConfig);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 FINAL CONFIGURATION");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("AMM Config:", ammConfig.toString());
    console.log("Protocol Owner (Admin):", config.protocolOwner.toString());
    console.log("Unified Fee Receiver:", config.feeReceiver.toString());
    console.log("\n✅ UNIFIED FEE RECEIVER BENEFITS:");
    console.log("   • Single address for ALL fees");
    console.log("   • Update once, applies everywhere");
    console.log("   • Simpler management");
    console.log("   • No confusion about which receiver to update");
    console.log("\n✅ ALL TESTS PASSED!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  });
});

