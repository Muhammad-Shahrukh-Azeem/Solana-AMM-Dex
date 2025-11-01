import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi');
const PROTOCOL_TOKEN_CONFIG = new PublicKey('7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv');

async function main() {
  console.log('\n🔧 Updating KEDOLOG Discount from 20% to 25%');
  console.log('━'.repeat(80));
  
  // Load wallet
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  console.log(`\n📊 Current Configuration:`);
  console.log(`   Network: ${NETWORK}`);
  console.log(`   Program: ${PROGRAM_ID.toString()}`);
  console.log(`   Protocol Token Config: ${PROTOCOL_TOKEN_CONFIG.toString()}`);
  console.log(`   Authority: ${keypair.publicKey.toString()}`);
  
  // Fetch current config
  const currentConfig: any = await (program.account as any).protocolTokenConfig.fetch(PROTOCOL_TOKEN_CONFIG);
  console.log(`\n📋 Current Discount Rate:`);
  console.log(`   Discount: ${currentConfig.discountRate / 100}% (${currentConfig.discountRate} basis points)`);
  
  if (currentConfig.discountRate === 2500) {
    console.log(`\n✅ Discount is already set to 25%!`);
    return;
  }
  
  // Update to 25% (2500 basis points)
  console.log(`\n🔄 Updating discount to 25% (2500 basis points)...`);
  
  const tx = await (program.methods as any)
    .updateProtocolTokenConfig(
      new BN(2500), // discount_rate: 25%
      null, // treasury: no change
      null, // protocol_token_per_usd: no change
      null  // new_authority: no change
    )
    .accountsPartial({
      authority: keypair.publicKey,
      protocolTokenConfig: PROTOCOL_TOKEN_CONFIG,
    })
    .rpc();
  
  console.log(`\n✅ Discount Updated!`);
  console.log(`   Transaction: ${tx}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);
  
  // Verify update
  const updatedConfig: any = await (program.account as any).protocolTokenConfig.fetch(PROTOCOL_TOKEN_CONFIG);
  console.log(`\n📋 New Configuration:`);
  console.log(`   Discount Rate: ${updatedConfig.discountRate / 100}% (${updatedConfig.discountRate} basis points)`);
  console.log(`   Protocol Token: ${updatedConfig.protocolTokenMint.toString()}`);
  console.log(`   Price per USD: ${updatedConfig.protocolTokenPerUsd.toString()}`);
  
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`✅ Discount successfully updated to 25%!`);
  console.log(`\n📊 This applies to:`);
  console.log(`   ✅ All existing pools`);
  console.log(`   ✅ All new pools that will be created`);
  console.log(`\n💡 Users will now save 25% on protocol fees when paying with KEDOLOG!`);
  console.log(`${'━'.repeat(80)}\n`);
}

main().catch(console.error);

