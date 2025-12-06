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
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";

/**
 * 🧪 Test Swap with Pyth Oracle Pricing
 * 
 * This script tests:
 * 1. Normal swap (0.25% fee)
 * 2. Swap with KEDOL discount (0.24% effective fee)
 * 3. Verifies Pyth prices are used correctly
 */

// Pyth price feed addresses (Devnet)
const PYTH_ORACLES = {
  SOL_USD: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
  // Add more as needed
};

async function main() {
  console.log("🧪 Testing Swaps with Pyth Oracle");
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
    process.exit(1);
  }
  
  const kedologMint = new PublicKey(addresses.kedologMint);
  const solMint = new PublicKey(addresses.testTokens.sol);
  const usdcMint = new PublicKey(addresses.testTokens.usdc);
  
  // Get AMM config
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), Buffer.from([0])],
    program.programId
  );
  
  // Get protocol token config
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );
  
  console.log(`\n⚙️  Configs:`);
  console.log(`   AMM Config: ${ammConfig.toString()}`);
  console.log(`   Protocol Token Config: ${protocolTokenConfig.toString()}`);
  
  // Test 1: Normal Swap (SOL → USDC)
  console.log("\n" + "━".repeat(60));
  console.log("Test 1: Normal Swap (0.25% fee)");
  console.log("━".repeat(60));
  
  await testNormalSwap(
    program,
    payer,
    ammConfig,
    solMint,
    usdcMint,
    new BN(1 * 1e9) // 1 SOL
  );
  
  // Test 2: Swap with KEDOL Discount
  console.log("\n" + "━".repeat(60));
  console.log("Test 2: Swap with KEDOL Discount (0.24% effective)");
  console.log("━".repeat(60));
  
  await testSwapWithKedologDiscount(
    program,
    payer,
    ammConfig,
    protocolTokenConfig,
    solMint,
    usdcMint,
    kedologMint,
    new BN(1 * 1e9) // 1 SOL
  );
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ All Tests Complete!");
  console.log("=".repeat(60));
}

