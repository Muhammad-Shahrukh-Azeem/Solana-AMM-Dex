import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";

/**
 * 🔄 Update KEDOLOG Price from Pool Reserves
 * 
 * This script fetches your KEDOLOG/USDC pool reserves and updates
 * the protocol token config with the calculated price.
 * 
 * Usage:
 *   1. Update KEDOLOG_USDC_POOL with your pool address
 *   2. Run: npx ts-node scripts/update-kedolog-price-from-pool.ts
 *   3. Or run continuously: node -r ts-node/register scripts/update-kedolog-price-from-pool.ts --watch
 */

// ========== CONFIGURATION ==========

// Update interval (5 minutes)
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// Which token is which in the pool
const KEDOLOG_IS_TOKEN0 = true; // KEDOLOG is token0, USDC is token1

// ===================================

// Load pool address from devnet-addresses.json
function getPoolAddress(): PublicKey {
  try {
    const addresses = JSON.parse(
      require("fs").readFileSync("devnet-addresses.json", "utf-8")
    );
    
    if (!addresses.kedologUsdcPool) {
      console.error("❌ kedologUsdcPool not found in devnet-addresses.json");
      console.error("   Run: npx ts-node scripts/create-kedolog-usdc-pool.ts first");
      process.exit(1);
    }
    
    return new PublicKey(addresses.kedologUsdcPool);
  } catch (e) {
    console.error("❌ Could not load devnet-addresses.json");
    console.error("   Run: ./scripts/create-test-tokens.sh first");
    process.exit(1);
  }
}

async function getProtocolTokenConfigAddress(
  program: Program<KedolikCpSwap>,
  protocolTokenMint: PublicKey
): Promise<PublicKey> {
  const [configAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );
  return configAddress;
}

async function updateKedologPriceFromPool() {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 Updating KEDOLOG Price from Pool");
  console.log("=".repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    // Setup
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
    const admin = (provider.wallet as anchor.Wallet).payer;
    
    // Get pool address
    const KEDOLOG_USDC_POOL = getPoolAddress();
    
    console.log(`\n📡 Network: ${provider.connection.rpcEndpoint}`);
    console.log(`👤 Admin: ${admin.publicKey.toString()}`);
    console.log(`🏊 Pool: ${KEDOLOG_USDC_POOL.toString()}`);
    
    // Fetch pool state
    console.log("\n📊 Fetching pool data...");
    const pool = await program.account.poolState.fetch(KEDOLOG_USDC_POOL);
    
    // Get reserves
    const token0Reserve = pool.token0VaultAmount.toNumber();
    const token1Reserve = pool.token1VaultAmount.toNumber();
    
    console.log(`   Token0 Reserve: ${token0Reserve}`);
    console.log(`   Token1 Reserve: ${token1Reserve}`);
    
    // Calculate price based on which token is KEDOLOG
    let kedologReserve: number;
    let usdcReserve: number;
    
    if (KEDOLOG_IS_TOKEN0) {
      kedologReserve = token0Reserve / 1e9; // KEDOLOG has 9 decimals
      usdcReserve = token1Reserve / 1e6;    // USDC has 6 decimals
    } else {
      kedologReserve = token1Reserve / 1e9;
      usdcReserve = token0Reserve / 1e6;
    }
    
    console.log(`\n💰 Adjusted Reserves:`);
    console.log(`   KEDOLOG: ${kedologReserve.toLocaleString()} tokens`);
    console.log(`   USDC: ${usdcReserve.toLocaleString()} USDC`);
    
    // Calculate KEDOLOG price
    const kedologPriceUsd = usdcReserve / kedologReserve;
    console.log(`\n📈 KEDOLOG Price: $${kedologPriceUsd.toFixed(6)}`);
    
    // Check for reasonable price (sanity check)
    if (kedologPriceUsd <= 0 || kedologPriceUsd > 1000) {
      console.error(`\n❌ Price seems unreasonable: $${kedologPriceUsd}`);
      console.error("   Skipping update. Check pool reserves.");
      return;
    }
    
    // Convert to tokens per USD (scaled by 1e6)
    const tokensPerUsd = Math.floor((1 / kedologPriceUsd) * 1_000_000);
    console.log(`   Tokens per USD: ${tokensPerUsd / 1_000_000} (scaled: ${tokensPerUsd})`);
    
    // Get protocol token config address
    const protocolTokenMint = pool.token0Mint; // Adjust if needed
    const configAddress = await getProtocolTokenConfigAddress(program, protocolTokenMint);
    
    console.log(`\n🔧 Updating config...`);
    console.log(`   Config Address: ${configAddress.toString()}`);
    
    // Update protocol token config
    const tx = await program.methods
      .updateProtocolTokenConfig(
        null,                    // Keep discount rate
        null,                    // Keep addresses
        new BN(tokensPerUsd),   // New price
        null                     // Keep oracle
      )
      .accounts({
        owner: admin.publicKey,
        protocolTokenConfig: configAddress,
      })
      .signers([admin])
      .rpc();
    
    console.log(`\n✅ Price Updated Successfully!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   New Price: $${kedologPriceUsd.toFixed(6)}`);
    
  } catch (error) {
    console.error("\n❌ Error updating price:");
    console.error(error);
    
    if (error.message?.includes("Pool not found")) {
      console.error("\n💡 Make sure KEDOLOG_USDC_POOL is set to your actual pool address");
    }
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
}

// Main execution
async function main() {
  console.log("🚀 KEDOLOG Price Update Service");
  console.log("================================");
  console.log(`Update interval: ${UPDATE_INTERVAL_MS / 1000} seconds`);
  console.log(`Pool address: ${KEDOLOG_USDC_POOL.toString()}`);
  console.log("\nPress Ctrl+C to stop");
  
  // Run immediately
  await updateKedologPriceFromPool();
  
  // Check if --once flag is passed
  const runOnce = process.argv.includes("--once");
  
  if (runOnce) {
    console.log("✅ Single update complete (--once flag detected)");
    process.exit(0);
  }
  
  // Run periodically
  setInterval(async () => {
    await updateKedologPriceFromPool();
  }, UPDATE_INTERVAL_MS);
  
  console.log("⏰ Service running... Updates every 5 minutes");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

