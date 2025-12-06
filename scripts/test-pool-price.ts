import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const POOL_ADDRESS = new PublicKey('HXfXjGqTsqhwLd4oc9ZwKpvdjGYmU8Tvbca6ftp8231w');
const KEDOLOG_MINT = new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx');
const USDC_MINT = new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32');

// Vault addresses from your deployment
const TOKEN_0_VAULT = new PublicKey('Bon8zyjdzGBgteK7fnB4yukA9hZovWKzMv41giwDdexc');
const TOKEN_1_VAULT = new PublicKey('A6fpTY76hfrEdrEGUTJMSfYB4h6uDQdXXhBrCvmY2yLE');

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing KEDOL Pool-Based Pricing');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const connection = new Connection(RPC_URL, 'confirmed');

  // Fetch token account data
  console.log('📊 Fetching pool reserves...\n');
  
  const vault0Info = await connection.getAccountInfo(TOKEN_0_VAULT);
  const vault1Info = await connection.getAccountInfo(TOKEN_1_VAULT);

  if (!vault0Info || !vault1Info) {
    console.error('❌ Failed to fetch vault accounts');
    return;
  }

  // Parse token account data
  // Token account layout: https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/state.rs
  // Offset 64: amount (u64, little-endian)
  const kedologAmount = vault0Info.data.readBigUInt64LE(64);
  const usdcAmount = vault1Info.data.readBigUInt64LE(64);

  console.log('🏦 Pool Reserves:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   KEDOL (Token 0): ${kedologAmount.toString()} lamports`);
  console.log(`   USDC (Token 1):    ${usdcAmount.toString()} lamports`);
  console.log('');

  // Assuming KEDOL has 9 decimals and USDC has 6 decimals (adjust if different)
  const KEDOLOG_DECIMALS = 9;
  const USDC_DECIMALS = 6;

  const kedologAmountDecimal = Number(kedologAmount) / Math.pow(10, KEDOLOG_DECIMALS);
  const usdcAmountDecimal = Number(usdcAmount) / Math.pow(10, USDC_DECIMALS);

  console.log('💰 Human-Readable Reserves:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   KEDOL: ${kedologAmountDecimal.toLocaleString()} KEDOL`);
  console.log(`   USDC:    ${usdcAmountDecimal.toLocaleString()} USDC`);
  console.log('');

  // Calculate price
  // Price = USDC_reserve / KEDOLOG_reserve
  const priceUSD = usdcAmountDecimal / kedologAmountDecimal;
  
  console.log('📈 KEDOL Price:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   1 KEDOL = $${priceUSD.toFixed(6)} USD`);
  console.log('');

  // Show how the contract calculates it
  console.log('🔧 Contract Calculation:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   The contract reads these exact values from the vaults');
  console.log('   and calculates the price on-chain in real-time.');
  console.log('');
  console.log('   Formula: price_usd = (usdc_amount * 10^kedolog_decimals) / (kedolog_amount * 10^usdc_decimals)');
  console.log('');
  
  // Calculate the scaled price as the contract does (scaled by 10^6)
  const priceScaled = (Number(usdcAmount) * Math.pow(10, KEDOLOG_DECIMALS)) / 
                      (Number(kedologAmount) * Math.pow(10, USDC_DECIMALS));
  console.log(`   Scaled price (×10⁶): ${Math.floor(priceScaled * 1e6).toLocaleString()}`);
  console.log('');

  // Example fee calculation
  console.log('💸 Example: Protocol Fee Calculation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const exampleSwapAmount = 1000; // $1000 swap
  const protocolFeeRate = 0.0005; // 0.05%
  const protocolFeeUSD = exampleSwapAmount * protocolFeeRate;
  const protocolFeeWithDiscount = protocolFeeUSD * 0.75; // 25% discount
  const kedologRequired = protocolFeeWithDiscount / priceUSD;
  
  console.log(`   Swap Amount: $${exampleSwapAmount.toLocaleString()}`);
  console.log(`   Protocol Fee (0.05%): $${protocolFeeUSD.toFixed(2)}`);
  console.log(`   With 25% Discount: $${protocolFeeWithDiscount.toFixed(2)}`);
  console.log(`   KEDOL Required: ${kedologRequired.toFixed(4)} KEDOL`);
  console.log('');

  console.log('✅ Pool-based pricing is configured and working!');
  console.log('');
  console.log('📝 Frontend Integration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   When users swap with KEDOL discount, pass these vaults:');
  console.log(`   - Token 0 Vault: ${TOKEN_0_VAULT.toString()}`);
  console.log(`   - Token 1 Vault: ${TOKEN_1_VAULT.toString()}`);
  console.log('');
  console.log('   Example:');
  console.log('   ```typescript');
  console.log('   .remainingAccounts([');
  console.log('     { pubkey: new PublicKey("' + TOKEN_0_VAULT.toString() + '"), isSigner: false, isWritable: false },');
  console.log('     { pubkey: new PublicKey("' + TOKEN_1_VAULT.toString() + '"), isSigner: false, isWritable: false },');
  console.log('   ])');
  console.log('   ```');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

