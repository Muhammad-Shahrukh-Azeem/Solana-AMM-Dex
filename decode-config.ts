import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "./target/types/kedolik_cp_swap";
import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  const ammConfigAddress = new PublicKey("DUzS92SbYFFN66vPGUoJqwqS2rfEBmB8CvX1EinesMZG");

  const config = await program.account.ammConfig.fetch(ammConfigAddress);

  console.log("📊 AMM Configuration:");
  console.log("═══════════════════════════════════════");
  console.log("Index:", config.index);
  console.log("Trade Fee Rate:", config.tradeFeeRate.toString());
  console.log("Protocol Fee Rate:", config.protocolFeeRate.toString());
  console.log("Fund Fee Rate:", config.fundFeeRate.toString());
  console.log("Creator Fee Rate:", config.creatorFeeRate.toString());
  console.log("Create Pool Fee:", config.createPoolFee.toString());
  console.log("");
  console.log("📈 Percentage Breakdown:");
  console.log("═══════════════════════════════════════");
  console.log("Trade Fee:", (config.tradeFeeRate.toNumber() / 10000).toFixed(2) + "%");
  console.log("Protocol Fee:", (config.protocolFeeRate.toNumber() / 10000).toFixed(2) + "% of trade fee");
  console.log("Fund Fee:", (config.fundFeeRate.toNumber() / 10000).toFixed(2) + "% of trade fee");
  console.log("Creator Fee:", (config.creatorFeeRate.toNumber() / 10000).toFixed(2) + "%");
  console.log("");
  console.log("💰 Example: 100 SOL Swap");
  console.log("═══════════════════════════════════════");
  const swapAmount = 100;
  const tradeFee = swapAmount * (config.tradeFeeRate.toNumber() / 1000000);
  const protocolFee = tradeFee * (config.protocolFeeRate.toNumber() / 1000000);
  const fundFee = tradeFee * (config.fundFeeRate.toNumber() / 1000000);
  const creatorFee = swapAmount * (config.creatorFeeRate.toNumber() / 1000000);
  
  console.log("Swap Amount:", swapAmount, "SOL");
  console.log("Trade Fee:", tradeFee.toFixed(4), "SOL");
  console.log("  → Protocol Fee:", protocolFee.toFixed(4), "SOL");
  console.log("  → Fund Fee:", fundFee.toFixed(4), "SOL");
  console.log("Creator Fee:", creatorFee.toFixed(4), "SOL");
  console.log("Total Fees:", (tradeFee + creatorFee).toFixed(4), "SOL");
}

main();

