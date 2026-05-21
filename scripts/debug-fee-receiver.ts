#!/usr/bin/env ts-node
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import * as os from 'os';

async function debugFeeReceiver() {
  // Your latest deployment
  const PROGRAM_ID = new PublicKey('4QQN6R5AbhrUEBCLHxpJrGEmq4DHXxbcVC6eWxRh6bUR');
  const AMM_CONFIG = new PublicKey('UwcS5rX4LL1db6Unq4PGyqHvjuKhTb7ujSZycgu4JX7');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const idl = JSON.parse(readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  
  const wallet = new Wallet({
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Not implemented'); },
    signAllTransactions: async () => { throw new Error('Not implemented'); },
  } as any);
  
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, provider);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 DEBUGGING FEE RECEIVER ISSUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`⚙️  AMM Config: ${AMM_CONFIG.toString()}\n`);
  
  // Fetch current config
  const ammConfig: any = await (program.account as any).ammConfig.fetch(AMM_CONFIG);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CURRENT ON-CHAIN CONFIG');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const admin = ammConfig.protocolOwner.toString();
  const poolFeeReceiver = ammConfig.createPoolFeeReceiver.toString();
  const protocolFeeReceiver = ammConfig.protocolFeeReceiver.toString();
  const fundOwner = ammConfig.fundOwner.toString();
  
  console.log(`👤 Protocol Owner (Admin):        ${admin}`);
  console.log(`🏦 Pool Creation Fee Receiver:    ${poolFeeReceiver}`);
  console.log(`💰 Protocol Fee Receiver:         ${protocolFeeReceiver}`);
  console.log(`💼 Fund Owner:                    ${fundOwner}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 DIAGNOSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check pool creation fee receiver
  if (poolFeeReceiver === admin) {
    console.log('❌ PROBLEM FOUND: Pool Creation Fee Receiver = Admin\n');
    console.log('   📝 Explanation:');
    console.log('   When someone creates a pool, the 1 SOL fee goes to:');
    console.log(`   → createPoolFeeReceiver: ${poolFeeReceiver}`);
    console.log(`   → This is the ADMIN wallet!\n`);
    console.log('   ⚠️  This is why the 1 SOL went to the admin address.\n');
  } else {
    console.log('✅ Pool Creation Fee Receiver is separate from admin\n');
    console.log(`   → Fee goes to: ${poolFeeReceiver}\n`);
  }
  
  // Check protocol fee receiver
  if (protocolFeeReceiver === admin) {
    console.log('⚠️  Protocol Fee Receiver = Admin\n');
    console.log('   📝 Explanation:');
    console.log('   Protocol fees from swaps can only be claimed by:');
    console.log(`   → protocolFeeReceiver: ${protocolFeeReceiver}`);
    console.log(`   → This is the ADMIN wallet!\n`);
  } else {
    console.log('✅ Protocol Fee Receiver is separate from admin\n');
    console.log(`   → Fees claimable by: ${protocolFeeReceiver}\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 UNDERSTANDING THE TWO FEE RECEIVERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('1️⃣  Pool Creation Fee Receiver (createPoolFeeReceiver):');
  console.log('   • Receives the 1 SOL fee when someone creates a new pool');
  console.log('   • Fee is paid IMMEDIATELY during pool creation');
  console.log('   • Updated with parameter 8 in updateAmmConfig\n');
  
  console.log('2️⃣  Protocol Fee Receiver (protocolFeeReceiver):');
  console.log('   • Can claim accumulated protocol fees from swaps');
  console.log('   • Fees accumulate in pool vaults over time');
  console.log('   • Must call collectProtocolFee to claim');
  console.log('   • Updated with parameter 9 in updateAmmConfig\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 HOW TO FIX');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('To change the Pool Creation Fee Receiver:');
  console.log('```bash');
  console.log('npx ts-node scripts/update-pool-fee-receiver.ts <NEW_RECEIVER_ADDRESS>');
  console.log('```\n');
  
  console.log('To change the Protocol Fee Receiver:');
  console.log('```bash');
  console.log('npx ts-node scripts/update-protocol-fee-receiver.ts <NEW_RECEIVER_ADDRESS>');
  console.log('```\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check recent transactions
  console.log('🔍 Checking recent pool creation transactions...\n');
  
  try {
    const walletPath = `${os.homedir()}/.config/solana/id.json`;
    const walletKeypair = Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')));
    const adminPubkey = PublicKey.default; // We'll get this from config
    
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(admin),
      { limit: 10 }
    );
    
    console.log(`Found ${signatures.length} recent transactions for admin wallet\n`);
    
    for (const sig of signatures.slice(0, 5)) {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!tx) continue;
      
      // Check if this is a pool creation (has 1 SOL transfer)
      const hasPoolCreationFee = tx.meta?.postBalances && tx.meta?.preBalances &&
        tx.meta.postBalances.some((post, i) => {
          const pre = tx.meta!.preBalances[i];
          const diff = Math.abs(post - pre) / 1e9;
          return diff >= 0.99 && diff <= 1.01; // ~1 SOL
        });
      
      if (hasPoolCreationFee) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 Pool Creation Transaction Found:`);
        console.log(`   Signature: ${sig.signature}`);
        console.log(`   Time: ${new Date(sig.blockTime! * 1000).toLocaleString()}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${sig.signature}?cluster=devnet\n`);
        
        // Show balance changes
        if (tx.meta?.preBalances && tx.meta?.postBalances) {
          console.log(`   Balance Changes:`);
          tx.meta.postBalances.forEach((post, i) => {
            const pre = tx.meta!.preBalances[i];
            const diff = (post - pre) / 1e9;
            if (Math.abs(diff) > 0.01) {
              const account = tx.transaction.message.accountKeys[i];
              console.log(`   ${account.pubkey.toString()}: ${diff > 0 ? '+' : ''}${diff.toFixed(4)} SOL`);
            }
          });
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
    }
  } catch (e) {
    console.log('⚠️  Could not fetch recent transactions');
  }
}

debugFeeReceiver().catch(console.error);

