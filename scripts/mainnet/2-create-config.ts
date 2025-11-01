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
// 🔧 MAINNET CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TRADE_FEE_RATE = 2500;        // 0.25%
const PROTOCOL_FEE_RATE = 500;      // 0.05% (20% of trade fee)
const FUND_FEE_RATE = 0;            // 0%
const CREATE_POOL_FEE = 1000000000; // 1 SOL (1,000,000,000 lamports)
const CREATOR_FEE_RATE = 0;         // 0%

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
  console.log('🚀 MAINNET DEPLOYMENT - STEP 2: Create AMM Config');
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
  
  if (balance < 0.1 * 1e9) {
    console.error('❌ Insufficient balance! Need at least 0.1 SOL');
    process.exit(1);
  }
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  // Configuration
  console.log('⚙️  Configuration:');
  console.log('   Trade Fee:', TRADE_FEE_RATE / 10000, '%');
  console.log('   Protocol Fee:', PROTOCOL_FEE_RATE / 10000, '%');
  console.log('   LP Fee:', (TRADE_FEE_RATE - PROTOCOL_FEE_RATE) / 10000, '%');
  console.log('   Create Pool Fee:', CREATE_POOL_FEE / 1e9, 'SOL');
  console.log('   Pool Fee Receiver:', admin.publicKey.toString());
  console.log('');
  
  // Confirm with network-aware prompt
  const networkUpper = NETWORK.toUpperCase();
  const confirm = await question(`⚠️  Deploy to ${networkUpper}? Type "DEPLOY" to confirm: `);
  if (confirm !== 'DEPLOY') {
    console.log('❌ Aborted');
    process.exit(1);
  }
  
  // Use index 0 for mainnet
  const CONFIG_INDEX = 0;
  
  // Derive config address
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(CONFIG_INDEX, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('amm_config'), indexBuffer],
    PROGRAM_ID
  );
  
  console.log('\n📝 AMM Config Address:', ammConfig.toString());
  
  // Check if already exists
  try {
    const existingConfig: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log('\n⚠️  Config already exists!');
    console.log('   Protocol Owner:', existingConfig.protocolOwner.toString());
    console.log('   Fund Owner:', existingConfig.fundOwner.toString());
    console.log('   Fee Receiver:', existingConfig.createPoolFeeReceiver.toString());
    console.log('   Create Pool Fee:', existingConfig.createPoolFee.toString(), 'lamports');
    console.log('\n✅ Config already initialized. Skipping...');
    return;
  } catch (e) {
    console.log('✅ Config does not exist, creating...\n');
  }
  
  // Create config
  console.log('🔄 Creating AMM Config...');
  
  try {
    const tx = await (program.methods as any)
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
    
    console.log('✅ Transaction confirmed!');
    console.log('   Signature:', tx);
    console.log('   Explorer: https://explorer.solana.com/tx/' + tx);
    
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const config: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log('\n📋 Verified Config:');
    console.log('   Index:', config.index);
    console.log('   Protocol Owner:', config.protocolOwner.toString());
    console.log('   Fund Owner:', config.fundOwner.toString());
    console.log('   Fee Receiver:', config.createPoolFeeReceiver.toString());
    console.log('   Trade Fee:', config.tradeFeeRate.toString(), '(' + (config.tradeFeeRate.toNumber() / 10000) + '%)');
    console.log('   Protocol Fee:', config.protocolFeeRate.toString(), '(' + (config.protocolFeeRate.toNumber() / 10000) + '%)');
    console.log('   Create Pool Fee:', config.createPoolFee.toString(), 'lamports (' + (config.createPoolFee.toNumber() / 1e9) + ' SOL)');
    
    // Save deployment info
    const deploymentInfo = {
      network: NETWORK,
      programId: PROGRAM_ID.toString(),
      ammConfigIndex: CONFIG_INDEX,
      ammConfig: ammConfig.toString(),
      protocolOwner: config.protocolOwner.toString(),
      fundOwner: config.fundOwner.toString(),
      createPoolFeeReceiver: config.createPoolFeeReceiver.toString(),
      fees: {
        tradeFeeRate: TRADE_FEE_RATE,
        protocolFeeRate: PROTOCOL_FEE_RATE,
        lpFeeRate: TRADE_FEE_RATE - PROTOCOL_FEE_RATE,
        fundFeeRate: FUND_FEE_RATE,
        creatorFeeRate: CREATOR_FEE_RATE,
        createPoolFee: CREATE_POOL_FEE,
      },
      transaction: tx,
      createdAt: new Date().toISOString(),
    };
    
    const deploymentFile = `deployed-${NETWORK}.json`;
    fs.writeFileSync(
      deploymentFile,
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n💾 Saved to: ${deploymentFile}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ STEP 2 COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n➡️  Next: Run npx ts-node scripts/mainnet/3-setup-kedolog.ts');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('\nLogs:', error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);