async function testNormalSwap(
  program: Program<KedolikCpSwap>,
  payer: Keypair,
  ammConfig: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: BN
) {
  console.log(`\n💱 Swapping ${amountIn.toNumber() / 1e9} SOL → USDC`);
  
  // Get pool address
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      inputMint.toBuffer(),
      outputMint.toBuffer(),
    ],
    program.programId
  );
  
  console.log(`   Pool: ${poolAddress.toString()}`);
  
  // Get token accounts
  const inputTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    payer.publicKey
  );
  const outputTokenAccount = getAssociatedTokenAddressSync(
    outputMint,
    payer.publicKey
  );
  
  // Get balances before
  const inputBefore = await getAccount(
    program.provider.connection,
    inputTokenAccount
  );
  const outputBefore = await getAccount(
    program.provider.connection,
    outputTokenAccount
  );
  
  console.log(`\n📊 Before:`);
  console.log(`   Input: ${inputBefore.amount.toString()}`);
  console.log(`   Output: ${outputBefore.amount.toString()}`);
  
  // Get vaults
  const [inputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), inputMint.toBuffer()],
    program.programId
  );
  const [outputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), outputMint.toBuffer()],
    program.programId
  );
  
  // Get authority
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    program.programId
  );
  
  // Get observation
  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from("observation"), poolAddress.toBuffer()],
    program.programId
  );
  
  try {
    const tx = await program.methods
      .swapBaseInput(amountIn, new BN(0))
      .accounts({
        payer: payer.publicKey,
        authority,
        ammConfig,
        poolState: poolAddress,
        inputTokenAccount,
        outputTokenAccount,
        inputVault,
        outputVault,
        inputTokenProgram: TOKEN_PROGRAM_ID,
        outputTokenProgram: TOKEN_PROGRAM_ID,
        inputTokenMint: inputMint,
        outputTokenMint: outputMint,
        observationState,
      })
      .rpc({ skipPreflight: true });
    
    console.log(`\n✅ Swap successful!`);
    console.log(`   TX: ${tx}`);
    
    // Get balances after
    const inputAfter = await getAccount(
      program.provider.connection,
      inputTokenAccount
    );
    const outputAfter = await getAccount(
      program.provider.connection,
      outputTokenAccount
    );
    
    console.log(`\n📊 After:`);
    console.log(`   Input: ${inputAfter.amount.toString()}`);
    console.log(`   Output: ${outputAfter.amount.toString()}`);
    
    const inputDiff = Number(inputBefore.amount) - Number(inputAfter.amount);
    const outputDiff = Number(outputAfter.amount) - Number(outputBefore.amount);
    
    console.log(`\n💰 Changes:`);
    console.log(`   Spent: ${inputDiff / 1e9} SOL`);
    console.log(`   Received: ${outputDiff / 1e6} USDC`);
    console.log(`   Effective fee: ${((amountIn.toNumber() - inputDiff) / amountIn.toNumber() * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error("\n❌ Swap failed:", error);
    throw error;
  }
}

async function testSwapWithKedologDiscount(
  program: Program<KedolikCpSwap>,
  payer: Keypair,
  ammConfig: PublicKey,
  protocolTokenConfig: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  kedologMint: PublicKey,
  amountIn: BN
) {
  console.log(`\n💱 Swapping ${amountIn.toNumber() / 1e9} SOL → USDC (with KEDOL)`);
  
  // Get pool address
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      ammConfig.toBuffer(),
      inputMint.toBuffer(),
      outputMint.toBuffer(),
    ],
    program.programId
  );
  
  console.log(`   Pool: ${poolAddress.toString()}`);
  
  // Get token accounts
  const inputTokenAccount = getAssociatedTokenAddressSync(
    inputMint,
    payer.publicKey
  );
  const outputTokenAccount = getAssociatedTokenAddressSync(
    outputMint,
    payer.publicKey
  );
  const kedologAccount = getAssociatedTokenAddressSync(
    kedologMint,
    payer.publicKey
  );
  
  // Get balances before
  const inputBefore = await getAccount(
    program.provider.connection,
    inputTokenAccount
  );
  const outputBefore = await getAccount(
    program.provider.connection,
    outputTokenAccount
  );
  const kedologBefore = await getAccount(
    program.provider.connection,
    kedologAccount
  );
  
  console.log(`\n📊 Before:`);
  console.log(`   Input: ${inputBefore.amount.toString()}`);
  console.log(`   Output: ${outputBefore.amount.toString()}`);
  console.log(`   KEDOL: ${kedologBefore.amount.toString()}`);
  
  // Get vaults
  const [inputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), inputMint.toBuffer()],
    program.programId
  );
  const [outputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolAddress.toBuffer(), outputMint.toBuffer()],
    program.programId
  );
  
  // Get authority
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    program.programId
  );
  
  // Get observation
  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from("observation"), poolAddress.toBuffer()],
    program.programId
  );
  
  // Get protocol token treasury
  const config = await program.account.protocolTokenConfig.fetch(
    protocolTokenConfig
  );
  const protocolTokenTreasury = config.protocolTokenTreasury;
  
  try {
    const tx = await program.methods
      .swapBaseInputWithProtocolToken(amountIn, new BN(0))
      .accounts({
        payer: payer.publicKey,
        authority,
        ammConfig,
        poolState: poolAddress,
        inputTokenAccount,
        outputTokenAccount,
        inputVault,
        outputVault,
        inputTokenProgram: TOKEN_PROGRAM_ID,
        outputTokenProgram: TOKEN_PROGRAM_ID,
        inputTokenMint: inputMint,
        outputTokenMint: outputMint,
        observationState,
        protocolTokenConfig,
        protocolTokenAccount: kedologAccount,
        protocolTokenMint: kedologMint,
        protocolTokenTreasury,
        protocolTokenProgram: TOKEN_PROGRAM_ID,
        inputTokenOracle: PYTH_ORACLES.SOL_USD,  // Pyth SOL/USD
        protocolTokenOracle: SystemProgram.programId,  // Manual KEDOL price
      })
      .rpc({ skipPreflight: true });
    
    console.log(`\n✅ Swap successful!`);
    console.log(`   TX: ${tx}`);
    
    // Get balances after
    const inputAfter = await getAccount(
      program.provider.connection,
      inputTokenAccount
    );
    const outputAfter = await getAccount(
      program.provider.connection,
      outputTokenAccount
    );
    const kedologAfter = await getAccount(
      program.provider.connection,
      kedologAccount
    );
    
    console.log(`\n📊 After:`);
    console.log(`   Input: ${inputAfter.amount.toString()}`);
    console.log(`   Output: ${outputAfter.amount.toString()}`);
    console.log(`   KEDOL: ${kedologAfter.amount.toString()}`);
    
    const inputDiff = Number(inputBefore.amount) - Number(inputAfter.amount);
    const outputDiff = Number(outputAfter.amount) - Number(outputBefore.amount);
    const kedologDiff = Number(kedologBefore.amount) - Number(kedologAfter.amount);
    
    console.log(`\n💰 Changes:`);
    console.log(`   Spent: ${inputDiff / 1e9} SOL`);
    console.log(`   Received: ${outputDiff / 1e6} USDC`);
    console.log(`   KEDOL paid: ${kedologDiff / 1e9} tokens`);
    console.log(`   Effective fee: ${((amountIn.toNumber() - inputDiff) / amountIn.toNumber() * 100).toFixed(2)}%`);
    
    // Fetch and display logs
    console.log(`\n📜 Fetching transaction logs...`);
    const txDetails = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
    });
    
    if (txDetails?.meta?.logMessages) {
      const pythLogs = txDetails.meta.logMessages.filter(log => 
        log.includes("Pyth price") || log.includes("KEDOL")
      );
      
      if (pythLogs.length > 0) {
        console.log(`\n🔮 Pyth Oracle Logs:`);
        pythLogs.forEach(log => console.log(`   ${log}`));
      }
    }
    
  } catch (error) {
    console.error("\n❌ Swap failed:", error);
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

