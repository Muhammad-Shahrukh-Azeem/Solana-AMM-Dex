import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";

/**
 * 🔐 Transfer Program Upgrade Authority
 * 
 * CRITICAL: This transfers control of the program to a new authority
 * Only the current upgrade authority can run this
 * 
 * Usage:
 *   NETWORK=devnet NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts
 *   NETWORK=mainnet NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts
 */

const NETWORK = process.env.NETWORK || "devnet";
const CLUSTER = NETWORK === "mainnet" ? "mainnet-beta" : "devnet";
const NEW_AUTHORITY_STR = process.env.NEW_AUTHORITY;

async function main() {
  console.log("🔐 Transfer Program Upgrade Authority");
  console.log("=".repeat(60));
  
  if (!NEW_AUTHORITY_STR) {
    console.error("\n❌ Error: NEW_AUTHORITY environment variable required");
    console.error("   Usage: NEW_AUTHORITY=<address> npx ts-node scripts/admin/transfer-program-authority.ts");
    process.exit(1);
  }
  
  // Validate new authority address
  let newAuthority: PublicKey;
  try {
    newAuthority = new PublicKey(NEW_AUTHORITY_STR);
  } catch (e) {
    console.error("\n❌ Error: Invalid NEW_AUTHORITY address");
    process.exit(1);
  }
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const currentAuthority = (provider.wallet as anchor.Wallet).payer;
  
  // Get program ID
  const programKeypair = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync("target/deploy/kedolik_cp_swap-keypair.json", "utf-8"))
    )
  );
  const programId = programKeypair.publicKey;
  
  console.log(`\n📡 Network: ${NETWORK}`);
  console.log(`🔗 Cluster: ${CLUSTER}`);
  console.log(`\n📋 Program ID: ${programId.toString()}`);
  console.log(`👤 Current Authority: ${currentAuthority.publicKey.toString()}`);
  console.log(`🎯 New Authority: ${newAuthority.toString()}`);
  
  // Verify current authority
  const programInfo = await connection.getAccountInfo(programId);
  if (!programInfo) {
    console.error("\n❌ Program not found!");
    process.exit(1);
  }
  
  // Warning
  console.log(`\n⚠️  WARNING: This will transfer program upgrade authority!`);
  console.log(`   After this, only the new authority can upgrade the program.`);
  console.log(`   Make sure you control the new authority address!`);
  
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
  
  // Transfer authority
  console.log(`\n🔄 Transferring authority...`);
  
  try {
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);
    
    const command = `solana program set-upgrade-authority ${programId.toString()} --new-upgrade-authority ${newAuthority.toString()} --url ${CLUSTER}`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes("Signature:")) {
      console.error("\n❌ Error:", stderr);
      process.exit(1);
    }
    
    console.log(`\n✅ Authority Transferred!`);
    console.log(stdout);
    
    // Save transfer record
    const transferRecord = {
      network: NETWORK,
      programId: programId.toString(),
      oldAuthority: currentAuthority.publicKey.toString(),
      newAuthority: newAuthority.toString(),
      transferredAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      `authority-transfer-${NETWORK}-${Date.now()}.json`,
      JSON.stringify(transferRecord, null, 2)
    );
    
    console.log(`\n📝 Transfer record saved`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   - Program authority is now: ${newAuthority.toString()}`);
    console.log(`   - Only this address can upgrade the program`);
    console.log(`   - Keep the private key safe!`);
    
  } catch (error) {
    console.error("\n❌ Error transferring authority:", error);
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

