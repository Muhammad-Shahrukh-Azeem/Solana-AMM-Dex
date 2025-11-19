import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';
import * as readline from 'readline';
import { execSync } from 'child_process';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 CONFIGURATION - UPDATE THESE TOKEN MINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOKEN_MINTS = {
  // Mainnet KEDOLOG token
  KEDOLOG: new PublicKey('FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN'),
  
  // USDC addresses for different networks
  USDC: {
    devnet: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'),
    testnet: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'), // Same as devnet
    mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // Mainnet USDC
  },
  
  // Wrapped SOL (same on all networks)
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get current network from Solana CLI or command line
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

// Find pool by token pair
async function findPoolByTokenPair(
  program: Program,
  token0Mint: PublicKey,
  token1Mint: PublicKey
): Promise<{ pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null> {
  try {
    console.log(`   🔍 Searching for pool with tokens:`);
    console.log(`      Token 0: ${token0Mint.toString()}`);
    console.log(`      Token 1: ${token1Mint.toString()}`);
    
    // Fetch all pools
    const pools = await (program.account as any).poolState.all();
    
    // Find matching pool (check both orders)
    for (const pool of pools) {
      const poolData: any = pool.account;
      
      const matches = 
        (poolData.token0Mint.equals(token0Mint) && poolData.token1Mint.equals(token1Mint)) ||
        (poolData.token0Mint.equals(token1Mint) && poolData.token1Mint.equals(token0Mint));
      
      if (matches) {
        console.log(`   ✅ Found pool: ${pool.publicKey.toString()}`);
        console.log(`      Vault 0: ${poolData.token0Vault.toString()}`);
        console.log(`      Vault 1: ${poolData.token1Vault.toString()}`);
        
        return {
          pool: pool.publicKey,
          vault0: poolData.token0Vault,
          vault1: poolData.token1Vault,
        };
      }
    }
    
    console.log(`   ⚠️  Pool not found`);
    return null;
  } catch (error) {
    console.log(`   ❌ Error searching for pool:`, error);
    return null;
  }
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Auto-Setup Reference Pools');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('This script will:');
  console.log('  1. Auto-detect your network (devnet/testnet/mainnet)');
  console.log('  2. Search for pools with the configured token mints');
  console.log('  3. Extract pool and vault addresses automatically');
  console.log('  4. Update the protocol config with all 3 reference pools');
  console.log('');
  console.log('Usage:');
  console.log('  # Auto-detect network from Solana CLI:');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts');
  console.log('');
  console.log('  # Or specify network:');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network devnet');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network mainnet');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let networkOverride: string | null = null;
  let PROGRAM_ID: PublicKey | null = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--network' && args[i + 1]) {
      networkOverride = args[i + 1];
      i++;
    } else if (args[i] === '--program-id' && args[i + 1]) {
      try {
        PROGRAM_ID = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid program ID');
        process.exit(1);
      }
    }
  }
  
  // Get network
  let network: string;
  let rpcUrl: string;
  
  if (networkOverride) {
    network = networkOverride;
    if (network === 'devnet') {
      rpcUrl = 'https://api.devnet.solana.com';
    } else if (network === 'testnet') {
      rpcUrl = 'https://api.testnet.solana.com';
    } else if (network === 'mainnet') {
      rpcUrl = 'https://api.mainnet-beta.solana.com';
    } else {
      console.error('❌ Invalid network. Use: devnet, testnet, or mainnet');
      process.exit(1);
    }
  } else {
    const detected = getCurrentNetwork();
    network = detected.network;
    rpcUrl = detected.rpcUrl;
  }
  
  // Get USDC mint for this network
  const usdcMint = TOKEN_MINTS.USDC.mainnet;
  
  console.log('📡 Network:', network.toUpperCase());
  console.log('🔗 RPC:', rpcUrl);
  console.log('');
  console.log('📋 Token Mints:');
  console.log('   KEDOLOG:', TOKEN_MINTS.KEDOLOG.toString());
  console.log('   USDC:', usdcMint.toString());
  console.log('   SOL:', TOKEN_MINTS.SOL.toString());
  console.log('');
  
  // Load program ID from Anchor.toml if not provided
  if (!PROGRAM_ID) {
    const anchorToml = fs.readFileSync('./Anchor.toml', 'utf-8');
    const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([A-Za-z0-9]+)"/);
    if (!programIdMatch) {
      console.error('❌ Could not find program ID in Anchor.toml');
      console.error('💡 Use --program-id flag to specify manually');
      process.exit(1);
    }
    PROGRAM_ID = new PublicKey(programIdMatch[1]);
  }
  
  console.log('📋 Program ID:', PROGRAM_ID.toString());
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at:', walletPath);
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
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
  let currentConfig: any;
  try {
    currentConfig = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📊 Current Configuration:');
    console.log('   Token Mint:', currentConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', currentConfig.discountRate.toString(), `(${currentConfig.discountRate.toNumber() / 100}%)`);
    console.log('   Treasury:', currentConfig.treasury.toString());
    console.log('   Current KEDOLOG/USDC Pool:', currentConfig.kedologUsdcPool.toString());
    console.log('   Current SOL/USDC Pool:', currentConfig.solUsdcPool.toString());
    console.log('   Current KEDOLOG/SOL Pool:', currentConfig.kedologSolPool.toString());
    console.log('   Authority:', currentConfig.authority.toString());
  } catch (e) {
    console.error('\n❌ Protocol token config not found!');
    console.error('   Run the deployment script first to create the config.');
    process.exit(1);
  }
  
  // Search for pools
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Searching for Pools...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Find KEDOLOG/USDC pool
  console.log('1️⃣  KEDOLOG/USDC Pool:');
  const kedologUsdcPool = await findPoolByTokenPair(program, TOKEN_MINTS.KEDOLOG, usdcMint);
  
  // 2. Find SOL/USDC pool
  console.log('\n2️⃣  SOL/USDC Pool:');
  const solUsdcPool = await findPoolByTokenPair(program, TOKEN_MINTS.SOL, usdcMint);
  
  // 3. Find KEDOLOG/SOL pool
  console.log('\n3️⃣  KEDOLOG/SOL Pool:');
  const kedologSolPool = await findPoolByTokenPair(program, TOKEN_MINTS.KEDOLOG, TOKEN_MINTS.SOL);
  
  // Check if we found the required pools
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Pool Discovery Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!kedologUsdcPool) {
    console.error('❌ KEDOLOG/USDC pool not found!');
    console.error('   You must create this pool first.');
    console.error('   Create a pool with:');
    console.error(`   - Token 0: KEDOLOG (${TOKEN_MINTS.KEDOLOG.toString()})`);
    console.error(`   - Token 1: USDC (${usdcMint.toString()})`);
    process.exit(1);
  }
  
  if (!solUsdcPool) {
    console.error('❌ SOL/USDC pool not found!');
    console.error('   You must create this pool first.');
    console.error('   Create a pool with:');
    console.error(`   - Token 0: SOL (${TOKEN_MINTS.SOL.toString()})`);
    console.error(`   - Token 1: USDC (${usdcMint.toString()})`);
    process.exit(1);
  }
  
  console.log('✅ KEDOLOG/USDC Pool:', kedologUsdcPool.pool.toString());
  console.log('✅ SOL/USDC Pool:', solUsdcPool.pool.toString());
  
  if (kedologSolPool) {
    console.log('✅ KEDOLOG/SOL Pool:', kedologSolPool.pool.toString());
  } else {
    console.log('⚠️  KEDOLOG/SOL Pool: Not found (optional)');
  }
  
  // Confirm update
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Update Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Network:', network.toUpperCase());
  console.log('Protocol Token Config:', protocolTokenConfig.toString());
  console.log('');
  console.log('New Reference Pools:');
  console.log('  1. KEDOLOG/USDC:', kedologUsdcPool.pool.toString());
  console.log('  2. SOL/USDC:', solUsdcPool.pool.toString());
  console.log('  3. KEDOLOG/SOL:', kedologSolPool ? kedologSolPool.pool.toString() : 'Not set (optional)');
  
  const networkUpper = network.toUpperCase();
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
        kedologUsdcPool.pool, // kedolog_usdc_pool
        solUsdcPool.pool, // sol_usdc_pool
        kedologSolPool ? kedologSolPool.pool : null, // kedolog_sol_pool (optional)
        null  // new_authority (no change)
      )
      .accountsPartial({
        authority: admin.publicKey,
      })
      .rpc();
    
    console.log('✅ Reference pools updated!');
    console.log('   Transaction:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=${network}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const updatedConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📋 Verified Configuration:');
    console.log('   Token Mint:', updatedConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', updatedConfig.discountRate.toString(), `(${updatedConfig.discountRate.toNumber() / 100}%)`);
    console.log('   Treasury:', updatedConfig.treasury.toString());
    console.log('   KEDOLOG/USDC Pool:', updatedConfig.kedologUsdcPool.toString());
    console.log('   SOL/USDC Pool:', updatedConfig.solUsdcPool.toString());
    console.log('   KEDOLOG/SOL Pool:', updatedConfig.kedologSolPool.toString());
    console.log('   Authority:', updatedConfig.authority.toString());
    
    // Save deployment info
    const deploymentInfo = {
      network: network,
      programId: PROGRAM_ID.toString(),
      protocolTokenConfig: protocolTokenConfig.toString(),
      referencePools: {
        kedologUsdc: {
          pool: kedologUsdcPool.pool.toString(),
          vault0: kedologUsdcPool.vault0.toString(),
          vault1: kedologUsdcPool.vault1.toString(),
        },
        solUsdc: {
          pool: solUsdcPool.pool.toString(),
          vault0: solUsdcPool.vault0.toString(),
          vault1: solUsdcPool.vault1.toString(),
        },
        kedologSol: kedologSolPool ? {
          pool: kedologSolPool.pool.toString(),
          vault0: kedologSolPool.vault0.toString(),
          vault1: kedologSolPool.vault1.toString(),
        } : null,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: admin.publicKey.toString(),
    };
    
    const infoFile = `reference-pools-${network}-${Date.now()}.json`;
    fs.writeFileSync(infoFile, JSON.stringify(deploymentInfo, null, 2));
    console.log('\n💾 Pool info saved to:', infoFile);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REFERENCE POOLS CONFIGURED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🎉 The contract now supports:');
    console.log('   ✅ Direct USDC pairs (Token/USDC)');
    console.log('   ✅ Direct SOL pairs (Token/SOL)');
    console.log('   ✅ 1-hop pricing via USDC');
    console.log('   ✅ 2-hop pricing via SOL');
    console.log('   ✅ Automatic token ordering detection');
    
    console.log('\n💡 Frontend Integration:');
    console.log('   Use the pool and vault addresses from:', infoFile);
    console.log('   Pass them in remainingAccounts for swaps!');
    
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


