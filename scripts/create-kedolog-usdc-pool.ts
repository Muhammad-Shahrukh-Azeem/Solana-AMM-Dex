import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";

/**
 * 🏊 Create KEDOLOG/USDC Pool on Devnet
 * 
 * This script:
 * 1. Creates a KEDOLOG/USDC pool
 * 2. Adds initial liquidity (sets initial price)
 * 3. Saves pool address for price updates
 */

async function main() {
  console.log("🏊 Creating KEDOLOG/USDC Pool");
  console.log("=".repeat(60));
  
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.KedolikCpSwap as Program<KedolikCpSwap>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;
  
  console.log(`\n📡 Network: ${connection.rpcEndpoint}`);
  console.log(`💰 Payer: ${payer.publicKey.toString()}`);
  
  // Load addresses
  let addresses: any = {};
  try {
    addresses = JSON.parse(fs.readFileSync("devnet-addresses.json", "utf-8"));
  } catch (e) {
    console.error("❌ devnet-addresses.json not found!");
    console.error("   Run: ./scripts/create-test-tokens.sh first");
    process.exit(1);
  }
  
  const kedologMint = new PublicKey(addresses.kedologMint);
  const usdcMint = new PublicKey(addresses.testTokens.usdc);
  
  console.log(`\n📊 Pool Tokens:`);
  console.log(`   KEDOLOG: ${kedologMint.toString()}`);
  console.log(`   USDC: ${usdcMint.toString()}`);
  
  // Get AMM config
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), Buffer.from([0])],
    program.programId
  );
  
  console.log(`\n⚙️  AMM Config: ${ammConfig.toString()}`);
  
  // Derive pool address
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      kedologMint.toBuffer(),
      usdcMint.toBuffer(),
    ],
    program.programId
  );
  
  console.log(`\n🏊 Pool Address: ${poolAddress.toString()}`);
  
  // Check if pool already exists
  try {
    await program.account.poolState.fetch(poolAddress);
    console.log("\n⚠️  Pool already exists!");
    console.log("   Use this address for price updates:");
    console.log(`   ${poolAddress.toString()}`);
    
    // Save pool address
    addresses.kedologUsdcPool = poolAddress.toString();
    fs.writeFileSync("devnet-addresses.json", JSON.stringify(addresses, null, 2));
    
    return;
  } catch (e) {
    console.log("\n✅ Pool doesn't exist yet, creating...");
  }
  
  // Create pool
  console.log("\n📝 Creating pool...");
  
  // Get token accounts
  const payerKedologAccount = getAssociatedTokenAddressSync(
    kedologMint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  
  const payerUsdcAccount = getAssociatedTokenAddressSync(
    usdcMint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  
  // Derive vault addresses
  const [token0Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), kedologMint.toBuffer()],
    program.programId
  );
  
  const [token1Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  // Derive LP mint
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), poolAddress.toBuffer()],
    program.programId
  );
  
  // Derive observation
  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from("observation"), poolAddress.toBuffer()],
    program.programId
  );
  
  // Get authority
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    program.programId
  );
  
  // LP token account
  const payerLpAccount = getAssociatedTokenAddressSync(
    lpMint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  
  // Initial liquidity amounts
  // Setting price: 10 KEDOLOG = 1 USDC (so 1 KEDOLOG = $0.10)
  const kedologAmount = new BN(1_000_000 * 1e9); // 1M KEDOLOG (9 decimals)
  const usdcAmount = new BN(100_000 * 1e6);      // 100K USDC (6 decimals)
  
  console.log(`\n💰 Initial Liquidity:`);
  console.log(`   KEDOLOG: ${kedologAmount.toNumber() / 1e9} tokens`);
  console.log(`   USDC: ${usdcAmount.toNumber() / 1e6} tokens`);
  console.log(`   Initial Price: 1 KEDOLOG = $${(usdcAmount.toNumber() / 1e6) / (kedologAmount.toNumber() / 1e9)}`);
  
  try {
    const tx = await program.methods
      .initialize(kedologAmount, usdcAmount, new BN(Date.now()))
      .accountsPartial({
        creator: payer.publicKey,
        ammConfig,
        poolState: poolAddress,
        token0Mint: kedologMint,
        token1Mint: usdcMint,
        lpMint,
        creatorToken0: payerKedologAccount,
        creatorToken1: payerUsdcAccount,
        creatorLpToken: payerLpAccount,
        token0Vault,
        token1Vault,
        createPoolFee: payer.publicKey,
        observationState,
        tokenProgram: TOKEN_PROGRAM_ID,
        token0Program: TOKEN_PROGRAM_ID,
        token1Program: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true });
    
    console.log(`\n✅ Pool Created!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Pool Address: ${poolAddress.toString()}`);
    
    // Save pool address
    addresses.kedologUsdcPool = poolAddress.toString();
    fs.writeFileSync("devnet-addresses.json", JSON.stringify(addresses, null, 2));
    
    console.log(`\n📝 Pool address saved to devnet-addresses.json`);
    
    console.log(`\n🎯 Next Steps:`);
    console.log(`   1. Update KEDOLOG price from pool:`);
    console.log(`      npx ts-node scripts/update-kedolog-price-from-pool.ts --once`);
    console.log(`   2. Test swaps with KEDOLOG discount`);
    console.log(`   3. Verify prices in logs`);
    
  } catch (error) {
    console.error("\n❌ Error creating pool:", error);
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

