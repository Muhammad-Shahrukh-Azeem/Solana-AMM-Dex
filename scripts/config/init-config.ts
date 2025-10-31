import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../../target/types/kedolik_cp_swap";
import { PublicKey } from "@solana/web3.js";

/**
 * 🔧 Initialize AMM Configuration
 * 
 * Works for both devnet and mainnet
 * Set NETWORK environment variable: devnet or mainnet
 */

// Get network from environment or default to devnet
const NETWORK = process.env.NETWORK || "devnet";
const CLUSTER = NETWORK === "mainnet" ? "mainnet-beta" : "devnet";

// Fee configuration (0.25% total)
const TRADE_FEE_RATE = 2500; // 0.25% (2500/1000000)
const PROTOCOL_FEE_RATE = 500; // 0.05% (500/1000000) - 20% of trade fee
const FUND_FEE_RATE = 0; // 0% - Not used
const CREATOR_FEE_RATE = 0; // 0% - Disabled
const CREATE_POOL_FEE = 0; // 0 SOL - Can be changed later

async function main() {
  console.log("🔧 Initializing AMM Configuration");
  console.log("=".repeat(60));
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const admin = (provider.wallet as anchor.Wallet).payer;
  
  console.log(`\n📡 Network: ${NETWORK}`);
  console.log(`🔗 Cluster: ${CLUSTER}`);
  console.log(`👤 Admin: ${admin.publicKey.toString()}`);
  
  // Get program ID
  console.log(`\n📋 Program ID: ${program.programId.toString()}`);
  
  // Derive AMM config address (index 0)
  // Note: index is u16 (2 bytes, little-endian)
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), indexBuffer],
    program.programId
  );
  
  console.log(`\n⚙️  AMM Config Address: ${ammConfig.toString()}`);
  
  // Check if config already exists
  try {
    const existingConfig = await program.account.ammConfig.fetch(ammConfig);
    console.log(`\n✅ AMM Config already exists!`);
    console.log(`   Index: ${existingConfig.index}`);
    console.log(`   Trade Fee: ${existingConfig.tradeFeeRate.toString()} / 1000000 (${existingConfig.tradeFeeRate.toNumber() / 10000}%)`);
    console.log(`   Protocol Fee: ${existingConfig.protocolFeeRate.toString()} / 1000000 (${existingConfig.protocolFeeRate.toNumber() / 10000}%)`);
    console.log(`   Fund Fee: ${existingConfig.fundFeeRate.toString()}`);
    console.log(`   Creator Fee: ${existingConfig.creatorFeeRate.toString()}`);
    console.log(`   Create Pool Fee: ${existingConfig.createPoolFee.toString()} lamports`);
    console.log(`   Protocol Owner: ${existingConfig.protocolOwner.toString()}`);
    console.log(`   Fund Owner: ${existingConfig.fundOwner.toString()}`);
    
    console.log(`\n💡 Config already initialized. Use update scripts to modify.`);
    return;
  } catch (e) {
    console.log(`\n📝 Config doesn't exist, creating...`);
  }
  
  // Create AMM config
  console.log(`\n🔄 Creating AMM Config...`);
  console.log(`   Trade Fee: ${TRADE_FEE_RATE} (${TRADE_FEE_RATE / 10000}%)`);
  console.log(`   Protocol Fee: ${PROTOCOL_FEE_RATE} (${PROTOCOL_FEE_RATE / 10000}%)`);
  console.log(`   LP Fee: ${TRADE_FEE_RATE - PROTOCOL_FEE_RATE} (${(TRADE_FEE_RATE - PROTOCOL_FEE_RATE) / 10000}%)`);
  console.log(`   Fund Fee: ${FUND_FEE_RATE}`);
  console.log(`   Creator Fee: ${CREATOR_FEE_RATE}`);
  console.log(`   Create Pool Fee: ${CREATE_POOL_FEE} SOL`);
  
  try {
    const tx = await program.methods
      .createAmmConfig(
        0, // index
        new BN(TRADE_FEE_RATE),
        new BN(PROTOCOL_FEE_RATE),
        new BN(FUND_FEE_RATE),
        new BN(CREATOR_FEE_RATE),
        new BN(CREATE_POOL_FEE)
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig,
      })
      .rpc();
    
    console.log(`\n✅ AMM Config Created!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Config Address: ${ammConfig.toString()}`);
    
    // Save config info
    const configInfo = {
      network: NETWORK,
      cluster: CLUSTER,
      ammConfig: ammConfig.toString(),
      programId: program.programId.toString(),
      owner: admin.publicKey.toString(),
      fees: {
        tradeFeeRate: TRADE_FEE_RATE,
        protocolFeeRate: PROTOCOL_FEE_RATE,
        lpFeeRate: TRADE_FEE_RATE - PROTOCOL_FEE_RATE,
        fundFeeRate: FUND_FEE_RATE,
        creatorFeeRate: CREATOR_FEE_RATE,
        createPoolFee: CREATE_POOL_FEE
      },
      createdAt: new Date().toISOString()
    };
    
    const fs = require("fs");
    fs.writeFileSync(
      `config-${NETWORK}.json`,
      JSON.stringify(configInfo, null, 2)
    );
    
    console.log(`\n📝 Config info saved to: config-${NETWORK}.json`);
    
    console.log(`\n💡 Fee Breakdown:`);
    console.log(`   Total: 0.25%`);
    console.log(`   ├─ LP Fee: 0.20% (stays in pool)`);
    console.log(`   └─ Protocol Fee: 0.05% (claimable by admin)`);
    
  } catch (error) {
    console.error("\n❌ Error creating config:", error);
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

