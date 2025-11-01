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
  console.log('🔧 Set KEDOLOG Price Pool');
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
  
  console.log('📡 Network:', NETWORK.toUpperCase());
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
    console.log('   Current Price Pool:', config.pricePool.toString());
    console.log('   Authority:', config.authority.toString());
  } catch (e) {
    console.error('\n❌ Protocol token config not found!');
    console.error('   Run the deployment script first to create the config.');
    process.exit(1);
  }
  
  // Ask for pool address
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏊 KEDOLOG/USDC Pool Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const poolAddressStr = await question('Enter KEDOLOG/USDC pool address: ');
  let POOL_ADDRESS: PublicKey;
  
  try {
    POOL_ADDRESS = new PublicKey(poolAddressStr.trim());
  } catch (e) {
    console.error('❌ Invalid pool address');
    process.exit(1);
  }
  
  // Verify pool exists and fetch its data
  console.log('\n🔍 Verifying pool...');
  try {
    const poolData: any = await (program.account as any).poolState.fetch(POOL_ADDRESS);
    console.log('✅ Pool found!');
    console.log('   Token 0 Mint:', poolData.token0Mint.toString());
    console.log('   Token 1 Mint:', poolData.token1Mint.toString());
    console.log('   Token 0 Vault:', poolData.token0Vault.toString());
    console.log('   Token 1 Vault:', poolData.token1Vault.toString());
    
    // Verify it's a KEDOLOG pool
    const config: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    const kedologMint = config.protocolTokenMint.toString();
    
    if (poolData.token0Mint.toString() !== kedologMint && poolData.token1Mint.toString() !== kedologMint) {
      console.error('\n⚠️  WARNING: This pool does not contain KEDOLOG token!');
      console.error('   KEDOLOG Mint:', kedologMint);
      const confirmAnyway = await question('\nContinue anyway? (yes/no): ');
      if (confirmAnyway.toLowerCase() !== 'yes') {
        console.log('❌ Aborted');
        process.exit(1);
      }
    } else {
      console.log('✅ Pool contains KEDOLOG');
    }
    
  } catch (e) {
    console.error('❌ Pool not found or invalid:', e);
    process.exit(1);
  }
  
  // Confirm
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Update Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Network:', NETWORK.toUpperCase());
  console.log('Protocol Token Config:', protocolTokenConfig.toString());
  console.log('New Price Pool:', POOL_ADDRESS.toString());
  
  const networkUpper = NETWORK.toUpperCase();
  const confirm = await question(`\n⚠️  Update price pool on ${networkUpper}? Type "UPDATE" to confirm: `);
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
        POOL_ADDRESS, // price_pool (update)
        null  // new_authority (no change)
      )
      .accountsPartial({
        authority: admin.publicKey,
      })
      .rpc();
    
    console.log('✅ Price pool updated!');
    console.log('   Transaction:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const updatedConfig: any = await (program.account as any).protocolTokenConfig.fetch(protocolTokenConfig);
    console.log('\n📋 Verified Configuration:');
    console.log('   Token Mint:', updatedConfig.protocolTokenMint.toString());
    console.log('   Discount Rate:', updatedConfig.discountRate.toString(), `(${updatedConfig.discountRate.toNumber() / 100}%)`);
    console.log('   Treasury:', updatedConfig.treasury.toString());
    console.log('   Price Pool:', updatedConfig.pricePool.toString());
    console.log('   Authority:', updatedConfig.authority.toString());
    
    // Fetch pool vaults for frontend reference
    const poolData: any = await (program.account as any).poolState.fetch(POOL_ADDRESS);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PRICE POOL CONFIGURED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📋 Pool Vault Addresses (for frontend):');
    console.log('   Token 0 Vault:', poolData.token0Vault.toString());
    console.log('   Token 1 Vault:', poolData.token1Vault.toString());
    
    console.log('\n💡 Frontend Integration:');
    console.log('   Pass these vault addresses as remaining accounts when swapping:');
    console.log('   remainingAccounts: [');
    console.log(`     { pubkey: "${poolData.token0Vault.toString()}", isSigner: false, isWritable: false },`);
    console.log(`     { pubkey: "${poolData.token1Vault.toString()}", isSigner: false, isWritable: false },`);
    console.log('   ]');
    
    console.log('\n🎉 The contract will now automatically fetch KEDOLOG price from the pool!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ Failed to update price pool:', error.message);
    if (error.logs) {
      console.error('\nLogs:', error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);

