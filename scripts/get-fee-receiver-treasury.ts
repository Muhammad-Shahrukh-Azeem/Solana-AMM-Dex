import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the current fee receiver's KEDOL treasury account
 * 
 * This script helps frontend developers get the correct treasury address
 * to pass to the swapBaseInputWithProtocolToken instruction.
 * 
 * Usage:
 *   npx ts-node scripts/get-fee-receiver-treasury.ts [AMM_CONFIG_ADDRESS]
 * 
 * Example:
 *   npx ts-node scripts/get-fee-receiver-treasury.ts GQfc8j8R1xDR9aTV68YwYWHoprVkzvWDfDg5FCPLToqD
 */

const KEDOLOG_MINT = new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx');

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Get Fee Receiver Treasury Account');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get AMM config address from command line or use default
  let ammConfigAddress: string;
  if (process.argv[2]) {
    ammConfigAddress = process.argv[2];
  } else {
    // Try to load from Anchor.toml
    const anchorToml = fs.readFileSync(path.join(__dirname, '..', 'Anchor.toml'), 'utf-8');
    const programIdMatch = anchorToml.match(/kedolik_cp_swap = "([^"]+)"/);
    if (!programIdMatch) {
      console.error('❌ Could not find program ID in Anchor.toml');
      console.log('\nUsage: npx ts-node scripts/get-fee-receiver-treasury.ts [AMM_CONFIG_ADDRESS]');
      process.exit(1);
    }
    
    const programId = new PublicKey(programIdMatch[1]);
    
    // Derive AMM config PDA
    const [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from('amm_config'), Buffer.from([0, 0])], // index 0
      programId
    );
    
    ammConfigAddress = ammConfig.toString();
    console.log('📍 Using AMM Config from PDA (index 0):', ammConfigAddress);
  }

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load IDL
  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'kedolik_cp_swap.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  
  // Create a dummy wallet (we're only reading, not signing)
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  } as Wallet;
  
  const provider = new AnchorProvider(connection, dummyWallet, {});
  const program = new Program(idl, provider);

  console.log('\n📋 Configuration:');
  console.log('   AMM Config:', ammConfigAddress);
  console.log('   KEDOL Mint:', KEDOLOG_MINT.toString());
  console.log('');

  // Fetch AMM config
  console.log('🔍 Fetching AMM Config...');
  const ammConfig: any = await (program.account as any).ammConfig.fetch(new PublicKey(ammConfigAddress));
  
  const feeReceiver = ammConfig.feeReceiver as PublicKey;
  const protocolOwner = ammConfig.protocolOwner as PublicKey;
  
  console.log('✅ AMM Config loaded\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Current Configuration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('👤 Protocol Owner (Admin):');
  console.log('   ', protocolOwner.toString());
  console.log('');
  
  console.log('💰 Fee Receiver:');
  console.log('   ', feeReceiver.toString());
  console.log('');

  // Get fee receiver's KEDOL token account
  console.log('🔍 Calculating Fee Receiver\'s KEDOL Token Account...');
  const feeReceiverKedologAccount = await getAssociatedTokenAddress(
    KEDOLOG_MINT,
    feeReceiver
  );
  
  console.log('✅ Token account calculated\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 TREASURY ACCOUNT TO USE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('   ', feeReceiverKedologAccount.toString());
  console.log('');

  // Check if account exists
  console.log('🔍 Checking if account exists on-chain...');
  const accountInfo = await connection.getAccountInfo(feeReceiverKedologAccount);
  
  if (accountInfo) {
    console.log('✅ Account EXISTS on-chain');
    console.log('   Owner:', accountInfo.owner.toString());
  } else {
    console.log('⚠️  Account does NOT exist yet');
    console.log('   It will be created automatically on first fee payment');
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Frontend Integration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Use this code in your frontend:\n');
  console.log('```typescript');
  console.log('// 1. Fetch current fee receiver from AMM config');
  console.log(`const ammConfig = await program.account.ammConfig.fetch('${ammConfigAddress}');`);
  console.log('const feeReceiver = ammConfig.feeReceiver;');
  console.log('');
  console.log('// 2. Get fee receiver\'s KEDOL token account');
  console.log('const feeReceiverKedologAccount = await getAssociatedTokenAddress(');
  console.log(`  new PublicKey('${KEDOLOG_MINT.toString()}'),`);
  console.log('  feeReceiver');
  console.log(');');
  console.log('');
  console.log('// 3. Use in swap instruction');
  console.log('await program.methods');
  console.log('  .swapBaseInputWithProtocolToken(amountIn, minimumAmountOut)');
  console.log('  .accounts({');
  console.log('    protocolTokenTreasury: feeReceiverKedologAccount,  // ← Use this!');
  console.log('    // ... other accounts');
  console.log('  })');
  console.log('  .remainingAccounts([');
  console.log('    { pubkey: KEDOLOG_VAULT, isSigner: false, isWritable: false },');
  console.log('    { pubkey: USDC_VAULT, isSigner: false, isWritable: false },');
  console.log('  ])');
  console.log('  .rpc();');
  console.log('```\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Done!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

