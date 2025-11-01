import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('fWk79D52Gqr6pE59kca4rDrEyeeuefE7q2WPrNM17P9');
const KEDOLOG_MINT = new PublicKey('22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx');
const TREASURY = new PublicKey('67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa');
const KEDOLOG_DISCOUNT_RATE = 2500; // 25%

async function main() {
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  
  const idl = JSON.parse(fs.readFileSync('./target/idl/kedolik_cp_swap.json', 'utf-8'));
  const program = new Program(idl as any, provider);
  
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_token_config')],
    PROGRAM_ID
  );
  
  console.log('🔄 Creating KEDOLOG Config...\n');
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('Config Address:', protocolTokenConfig.toString());
  console.log('');
  
  const SystemProgram = new PublicKey('11111111111111111111111111111111');
  
  const kedologTx = await (program.methods as any)
    .createProtocolTokenConfig(
      KEDOLOG_MINT,
      new BN(KEDOLOG_DISCOUNT_RATE),
      admin.publicKey,
      TREASURY,
      PublicKey.default
    )
    .accounts({
      payer: admin.publicKey,
      protocolTokenConfig: protocolTokenConfig,
      systemProgram: SystemProgram,
    })
    .rpc();
  
  console.log('✅ KEDOLOG Config created!');
  console.log('Transaction:', kedologTx);
  console.log('Explorer:', `https://explorer.solana.com/tx/${kedologTx}?cluster=devnet`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('AMM Config: 7hiyWmzAH1Shp9aC5DVeeM8hoie5ZzLen83SuDh9jvfE');
  console.log('KEDOLOG Config:', protocolTokenConfig.toString());
  console.log('');
  console.log('Next: Create KEDOLOG/USDC pool from frontend');
}

main().catch(console.error);

