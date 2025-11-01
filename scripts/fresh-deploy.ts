import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TRADE_FEE_RATE = 2500;        // 0.25%
const PROTOCOL_FEE_RATE = 500;      // 0.05% (20% of trade fee)
const FUND_FEE_RATE = 0;            // 0%
const CREATE_POOL_FEE = 1000000000; // 1 SOL
const CREATOR_FEE_RATE = 0;         // 0%
const KEDOLOG_DISCOUNT_RATE = 2500; // 25%

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  console.log('🚀 FRESH DEPLOYMENT - All New Addresses');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at:', walletPath);
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  // Load program ID from Anchor.toml
  const anchorToml = fs.readFileSync('./Anchor.toml', 'utf-8');
  const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([A-Za-z0-9]+)"/);
  if (!programIdMatch) {
    console.error('❌ Could not find program ID in Anchor.toml');
    process.exit(1);
  }
  const PROGRAM_ID = new PublicKey(programIdMatch[1]);
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  // Check network
  const version = await connection.getVersion();
  console.log('📡 Network:', version['solana-core']);
  console.log('🔗 RPC:', RPC_URL);
  console.log('📋 Program ID:', PROGRAM_ID.toString());
  console.log('👤 Admin:', admin.publicKey.toString());
  
  // Check balance
  const balance = await connection.getBalance(admin.publicKey);
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');
  
  if (balance < 0.5 * 1e9) {
    console.error('❌ Insufficient balance! Need at least 0.5 SOL');
    process.exit(1);
  }
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 1: Ask for config index
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 1: Choose AMM Config Index');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('This creates a NEW AMM config with fresh addresses.');
  console.log('Existing configs:');
  
  // Check existing configs
  for (let i = 0; i < 5; i++) {
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(i, 0);
    const [configAddr] = PublicKey.findProgramAddressSync(
      [Buffer.from('amm_config'), indexBuffer],
      PROGRAM_ID
    );
    
    try {
      const config: any = await (program.account as any).ammConfig.fetch(configAddr);
      console.log(`   [${i}] ✅ EXISTS - ${configAddr.toString()}`);
    } catch (e) {
      console.log(`   [${i}] ⚪ Available - ${configAddr.toString()}`);
    }
  }
  
  const configIndexStr = await question('\nEnter config index to create (0-65535, recommend next available): ');
  const CONFIG_INDEX = parseInt(configIndexStr);
  
  if (isNaN(CONFIG_INDEX) || CONFIG_INDEX < 0 || CONFIG_INDEX > 65535) {
    console.error('❌ Invalid index');
    process.exit(1);
  }
  
  // Derive config address
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(CONFIG_INDEX, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('amm_config'), indexBuffer],
    PROGRAM_ID
  );
  
  console.log('\n📝 New AMM Config Address:', ammConfig.toString());
  
  // Check if already exists
  try {
    await (program.account as any).ammConfig.fetch(ammConfig);
    console.error('\n❌ Config index', CONFIG_INDEX, 'already exists! Choose a different index.');
    process.exit(1);
  } catch (e) {
    console.log('✅ Index available\n');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 2: Ask for KEDOLOG mint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🪙 STEP 2: KEDOLOG Token Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const kedologMintStr = await question('Enter KEDOLOG token mint address: ');
  let KEDOLOG_MINT: PublicKey;
  
  try {
    KEDOLOG_MINT = new PublicKey(kedologMintStr.trim());
  } catch (e) {
    console.error('❌ Invalid mint address');
    process.exit(1);
  }
  
  // Verify token exists
  try {
    const mintInfo = await connection.getAccountInfo(KEDOLOG_MINT);
    if (!mintInfo) {
      console.error('❌ Token mint does not exist on', NETWORK);
      process.exit(1);
    }
    console.log('✅ Token verified on', NETWORK);
  } catch (e) {
    console.error('❌ Failed to verify token');
    process.exit(1);
  }
  
  const treasuryStr = await question('\nEnter treasury address (or press Enter to use your wallet): ');
  const TREASURY = treasuryStr.trim() ? new PublicKey(treasuryStr.trim()) : admin.publicKey;
  
  console.log('\n📋 KEDOLOG Configuration:');
  console.log('   Mint:', KEDOLOG_MINT.toString());
  console.log('   Treasury:', TREASURY.toString());
  console.log('   Discount Rate:', KEDOLOG_DISCOUNT_RATE / 100, '%');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 3: Confirm deployment
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Network:', NETWORK.toUpperCase());
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('\nAMM Config (NEW):');
  console.log('   Index:', CONFIG_INDEX);
  console.log('   Address:', ammConfig.toString());
  console.log('   Trade Fee:', TRADE_FEE_RATE / 10000, '%');
  console.log('   Protocol Fee:', PROTOCOL_FEE_RATE / 10000, '%');
  console.log('   LP Fee:', (TRADE_FEE_RATE - PROTOCOL_FEE_RATE) / 10000, '%');
  console.log('   Create Pool Fee:', CREATE_POOL_FEE / 1e9, 'SOL');
  console.log('   Pool Fee Receiver:', admin.publicKey.toString());
  
  console.log('\nKEDOLOG Config (NEW):');
  console.log('   Token:', KEDOLOG_MINT.toString());
  console.log('   Discount:', KEDOLOG_DISCOUNT_RATE / 100, '%');
  console.log('   Treasury:', TREASURY.toString());
  
  const networkUpper = NETWORK.toUpperCase();
  const confirm = await question(`\n⚠️  Deploy to ${networkUpper}? Type "DEPLOY" to confirm: `);
  if (confirm !== 'DEPLOY') {
    console.log('❌ Aborted');
    process.exit(1);
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 4: Create AMM Config
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Creating AMM Config...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const configTx = await (program.methods as any)
      .createAmmConfig(
        CONFIG_INDEX,
        new BN(TRADE_FEE_RATE),
        new BN(PROTOCOL_FEE_RATE),
        new BN(FUND_FEE_RATE),
        new BN(CREATE_POOL_FEE),
        new BN(CREATOR_FEE_RATE),
        admin.publicKey // create_pool_fee_receiver
      )
      .accountsPartial({
        owner: admin.publicKey,
      })
      .rpc();
    
    console.log('✅ AMM Config created!');
    console.log('   Transaction:', configTx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${configTx}?cluster=${NETWORK}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const config: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log('\n📋 Verified Config:');
    console.log('   Address:', ammConfig.toString());
    console.log('   Protocol Owner:', config.protocolOwner.toString());
    console.log('   Fund Owner:', config.fundOwner.toString());
    console.log('   Fee Receiver:', config.createPoolFeeReceiver.toString());
    console.log('   Create Pool Fee:', config.createPoolFee.toString(), 'lamports');
    
  } catch (error: any) {
    console.error('\n❌ Failed to create AMM config:', error.message);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 5: Create KEDOLOG Config
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Creating KEDOLOG Config...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_token_config')],
    PROGRAM_ID
  );
  
  console.log('Protocol Token Config Address:', protocolTokenConfig.toString());
  
  // Check if already exists
  try {
    const existing: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n⚠️  Protocol token config already exists!');
    console.log('   Mint:', existing.protocolTokenMint.toString());
    console.log('   Discount:', existing.discountRate.toString());
    console.log('   Treasury:', existing.treasury.toString());
    console.log('\n❌ Cannot create - already exists. You can update it instead.');
    
  } catch (e) {
    // Doesn't exist, create it
    try {
      const kedologTx = await (program.methods as any)
        .createProtocolTokenConfig(
          KEDOLOG_MINT,
          new BN(KEDOLOG_DISCOUNT_RATE),
          admin.publicKey, // authority
          TREASURY,
          new BN(1000000) // protocol_token_per_usd (1 token per USD, adjust as needed)
        )
        .accountsPartial({
          payer: admin.publicKey,
        })
        .rpc();
      
      console.log('✅ KEDOLOG Config created!');
      console.log('   Transaction:', kedologTx);
      console.log('   Explorer:', `https://explorer.solana.com/tx/${kedologTx}?cluster=${NETWORK}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify
      const kedologConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
      console.log('\n📋 Verified KEDOLOG Config:');
      console.log('   Address:', protocolTokenConfig.toString());
      console.log('   Token Mint:', kedologConfig.protocolTokenMint.toString());
      console.log('   Discount Rate:', kedologConfig.discountRate.toString(), `(${kedologConfig.discountRate.toNumber() / 100}%)`);
      console.log('   Treasury:', kedologConfig.treasury.toString());
      console.log('   Authority:', kedologConfig.authority.toString());
      
    } catch (error: any) {
      console.error('\n❌ Failed to create KEDOLOG config:', error.message);
      if (error.logs) console.error('Logs:', error.logs);
      process.exit(1);
    }
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Save deployment info
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  const deploymentInfo = {
    network: NETWORK,
    programId: PROGRAM_ID.toString(),
    ammConfig: {
      index: CONFIG_INDEX,
      address: ammConfig.toString(),
      protocolOwner: admin.publicKey.toString(),
      fundOwner: admin.publicKey.toString(),
      createPoolFeeReceiver: admin.publicKey.toString(),
    },
    kedologConfig: {
      address: protocolTokenConfig.toString(),
      mint: KEDOLOG_MINT.toString(),
      discountRate: KEDOLOG_DISCOUNT_RATE,
      treasury: TREASURY.toString(),
    },
    fees: {
      tradeFeeRate: TRADE_FEE_RATE,
      protocolFeeRate: PROTOCOL_FEE_RATE,
      lpFeeRate: TRADE_FEE_RATE - PROTOCOL_FEE_RATE,
      fundFeeRate: FUND_FEE_RATE,
      creatorFeeRate: CREATOR_FEE_RATE,
      createPoolFee: CREATE_POOL_FEE,
    },
    deployedAt: new Date().toISOString(),
    deployedBy: admin.publicKey.toString(),
  };
  
  const deploymentFile = `deployed-${NETWORK}-fresh.json`;
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ FRESH DEPLOYMENT COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('💾 Saved to:', deploymentFile);
  console.log('\n📋 Deployment Summary:');
  console.log('   Program ID:', PROGRAM_ID.toString());
  console.log('   AMM Config:', ammConfig.toString());
  console.log('   KEDOLOG Config:', protocolTokenConfig.toString());
  console.log('\n🎉 Ready to create pools from your frontend!');
  console.log('   Pool creation fee: 1 SOL');
  console.log('   KEDOLOG discount: 25%');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

