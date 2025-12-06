/**
 * Update KEDOL Price from Existing Raydium Pool
 * 
 * This script fetches the KEDOL price from an existing Raydium liquidity pool
 * and updates the protocol token config in your CP-Swap contract.
 * 
 * Usage:
 *   RAYDIUM_POOL_ADDRESS=<pool_address> npx ts-node scripts/update-kedol-price-from-raydium.ts
 * 
 * Example:
 *   RAYDIUM_POOL_ADDRESS=YourRaydiumPoolAddress npx ts-node scripts/update-kedol-price-from-raydium.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import idl from "../target/idl/kedolik_cp_swap.json";
import fs from "fs";

// Raydium AMM Program ID (mainnet/devnet)
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

interface RaydiumPoolState {
  status: anchor.BN;
  nonce: number;
  orderNum: anchor.BN;
  depth: anchor.BN;
  coinDecimals: anchor.BN;
  pcDecimals: anchor.BN;
  state: anchor.BN;
  resetFlag: anchor.BN;
  minSize: anchor.BN;
  volMaxCutRatio: anchor.BN;
  amountWaveRatio: anchor.BN;
  coinLotSize: anchor.BN;
  pcLotSize: anchor.BN;
  minPriceMultiplier: anchor.BN;
  maxPriceMultiplier: anchor.BN;
  systemDecimalsValue: anchor.BN;
  minSeparateNumerator: anchor.BN;
  minSeparateDenominator: anchor.BN;
  tradeFeeNumerator: anchor.BN;
  tradeFeeDenominator: anchor.BN;
  pnlNumerator: anchor.BN;
  pnlDenominator: anchor.BN;
  swapFeeNumerator: anchor.BN;
  swapFeeDenominator: anchor.BN;
  needTakePnlCoin: anchor.BN;
  needTakePnlPc: anchor.BN;
  totalPnlPc: anchor.BN;
  totalPnlCoin: anchor.BN;
  poolOpenTime: anchor.BN;
  punishPcAmount: anchor.BN;
  punishCoinAmount: anchor.BN;
  orderbookToInitTime: anchor.BN;
  swapCoinInAmount: anchor.BN;
  swapPcOutAmount: anchor.BN;
  swapCoin2PcFee: anchor.BN;
  swapPcInAmount: anchor.BN;
  swapCoinOutAmount: anchor.BN;
  swapPc2CoinFee: anchor.BN;
  poolCoinTokenAccount: PublicKey;
  poolPcTokenAccount: PublicKey;
  coinMintAddress: PublicKey;
  pcMintAddress: PublicKey;
  lpMintAddress: PublicKey;
  ammOpenOrders: PublicKey;
  serumMarket: PublicKey;
  serumProgramId: PublicKey;
  ammTargetOrders: PublicKey;
  poolWithdrawQueue: PublicKey;
  poolTempLpTokenAccount: PublicKey;
  ammOwner: PublicKey;
  pnlOwner: PublicKey;
}

async function main() {
  console.log("🔄 Updating KEDOL Price from Raydium Pool");
  console.log("═══════════════════════════════════════════\n");

  // Get Raydium pool address from environment
  const raydiumPoolAddress = process.env.RAYDIUM_POOL_ADDRESS;
  if (!raydiumPoolAddress) {
    console.error("❌ Error: RAYDIUM_POOL_ADDRESS environment variable not set");
    console.log("\nUsage:");
    console.log("  RAYDIUM_POOL_ADDRESS=<pool_address> npx ts-node scripts/update-kedol-price-from-raydium.ts");
    process.exit(1);
  }

  // Setup connection and provider
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet;

  console.log(`📡 Network: ${connection.rpcEndpoint}`);
  console.log(`💰 Admin: ${wallet.publicKey.toString()}`);
  console.log(`🏊 Raydium Pool: ${raydiumPoolAddress}\n`);

  // Load program
  const programId = new PublicKey((idl as any).address);
  const program = new Program(idl as any, provider) as Program<KedolikCpSwap>;

  // Get protocol token config address
  const [protocolTokenConfigAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );

  console.log(`📋 Protocol Token Config: ${protocolTokenConfigAddress.toString()}\n`);

  // Fetch Raydium pool state
  console.log("🔍 Fetching Raydium pool data...");
  const poolPublicKey = new PublicKey(raydiumPoolAddress);
  const poolAccountInfo = await connection.getAccountInfo(poolPublicKey);

  if (!poolAccountInfo) {
    console.error("❌ Error: Raydium pool not found");
    process.exit(1);
  }

  // Parse Raydium pool state (simplified - you may need to adjust based on actual Raydium layout)
  // For a proper implementation, you'd use the Raydium SDK or parse the account data correctly
  console.log("⚠️  Note: This is a simplified parser. For production, use Raydium SDK.\n");

  // Get vault balances from the pool
  // In Raydium, the pool state contains references to token vaults
  // We need to read those vault balances to calculate price
  
  console.log("📊 Fetching vault balances...");
  
  // For now, let's provide a manual input option
  console.log("\n⚠️  Automatic Raydium pool parsing requires the Raydium SDK.");
  console.log("For now, please provide the pool reserves manually:\n");
  console.log("1. Go to https://raydium.io/");
  console.log("2. Find your KEDOL pool");
  console.log("3. Note the reserves (e.g., '1M KEDOL' and '100K USDC')");
  console.log("4. Set environment variables:");
  console.log("   KEDOLOG_RESERVE=1000000");
  console.log("   USDC_RESERVE=100000");
  console.log("   KEDOLOG_DECIMALS=9");
  console.log("   USDC_DECIMALS=6\n");

  const kedologReserve = process.env.KEDOLOG_RESERVE;
  const usdcReserve = process.env.USDC_RESERVE;
  const kedologDecimals = parseInt(process.env.KEDOLOG_DECIMALS || "9");
  const usdcDecimals = parseInt(process.env.USDC_DECIMALS || "6");

  if (!kedologReserve || !usdcReserve) {
    console.error("❌ Error: Please set KEDOLOG_RESERVE and USDC_RESERVE");
    process.exit(1);
  }

  // Calculate price
  const kedologAmount = parseFloat(kedologReserve);
  const usdcAmount = parseFloat(usdcReserve);
  
  const priceInUsd = usdcAmount / kedologAmount;
  const kedologPerUsd = 1 / priceInUsd;

  console.log("💰 Price Calculation:");
  console.log(`   KEDOL Reserve: ${kedologAmount.toLocaleString()}`);
  console.log(`   USDC Reserve: ${usdcAmount.toLocaleString()}`);
  console.log(`   Price: 1 KEDOL = $${priceInUsd.toFixed(6)}`);
  console.log(`   Inverse: 1 USD = ${kedologPerUsd.toFixed(2)} KEDOL\n`);

  // Convert to protocol format (scaled by 10^6)
  const protocolTokenPerUsd = Math.floor(kedologPerUsd * 1_000_000);

  console.log(`📝 Protocol Format: ${protocolTokenPerUsd} (scaled by 10^6)\n`);

  // Update the config
  console.log("🔄 Updating protocol token config...");

  try {
    const tx = await program.methods
      .updateProtocolTokenConfig(
        null, // protocolTokenMint (null = no change)
        null, // discountRate (null = no change)
        null, // authority (null = no change)
        null, // treasury (null = no change)
        new anchor.BN(protocolTokenPerUsd) // protocolTokenPerUsd
      )
      .accountsPartial({
        authority: wallet.publicKey,
        protocolTokenConfig: protocolTokenConfigAddress,
      })
      .rpc();

    console.log("✅ Price Updated!");
    console.log(`   Transaction: ${tx}\n`);

    // Verify
    const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfigAddress);
    console.log("📊 Verified Configuration:");
    console.log(`   KEDOL per USD: ${config.protocolTokenPerUsd.toNumber() / 1_000_000}`);
    console.log(`   Price: 1 KEDOL = $${(1_000_000 / config.protocolTokenPerUsd.toNumber()).toFixed(6)}`);

  } catch (error: any) {
    console.error("❌ Error updating config:", error.message);
    if (error.logs) {
      console.log("\nProgram Logs:");
      error.logs.forEach((log: string) => console.log("  ", log));
    }
    process.exit(1);
  }
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

