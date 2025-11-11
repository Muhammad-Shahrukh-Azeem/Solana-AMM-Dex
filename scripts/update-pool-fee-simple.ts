import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf");
const POOL_FEE_LAMPORTS = 150_000_000; // 0.15 SOL

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairData = JSON.parse(fs.readFileSync("/home/ubuntu/.config/solana/id.json", "utf-8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log("Admin:", admin.publicKey.toString());
  
  // Derive AMM config PDA
  const [ammConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_config"), Buffer.from([0])],
    PROGRAM_ID
  );
  
  console.log("AMM Config:", ammConfig.toString());
  
  // Fetch current config
  const accountInfo = await connection.getAccountInfo(ammConfig);
  if (!accountInfo) {
    console.error("AMM Config not found!");
    process.exit(1);
  }
  
  // Read current fee (at offset 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 = 120)
  const currentFee = accountInfo.data.readBigUInt64LE(120);
  console.log("Current pool creation fee:", Number(currentFee) / 1e9, "SOL");
  
  // Build instruction data
  // Discriminator for update_amm_config (8 bytes) + param (1 byte) + value (8 bytes)
  const discriminator = Buffer.from([0x1d, 0x9a, 0xcb, 0x51, 0x2e, 0xa5, 0x45, 0x94]); // update_amm_config
  const param = Buffer.from([5]); // param 5 = create_pool_fee
  const value = Buffer.alloc(8);
  value.writeBigUInt64LE(BigInt(POOL_FEE_LAMPORTS));
  
  const data = Buffer.concat([discriminator, param, value]);
  
  // Build instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
      { pubkey: ammConfig, isSigner: false, isWritable: true },
    ],
    data,
  });
  
  // Send transaction
  const tx = new Transaction().add(instruction);
  const signature = await connection.sendTransaction(tx, [admin]);
  await connection.confirmTransaction(signature);
  
  console.log("✅ Updated! Transaction:", signature);
  console.log("New pool creation fee: 0.15 SOL");
}

main().catch(console.error);


