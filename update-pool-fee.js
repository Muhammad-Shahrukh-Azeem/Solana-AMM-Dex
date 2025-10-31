const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair } = require("@solana/web3.js");
const fs = require("fs");

async function main() {
  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/kedolik_cp_swap.json", "utf8"));
  
  // Setup provider
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, "utf8")))
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);
  
  const program = new anchor.Program(idl, provider);
  
  console.log("🔧 Setting Pool Creation Fee");
  console.log("═══════════════════════════════════════\n");
  
  // Derive AMM config
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
  console.log("\n📊 Current:");
  console.log("  Create Pool Fee:", config.createPoolFee.toString(), "lamports =", config.createPoolFee.toNumber() / 1e9, "SOL");
  
  // New fee: 0.15 SOL
  const newFee = new anchor.BN(150_000_000);
  console.log("\n🔄 Updating to:");
  console.log("  Create Pool Fee:", newFee.toString(), "lamports =", newFee.toNumber() / 1e9, "SOL");
  
  // Update (param 5 = create_pool_fee)
  const tx = await program.methods
    .updateAmmConfig(5, newFee)
    .accountsPartial({
      owner: wallet.publicKey,
      ammConfig,
    })
    .rpc();
  
  console.log("\n✅ Updated!");
  console.log("   TX:", tx);
  
  // Verify
  const updated = await program.account.ammConfig.fetch(ammConfig);
  console.log("\n📊 Verified:");
  console.log("  Create Pool Fee:", updated.createPoolFee.toString(), "lamports =", updated.createPoolFee.toNumber() / 1e9, "SOL");
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
