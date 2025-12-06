import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

/**
 * 🔍 Diagnose Pool Swap Direction
 * 
 * This script checks if the swap direction is correct by:
 * 1. Fetching pool state
 * 2. Identifying which token is token0 and which is token1
 * 3. Explaining the expected price behavior
 */

const KEDOLOG_MINT = new PublicKey('FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function main() {
  console.log("🔍 Diagnosing Pool Swap Direction");
  console.log("=".repeat(60));
  
  // Get network from Solana CLI
  const getCurrentNetwork = (): { network: string; rpcUrl: string } => {
    try {
      const output = execSync('solana config get', { encoding: 'utf-8' });
      const rpcLine = output.split('\n').find(line => line.includes('RPC URL'));
      const rpcUrl = rpcLine ? rpcLine.split(':').slice(1).join(':').trim() : 'https://api.mainnet-beta.solana.com';
      
      let network = 'mainnet';
      if (rpcUrl.includes('devnet')) network = 'devnet';
      else if (rpcUrl.includes('testnet')) network = 'testnet';
      else if (rpcUrl.includes('mainnet')) network = 'mainnet';
      
      return { network, rpcUrl };
    } catch (e) {
      return { network: 'mainnet', rpcUrl: 'https://api.mainnet-beta.solana.com' };
    }
  };

  const { network, rpcUrl } = getCurrentNetwork();
  
  // Load wallet
  let walletPath: string;
  try {
    const configOutput = execSync('solana config get', { encoding: 'utf-8' });
    const keypairLine = configOutput.split('\n').find(line => line.includes('Keypair Path'));
    walletPath = keypairLine ? keypairLine.split(':')[1].trim() : `${os.homedir()}/.config/solana/id.json`;
    
    if (walletPath.startsWith('~')) {
      walletPath = walletPath.replace('~', os.homedir());
    }
  } catch (e) {
    walletPath = `${os.homedir()}/.config/solana/id.json`;
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  // Load program ID
  const anchorToml = fs.readFileSync('./Anchor.toml', 'utf-8');
  const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([A-Za-z0-9]+)"/);
  if (!programIdMatch) {
    console.error('❌ Could not find program ID in Anchor.toml');
    process.exit(1);
  }
  const PROGRAM_ID = new PublicKey(programIdMatch[1]);
  
  // Setup connection
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  console.log(`\n📡 Network: ${network.toUpperCase()}`);
  console.log(`🔗 RPC: ${rpcUrl}`);
  console.log(`📋 Program ID: ${PROGRAM_ID.toString()}\n`);
  
  // Check KEDOL/USDC pool
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1️⃣  KEDOL/USDC Pool Analysis");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const kedologUsdcPool = new PublicKey('8KYfYHmPyzpzqYQzVzHR3uv94E1UX8TsaEFLqBWzenRJ');
  
  try {
    const poolData: any = await (program.account as any).poolState.fetch(kedologUsdcPool);
    
    const token0Mint = poolData.token0Mint || poolData.token_0_mint;
    const token1Mint = poolData.token1Mint || poolData.token_1_mint;
    const token0Vault = poolData.token0Vault || poolData.token_0_vault;
    const token1Vault = poolData.token1Vault || poolData.token_1_vault;
    
    // Get vault balances
    const token0Balance = await connection.getTokenAccountBalance(token0Vault);
    const token1Balance = await connection.getTokenAccountBalance(token1Vault);
    
    const token0Amount = parseFloat(token0Balance.value.amount) / Math.pow(10, token0Balance.value.decimals);
    const token1Amount = parseFloat(token1Balance.value.amount) / Math.pow(10, token1Balance.value.decimals);
    
    console.log("📊 Pool Structure:");
    console.log(`   Token0 Mint: ${token0Mint.toString()}`);
    console.log(`   Token1 Mint: ${token1Mint.toString()}`);
    console.log(`   Token0 Vault: ${token0Vault.toString()}`);
    console.log(`   Token1 Vault: ${token1Vault.toString()}`);
    console.log(`   Token0 Reserve: ${token0Amount.toLocaleString()}`);
    console.log(`   Token1 Reserve: ${token1Amount.toLocaleString()}`);
    console.log("");
    
    // Identify tokens
    const isKedologToken0 = token0Mint.equals(KEDOLOG_MINT);
    const isUsdcToken0 = token0Mint.equals(USDC_MINT);
    const isKedologToken1 = token1Mint.equals(KEDOLOG_MINT);
    const isUsdcToken1 = token1Mint.equals(USDC_MINT);
    
    if (!isKedologToken0 && !isKedologToken1) {
      console.error("❌ Pool does not contain KEDOL!");
      process.exit(1);
    }
    if (!isUsdcToken0 && !isUsdcToken1) {
      console.error("❌ Pool does not contain USDC!");
      process.exit(1);
    }
    
    console.log("🔍 Token Identification:");
    if (isKedologToken0) {
      console.log("   ✅ Token0 = KEDOL");
      console.log("   ✅ Token1 = USDC");
      console.log("");
      console.log("💰 Current Price:");
      console.log(`   1 KEDOL = ${(token1Amount / token0Amount).toFixed(6)} USDC`);
      console.log(`   1 USDC = ${(token0Amount / token1Amount).toFixed(6)} KEDOL`);
      console.log("");
      console.log("📈 Expected Price Behavior:");
      console.log("   When swapping USDC → KEDOL:");
      console.log("     - Adding USDC to pool (Token1 increases)");
      console.log("     - Removing KEDOL from pool (Token0 decreases)");
      console.log("     - Price = USDC_reserve / KEDOL_reserve");
      console.log("     - ✅ Price of KEDOL should INCREASE");
      console.log("");
      console.log("   When swapping KEDOL → USDC:");
      console.log("     - Adding KEDOL to pool (Token0 increases)");
      console.log("     - Removing USDC from pool (Token1 decreases)");
      console.log("     - Price = USDC_reserve / KEDOL_reserve");
      console.log("     - ✅ Price of KEDOL should DECREASE");
    } else {
      console.log("   ✅ Token0 = USDC");
      console.log("   ✅ Token1 = KEDOL");
      console.log("");
      console.log("💰 Current Price:");
      console.log(`   1 KEDOL = ${(token0Amount / token1Amount).toFixed(6)} USDC`);
      console.log(`   1 USDC = ${(token1Amount / token0Amount).toFixed(6)} KEDOL`);
      console.log("");
      console.log("📈 Expected Price Behavior:");
      console.log("   When swapping USDC → KEDOL:");
      console.log("     - Adding USDC to pool (Token0 increases)");
      console.log("     - Removing KEDOL from pool (Token1 decreases)");
      console.log("     - Price = USDC_reserve / KEDOL_reserve = Token0 / Token1");
      console.log("     - ✅ Price of KEDOL should INCREASE");
      console.log("");
      console.log("   When swapping KEDOL → USDC:");
      console.log("     - Adding KEDOL to pool (Token1 increases)");
      console.log("     - Removing USDC from pool (Token0 decreases)");
      console.log("     - Price = USDC_reserve / KEDOL_reserve = Token0 / Token1");
      console.log("     - ✅ Price of KEDOL should DECREASE");
    }
    
    console.log("");
    console.log("⚠️  If you're seeing the OPPOSITE behavior:");
    console.log("   1. Check if you're swapping in the correct direction");
    console.log("   2. Verify which vault is being used as input_vault vs output_vault");
    console.log("   3. Check if the frontend is displaying price correctly");
    
  } catch (e: any) {
    console.error("❌ Error fetching pool:", e.message);
    process.exit(1);
  }
  
  console.log("\n✅ Diagnosis complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

