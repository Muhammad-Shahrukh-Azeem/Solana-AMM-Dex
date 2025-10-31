import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import * as fs from "fs";

/**
 * Script to update the KEDOLOG pool address in ProtocolTokenConfig
 * This allows the contract to fetch KEDOLOG price from your pool
 */

const NETWORK = process.env.NETWORK || "devnet";
const RPC_URL = NETWORK === "mainnet" 
  ? "https://api.mainnet-beta.solana.com"
  : "https://api.devnet.solana.com";

async function main() {
  console.log("🔄 Updating KEDOLOG Pool Address in Protocol Config");
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
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET || "~/.config/solana/id.json", "utf-8"))
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
  const program = new Program(idl, programId, provider) as Program<KedolikCpSwap>;

  console.log("📋 Current Configuration:");
  console.log(`   Program ID: ${deployment.programId}`);
  console.log(`   Protocol Token Config: ${deployment.protocolTokenConfig}`);
  console.log(`   KEDOLOG Mint: ${deployment.kedologMint}`);
  console.log("");

  // Derive the KEDOLOG/USDC pool address
  const kedologMint = new PublicKey(deployment.kedologMint);
  const usdcMint = new PublicKey("2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32"); // From your screenshot
  const ammConfig = new PublicKey(deployment.ammConfig);

  // Sort mints (token_0 must be < token_1)
  const [token0Mint, token1Mint] = kedologMint.toBuffer().compare(usdcMint.toBuffer()) < 0
    ? [kedologMint, usdcMint]
    : [usdcMint, kedologMint];

  const [poolState] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      token0Mint.toBuffer(),
      token1Mint.toBuffer(),
    ],
    programId
  );

  console.log("🔍 Derived Pool Address:");
  console.log(`   KEDOLOG/USDC Pool: ${poolState.toString()}`);
  console.log("");

  // Verify the pool exists
  console.log("🔍 Verifying pool exists on-chain...");
  try {
    const poolAccount = await program.account.poolState.fetch(poolState);
    console.log("✅ Pool found!");
    console.log(`   Token 0 Mint: ${poolAccount.token0Mint.toString()}`);
    console.log(`   Token 1 Mint: ${poolAccount.token1Mint.toString()}`);
    console.log(`   Token 0 Vault: ${poolAccount.token0Vault.toString()}`);
    console.log(`   Token 1 Vault: ${poolAccount.token1Vault.toString()}`);
    console.log("");
  } catch (error) {
    console.error("❌ Pool not found on-chain!");
    console.error("   Make sure you've created the KEDOLOG/USDC pool first.");
    process.exit(1);
  }

  // Fetch current protocol token config
  const protocolTokenConfig = new PublicKey(deployment.protocolTokenConfig);
  console.log("📖 Reading current Protocol Token Config...");
  
  try {
    const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);
    console.log("   Current Pool Address:", config.poolAddress?.toString() || "None");
    console.log("   Protocol Token Mint:", config.protocolTokenMint.toString());
    console.log("   Discount Rate:", config.discountRate.toString());
    console.log("   Protocol Token Per USD:", config.protocolTokenPerUsd.toString());
    console.log("");

    if (config.poolAddress && config.poolAddress.toString() === poolState.toString()) {
      console.log("✅ Pool address is already set correctly!");
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ No update needed - configuration is correct!");
      return;
    }
  } catch (error) {
    console.error("❌ Error reading protocol token config:", error);
    process.exit(1);
  }

  // Update the pool address
  console.log("🔄 Updating pool address in Protocol Token Config...");
  console.log("");

  try {
    const tx = await program.methods
      .updateProtocolTokenConfig(
        null, // Don't change discount rate
        null, // Don't change authority
        null, // Don't change treasury
        null, // Don't change protocol_token_per_usd
        poolState // Update pool address
      )
      .accounts({
        owner: wallet.publicKey,
        protocolTokenConfig: protocolTokenConfig,
      })
      .rpc();

    console.log("✅ Pool address updated!");
    console.log(`📜 Transaction: ${tx}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
    console.log("");

    // Verify the update
    const updatedConfig = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);
    console.log("✅ Verified updated configuration:");
    console.log(`   Pool Address: ${updatedConfig.poolAddress?.toString()}`);
    console.log("");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ SUCCESS! KEDOLOG pool address updated!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("🎯 Next Steps:");
    console.log("   1. The contract can now fetch KEDOLOG price from your pool");
    console.log("   2. Users can pay protocol fees with KEDOLOG (20% discount)");
    console.log("   3. The discount is OPTIONAL - users choose at swap time");
    console.log("");

  } catch (error: any) {
    console.error("❌ Error updating pool address:", error.message || error);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

