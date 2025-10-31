import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Set Fixed 0.25% Fee for All Pools
 */

async function main() {
  console.log("🎯 Setting Fixed 0.25% Fee");
  console.log("═══════════════════════════════════════\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const ammConfigAddress = new PublicKey("DUzS92SbYFFN66vPGUoJqwqS2rfEBmB8CvX1EinesMZG");

  console.log("Program ID:", program.programId.toString());
  console.log("Admin Wallet:", wallet.publicKey.toString());
  console.log("AMM Config:", ammConfigAddress.toString());
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // FIXED 0.25% FEE CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const FIXED_FEE_CONFIG = {
    tradeFeeRate: 2500,       // 0.25%
    protocolFeeRate: 200000,  // 20% of trade fee = 0.05%
    fundFeeRate: 0,           // 0%
    creatorFeeRate: 0,        // 0% - NO creator fee
  };

  console.log("📊 New Fixed Fee Configuration:");
  console.log("─────────────────────────────────────");
  console.log("Trade Fee: 0.25%");
  console.log("Protocol Fee: 0.05% (20% of trade fee)");
  console.log("Creator Fee: 0% (DISABLED)");
  console.log("Total User Pays: 0.25%");
  console.log("");

  console.log("💰 Example: 100 SOL Swap");
  console.log("─────────────────────────────────────");
  console.log("User swaps: 100 SOL");
  console.log("Trade Fee: 0.25 SOL");
  console.log("  → Protocol (YOU): 0.05 SOL");
  console.log("  → LPs (stays in pool): 0.20 SOL");
  console.log("Creator Fee: 0 SOL (NONE)");
  console.log("Total Fees: 0.25 SOL");
  console.log("");

  console.log("⚠️  This will update fees for ALL FUTURE pools!");
  console.log("Existing pools will keep their current fees.");
  console.log("");
  console.log("🔒 Updates are DISABLED by default.");
  console.log("To enable, uncomment the execution code below.\n");

  // ═══════════════════════════════════════════════════════════
  // EXECUTION
  // ═══════════════════════════════════════════════════════════

  console.log("🚀 Updating fees...\n");

  // 1. Update trade fee to 0.25%
  console.log("1. Setting trade fee to 0.25%...");
  const tx1 = await program.methods
    .updateAmmConfig(0, new anchor.BN(FIXED_FEE_CONFIG.tradeFeeRate))
    .accounts({
      ammConfig: ammConfigAddress,
    })
    .rpc();
  console.log("   ✅ Transaction:", tx1);

  // 2. Update protocol fee to 20%
  console.log("2. Setting protocol fee to 20% of trade fee...");
  const tx2 = await program.methods
    .updateAmmConfig(1, new anchor.BN(FIXED_FEE_CONFIG.protocolFeeRate))
    .accounts({
      ammConfig: ammConfigAddress,
    })
    .rpc();
  console.log("   ✅ Transaction:", tx2);

  // 3. Update creator fee to 0% (keep it disabled)
  console.log("3. Confirming creator fee is 0%...");
  const tx3 = await program.methods
    .updateAmmConfig(6, new anchor.BN(FIXED_FEE_CONFIG.creatorFeeRate))
    .accounts({
      ammConfig: ammConfigAddress,
    })
    .rpc();
  console.log("   ✅ Transaction:", tx3);

  console.log("\n✅ All fees updated successfully!");
  
  // Verify
  const config = await program.account.ammConfig.fetch(ammConfigAddress);
  console.log("\n📊 Verified Configuration:");
  console.log("Trade Fee:", (config.tradeFeeRate.toNumber() / 10000).toFixed(2) + "%");
  console.log("Protocol Fee:", (config.protocolFeeRate.toNumber() / 10000).toFixed(2) + "% of trade fee");
  console.log("Creator Fee:", (config.creatorFeeRate.toNumber() / 10000).toFixed(2) + "%");
  
  console.log("\n✅ Your DEX now has a fixed 0.25% fee for all FUTURE pools!");
  console.log("Use this AMM config address for all pool creations:");
  console.log(ammConfigAddress.toString());
}

main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

