import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import * as fs from "fs";

/**
 * Script to check all accumulated fees across pools
 * 
 * Shows:
 * - Protocol fees (SOL and tokens)
 * - Creator fees (if any)
 * - LP fees (distributed to liquidity providers)
 * - Pool creation fees collected
 */

const NETWORK = process.env.NETWORK || "devnet";
const RPC_URL = NETWORK === "mainnet" 
  ? "https://api.mainnet-beta.solana.com"
  : "https://api.devnet.solana.com";

async function main() {
  console.log("💰 Fee Collection Report");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Load deployment info
  const deploymentPath = `./deployed-${NETWORK}-new.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(fs.readFileSync(walletPath, "utf-8"))
      )
    )
  );
  
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program
  const programId = new PublicKey(deployment.programId);
  const idl = JSON.parse(
    fs.readFileSync("./target/idl/kedolik_cp_swap.json", "utf-8")
  );
  const program = new Program(idl, provider) as Program<KedolikCpSwap>;

  console.log("📋 Configuration:");
  console.log(`   Program ID: ${deployment.programId}`);
  console.log(`   Protocol Owner: ${deployment.protocolOwner}`);
  console.log(`   Pool Fee Receiver: ${deployment.createPoolFeeReceiver}`);
  console.log("");

  // Check pool creation fee receiver balance
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💵 Pool Creation Fees Collected:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const feeReceiverBalance = await connection.getBalance(
    new PublicKey(deployment.createPoolFeeReceiver)
  );
  console.log(`   Fee Receiver: ${deployment.createPoolFeeReceiver}`);
  console.log(`   Balance: ${(feeReceiverBalance / 1e9).toFixed(9)} SOL`);
  console.log(`   (Each pool creation costs 0.15 SOL)`);
  console.log("");

  // Fetch all pools
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Fetching all pools...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  try {
    const pools = await program.account.poolState.all();
    
    if (pools.length === 0) {
      console.log("ℹ️  No pools found.");
      return;
    }

    console.log(`Found ${pools.length} pool(s)\n`);

    let totalProtocolFees = {
      sol: 0,
      tokens: new Map<string, { amount: number; symbol: string; decimals: number }>(),
    };

    for (let i = 0; i < pools.length; i++) {
      const poolAccount = pools[i];
      const pool = poolAccount.account;
      const poolAddress = poolAccount.publicKey;

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Pool ${i + 1}: ${poolAddress.toString().substring(0, 8)}...`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Get token info
      const token0Mint = pool.token0Mint;
      const token1Mint = pool.token1Mint;
      
      console.log(`Token 0: ${token0Mint.toString().substring(0, 8)}...`);
      console.log(`Token 1: ${token1Mint.toString().substring(0, 8)}...`);
      console.log("");

      // Protocol fees
      console.log("💼 Protocol Fees (Accumulated):");
      
      const protocolFees0 = pool.protocolFeesToken0.toNumber();
      const protocolFees1 = pool.protocolFeesToken1.toNumber();
      
      if (protocolFees0 > 0 || protocolFees1 > 0) {
        // Get vault balances to show actual amounts
        try {
          const vault0Info = await connection.getTokenAccountBalance(pool.token0Vault);
          const vault1Info = await connection.getTokenAccountBalance(pool.token1Vault);
          
          const protocolFees0Display = protocolFees0 / Math.pow(10, vault0Info.value.decimals);
          const protocolFees1Display = protocolFees1 / Math.pow(10, vault1Info.value.decimals);
          
          console.log(`   Token 0: ${protocolFees0Display.toFixed(6)} (${protocolFees0} raw)`);
          console.log(`   Token 1: ${protocolFees1Display.toFixed(6)} (${protocolFees1} raw)`);
          
          // Track totals
          if (!totalProtocolFees.tokens.has(token0Mint.toString())) {
            totalProtocolFees.tokens.set(token0Mint.toString(), {
              amount: 0,
              symbol: "Token0",
              decimals: vault0Info.value.decimals,
            });
          }
          if (!totalProtocolFees.tokens.has(token1Mint.toString())) {
            totalProtocolFees.tokens.set(token1Mint.toString(), {
              amount: 0,
              symbol: "Token1",
              decimals: vault1Info.value.decimals,
            });
          }
          
          const token0Data = totalProtocolFees.tokens.get(token0Mint.toString())!;
          const token1Data = totalProtocolFees.tokens.get(token1Mint.toString())!;
          token0Data.amount += protocolFees0Display;
          token1Data.amount += protocolFees1Display;
          
        } catch (error) {
          console.log(`   Token 0: ${protocolFees0} (raw)`);
          console.log(`   Token 1: ${protocolFees1} (raw)`);
        }
      } else {
        console.log(`   No protocol fees accumulated yet`);
      }
      console.log("");

      // Creator fees (if enabled)
      console.log("👤 Creator Fees (Accumulated):");
      
      const creatorFees0 = pool.fundFeesToken0.toNumber();
      const creatorFees1 = pool.fundFeesToken1.toNumber();
      
      if (creatorFees0 > 0 || creatorFees1 > 0) {
        console.log(`   Token 0: ${creatorFees0} (raw)`);
        console.log(`   Token 1: ${creatorFees1} (raw)`);
        console.log(`   Creator: ${pool.poolCreator.toString().substring(0, 8)}...`);
      } else {
        console.log(`   No creator fees accumulated`);
      }
      console.log("");

      // LP fees (these are automatically distributed to LPs via the constant product formula)
      console.log("💎 LP Fees:");
      console.log(`   LP fees are automatically distributed to liquidity providers`);
      console.log(`   They are reflected in the increased value of LP tokens`);
      console.log("");

      // Pool stats
      console.log("📈 Pool Stats:");
      console.log(`   Total Liquidity: ${pool.lpSupply.toString()} LP tokens`);
      console.log(`   Trade Fee Rate: ${pool.ammConfig.toString()}`);
      console.log("");
    }

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 TOTAL FEES SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    
    console.log("💵 Pool Creation Fees:");
    console.log(`   ${(feeReceiverBalance / 1e9).toFixed(9)} SOL`);
    console.log("");
    
    console.log("💼 Protocol Fees (Claimable by Protocol Owner):");
    if (totalProtocolFees.tokens.size > 0) {
      for (const [mint, data] of totalProtocolFees.tokens.entries()) {
        if (data.amount > 0) {
          console.log(`   ${mint.substring(0, 8)}...: ${data.amount.toFixed(6)}`);
        }
      }
    } else {
      console.log("   No protocol fees accumulated yet");
    }
    console.log("");

    console.log("💡 To Claim Protocol Fees:");
    console.log("   Run: npx ts-node scripts/claim-protocol-fees.ts");
    console.log("");

  } catch (error: any) {
    console.error("❌ Error fetching pools:", error.message || error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

