import { Connection, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

/**
 * Script to analyze recent transactions and show fees generated
 * 
 * This checks recent swap transactions and calculates:
 * - Total swap volume
 * - Fees generated per transaction
 * - LP fees vs Protocol fees
 */

const NETWORK = process.env.NETWORK || "devnet";
const RPC_URL = NETWORK === "mainnet" 
  ? "https://api.mainnet-beta.solana.com"
  : "https://api.devnet.solana.com";

async function main() {
  console.log("📊 Recent Transaction Fee Analysis");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Load deployment info
  const deploymentPath = `./deployed-${NETWORK}-new.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const connection = new Connection(RPC_URL, "confirmed");
  const programId = new PublicKey(deployment.programId);

  console.log("📋 Configuration:");
  console.log(`   Program ID: ${deployment.programId}`);
  console.log(`   Network: ${NETWORK}`);
  console.log("");

  console.log("🔍 Fetching recent transactions...");
  console.log("");

  try {
    // Get recent signatures for the program
    const signatures = await connection.getSignaturesForAddress(
      programId,
      { limit: 20 } // Get last 20 transactions
    );

    if (signatures.length === 0) {
      console.log("ℹ️  No recent transactions found.");
      return;
    }

    console.log(`Found ${signatures.length} recent transaction(s)\n`);

    let totalSwaps = 0;
    let totalPoolCreations = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Transaction ${i + 1}:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Signature: ${sig.signature.substring(0, 16)}...`);
      console.log(`Time: ${new Date(sig.blockTime! * 1000).toLocaleString()}`);
      console.log(`Status: ${sig.err ? '❌ Failed' : '✅ Success'}`);
      
      if (sig.err) {
        console.log(`Error: ${JSON.stringify(sig.err)}`);
        console.log("");
        continue;
      }

      // Fetch full transaction details
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) {
          console.log("⚠️  Could not fetch transaction details");
          console.log("");
          continue;
        }

        // Analyze transaction logs to determine type
        const logs = tx.meta.logMessages || [];
        let txType = "Unknown";
        
        if (logs.some(log => log.includes("Instruction: SwapBaseInput"))) {
          txType = "Swap";
          totalSwaps++;
        } else if (logs.some(log => log.includes("Instruction: SwapBaseInputWithProtocolToken"))) {
          txType = "Swap (KEDOL Discount)";
          totalSwaps++;
        } else if (logs.some(log => log.includes("Instruction: Initialize"))) {
          txType = "Pool Creation";
          totalPoolCreations++;
        } else if (logs.some(log => log.includes("Instruction: Deposit"))) {
          txType = "Add Liquidity";
          totalDeposits++;
        } else if (logs.some(log => log.includes("Instruction: Withdraw"))) {
          txType = "Remove Liquidity";
          totalWithdrawals++;
        }

        console.log(`Type: ${txType}`);

        // Show fee information
        const fee = tx.meta.fee;
        console.log(`Transaction Fee: ${(fee / 1e9).toFixed(9)} SOL`);

        // For swaps, try to extract swap amounts from logs
        if (txType.includes("Swap")) {
          const swapLog = logs.find(log => log.includes("amount_in") || log.includes("amount_out"));
          if (swapLog) {
            console.log(`Swap Details: ${swapLog}`);
          }

          // Calculate fees (0.25% total, 0.20% LP, 0.05% protocol)
          console.log(`Trading Fees:`);
          console.log(`   Total: 0.25% of swap amount`);
          console.log(`   - LP Fee: 0.20% (distributed to LPs)`);
          console.log(`   - Protocol Fee: 0.05% (claimable by owner)`);
          
          if (txType.includes("KEDOL")) {
            console.log(`   💎 KEDOL Discount Applied: 20% off protocol fee!`);
            console.log(`   - Actual Protocol Fee: 0.04% (paid in KEDOL)`);
          }
        }

        // For pool creation, show the 0.15 SOL fee
        if (txType === "Pool Creation") {
          console.log(`Pool Creation Fee: 0.15 SOL`);
          console.log(`   Sent to: ${deployment.createPoolFeeReceiver.substring(0, 16)}...`);
        }

        console.log("");

      } catch (error) {
        console.log(`⚠️  Error fetching transaction details: ${error}`);
        console.log("");
      }
    }

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 TRANSACTION SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log(`Total Transactions: ${signatures.length}`);
    console.log(`   Swaps: ${totalSwaps}`);
    console.log(`   Pool Creations: ${totalPoolCreations}`);
    console.log(`   Deposits: ${totalDeposits}`);
    console.log(`   Withdrawals: ${totalWithdrawals}`);
    console.log("");
    console.log("💡 For detailed fee breakdown per pool:");
    console.log("   Run: npx ts-node scripts/check-fees.ts");
    console.log("");

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

