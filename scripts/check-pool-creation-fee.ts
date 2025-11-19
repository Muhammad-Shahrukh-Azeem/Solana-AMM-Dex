import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { KedolikCpSwap } from "../target/types/kedolik_cp_swap";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

/**
 * 💰 Check Pool Creation Fee
 * 
 * This script reads and displays the current pool creation fee from the AMM config.
 */

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

async function main() {
  console.log("💰 Checking Pool Creation Fee");
  console.log("=".repeat(60));
  
  // Get network from Solana CLI
  const { network: NETWORK, rpcUrl: RPC_URL } = getCurrentNetwork();
  
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
  
  // Setup connection and provider
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  console.log(`\n📡 Network: ${NETWORK.toUpperCase()}`);
  console.log(`🔗 RPC: ${RPC_URL}`);
  console.log(`👤 Admin: ${admin.publicKey.toString()}`);
  console.log(`📋 Program ID: ${PROGRAM_ID.toString()}`);
  
  // Get AMM config address (index 0)
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0, 0);
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), indexBuffer],
    PROGRAM_ID
  );
  
  console.log(`\n⚙️  AMM Config: ${ammConfig.toString()}`);
  
  // Fetch current config
  try {
    const config: any = await (program.account as any).ammConfig.fetch(ammConfig);
    console.log(`\n📊 Current AMM Configuration:`);
    console.log(`   Trade Fee Rate: ${config.tradeFeeRate} (${Number(config.tradeFeeRate) / 10000}%)`);
    console.log(`   Protocol Fee Rate: ${config.protocolFeeRate} (${Number(config.protocolFeeRate) / 10000}%)`);
    console.log(`   Fund Fee Rate: ${config.fundFeeRate}`);
    console.log(`   Creator Fee Rate: ${config.creatorFeeRate}`);
    console.log(`\n💰 Pool Creation Fee:`);
    console.log(`   Amount: ${config.createPoolFee.toString()} lamports`);
    console.log(`   Amount: ${(Number(config.createPoolFee) / 1e9).toFixed(4)} SOL`);
    console.log(`\n📦 Other Config Details:`);
    console.log(`   Protocol Owner: ${config.protocolOwner.toString()}`);
    console.log(`   Fee Receiver: ${config.feeReceiver.toString()}`);
    console.log(`   Disable Create Pool: ${config.disableCreatePool}`);
    
    // Show fee receiver info
    if (Number(config.createPoolFee) > 0) {
      console.log(`\n💡 When someone creates a pool:`);
      console.log(`   They must pay: ${(Number(config.createPoolFee) / 1e9).toFixed(4)} SOL`);
      console.log(`   Fee goes to: ${config.feeReceiver.toString()}`);
    } else {
      console.log(`\n💡 Pool creation fee is currently DISABLED (0 SOL)`);
    }
    
  } catch (e: any) {
    console.error("\n❌ Error fetching AMM Config!");
    console.error(`   Error: ${e.message}`);
    console.error(`\n💡 Make sure:`);
    console.error(`   1. The AMM config exists at: ${ammConfig.toString()}`);
    console.error(`   2. You're connected to the correct network`);
    console.error(`   3. The program ID is correct: ${program.programId.toString()}`);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

