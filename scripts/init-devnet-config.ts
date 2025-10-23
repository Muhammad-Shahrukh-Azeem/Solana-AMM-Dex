import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

/**
 * Initialize AMM Config on Devnet
 * Run this after deploying the program
 */
async function main() {
  console.log("🔧 Initializing Devnet Configuration");
  console.log("=====================================\n");

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", wallet.publicKey.toString());
  console.log("");

  // Derive AMM Config address
  const configIndex = 0;
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16BE(configIndex, 0); // Use big-endian as per Rust to_be_bytes()
  const [ammConfigAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("amm_config"),
      indexBuffer
    ],
    program.programId
  );

  console.log("AMM Config Address:", ammConfigAddress.toString());
  console.log("");

  // Check if already exists
  try {
    const existingConfig = await program.account.ammConfig.fetch(ammConfigAddress);
    console.log("✅ AMM Config already exists!");
    console.log("   Index:", existingConfig.index);
    console.log("   Trade Fee:", existingConfig.tradeFeeRate.toString(), "/ 10000");
    console.log("   Protocol Fee:", existingConfig.protocolFeeRate.toString(), "/ 10000");
    console.log("");
    return;
  } catch (e) {
    console.log("📝 AMM Config doesn't exist, creating...");
  }

  // Create AMM Config
  try {
    const tx = await program.methods
      .createAmmConfig(
        configIndex,
        new anchor.BN(100),    // 1% trade fee (100/10000)
        new anchor.BN(10000),  // 100% protocol fee (all trade fees go to protocol)
        new anchor.BN(0),      // 0% fund fee
        new anchor.BN(0),      // 0% create pool fee
        new anchor.BN(0)       // 0% creator fee
      )
      .accounts({
        owner: wallet.publicKey,
        ammConfig: ammConfigAddress,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ AMM Config Created!");
    console.log("   Transaction:", tx);
    console.log("   Address:", ammConfigAddress.toString());
    console.log("");

    // Verify
    const config = await program.account.ammConfig.fetch(ammConfigAddress);
    console.log("📊 Configuration:");
    console.log("   Index:", config.index);
    console.log("   Trade Fee Rate:", config.tradeFeeRate.toString(), "/ 10000 =", (config.tradeFeeRate.toNumber() / 100), "%");
    console.log("   Protocol Fee Rate:", config.protocolFeeRate.toString(), "/ 10000 =", (config.protocolFeeRate.toNumber() / 100), "%");
    console.log("   Fund Fee Rate:", config.fundFeeRate.toString());
    console.log("   Create Pool Fee:", config.createPoolFee.toString());
    console.log("");

  } catch (error) {
    console.error("❌ Error creating AMM Config:");
    console.error(error);
    process.exit(1);
  }

  console.log("✅ Devnet initialization complete!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Create test tokens (see DEVNET_DEPLOYMENT.md)");
  console.log("2. Update your website with:");
  console.log("   - Program ID:", program.programId.toString());
  console.log("   - AMM Config:", ammConfigAddress.toString());
  console.log("   - IDL from: target/idl/kedolik_cp_swap.json");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


