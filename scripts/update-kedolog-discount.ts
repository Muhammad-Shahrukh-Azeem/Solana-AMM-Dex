import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Update KEDOLOG Discount Configuration
 * 
 * This updates the GLOBAL config - changes apply to ALL pools immediately!
 */

async function main() {
  console.log("🔧 Updating KEDOLOG Discount Configuration");
  console.log("═══════════════════════════════════════\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;

  console.log("Program ID:", program.programId.toString());
  console.log("Admin Wallet:", wallet.publicKey.toString());
  console.log("");

  // Derive protocol token config PDA
  const [protocolTokenConfigAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );

  // Check current config
  try {
    const currentConfig = await program.account.protocolTokenConfig.fetch(protocolTokenConfigAddress);
    console.log("📊 Current Configuration:");
    console.log("─────────────────────────────────────");
    console.log("Discount Rate:", (currentConfig.discountRate.toNumber() / 100) + "%");
    console.log("KEDOLOG per USD:", currentConfig.protocolTokenPerUsd.toNumber() / 1_000_000);
    console.log("Treasury:", currentConfig.treasury.toString());
    console.log("Authority:", currentConfig.authority.toString());
    console.log("");
  } catch (e) {
    console.error("❌ Protocol Token Config doesn't exist!");
    console.error("Run activate-kedolog-discount.ts first.");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════
  // NEW CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const NEW_CONFIG = {
    // Set to null to keep current value, or provide new value
    
    // Discount rate: 2500 = 25%, 3000 = 30%
    discountRate: 2500, // Change to 25% (was 20%)
    
    // Treasury address (where KEDOLOG fees go)
    treasury: null, // null = keep current
    
    // Price ratio: KEDOLOG per USD (scaled by 10^6)
    protocolTokenPerUsd: null, // null = keep current
    
    // New authority (who can update config)
    newAuthority: null, // null = keep current
  };

  // ═══════════════════════════════════════════════════════════
  // PREVIEW
  // ═══════════════════════════════════════════════════════════

  console.log("📝 Proposed Changes:");
  console.log("─────────────────────────────────────");
  if (NEW_CONFIG.discountRate !== null) {
    console.log("Discount Rate: → " + (NEW_CONFIG.discountRate / 100) + "%");
  }
  if (NEW_CONFIG.treasury !== null) {
    console.log("Treasury: → " + NEW_CONFIG.treasury.toString());
  }
  if (NEW_CONFIG.protocolTokenPerUsd !== null) {
    console.log("KEDOLOG per USD: → " + (NEW_CONFIG.protocolTokenPerUsd / 1_000_000));
  }
  if (NEW_CONFIG.newAuthority !== null) {
    console.log("Authority: → " + NEW_CONFIG.newAuthority.toString());
  }
  console.log("");

  console.log("💰 Example with New Config: 100 SOL Swap");
  console.log("─────────────────────────────────────");
  if (NEW_CONFIG.discountRate !== null) {
    const discountPercent = NEW_CONFIG.discountRate / 100;
    console.log("Protocol Fee: 0.05 SOL");
    console.log("With " + discountPercent + "% discount: " + (0.05 * (100 - discountPercent) / 100).toFixed(4) + " SOL worth");
    console.log("Savings: " + (0.05 * discountPercent / 100).toFixed(4) + " SOL 🎉");
  }
  console.log("");

  console.log("⚠️  This will update settings for ALL pools immediately!");
  console.log("Both existing and future pools will use new settings.");
  console.log("");
  console.log("🔒 Updates are DISABLED by default.");
  console.log("To enable, uncomment the execution code below.\n");

  // ═══════════════════════════════════════════════════════════
  // EXECUTION (Uncomment to enable)
  // ═══════════════════════════════════════════════════════════

  /*
  console.log("🚀 Updating protocol token config...\n");

  const tx = await program.methods
    .updateProtocolTokenConfig(
      NEW_CONFIG.discountRate !== null ? new anchor.BN(NEW_CONFIG.discountRate) : null,
      NEW_CONFIG.treasury,
      NEW_CONFIG.protocolTokenPerUsd !== null ? new anchor.BN(NEW_CONFIG.protocolTokenPerUsd) : null,
      NEW_CONFIG.newAuthority
    )
    .accounts({
      authority: wallet.publicKey,
      protocolTokenConfig: protocolTokenConfigAddress,
    })
    .rpc();

  console.log("✅ Configuration Updated!");
  console.log("   Transaction:", tx);
  console.log("");

  // Verify
  const updatedConfig = await program.account.protocolTokenConfig.fetch(protocolTokenConfigAddress);
  console.log("📊 Updated Configuration:");
  console.log("   Discount Rate:", (updatedConfig.discountRate.toNumber() / 100) + "%");
  console.log("   KEDOLOG per USD:", updatedConfig.protocolTokenPerUsd.toNumber() / 1_000_000);
  console.log("   Treasury:", updatedConfig.treasury.toString());
  console.log("");

  console.log("✅ Changes are now LIVE for ALL pools!");
  console.log("Users will see new discount rate immediately.");
  */
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

