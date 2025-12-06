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
  // KEDOL token addresses for different networks
  KEDOL: {
    devnet: new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx'), // Devnet KEDOL
    testnet: new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx'), // Testnet KEDOL (same as devnet)
    mainnet: new PublicKey('FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN'), // Mainnet KEDOL
  },
  
  // USDC addresses for different networks
  USDC: {
    devnet: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'), // Devnet USDC
    testnet: new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'), // Testnet USDC (same as devnet)
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

// Find pool by token pair - tries both derivation and account search
async function findPoolByTokenPair(
  program: Program,
  token0Mint: PublicKey,
  token1Mint: PublicKey
): Promise<{ pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null> {
  try {
    console.log(`   🔍 Searching for pool with tokens:`);
    console.log(`      Token 0: ${token0Mint.toString()}`);
    console.log(`      Token 1: ${token1Mint.toString()}`);
    
    // First, try to derive the pool address directly (more reliable)
    // Pools are derived using: [pool_seed, amm_config, token_mint_0, token_mint_1]
    // Tokens must be in lexicographic order
    const tokens = [token0Mint, token1Mint].sort((a, b) => {
      const aBytes = a.toBytes();
      const bBytes = b.toBytes();
      for (let i = 0; i < 32; i++) {
        if (aBytes[i] < bBytes[i]) return -1;
        if (aBytes[i] > bBytes[i]) return 1;
      }
      return 0;
    });
    
    // Get AMM config (index 0)
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(0, 0);
    const [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config"), indexBuffer],
      program.programId
    );
    
    // Try both token orders for pool derivation
    const poolAddresses = [
      PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), ammConfig.toBuffer(), tokens[0].toBuffer(), tokens[1].toBuffer()],
        program.programId
      )[0],
      PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), ammConfig.toBuffer(), tokens[1].toBuffer(), tokens[0].toBuffer()],
        program.programId
      )[0],
    ];
    
    // Try to fetch pool by derived address
    for (const poolAddress of poolAddresses) {
      try {
        const poolData: any = await (program.account as any).poolState.fetch(poolAddress);
        
        // Verify it matches our tokens
        const poolToken0 = poolData.token0Mint || poolData.token_0_mint;
        const poolToken1 = poolData.token1Mint || poolData.token_1_mint;
        
        if (poolToken0 && poolToken1) {
          const matches = 
            (poolToken0.equals(token0Mint) && poolToken1.equals(token1Mint)) ||
            (poolToken0.equals(token1Mint) && poolToken1.equals(token0Mint));
          
          if (matches) {
            const vault0 = poolData.token0Vault || poolData.token_0_vault;
            const vault1 = poolData.token1Vault || poolData.token_1_vault;
            
            console.log(`   ✅ Found pool by derivation: ${poolAddress.toString()}`);
            console.log(`      Vault 0: ${vault0.toString()}`);
            console.log(`      Vault 1: ${vault1.toString()}`);
            
            return {
              pool: poolAddress,
              vault0: vault0,
              vault1: vault1,
            };
          }
        }
      } catch (e) {
        // Pool doesn't exist at this address, try next
        continue;
      }
    }
    
    // Fallback: Search all pools
    console.log(`   🔄 Pool not found by derivation, searching all pools...`);
    const pools = await (program.account as any).poolState.all();
    console.log(`   📊 Found ${pools.length} total pools in program`);
    
    // Find matching pool (check both orders)
    // Try both camelCase and snake_case field names
    for (const pool of pools) {
      const poolData: any = pool.account;
      
      // Try camelCase first (Anchor IDL default)
      const token0 = poolData.token0Mint || poolData.token_0_mint;
      const token1 = poolData.token1Mint || poolData.token_1_mint;
      
      if (!token0 || !token1) {
        continue;
      }
      
      const matches = 
        (token0.equals(token0Mint) && token1.equals(token1Mint)) ||
        (token0.equals(token1Mint) && token1.equals(token0Mint));
      
      if (matches) {
        const vault0 = poolData.token0Vault || poolData.token_0_vault;
        const vault1 = poolData.token1Vault || poolData.token_1_vault;
        
        console.log(`   ✅ Found pool: ${pool.publicKey.toString()}`);
        console.log(`      Vault 0: ${vault0.toString()}`);
        console.log(`      Vault 1: ${vault1.toString()}`);
        
        return {
          pool: pool.publicKey,
          vault0: vault0,
          vault1: vault1,
        };
      }
    }
    
    // If no match found, list all pools for debugging
    if (pools.length > 0) {
      console.log(`   📋 Available pools:`);
      for (const pool of pools.slice(0, 5)) { // Show first 5 pools
        const poolData: any = pool.account;
        const token0 = poolData.token0Mint || poolData.token_0_mint;
        const token1 = poolData.token1Mint || poolData.token_1_mint;
        if (token0 && token1) {
          console.log(`      - ${pool.publicKey.toString()}: ${token0.toString()} / ${token1.toString()}`);
        }
      }
      if (pools.length > 5) {
        console.log(`      ... and ${pools.length - 5} more pools`);
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
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network testnet');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network mainnet');
  console.log('');
  console.log('  # Or specify program ID manually:');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network mainnet --program-id <PROGRAM_ID>');
  console.log('');
  console.log('  # Or use a custom RPC URL (for paid RPCs):');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network mainnet --rpc-url <YOUR_RPC_URL>');
  console.log('');
  console.log('  # Or manually specify pool addresses:');
  console.log('  npx ts-node scripts/setup-reference-pools-auto.ts --network mainnet \\');
  console.log('    --kedol-usdc-pool <POOL_ADDRESS> \\');
  console.log('    --sol-usdc-pool <POOL_ADDRESS> \\');
  console.log('    --kedol-sol-pool <POOL_ADDRESS>');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let networkOverride: string | null = null;
  let PROGRAM_ID: PublicKey | null = null;
  let customRpcUrl: string | null = null;
  let manualKedologUsdcPool: PublicKey | null = null;
  let manualSolUsdcPool: PublicKey | null = null;
  let manualKedologSolPool: PublicKey | null = null;
  
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
    } else if (args[i] === '--rpc-url' && args[i + 1]) {
      customRpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--kedol-usdc-pool' && args[i + 1]) {
      try {
        manualKedologUsdcPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid KEDOL/USDC pool address');
        process.exit(1);
      }
    } else if (args[i] === '--sol-usdc-pool' && args[i + 1]) {
      try {
        manualSolUsdcPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid SOL/USDC pool address');
        process.exit(1);
      }
    } else if (args[i] === '--kedol-sol-pool' && args[i + 1]) {
      try {
        manualKedologSolPool = new PublicKey(args[i + 1]);
        i++;
      } catch (e) {
        console.error('❌ Invalid KEDOL/SOL pool address');
        process.exit(1);
      }
    }
  }
  
  // Get network
  let network: string;
  let rpcUrl: string;
  
  if (customRpcUrl) {
    // Use custom RPC URL if provided
    rpcUrl = customRpcUrl;
    // Try to detect network from RPC URL, or use networkOverride
  if (networkOverride) {
      network = networkOverride;
    } else {
      if (rpcUrl.includes('devnet')) network = 'devnet';
      else if (rpcUrl.includes('testnet')) network = 'testnet';
      else if (rpcUrl.includes('mainnet')) network = 'mainnet';
      else {
        // Default to mainnet if can't detect
        network = 'mainnet';
      }
    }
  } else if (networkOverride) {
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
  
  // Get token mints for this network
  const kedologMint = TOKEN_MINTS.KEDOL[network as keyof typeof TOKEN_MINTS.KEDOL] || TOKEN_MINTS.KEDOL.mainnet;
  const usdcMint = TOKEN_MINTS.USDC[network as keyof typeof TOKEN_MINTS.USDC] || TOKEN_MINTS.USDC.mainnet;
  
  console.log('📡 Network:', network.toUpperCase());
  console.log('🔗 RPC:', rpcUrl);
  console.log('');
  console.log('📋 Token Mints:');
  console.log('   KEDOL:', kedologMint.toString());
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
  
  // Load wallet from Solana CLI config
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
  
  // Load IDL and ensure it has the correct program ID
  let idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  
  // Verify IDL has correct program ID
  if (idl.address !== PROGRAM_ID.toString()) {
    console.log('⚠️  IDL address mismatch, updating...');
    idl.address = PROGRAM_ID.toString();
    idl.metadata = { address: PROGRAM_ID.toString() };
    console.log('✅ IDL updated with correct program ID\n');
  }
  
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
    console.log('   Current KEDOL/USDC Pool:', currentConfig.kedologUsdcPool.toString());
    console.log('   Current SOL/USDC Pool:', currentConfig.solUsdcPool.toString());
    console.log('   Current KEDOL/SOL Pool:', currentConfig.kedologSolPool.toString());
    console.log('   Authority:', currentConfig.authority.toString());
  } catch (e) {
    console.error('\n❌ Protocol token config not found!');
    console.error('   Run the deployment script first to create the config.');
    process.exit(1);
  }
  
  // Helper function to fetch pool by address
  async function fetchPoolByAddress(poolAddress: PublicKey): Promise<{ pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null> {
    try {
      const poolData: any = await (program.account as any).poolState.fetch(poolAddress);
      const vault0 = poolData.token0Vault || poolData.token_0_vault;
      const vault1 = poolData.token1Vault || poolData.token_1_vault;
      
      return {
        pool: poolAddress,
        vault0: vault0,
        vault1: vault1,
      };
    } catch (e) {
      console.log(`   ❌ Error fetching pool: ${e.message}`);
      return null;
    }
  }
  
  // Search for pools
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Searching for Pools...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  let kedologUsdcPool: { pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null = null;
  let solUsdcPool: { pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null = null;
  let kedologSolPool: { pool: PublicKey; vault0: PublicKey; vault1: PublicKey } | null = null;
  
  // 1. Find KEDOL/USDC pool
  if (manualKedologUsdcPool) {
    console.log('1️⃣  KEDOL/USDC Pool (manual):');
    console.log(`   Using provided address: ${manualKedologUsdcPool.toString()}`);
    kedologUsdcPool = await fetchPoolByAddress(manualKedologUsdcPool);
    if (kedologUsdcPool) {
      console.log(`   ✅ Found pool: ${kedologUsdcPool.pool.toString()}`);
      console.log(`      Vault 0: ${kedologUsdcPool.vault0.toString()}`);
      console.log(`      Vault 1: ${kedologUsdcPool.vault1.toString()}`);
    }
  } else {
  console.log('1️⃣  KEDOL/USDC Pool:');
    kedologUsdcPool = await findPoolByTokenPair(program, kedologMint, usdcMint);
  }
  
  // 2. Find SOL/USDC pool
  if (manualSolUsdcPool) {
    console.log('\n2️⃣  SOL/USDC Pool (manual):');
    console.log(`   Using provided address: ${manualSolUsdcPool.toString()}`);
    solUsdcPool = await fetchPoolByAddress(manualSolUsdcPool);
    if (solUsdcPool) {
      console.log(`   ✅ Found pool: ${solUsdcPool.pool.toString()}`);
      console.log(`      Vault 0: ${solUsdcPool.vault0.toString()}`);
      console.log(`      Vault 1: ${solUsdcPool.vault1.toString()}`);
    }
  } else {
  console.log('\n2️⃣  SOL/USDC Pool:');
    solUsdcPool = await findPoolByTokenPair(program, TOKEN_MINTS.SOL, usdcMint);
  }
  
  // 3. Find KEDOL/SOL pool
  if (manualKedologSolPool) {
    console.log('\n3️⃣  KEDOL/SOL Pool (manual):');
    console.log(`   Using provided address: ${manualKedologSolPool.toString()}`);
    kedologSolPool = await fetchPoolByAddress(manualKedologSolPool);
    if (kedologSolPool) {
      console.log(`   ✅ Found pool: ${kedologSolPool.pool.toString()}`);
      console.log(`      Vault 0: ${kedologSolPool.vault0.toString()}`);
      console.log(`      Vault 1: ${kedologSolPool.vault1.toString()}`);
    }
  } else {
  console.log('\n3️⃣  KEDOL/SOL Pool:');
    kedologSolPool = await findPoolByTokenPair(program, kedologMint, TOKEN_MINTS.SOL);
  }
  
  // Check if we found the required pools
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Pool Discovery Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!kedologUsdcPool) {
    console.error('❌ KEDOL/USDC pool not found!');
    console.error('   You must create this pool first.');
    console.error('   Create a pool with:');
    console.error(`   - Token 0: KEDOL (${kedologMint.toString()})`);
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
  
  console.log('✅ KEDOL/USDC Pool:', kedologUsdcPool.pool.toString());
  console.log('✅ SOL/USDC Pool:', solUsdcPool.pool.toString());
  
  if (kedologSolPool) {
    console.log('✅ KEDOL/SOL Pool:', kedologSolPool.pool.toString());
  } else {
    console.log('⚠️  KEDOL/SOL Pool: Not found (optional)');
  }
  
  // Confirm update
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Update Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Network:', network.toUpperCase());
  console.log('Protocol Token Config:', protocolTokenConfig.toString());
  console.log('');
  console.log('New Reference Pools:');
  console.log('  1. KEDOL/USDC:', kedologUsdcPool.pool.toString());
  console.log('  2. SOL/USDC:', solUsdcPool.pool.toString());
  console.log('  3. KEDOL/SOL:', kedologSolPool ? kedologSolPool.pool.toString() : 'Not set (optional)');
  
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
    // Ensure we're using the correct program ID
    console.log('🔧 Preparing transaction...');
    console.log('   Program ID:', PROGRAM_ID.toString());
    console.log('   Authority:', admin.publicKey.toString());
    console.log('   Protocol Token Config:', protocolTokenConfig.toString());
    
    const tx = await (program.methods as any)
      .updateProtocolTokenConfig(
        null, // discount_rate (no change)
        null, // treasury (no change)
        kedologUsdcPool.pool, // kedolog_usdc_pool
        solUsdcPool.pool, // sol_usdc_pool
        kedologSolPool ? kedologSolPool.pool : null, // kedolog_sol_pool (optional)
        null  // new_authority (no change)
      )
      .accounts({
        authority: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
      })
      .rpc({
        skipPreflight: false,
        commitment: 'confirmed',
        skipConfirmation: false,
      });
    
    console.log('✅ Transaction sent:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=${network}`);
    
    // Wait for confirmation using polling (some RPCs don't support WebSocket subscriptions)
    console.log('⏳ Waiting for confirmation...');
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const status = await connection.getSignatureStatus(tx);
        if (status.value && status.value.confirmationStatus) {
          if (status.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
          }
          confirmed = true;
          console.log(`✅ Transaction confirmed (${status.value.confirmationStatus})`);
          break;
        }
      } catch (e) {
        // Continue polling
      }
    }
    
    if (!confirmed) {
      console.log('⚠️  Could not confirm transaction, but it may have succeeded.');
      console.log('   Please check the transaction on the explorer.');
    }
    
    console.log('\n✅ Reference pools updated!');
    
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
    if (error.simulationResponse) {
      console.error('\nSimulation Response:', JSON.stringify(error.simulationResponse, null, 2));
    }
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);


