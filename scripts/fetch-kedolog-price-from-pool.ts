import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import * as fs from "fs";

/**
 * Script to fetch KEDOL price from your pool and update ProtocolTokenConfig
 * 
 * This calculates: How many KEDOL tokens = 1 USD
 * Based on the KEDOL/USDC pool reserves
 */

const NETWORK = process.env.NETWORK || "devnet";
const RPC_URL = NETWORK === "mainnet" 
  ? "https://api.mainnet-beta.solana.com"
  : "https://api.devnet.solana.com";

async function main() {
  console.log("💰 Fetching KEDOL Price from Pool");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Load deployment info
  const deploymentPath = `./deployed-${NETWORK}-new.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(fs.readFileSync(walletPath, "utf-8"))
      )
    )
  );
  
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program
  const programId = new PublicKey(deployment.programId);
  const idl = JSON.parse(
    fs.readFileSync("./target/idl/kedolik_cp_swap.json", "utf-8")
  );
  const program = new Program(idl, provider) as Program<KedolikCpSwap>;

  console.log("📋 Configuration:");
  console.log(`   Program ID: ${deployment.programId}`);
  console.log(`   KEDOL Mint: ${deployment.kedologMint}`);
  console.log("");

  // Derive the KEDOL/USDC pool address
  const kedologMint = new PublicKey(deployment.kedologMint);
  const usdcMint = new PublicKey("2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32");
  const ammConfig = new PublicKey(deployment.ammConfig);

  // Sort mints (token_0 must be < token_1)
  const [token0Mint, token1Mint] = kedologMint.toBuffer().compare(usdcMint.toBuffer()) < 0
    ? [kedologMint, usdcMint]
    : [usdcMint, kedologMint];

  const isKedologToken0 = token0Mint.equals(kedologMint);

  const [poolState] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      token0Mint.toBuffer(),
      token1Mint.toBuffer(),
    ],
    programId
  );

  console.log("🔍 KEDOL/USDC Pool:");
  console.log(`   Pool Address: ${poolState.toString()}`);
  console.log(`   KEDOL is Token${isKedologToken0 ? "0" : "1"}`);
  console.log("");

  // Fetch pool data
  console.log("📊 Fetching pool reserves...");
  try {
    const poolAccount = await program.account.poolState.fetch(poolState);
    
    const token0Reserve = poolAccount.token0Vault;
    const token1Reserve = poolAccount.token1Vault;

    // Get actual vault balances
    const token0VaultInfo = await connection.getTokenAccountBalance(token0Reserve);
    const token1VaultInfo = await connection.getTokenAccountBalance(token1Reserve);

    const token0Amount = parseFloat(token0VaultInfo.value.amount);
    const token1Amount = parseFloat(token1VaultInfo.value.amount);
    const token0Decimals = token0VaultInfo.value.decimals;
    const token1Decimals = token1VaultInfo.value.decimals;

    console.log("✅ Pool Reserves:");
    console.log(`   Token0 (${isKedologToken0 ? "KEDOL" : "USDC"}): ${token0Amount / Math.pow(10, token0Decimals)}`);
    console.log(`   Token1 (${isKedologToken0 ? "USDC" : "KEDOL"}): ${token1Amount / Math.pow(10, token1Decimals)}`);
    console.log("");

    // Calculate price: How many KEDOL per 1 USDC?
    let kedologPerUsdc: number;
    if (isKedologToken0) {
      // KEDOL is token0, USDC is token1
      // Price = token0_amount / token1_amount (adjusted for decimals)
      kedologPerUsdc = (token0Amount / Math.pow(10, token0Decimals)) / (token1Amount / Math.pow(10, token1Decimals));
    } else {
      // USDC is token0, KEDOL is token1
      // Price = token1_amount / token0_amount (adjusted for decimals)
      kedologPerUsdc = (token1Amount / Math.pow(10, token1Decimals)) / (token0Amount / Math.pow(10, token0Decimals));
    }

    console.log("💵 Calculated Price:");
    console.log(`   1 USDC = ${kedologPerUsdc.toFixed(6)} KEDOL`);
    console.log(`   1 KEDOL = ${(1 / kedologPerUsdc).toFixed(6)} USDC`);
    console.log("");

    // Convert to protocol_token_per_usd format (scaled by 10^6)
    // This represents: how many KEDOL tokens (in smallest units) per 1 USD
    const protocolTokenPerUsd = Math.floor(kedologPerUsdc * 1_000_000);

    console.log("🔢 For Contract:");
    console.log(`   protocol_token_per_usd: ${protocolTokenPerUsd}`);
    console.log(`   (This means: ${kedologPerUsdc.toFixed(6)} KEDOL per 1 USD)`);
    console.log("");

    // Ask if user wants to update
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 Updating Protocol Token Config...");
    console.log("");

    const protocolTokenConfig = new PublicKey(deployment.protocolTokenConfig);

    try {
      const tx = await program.methods
        .updateProtocolTokenConfig(
          null, // Don't change discount rate
          null, // Don't change treasury
          new BN(protocolTokenPerUsd), // Update protocol_token_per_usd
          null  // Don't change authority
        )
        .accountsPartial({
          authority: wallet.publicKey,
          protocolTokenConfig: protocolTokenConfig,
        })
        .rpc();

      console.log("✅ Price updated in Protocol Token Config!");
      console.log(`📜 Transaction: ${tx}`);
      console.log(`🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
      console.log("");

      // Verify the update
      const updatedConfig = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);
      console.log("✅ Verified updated configuration:");
      console.log(`   Protocol Token Per USD: ${updatedConfig.protocolTokenPerUsd.toString()}`);
      console.log(`   Discount Rate: ${updatedConfig.discountRate.toString()} (${updatedConfig.discountRate.toNumber() / 100}%)`);
      console.log("");

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ SUCCESS! KEDOL price updated!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("🎯 What This Means:");
      console.log(`   • When users swap, they can pay protocol fees with KEDOL`);
      console.log(`   • They get a ${updatedConfig.discountRate.toNumber() / 100}% discount`);
      console.log(`   • The contract uses this price: 1 USD = ${kedologPerUsdc.toFixed(6)} KEDOL`);
      console.log(`   • This is OPTIONAL - users choose at swap time`);
      console.log("");
      console.log("💡 TIP: Run this script periodically to update the price!");
      console.log("");

    } catch (error: any) {
      console.error("❌ Error updating price:", error.message || error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      process.exit(1);
    }

  } catch (error: any) {
    console.error("❌ Error fetching pool data:", error.message || error);
    console.error("");
    console.error("💡 Make sure:");
    console.error("   1. You've created the KEDOL/USDC pool");
    console.error("   2. The pool has liquidity");
    console.error("   3. You're connected to the correct network");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

