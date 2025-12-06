import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';
import * as readline from 'readline';
import { execSync } from 'child_process';

// Get current network from Solana CLI
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

const { network: NETWORK, rpcUrl: RPC_URL } = getCurrentNetwork();

function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Set Reference Pools for 1-Hop Pricing');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('This script updates all 3 reference pools used for pricing:');
  console.log('  1. KEDOL/USDC pool (required)');
  console.log('  2. SOL/USDC pool (required for SOL pairs)');
  console.log('  3. KEDOL/SOL pool (optional)');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node scripts/set-reference-pools.ts \\');
  console.log('    --kedol-usdc POOL_ADDRESS \\');
  console.log('    --sol-usdc POOL_ADDRESS \\');
  console.log('    --kedol-sol POOL_ADDRESS \\  # Optional');
  console.log('    --program-id PROGRAM_ID       # Optional');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node scripts/set-reference-pools.ts \\');
  console.log('    --kedol-usdc 4BNsmFr9SR3D5cPzUgrMrZFhbYWGhVDe41KaipMkUzDz \\');
  console.log('    --sol-usdc 7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let PROGRAM_ID: PublicKey;
  let kedologUsdcPool: PublicKey | null = null;
  let solUsdcPool: PublicKey | null = null;
  let kedologSolPool: PublicKey | null = null;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--program-id' && args[i + 1]) {
      try {
        PROGRAM_ID = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid program ID');
        process.exit(1);
      }
    } else if (args[i] === '--kedol-usdc' && args[i + 1]) {
      try {
        kedologUsdcPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid KEDOL/USDC pool address');
        process.exit(1);
      }
    } else if (args[i] === '--sol-usdc' && args[i + 1]) {
      try {
        solUsdcPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid SOL/USDC pool address');
        process.exit(1);
      }
    } else if (args[i] === '--kedol-sol' && args[i + 1]) {
      try {
        kedologSolPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid KEDOL/SOL pool address');
        process.exit(1);
      }
    }
  }
  
  // Load program ID from Anchor.toml if not provided
  if (!PROGRAM_ID!) {
    const anchorToml = fs.readFileSync('./Anchor.toml', 'utf-8');
    const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([A-Za-z0-9]+)"/);
    if (!programIdMatch) {
      console.error('❌ Could not find program ID in Anchor.toml');
      process.exit(1);
    }
    PROGRAM_ID = new PublicKey(programIdMatch[1]);
  }
  
  // Interactive mode if pools not provided
  if (!kedologUsdcPool) {
    const input = await question('Enter KEDOL/USDC pool address (required): ');
    try {
      kedologUsdcPool = new PublicKey(input.trim());
    } catch (e) {
      console.error('❌ Invalid address');
      process.exit(1);
    }
  }
  
  if (!solUsdcPool) {
    const input = await question('Enter SOL/USDC pool address (required): ');
    try {
      solUsdcPool = new PublicKey(input.trim());
    } catch (e) {
      console.error('❌ Invalid address');
      process.exit(1);
    }
  }
  
  if (!kedologSolPool) {
    const input = await question('Enter KEDOL/SOL pool address (optional, press Enter to skip): ');
    if (input.trim()) {
      try {
        kedologSolPool = new PublicKey(input.trim());
      } catch (e) {
        console.error('❌ Invalid address');
        process.exit(1);
      }
    }
  }
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at:', walletPath);
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  console.log('\n📡 Network:', NETWORK.toUpperCase());
  console.log('🔗 RPC:', RPC_URL);
  console.log('📋 Program ID:', PROGRAM_ID.toString());
  console.log('👤 Authority:', admin.publicKey.toString());
  
  const balance = await connection.getBalance(admin.publicKey);
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  // Get protocol token config address
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_token_config')],
    PROGRAM_ID
  );
  
  console.log('📋 Protocol Token Config:', protocolTokenConfig.toString());
  
  // Fetch current config
  try {
    const config: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📊 Current Configuration:');
    console.log('   Token Mint:', config.protocolTokenMint.toString());
    console.log('   Discount Rate:', config.discountRate.toString(), `(${config.discountRate.toNumber() / 100}%)`);
    console.log('   Treasury:', config.treasury.toString());
    console.log('   Current KEDOL/USDC Pool:', config.kedologUsdcPool.toString());
    console.log('   Current SOL/USDC Pool:', config.solUsdcPool.toString());
    console.log('   Current KEDOL/SOL Pool:', config.kedologSolPool.toString());
    console.log('   Authority:', config.authority.toString());
  } catch (e) {
    console.error('\n❌ Protocol token config not found!');
    console.error('   Run the deployment script first to create the config.');
    process.exit(1);
  }
  
  // Verify pools exist
  console.log('\n🔍 Verifying pools...\n');
  
  try {
    const kedologPoolData: any = await (program.account as any).poolState.fetch(kedologUsdcPool);
    console.log('✅ KEDOL/USDC Pool verified');
    console.log('   Token 0:', kedologPoolData.token0Mint.toString());
    console.log('   Token 1:', kedologPoolData.token1Mint.toString());
  } catch (e) {
    console.error('❌ KEDOL/USDC pool not found');
    process.exit(1);
  }
  
  try {
    const solPoolData: any = await (program.account as any).poolState.fetch(solUsdcPool);
    console.log('\n✅ SOL/USDC Pool verified');
    console.log('   Token 0:', solPoolData.token0Mint.toString());
    console.log('   Token 1:', solPoolData.token1Mint.toString());
  } catch (e) {
    console.error('❌ SOL/USDC pool not found');
    process.exit(1);
  }
  
  if (kedologSolPool) {
    try {
      const kedologSolPoolData: any = await (program.account as any).poolState.fetch(kedologSolPool);
      console.log('\n✅ KEDOL/SOL Pool verified');
      console.log('   Token 0:', kedologSolPoolData.token0Mint.toString());
      console.log('   Token 1:', kedologSolPoolData.token1Mint.toString());
    } catch (e) {
      console.error('⚠️  KEDOL/SOL pool not found, will use PublicKey.default');
      kedologSolPool = null;
    }
  }
  
  // Confirm
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Update Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Network:', NETWORK.toUpperCase());
  console.log('Protocol Token Config:', protocolTokenConfig.toString());
  console.log('');
  console.log('New Reference Pools:');
  console.log('  1. KEDOL/USDC:', kedologUsdcPool.toString());
  console.log('  2. SOL/USDC:', solUsdcPool.toString());
  console.log('  3. KEDOL/SOL:', kedologSolPool ? kedologSolPool.toString() : 'Not set (optional)');
  
  const networkUpper = NETWORK.toUpperCase();
  const confirm = await question(`\n⚠️  Update reference pools on ${networkUpper}? Type "UPDATE" to confirm: `);
  if (confirm !== 'UPDATE') {
    console.log('❌ Aborted');
    process.exit(1);
  }
  
  // Update the config
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Updating Protocol Token Config...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const tx = await (program.methods as any)
      .updateProtocolTokenConfig(
        null, // discount_rate (no change)
        null, // treasury (no change)
        kedologUsdcPool, // kedolog_usdc_pool
        solUsdcPool, // sol_usdc_pool
        kedologSolPool || null, // kedolog_sol_pool (optional)
        null  // new_authority (no change)
      )
      .accountsPartial({
        authority: admin.publicKey,
      })
      .rpc();
    
    console.log('✅ Reference pools updated!');
    console.log('   Transaction:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const updatedConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📋 Verified Configuration:');
    console.log('   Token Mint:', updatedConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', updatedConfig.discountRate.toString(), `(${updatedConfig.discountRate.toNumber() / 100}%)`);
    console.log('   Treasury:', updatedConfig.treasury.toString());
    console.log('   KEDOL/USDC Pool:', updatedConfig.kedologUsdcPool.toString());
    console.log('   SOL/USDC Pool:', updatedConfig.solUsdcPool.toString());
    console.log('   KEDOL/SOL Pool:', updatedConfig.kedologSolPool.toString());
    console.log('   Authority:', updatedConfig.authority.toString());
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REFERENCE POOLS CONFIGURED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🎉 The contract now supports:');
    console.log('   ✅ Direct USDC pairs (Token/USDC)');
    console.log('   ✅ Direct SOL pairs (Token/SOL)');
    console.log('   ✅ 1-hop pricing via USDC');
    console.log('   ✅ 2-hop pricing via SOL');
    console.log('   ✅ Automatic token ordering detection');
    
    console.log('\n💡 Frontend can now fetch these pools and their vaults for pricing!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ Failed to update reference pools:', error.message);
    if (error.logs) {
      console.error('\nLogs:', error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);

