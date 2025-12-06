import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

/**
 * Activate KEDOL Token Discount Feature
 * 
 * This creates a GLOBAL config that applies to ALL pools (existing and new)
 * Users can pay protocol fees with KEDOL tokens and get a discount!
 */

async function main() {
  console.log("🎯 Activating KEDOL Discount Feature");
  console.log("═══════════════════════════════════════\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  console.log("Program ID:", program.programId.toString());
  console.log("Admin Wallet:", wallet.publicKey.toString());
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const KEDOLOG_CONFIG = {
    // KEDOL token mint address
    protocolTokenMint: new PublicKey("22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx"),
    
    // Discount rate: 2000 = 20% discount, 2500 = 25% discount
    discountRate: 2000, // 20% discount
    
    // Treasury where KEDOL fees go
    treasury: wallet.publicKey, // You can change this later
    
    // Price ratio: How many KEDOL per 1 USD (scaled by 10^6)
    // Example: If 1 USD = 10 KEDOL, set to 10_000_000
    // Example: If 1 USD = 100 KEDOL, set to 100_000_000
    protocolTokenPerUsd: 10_000_000, // 1 USD = 10 KEDOL
  };

  // Derive protocol token config PDA
  const [protocolTokenConfigAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );

  console.log("Protocol Token Config Address:", protocolTokenConfigAddress.toString());
  console.log("");

  // Check if already exists
  try {
    const existingConfig = await program.account.protocolTokenConfig.fetch(protocolTokenConfigAddress);
    console.log("✅ Protocol Token Config already exists!");
    console.log("   Discount Rate:", existingConfig.discountRate.toString(), "(" + (existingConfig.discountRate.toNumber() / 100) + "%)");
    console.log("   KEDOL per USD:", existingConfig.protocolTokenPerUsd.toNumber() / 1_000_000);
    console.log("   Treasury:", existingConfig.treasury.toString());
    console.log("");
    console.log("💡 To update, use the update-kedol-discount.ts script.");
    return;
  } catch (e) {
    console.log("📝 Config doesn't exist, will create new one...");
  }

  // ═══════════════════════════════════════════════════════════
  // PREVIEW
  // ═══════════════════════════════════════════════════════════

  console.log("\n📊 Configuration Preview:");
  console.log("─────────────────────────────────────");
  console.log("KEDOL Token:", KEDOLOG_CONFIG.protocolTokenMint.toString());
  console.log("Discount Rate:", (KEDOLOG_CONFIG.discountRate / 100) + "%");
  console.log("Treasury:", KEDOLOG_CONFIG.treasury.toString());
  console.log("Price Ratio:", KEDOLOG_CONFIG.protocolTokenPerUsd / 1_000_000, "KEDOL per USD");
  console.log("");

  console.log("💰 Example: 100 SOL Swap (assuming 1 SOL = $100)");
  console.log("─────────────────────────────────────");
  console.log("Without KEDOL:");
  console.log("  Protocol Fee: 0.05 SOL = $5");
  console.log("");
  console.log("With KEDOL (20% discount):");
  console.log("  Protocol Fee: 0.04 SOL worth = $4");
  console.log("  User pays: 0.4 KEDOL (at 10 KEDOL = $1)");
  console.log("  Savings: $1 (20% off!) 🎉");
  console.log("");

  console.log("⚠️  This will enable KEDOL discounts for ALL pools!");
  console.log("Both existing and future pools will support this feature.");
  console.log("");
  console.log("🚀 Creating protocol token config...\n");

  const tx = await program.methods
    .createProtocolTokenConfig(
      KEDOLOG_CONFIG.protocolTokenMint,
      new anchor.BN(KEDOLOG_CONFIG.discountRate),
      wallet.publicKey, // authority
      KEDOLOG_CONFIG.treasury,
      new anchor.BN(KEDOLOG_CONFIG.protocolTokenPerUsd)
    )
    .accountsPartial({
      payer: wallet.publicKey,
      protocolTokenConfig: protocolTokenConfigAddress,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Protocol Token Config Created!");
  console.log("   Transaction:", tx);
  console.log("   Address:", protocolTokenConfigAddress.toString());
  console.log("");

  // Verify
  const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfigAddress);
  console.log("📊 Verified Configuration:");
  console.log("   Discount Rate:", (config.discountRate.toNumber() / 100) + "%");
  console.log("   KEDOL per USD:", config.protocolTokenPerUsd.toNumber() / 1_000_000);
  console.log("   Treasury:", config.treasury.toString());
  console.log("");

  console.log("✅ KEDOL discount feature is now ACTIVE for ALL pools!");
  console.log("");
  console.log("📝 Next steps:");
  console.log("1. Update your frontend to show discount option");
  console.log("2. Users call 'swap_base_input_with_protocol_token' to use discount");
  console.log("3. Monitor KEDOL fee collection in treasury");
  console.log("");
  console.log("💡 To update settings later, use update-kedol-discount.ts");
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

