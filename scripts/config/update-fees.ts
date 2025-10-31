import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../../target/types/kedolik_cp_swap";
import { PublicKey } from "@solana/web3.js";

/**
 * 💰 Update Fee Configuration
 * 
 * Update any of the fee parameters
 * Only the config owner can run this
 * 
 * Usage:
 *   NETWORK=devnet TRADE_FEE=2500 PROTOCOL_FEE=500 npx ts-node scripts/config/update-fees.ts
 *   NETWORK=mainnet POOL_CREATION_FEE=150000000 npx ts-node scripts/config/update-fees.ts
 */

const NETWORK = process.env.NETWORK || "devnet";
const CLUSTER = NETWORK === "mainnet" ? "mainnet-beta" : "devnet";

// Fee parameters (optional, only update if provided)
const TRADE_FEE = process.env.TRADE_FEE ? parseInt(process.env.TRADE_FEE) : null;
const PROTOCOL_FEE = process.env.PROTOCOL_FEE ? parseInt(process.env.PROTOCOL_FEE) : null;
const FUND_FEE = process.env.FUND_FEE ? parseInt(process.env.FUND_FEE) : null;
const CREATOR_FEE = process.env.CREATOR_FEE ? parseInt(process.env.CREATOR_FEE) : null;
const POOL_CREATION_FEE = process.env.POOL_CREATION_FEE ? parseInt(process.env.POOL_CREATION_FEE) : null;

async function main() {
  console.log("💰 Update Fee Configuration");
  console.log("=".repeat(60));
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const owner = (provider.wallet as anchor.Wallet).payer;
  
  console.log(`\n📡 Network: ${NETWORK}`);
  console.log(`🔗 Cluster: ${CLUSTER}`);
  console.log(`👤 Owner: ${owner.publicKey.toString()}`);
  
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
    console.log(`   Trade Fee: ${config.tradeFeeRate} (${config.tradeFeeRate / 10000}%)`);
    console.log(`   Protocol Fee: ${config.protocolFeeRate} (${config.protocolFeeRate / 10000}%)`);
    console.log(`   Fund Fee: ${config.fundFeeRate}`);
    console.log(`   Creator Fee: ${config.creatorFeeRate}`);
    console.log(`   Pool Creation Fee: ${config.createPoolFee} lamports (${config.createPoolFee / 1e9} SOL)`);
  } catch (e) {
    console.error("\n❌ AMM Config not found!");
    console.error("   Run: npx ts-node scripts/config/init-config.ts first");
    process.exit(1);
  }
  
  // Check if any updates provided
  if (!TRADE_FEE && !PROTOCOL_FEE && !FUND_FEE && !CREATOR_FEE && !POOL_CREATION_FEE) {
    console.log(`\n💡 No updates provided. Set environment variables:`);
    console.log(`   TRADE_FEE=2500 (0.25%)`);
    console.log(`   PROTOCOL_FEE=500 (0.05%)`);
    console.log(`   FUND_FEE=0`);
    console.log(`   CREATOR_FEE=0`);
    console.log(`   POOL_CREATION_FEE=150000000 (0.15 SOL)`);
    process.exit(0);
  }
  
  // Update fees
  console.log(`\n🔄 Updating fees...`);
  
  const updates: Array<{param: number, value: BN, name: string}> = [];
  
  if (TRADE_FEE !== null) {
    updates.push({param: 0, value: new BN(TRADE_FEE), name: `Trade Fee: ${TRADE_FEE} (${TRADE_FEE / 10000}%)`});
  }
  if (PROTOCOL_FEE !== null) {
    updates.push({param: 1, value: new BN(PROTOCOL_FEE), name: `Protocol Fee: ${PROTOCOL_FEE} (${PROTOCOL_FEE / 10000}%)`});
  }
  if (FUND_FEE !== null) {
    updates.push({param: 2, value: new BN(FUND_FEE), name: `Fund Fee: ${FUND_FEE}`});
  }
  if (CREATOR_FEE !== null) {
    updates.push({param: 3, value: new BN(CREATOR_FEE), name: `Creator Fee: ${CREATOR_FEE}`});
  }
  if (POOL_CREATION_FEE !== null) {
    updates.push({param: 5, value: new BN(POOL_CREATION_FEE), name: `Pool Creation Fee: ${POOL_CREATION_FEE} lamports (${POOL_CREATION_FEE / 1e9} SOL)`});
  }
  
  try {
    for (const update of updates) {
      console.log(`\n   Updating: ${update.name}`);
      
      const tx = await program.methods
        .updateAmmConfig(update.param, update.value)
        .accounts({
          owner: owner.publicKey,
          ammConfig,
        })
        .rpc();
      
      console.log(`   ✅ Updated! TX: ${tx}`);
    }
    
    // Fetch updated config
    const updatedConfig = await program.account.ammConfig.fetch(ammConfig);
    console.log(`\n📊 Updated Configuration:`);
    console.log(`   Trade Fee: ${updatedConfig.tradeFeeRate} (${updatedConfig.tradeFeeRate / 10000}%)`);
    console.log(`   Protocol Fee: ${updatedConfig.protocolFeeRate} (${updatedConfig.protocolFeeRate / 10000}%)`);
    console.log(`   LP Fee: ${updatedConfig.tradeFeeRate - updatedConfig.protocolFeeRate} (${(updatedConfig.tradeFeeRate - updatedConfig.protocolFeeRate) / 10000}%)`);
    console.log(`   Fund Fee: ${updatedConfig.fundFeeRate}`);
    console.log(`   Creator Fee: ${updatedConfig.creatorFeeRate}`);
    console.log(`   Pool Creation Fee: ${updatedConfig.createPoolFee} lamports (${updatedConfig.createPoolFee / 1e9} SOL)`);
    
  } catch (error) {
    console.error("\n❌ Error updating fees:", error);
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

