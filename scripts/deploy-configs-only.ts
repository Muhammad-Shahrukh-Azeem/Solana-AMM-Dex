import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';
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

const CONFIG_INDEX = 0; // Always use index 0 for new programs
const KEDOLOG_MINT = new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx');
const TREASURY = new PublicKey('67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa');

const TRADE_FEE_RATE = 2500;        // 0.25%
const PROTOCOL_FEE_RATE = 500;      // 0.05%
const FUND_FEE_RATE = 0;            // 0%
const CREATE_POOL_FEE = 1000000000; // 1 SOL
const CREATOR_FEE_RATE = 0;         // 0%
const KEDOLOG_DISCOUNT_RATE = 2500; // 25%

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log('🔧 Creating AMM Config and KEDOLOG Config...\n');
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
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
  
  console.log('📡 Network:', NETWORK.toUpperCase());
  console.log('🔗 RPC:', RPC_URL);
  console.log('📋 Program ID:', PROGRAM_ID.toString());
  console.log('👤 Admin:', admin.publicKey.toString());
  
  const balance = await connection.getBalance(admin.publicKey);
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');
  
  // Load IDL and ensure it has the correct program ID
  let idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  
  // Verify IDL has correct program ID
  if (idl.address !== PROGRAM_ID.toString()) {
    console.log('⚠️  IDL address mismatch, updating...');
    idl.address = PROGRAM_ID.toString();
    idl.metadata = { address: PROGRAM_ID.toString() };
    fs.writeFileSync('./target/idl/kedolik_cp_swap.json', JSON.stringify(idl, null, 2));
    console.log('✅ IDL updated with correct program ID\n');
    // Reload IDL after update
    idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  }
  
  // Create program - it will use the address from the IDL
  const program = new Program(idl as any, provider);
  
  // Derive addresses
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(CONFIG_INDEX, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('amm_config'), indexBuffer],
    PROGRAM_ID
  );
  
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_token_config')],
    PROGRAM_ID
  );
  
  console.log('📋 Configuration:');
  console.log('   AMM Config:', ammConfig.toString());
  console.log('   KEDOLOG Config:', protocolTokenConfig.toString());
  console.log('   Pool Creation Fee: 1 SOL');
  console.log('   KEDOLOG Discount: 25%');
  console.log('   Treasury:', TREASURY.toString());
  console.log('');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Create AMM Config
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('🔄 Creating AMM Config...\n');
  
  try {
    const SystemProgram = new PublicKey('11111111111111111111111111111111');
    
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
      .accounts({
        owner: admin.publicKey,
        ammConfig: ammConfig,
        systemProgram: SystemProgram,
      })
      .rpc();
    
    console.log('✅ AMM Config created!');
    console.log('   Transaction:', configTx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${configTx}?cluster=${NETWORK}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const config: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log('\n📋 Verified AMM Config:');
    console.log('   Address:', ammConfig.toString());
    console.log('   Protocol Owner:', config.protocolOwner.toString());
    console.log('   Fee Receiver:', config.createPoolFeeReceiver.toString());
    console.log('   Create Pool Fee:', (config.createPoolFee.toNumber() / 1e9), 'SOL');
    
  } catch (error: any) {
    console.error('\n❌ Failed to create AMM config:', error.message);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Create KEDOLOG Config
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n🔄 Creating KEDOLOG Config...\n');
  
  try {
    const SystemProgram = new PublicKey('11111111111111111111111111111111');
    
    const kedologTx = await (program.methods as any)
      .createProtocolTokenConfig(
        KEDOLOG_MINT,
        new BN(KEDOLOG_DISCOUNT_RATE),
        admin.publicKey, // authority
        TREASURY,
        PublicKey.default // price_pool (will be set later after pool creation)
      )
      .accounts({
        payer: admin.publicKey,
        protocolTokenConfig: protocolTokenConfig,
        systemProgram: SystemProgram,
      })
      .rpc();
    
    console.log('✅ KEDOLOG Config created!');
    console.log('   Transaction:', kedologTx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${kedologTx}?cluster=${NETWORK}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const kedologConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📋 Verified KEDOLOG Config:');
    console.log('   Address:', protocolTokenConfig.toString());
    console.log('   Token Mint:', kedologConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', (kedologConfig.discountRate.toNumber() / 100), '%');
    console.log('   Treasury:', kedologConfig.treasury.toString());
    console.log('   Authority:', kedologConfig.authority.toString());
    console.log('   Price Pool:', kedologConfig.pricePool.toString(), '(not set yet)');
    
  } catch (error: any) {
    console.error('\n❌ Failed to create KEDOLOG config:', error.message);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
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
      pricePool: 'not set yet',
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
  
  const deploymentFile = `deployed-${NETWORK}-${Date.now()}.json`;
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log('\n💾 Deployment info saved to:', deploymentFile);
  console.log('\n✅ All configs created successfully!');
}

main().catch(console.error);

