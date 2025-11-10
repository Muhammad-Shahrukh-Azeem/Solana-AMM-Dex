#!/usr/bin/env ts-node
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import * as os from 'os';
import BN from 'bn.js';

async function updatePoolCreationFeeReceiver() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n❌ Usage: npx ts-node scripts/update-pool-creation-fee-receiver.ts <NEW_RECEIVER_ADDRESS>\n');
    console.log('Example:');
    console.log('  npx ts-node scripts/update-pool-creation-fee-receiver.ts 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa\n');
    process.exit(1);
  }
  
  const newReceiverAddress = args[0];
  let newReceiver: PublicKey;
  
  try {
    newReceiver = new PublicKey(newReceiverAddress);
  } catch (e) {
    console.log('\n❌ Invalid address format\n');
    process.exit(1);
  }
  
  // Load deployment info
  const PROGRAM_ID = new PublicKey('4QQN6R5AbhrUEBCLHxpJrGEmq4DHXxbcVC6eWxRh6bUR');
  const AMM_CONFIG = new PublicKey('UwcS5rX4LL1db6Unq4PGyqHvjuKhTb7ujSZycgu4JX7');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const idl = JSON.parse(readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')));
  const wallet = new Wallet({
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Not implemented'); },
    signAllTransactions: async () => { throw new Error('Not implemented'); },
  } as any);
  
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const { Program } = await import('@coral-xyz/anchor');
  const program = new Program(idl, provider);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 UPDATE POOL CREATION FEE RECEIVER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Fetch current config
  const ammConfig: any = await (program.account as any).ammConfig.fetch(AMM_CONFIG);
  
  console.log(`📋 Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`⚙️  AMM Config: ${AMM_CONFIG.toString()}\n`);
  
  console.log('Current Configuration:');
  console.log(`  Pool Creation Fee Receiver: ${ammConfig.createPoolFeeReceiver.toString()}`);
  console.log(`  Protocol Fee Receiver:      ${ammConfig.protocolFeeReceiver.toString()}`);
  console.log(`  Admin:                      ${ammConfig.protocolOwner.toString()}\n`);
  
  console.log('New Configuration:');
  console.log(`  Pool Creation Fee Receiver: ${newReceiver.toString()} ← UPDATING\n`);
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const confirm = await new Promise<string>((resolve) => {
    readline.question('⚠️  Confirm update? Type "UPDATE" to proceed: ', resolve);
  });
  readline.close();
  
  if (confirm !== 'UPDATE') {
    console.log('\n❌ Aborted\n');
    process.exit(0);
  }
  
  console.log('\n🔄 Updating pool creation fee receiver...\n');
  
  try {
    // Load actual wallet for signing
    const { Keypair } = await import('@solana/web3.js');
    const adminKeypair = Keypair.fromSecretKey(walletKeypair);
    
    // Create proper wallet
    const signingWallet = {
      publicKey: adminKeypair.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(adminKeypair);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach(tx => tx.partialSign(adminKeypair));
        return txs;
      },
    };
    
    const signingProvider = new AnchorProvider(connection, signingWallet as any, { commitment: 'confirmed' });
    const signingProgram = new Program(idl, signingProvider);
    
    // Call updateAmmConfig with param=8 (create_pool_fee_receiver)
    const tx = await (signingProgram.methods as any)
      .updateAmmConfig(
        8,           // param = 8 → update create_pool_fee_receiver
        new BN(0)    // value (not used for address updates)
      )
      .accounts({
        owner: adminKeypair.publicKey,
        ammConfig: AMM_CONFIG,
      })
      .remainingAccounts([
        {
          pubkey: newReceiver,
          isSigner: false,
          isWritable: false,
        }
      ])
      .rpc();
    
    console.log('✅ Transaction sent!');
    console.log(`   Signature: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
    
    console.log('⏳ Waiting for confirmation...\n');
    await connection.confirmTransaction(tx, 'confirmed');
    
    // Verify update
    const updatedConfig: any = await (program.account as any).ammConfig.fetch(AMM_CONFIG);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ UPDATE SUCCESSFUL!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Updated Configuration:');
    console.log(`  Pool Creation Fee Receiver: ${updatedConfig.createPoolFeeReceiver.toString()}`);
    console.log(`  Protocol Fee Receiver:      ${updatedConfig.protocolFeeReceiver.toString()}`);
    console.log(`  Admin:                      ${updatedConfig.protocolOwner.toString()}\n`);
    
    if (updatedConfig.createPoolFeeReceiver.toString() === newReceiver.toString()) {
      console.log('✅ Pool creation fee receiver updated successfully!');
      console.log('   From now on, the 1 SOL pool creation fee will go to:');
      console.log(`   → ${newReceiver.toString()}\n`);
    } else {
      console.log('⚠️  Warning: Update may not have taken effect. Please check manually.\n');
    }
    
  } catch (error: any) {
    console.log('\n❌ Error updating fee receiver:');
    console.log(error.message || error);
    console.log('\nMake sure:');
    console.log('  1. You are the admin of this AMM config');
    console.log('  2. You have enough SOL for transaction fees');
    console.log('  3. The new address is valid\n');
    process.exit(1);
  }
}

updatePoolCreationFeeReceiver().catch(console.error);

