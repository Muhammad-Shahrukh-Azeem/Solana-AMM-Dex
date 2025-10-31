import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../target/idl/kedolik_cp_swap.json";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as any, provider);
  const wallet = provider.wallet;

  console.log("🔧 Setting Pool Creation Fee");
  console.log("═══════════════════════════════════════\n");

  // Derive AMM config address
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), indexBuffer],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("AMM Config:", ammConfig.toString());
  console.log("Admin:", wallet.publicKey.toString());

  // Get current config
  const config = await program.account.ammConfig.fetch(ammConfig);
  console.log("\n📊 Current Configuration:");
  console.log("  Create Pool Fee:", config.createPoolFee.toString(), "lamports");
  console.log("  Create Pool Fee:", config.createPoolFee.toNumber() / 1e9, "SOL");

  // New fee: 0.15 SOL = 150,000,000 lamports
  const newFee = new BN(150_000_000);
  console.log("\n🔄 Updating to:");
  console.log("  Create Pool Fee:", newFee.toString(), "lamports");
  console.log("  Create Pool Fee:", newFee.toNumber() / 1e9, "SOL");

  // Update using param 5 (create_pool_fee)
  // Param values: 0=trade_fee, 1=protocol_fee, 2=fund_fee, 3=new_owner, 4=new_fund_owner, 5=create_pool_fee
  const tx = await program.methods
    .updateAmmConfig(5, newFee)
    .accountsPartial({
      owner: wallet.publicKey,
      ammConfig,
    })
    .rpc();

  console.log("\n✅ Pool Creation Fee Updated!");
  console.log("   Transaction:", tx);

  // Verify
  const updatedConfig = await program.account.ammConfig.fetch(ammConfig);
  console.log("\n📊 Verified Configuration:");
  console.log("  Create Pool Fee:", updatedConfig.createPoolFee.toString(), "lamports");
  console.log("  Create Pool Fee:", updatedConfig.createPoolFee.toNumber() / 1e9, "SOL");
  console.log("  Fee Receiver: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa");
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

