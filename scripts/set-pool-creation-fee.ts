import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { PublicKey } from "@solana/web3.js";

/**
 * 💰 Set Pool Creation Fee
 * 
 * This script sets the fee that users must pay to create a new pool.
 * The fee goes to the hardcoded address in the program:
 * 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
 */

// Configuration
const POOL_CREATION_FEE_SOL = 0.15; // 0.15 SOL per pool
const POOL_CREATION_FEE_LAMPORTS = POOL_CREATION_FEE_SOL * 1e9; // Convert to lamports

async function main() {
  console.log("💰 Setting Pool Creation Fee");
  console.log("=".repeat(60));
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const admin = (provider.wallet as anchor.Wallet).payer;
  
  console.log(`\n📡 Network: ${provider.connection.rpcEndpoint}`);
  console.log(`👤 Admin: ${admin.publicKey.toString()}`);
  
  // Get AMM config address
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
    console.log(`   Create Pool Fee: ${config.createPoolFee} lamports (${config.createPoolFee / 1e9} SOL)`);
  } catch (e) {
    console.error("\n❌ AMM Config not found!");
    console.error("   Run: npx ts-node scripts/init-devnet-config.ts first");
    process.exit(1);
  }
  
  // Update pool creation fee
  console.log(`\n🔄 Updating Pool Creation Fee...`);
  console.log(`   New Fee: ${POOL_CREATION_FEE_LAMPORTS} lamports (${POOL_CREATION_FEE_SOL} SOL)`);
  console.log(`   Fee Receiver: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa`);
  
  try {
    const tx = await program.methods
      .updateAmmConfig(
        5, // param: 5 = create_pool_fee
        new BN(POOL_CREATION_FEE_LAMPORTS)
      )
      .accounts({
        owner: admin.publicKey,
        ammConfig,
      })
      .rpc();
    
    console.log(`\n✅ Pool Creation Fee Updated!`);
    console.log(`   Transaction: ${tx}`);
    
    // Fetch updated config
    const updatedConfig = await program.account.ammConfig.fetch(ammConfig);
    console.log(`\n📊 Updated Configuration:`);
    console.log(`   Create Pool Fee: ${updatedConfig.createPoolFee} lamports (${updatedConfig.createPoolFee / 1e9} SOL)`);
    
    console.log(`\n💡 Important Notes:`);
    console.log(`   1. Users must pay ${POOL_CREATION_FEE_SOL} SOL to create a pool`);
    console.log(`   2. Fee goes to: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa`);
    console.log(`   3. This address is hardcoded in the program`);
    console.log(`   4. To change the receiver, update lib.rs and redeploy`);
    
  } catch (error) {
    console.error("\n❌ Error updating fee:", error);
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

