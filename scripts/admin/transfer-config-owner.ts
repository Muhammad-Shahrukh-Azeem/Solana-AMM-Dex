import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../../target/types/kedolik_cp_swap";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";

/**
 * 🔐 Transfer AMM Config Ownership
 * 
 * This transfers control of the AMM config (fees, settings) to a new owner
 * Only the current owner can run this
 * 
 * Usage:
 *   NETWORK=devnet NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts
 *   NETWORK=mainnet NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts
 */

const NETWORK = process.env.NETWORK || "devnet";
const CLUSTER = NETWORK === "mainnet" ? "mainnet-beta" : "devnet";
const NEW_OWNER_STR = process.env.NEW_OWNER;

async function main() {
  console.log("🔐 Transfer AMM Config Ownership");
  console.log("=".repeat(60));
  
  if (!NEW_OWNER_STR) {
    console.error("\n❌ Error: NEW_OWNER environment variable required");
    console.error("   Usage: NEW_OWNER=<address> npx ts-node scripts/admin/transfer-config-owner.ts");
    process.exit(1);
  }
  
  // Validate new owner address
  let newOwner: PublicKey;
  try {
    newOwner = new PublicKey(NEW_OWNER_STR);
  } catch (e) {
    console.error("\n❌ Error: Invalid NEW_OWNER address");
    process.exit(1);
  }
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const currentOwner = (provider.wallet as anchor.Wallet).payer;
  
  console.log(`\n📡 Network: ${NETWORK}`);
  console.log(`🔗 Cluster: ${CLUSTER}`);
  console.log(`\n📋 Program ID: ${program.programId.toString()}`);
  console.log(`👤 Current Owner: ${currentOwner.publicKey.toString()}`);
  console.log(`🎯 New Owner: ${newOwner.toString()}`);
  
  // Get AMM config
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), Buffer.from([0])],
    program.programId
  );
  
  console.log(`\n⚙️  AMM Config: ${ammConfig.toString()}`);
  
  // Fetch current config
  try {
    const config = await program.account.ammConfig.fetch(ammConfig);
    console.log(`\n📊 Current Configuration:`);
    console.log(`   Owner: ${config.owner.toString()}`);
    console.log(`   Trade Fee: ${config.tradeFeeRate} (${config.tradeFeeRate / 10000}%)`);
    console.log(`   Protocol Fee: ${config.protocolFeeRate} (${config.protocolFeeRate / 10000}%)`);
    
    // Verify current owner
    if (!config.owner.equals(currentOwner.publicKey)) {
      console.error(`\n❌ Error: You are not the current owner!`);
      console.error(`   Current owner: ${config.owner.toString()}`);
      console.error(`   Your address: ${currentOwner.publicKey.toString()}`);
      process.exit(1);
    }
  } catch (e) {
    console.error("\n❌ AMM Config not found!");
    console.error("   Run: npx ts-node scripts/config/init-config.ts first");
    process.exit(1);
  }
  
  // Warning
  console.log(`\n⚠️  WARNING: This will transfer AMM config ownership!`);
  console.log(`   After this, only the new owner can:`);
  console.log(`   - Update fee rates`);
  console.log(`   - Collect protocol fees`);
  console.log(`   - Transfer ownership again`);
  console.log(`   Make sure you control the new owner address!`);
  
  // Confirmation
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const confirmed = await new Promise<boolean>((resolve) => {
    readline.question("\nType 'TRANSFER' to confirm: ", (answer: string) => {
      readline.close();
      resolve(answer === "TRANSFER");
    });
  });
  
  if (!confirmed) {
    console.log("\n❌ Transfer cancelled");
    process.exit(0);
  }
  
  // Transfer ownership
  console.log(`\n🔄 Transferring ownership...`);
  
  try {
    const tx = await program.methods
      .setConfigOwner()
      .accounts({
        owner: currentOwner.publicKey,
        newOwner: newOwner,
        ammConfig,
      })
      .rpc();
    
    console.log(`\n✅ Ownership Transferred!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   New Owner: ${newOwner.toString()}`);
    
    // Save transfer record
    const transferRecord = {
      network: NETWORK,
      ammConfig: ammConfig.toString(),
      programId: program.programId.toString(),
      oldOwner: currentOwner.publicKey.toString(),
      newOwner: newOwner.toString(),
      transferredAt: new Date().toISOString(),
      transaction: tx,
    };
    
    fs.writeFileSync(
      `config-owner-transfer-${NETWORK}-${Date.now()}.json`,
      JSON.stringify(transferRecord, null, 2)
    );
    
    console.log(`\n📝 Transfer record saved`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   - Config owner is now: ${newOwner.toString()}`);
    console.log(`   - Only this address can manage fees and settings`);
    console.log(`   - Keep the private key safe!`);
    
  } catch (error) {
    console.error("\n❌ Error transferring ownership:", error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

