import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi');

// Fee configuration
const TRADE_FEE_RATE = 2500;      // 0.25%
const PROTOCOL_FEE_RATE = 500;    // 0.05%
const FUND_FEE_RATE = 0;          // 0%
const CREATE_POOL_FEE = 150000000; // 0.15 SOL
const CREATOR_FEE_RATE = 0;       // 0%

async function main() {
  console.log('\n🔧 Creating NEW AMM Config with Fee Receiver Field');
  console.log('━'.repeat(80));
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  console.log(`\n📊 Configuration:`);
  console.log(`   Network: ${NETWORK}`);
  console.log(`   Program: ${PROGRAM_ID.toString()}`);
  console.log(`   Admin: ${admin.publicKey.toString()}`);
  
  // Use index 1 for new config (index 0 is the old one)
  const NEW_INDEX = 1;
  
  // Note: Anchor uses the method call to derive the PDA automatically
  // We don't manually calculate it - let Anchor do it
  
  console.log(`\n⚙️  Creating AMM Config with Index: ${NEW_INDEX}`);
  
  // Create new AMM config
  console.log(`\n🔄 Creating AMM Config...`);
  console.log(`   Trade Fee: ${TRADE_FEE_RATE / 10000}%`);
  console.log(`   Protocol Fee: ${PROTOCOL_FEE_RATE / 10000}%`);
  console.log(`   LP Fee: ${(TRADE_FEE_RATE - PROTOCOL_FEE_RATE) / 10000}%`);
  console.log(`   Create Pool Fee: ${CREATE_POOL_FEE / 1e9} SOL`);
  console.log(`   Fee Receiver: ${admin.publicKey.toString()}`);
  
  try {
    const tx = await (program.methods as any)
      .createAmmConfig(
        NEW_INDEX,
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
    
    console.log(`\n✅ New AMM Config Created!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
    
    // Derive the config address for verification
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(NEW_INDEX, 0);
    const [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from('amm_config'), indexBuffer],
      PROGRAM_ID
    );
    
    console.log(`   Config Address: ${ammConfig.toString()}`);
    
    // Verify
    const config: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log(`\n📋 Verified Config:`);
    console.log(`   Protocol Owner: ${config.protocolOwner.toString()}`);
    console.log(`   Fund Owner: ${config.fundOwner.toString()}`);
    console.log(`   Fee Receiver: ${config.createPoolFeeReceiver.toString()}`);
    console.log(`   Create Pool Fee: ${config.createPoolFee.toString()} lamports`);
    
    // Save to file
    const deploymentInfo = {
      network: NETWORK,
      programId: PROGRAM_ID.toString(),
      ammConfigIndex: NEW_INDEX,
      ammConfig: ammConfig.toString(),
      protocolOwner: config.protocolOwner.toString(),
      fundOwner: config.fundOwner.toString(),
      createPoolFeeReceiver: config.createPoolFeeReceiver.toString(),
      transaction: tx,
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      `deployed-${NETWORK}-config-${NEW_INDEX}.json`,
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n💾 Saved to: deployed-${NETWORK}-config-${NEW_INDEX}.json`);
    console.log(`\n${'━'.repeat(80)}`);
    console.log(`\n✅ SUCCESS! Use this config for new pools.`);
    console.log(`\n⚠️  IMPORTANT: Update your frontend to use the new AMM config address!`);
    console.log(`   Old Config (Index 0): 6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt`);
    console.log(`   New Config (Index 1): ${ammConfig.toString()}`);
    console.log(`\n${'━'.repeat(80)}\n`);
    
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.logs) {
      console.error(`\nLogs:`, error.logs);
    }
  }
}

main().catch(console.error);

