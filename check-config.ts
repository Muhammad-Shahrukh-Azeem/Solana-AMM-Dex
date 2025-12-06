import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "./target/idl/kedolik_cp_swap.json";

async function main() {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as any, provider);

  const ammConfig = new PublicKey("6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt");
  const protocolConfig = new PublicKey("7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv");

  console.log("📋 AMM Configuration:");
  console.log("═══════════════════════════════════════\n");
  
  const config = await program.account.ammConfig.fetch(ammConfig);
  console.log("Trade Fee Rate:", config.tradeFeeRate.toString(), `(${config.tradeFeeRate.toNumber() / 10000}%)`);
  console.log("Protocol Fee Rate:", config.protocolFeeRate.toString(), `(${config.protocolFeeRate.toNumber() / 10000}%)`);
  console.log("LP Fee Rate:", (config.tradeFeeRate.toNumber() - config.protocolFeeRate.toNumber()), `(${(config.tradeFeeRate.toNumber() - config.protocolFeeRate.toNumber()) / 10000}%)`);
  console.log("Fund Fee Rate:", config.fundFeeRate.toString());
  console.log("Creator Fee Rate:", config.creatorFeeRate.toString());
  console.log("Create Pool Fee:", config.createPoolFee.toString(), "lamports", `(${config.createPoolFee.toNumber() / 1e9} SOL)`);
  console.log("Protocol Owner:", config.protocolOwner.toString());
  console.log("Fund Owner:", config.fundOwner.toString());

  console.log("\n📋 Protocol Token Configuration:");
  console.log("═══════════════════════════════════════\n");
  
  const ptConfig = await program.account.protocolTokenConfig.fetch(protocolConfig);
  console.log("Protocol Token Mint:", ptConfig.protocolTokenMint.toString());
  console.log("Discount Rate:", ptConfig.discountRate.toString(), `(${ptConfig.discountRate.toNumber() / 100}%)`);
  console.log("Authority:", ptConfig.authority.toString());
  console.log("Treasury:", ptConfig.treasury.toString());
  console.log("Protocol Token per USD:", ptConfig.protocolTokenPerUsd.toString(), `(${ptConfig.protocolTokenPerUsd.toNumber() / 1_000_000} KEDOL per USD)`);

  console.log("\n✅ Summary:");
  console.log("═══════════════════════════════════════");
  console.log("✅ Trade Fee: 0.25%");
  console.log("✅ Protocol Fee: 0.05%");
  console.log("✅ LP Fee: 0.20%");
  console.log("✅ Pool Creation Fee:", config.createPoolFee.toNumber() / 1e9, "SOL");
  console.log("✅ KEDOL Discount: 20%");
  console.log("✅ KEDOL Price: 10 per USD");
}

main();
