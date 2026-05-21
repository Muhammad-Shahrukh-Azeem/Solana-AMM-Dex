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
// 🔧 KEDOL TOKEN CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ⚠️ IMPORTANT: Set your KEDOL token mint address here!
const KEDOLOG_MINT = process.env.KEDOLOG_MINT || '';

const DISCOUNT_RATE = 2500;          // 25% discount
const PROTOCOL_TOKEN_PER_USD = 10000000; // 10 KEDOL per $1 USD (assuming 6 decimals)

// Treasury address (where collected KEDOL tokens go)
// Default: same as admin, but you can change this
const TREASURY = process.env.TREASURY || '';

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
  console.log('🚀 MAINNET DEPLOYMENT - STEP 3: Setup KEDOL Discount');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check if KEDOLOG_MINT is set
  if (!KEDOLOG_MINT) {
    console.log('⚠️  KEDOLOG_MINT not set!');
    console.log('');
    const mintInput = await question('Enter KEDOL token mint address: ');
    if (!mintInput || mintInput.length < 32) {
      console.error('❌ Invalid mint address');
      process.exit(1);
    }
    
    // Validate it's a valid public key
    try {
      new PublicKey(mintInput);
    } catch (e) {
      console.error('❌ Invalid public key format');
      process.exit(1);
    }
    
    // Update the mint
    const kedologMint = new PublicKey(mintInput);
    
    // Ask for treasury
    console.log('');
    const treasuryInput = await question('Enter treasury address (press Enter to use admin wallet): ');
    
    await setupKedolog(kedologMint, treasuryInput);
  } else {
    const kedologMint = new PublicKey(KEDOLOG_MINT);
    await setupKedolog(kedologMint, TREASURY);
  }
}

async function setupKedolog(kedologMint: PublicKey, treasuryInput: string) {
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const treasury = treasuryInput ? new PublicKey(treasuryInput) : admin.publicKey;
  
  // Load deployment info
  const deploymentFile = `deployed-${NETWORK}.json`;
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ ${deploymentFile} not found!`);
    console.error('   Run step 2 first: ./scripts/mainnet/2-create-config.sh');
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
  const PROGRAM_ID = new PublicKey(deploymentInfo.programId);
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  console.log('📡 Network:', NETWORK);
  console.log('📋 Program ID:', PROGRAM_ID.toString());
  console.log('👤 Admin:', admin.publicKey.toString());
  console.log('🪙 KEDOL Mint:', kedologMint.toString());
  console.log('🏦 Treasury:', treasury.toString());
  
  // Check balance
  const balance = await connection.getBalance(admin.publicKey);
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');
  
  // Verify KEDOL token exists
  try {
    const mintInfo = await connection.getAccountInfo(kedologMint);
    if (!mintInfo) {
      console.error(`❌ KEDOL token mint not found on ${NETWORK}!`);
      process.exit(1);
    }
    console.log(`✅ KEDOL token verified on ${NETWORK}\n`);
  } catch (e) {
    console.error('❌ Error verifying KEDOL token:', e);
    process.exit(1);
  }
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  // Derive protocol token config PDA
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_token_config')],
    PROGRAM_ID
  );
  
  console.log('📝 Protocol Token Config:', protocolTokenConfig.toString());
  
  // Check if already exists
  try {
    const existingConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n⚠️  KEDOL config already exists!');
    console.log('   Token Mint:', existingConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', existingConfig.discountRate.toString(), '(' + (existingConfig.discountRate.toNumber() / 100) + '%)');
    console.log('   Treasury:', existingConfig.treasury.toString());
    console.log('\n✅ KEDOL already configured. Skipping...');
    
    // Update deployment info
    deploymentInfo.kedol = {
      mint: existingConfig.protocolTokenMint.toString(),
      config: protocolTokenConfig.toString(),
      discountRate: existingConfig.discountRate.toNumber(),
      treasury: existingConfig.treasury.toString(),
    };
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    return;
  } catch (e) {
    console.log('✅ KEDOL not configured yet, setting up...\n');
  }
  
  // Configuration
  console.log('⚙️  KEDOL Configuration:');
  console.log('   Discount Rate:', DISCOUNT_RATE / 100, '%');
  console.log('   Token Per USD:', PROTOCOL_TOKEN_PER_USD / 1e6, 'KEDOL');
  console.log('');
  
  // Confirm
  // Confirm with network-aware prompt
  const networkUpper = NETWORK.toUpperCase();
  const confirm = await question(`⚠️  Setup KEDOL on ${networkUpper}? Type "DEPLOY" to confirm: `);
  if (confirm !== 'DEPLOY') {
    console.log('❌ Aborted');
    process.exit(1);
  }
  
  console.log('\n🔄 Creating Protocol Token Config...');
  
  try {
    const tx = await (program.methods as any)
      .createProtocolTokenConfig(
        kedologMint,
        new BN(DISCOUNT_RATE),
        treasury,
        new BN(PROTOCOL_TOKEN_PER_USD)
      )
      .accountsPartial({
        authority: admin.publicKey,
      })
      .rpc();
    
    console.log('✅ Transaction confirmed!');
    console.log('   Signature:', tx);
    console.log('   Explorer: https://explorer.solana.com/tx/' + tx);
    
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const config: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📋 Verified KEDOL Config:');
    console.log('   Token Mint:', config.protocolTokenMint.toString());
    console.log('   Discount Rate:', config.discountRate.toString(), '(' + (config.discountRate.toNumber() / 100) + '%)');
    console.log('   Treasury:', config.treasury.toString());
    console.log('   Token Per USD:', config.protocolTokenPerUsd.toString());
    console.log('   Authority:', config.authority.toString());
    
    // Update deployment info
    deploymentInfo.kedol = {
      mint: kedologMint.toString(),
      config: protocolTokenConfig.toString(),
      discountRate: DISCOUNT_RATE,
      treasury: treasury.toString(),
      protocolTokenPerUsd: PROTOCOL_TOKEN_PER_USD,
      transaction: tx,
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Updated: ${deploymentFile}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ STEP 3 COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 MAINNET DEPLOYMENT COMPLETE!');
    console.log('\n📋 Summary:');
    console.log('   Program ID:', deploymentInfo.programId);
    console.log('   AMM Config:', deploymentInfo.ammConfig);
    console.log('   KEDOL Config:', protocolTokenConfig.toString());
    console.log('   Pool Creation Fee: 1 SOL');
    console.log('   KEDOL Discount: 25%');
    console.log('\n➡️  Next Steps:');
    console.log('   1. Update your frontend with the new addresses');
    console.log(`   2. Copy ${deploymentFile} to your frontend`);
    console.log('   3. Create your first pool from the frontend');
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

