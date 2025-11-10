#!/usr/bin/env ts-node
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import * as os from 'os';

async function fixProtocolFeeRate() {
  const PROGRAM_ID = new PublicKey('2LVtzKZ7DwoowxeKnwmia6JGKdZy9cjAzH62RrburWtq');
  const AMM_CONFIG = new PublicKey('UwcS5rX4LL1db6Unq4PGyqHvjuKhTb7ujSZycgu4JX7');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const idl = JSON.parse(readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')))
  );
  
  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(walletKeypair);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach(tx => tx.partialSign(walletKeypair));
      return txs;
    },
  };
  
  const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
  const program = new Program(idl, provider);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Fix Protocol Fee Rate');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Fetch current config
  const config: any = await (program.account as any).ammConfig.fetch(AMM_CONFIG);
  
  console.log('Current Configuration:');
  console.log(`  Trade Fee Rate: ${config.tradeFeeRate.toString()} (${config.tradeFeeRate.toNumber() / 10000}%)`);
  console.log(`  Protocol Fee Rate: ${config.protocolFeeRate.toString()} (${config.protocolFeeRate.toNumber() / 10000}% of trade fee)`);
  console.log('');
  
  const currentRate = config.protocolFeeRate.toNumber();
  const correctRate = 200000; // 20% of trade fee
  
  if (currentRate === correctRate) {
    console.log('✅ Protocol fee rate is already correct!');
    return;
  }
  
  console.log(`❌ Protocol fee rate is WRONG: ${currentRate}`);
  console.log(`✅ Should be: ${correctRate} (20% of trade fee)\n`);
  
  console.log('This will update the protocol fee rate from 0.05% to 20% of trade fee.');
  console.log('This means:');
  console.log('  - Trade fee: 0.25%');
  console.log('  - Protocol portion: 0.05% (20% of 0.25%)');
  console.log('  - LP portion: 0.20% (80% of 0.25%)\n');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const confirm = await new Promise<string>((resolve) => {
    readline.question('⚠️  Update protocol fee rate? Type "UPDATE" to confirm: ', resolve);
  });
  readline.close();
  
  if (confirm !== 'UPDATE') {
    console.log('\n❌ Aborted\n');
    process.exit(0);
  }
  
  console.log('\n🔄 Updating protocol fee rate...\n');
  
  // Update using parameter 1 (protocol_fee_rate)
  const tx = await (program.methods as any)
    .updateAmmConfig(
      1,                      // param = 1 → update protocol_fee_rate
      new BN(correctRate)     // new value = 200000
    )
    .accounts({
      owner: walletKeypair.publicKey,
      ammConfig: AMM_CONFIG,
    })
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
  console.log(`  Trade Fee Rate: ${updatedConfig.tradeFeeRate.toString()} (${updatedConfig.tradeFeeRate.toNumber() / 10000}%)`);
  console.log(`  Protocol Fee Rate: ${updatedConfig.protocolFeeRate.toString()} (${updatedConfig.protocolFeeRate.toNumber() / 10000}% of trade fee)`);
  console.log('');
  
  // Test calculation
  const tradeFee = updatedConfig.tradeFeeRate.toNumber();
  const protocolRate = updatedConfig.protocolFeeRate.toNumber();
  const protocolPortion = Math.floor(tradeFee * protocolRate / 1000000);
  
  console.log(`Protocol Fee Portion: ${protocolPortion} (${protocolPortion / 10000}%)`);
  
  // Test with 1 USDC
  const amountIn = 1000000;
  const originalFee = Math.floor(amountIn * protocolPortion / 1000000);
  const discountedFee = Math.floor(originalFee * 7500 / 10000);
  
  console.log('\nFor 1 USDC swap:');
  console.log(`  Original protocol fee: ${originalFee} units`);
  console.log(`  Discounted fee (25% off): ${discountedFee} units`);
  console.log(`  ${discountedFee > 0 ? '✅ Will work!' : '❌ Still too small!'}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

fixProtocolFeeRate().catch(console.error);

