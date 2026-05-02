const fs = require("fs");
const path = require("path");
const {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Connection,
  clusterApiUrl,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} = require("@solana/spl-token");

const DEPLOYER_PATH =
  process.env.SOLANA_WALLET ||
  path.join(process.env.HOME, ".config/solana/mainnet-deployer.json");
const OUT_DIR = path.join(
  "/home/ubuntu/raydium-cp-swap",
  "staking-locking",
  "deployments"
);
const LIVE_STAKING_PATH = path.join(OUT_DIR, "devnet-staking-live.json");
const RPC_URL = process.env.SOLANA_URL || clusterApiUrl("devnet");
const LOCKER_PROGRAM_ID = new PublicKey("9mtTTmx6ncn7FKfE9oyeiURctm2fZUN6kPLAbPLoXuvU");

function loadKeypair(filePath) {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function u64Buffer(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function createVestingEscrowIx({
  base,
  escrow,
  escrowToken,
  sender,
  senderToken,
  recipient,
  eventAuthority,
  params,
}) {
  const discriminator = Buffer.from([23, 100, 197, 94, 222, 153, 38, 90]);
  const data = Buffer.concat([
    discriminator,
    u64Buffer(params.vestingStartTime),
    u64Buffer(params.cliffTime),
    u64Buffer(params.frequency),
    u64Buffer(params.cliffUnlockAmount),
    u64Buffer(params.amountPerPeriod),
    u64Buffer(params.numberOfPeriod),
    Buffer.from([params.updateRecipientMode]),
    Buffer.from([params.cancelMode]),
  ]);

  return new TransactionInstruction({
    programId: LOCKER_PROGRAM_ID,
    keys: [
      { pubkey: base, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: escrowToken, isSigner: false, isWritable: true },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: senderToken, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: LOCKER_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

(async () => {
  const payer = loadKeypair(DEPLOYER_PATH);
  const liveStaking = JSON.parse(fs.readFileSync(LIVE_STAKING_PATH, "utf8"));
  const connection = new Connection(RPC_URL, "confirmed");

  const base = Keypair.generate();
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), base.publicKey.toBuffer()],
    LOCKER_PROGRAM_ID
  );
  const stakeMint = new PublicKey(liveStaking.staking_setup.stake_token_mint);
  const senderToken = new PublicKey(liveStaking.staking_setup.stake_token_account);
  const escrowToken = getAssociatedTokenAddressSync(stakeMint, escrowPda, true, TOKEN_PROGRAM_ID);
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    LOCKER_PROGRAM_ID
  );

  const now = Math.floor(Date.now() / 1000);
  const params = {
    vestingStartTime: BigInt(now),
    cliffTime: BigInt(now + 15),
    frequency: 15n,
    cliffUnlockAmount: 10_000_000_000n,
    amountPerPeriod: 5_000_000_000n,
    numberOfPeriod: 8n,
    updateRecipientMode: 3,
    cancelMode: 3,
  };
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      escrowToken,
      escrowPda,
      stakeMint,
      TOKEN_PROGRAM_ID
    ),
    createVestingEscrowIx({
      base: base.publicKey,
      escrow: escrowPda,
      escrowToken,
      sender: payer.publicKey,
      senderToken,
      recipient: payer.publicKey,
      eventAuthority,
      params,
    })
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, base], {
    commitment: "confirmed",
  });

  const output = {
    status: "live",
    network: "devnet",
    rpc_url: RPC_URL,
    deployer_wallet: payer.publicKey.toBase58(),
    locker_program: LOCKER_PROGRAM_ID.toBase58(),
    lock_setup: {
      base: base.publicKey.toBase58(),
      escrow: escrowPda.toBase58(),
      escrow_token: escrowToken.toBase58(),
      token_mint: stakeMint.toBase58(),
      sender_token: senderToken.toBase58(),
      recipient: payer.publicKey.toBase58(),
      vesting_start_time: now,
      cliff_time: now + 15,
      frequency: 15,
      cliff_unlock_amount: "10000000000",
      amount_per_period: "5000000000",
      number_of_period: "8",
      total_locked_amount: "50000000000",
      update_recipient_mode: 3,
      cancel_mode: 3,
    },
    signature,
  };

  const latestPath = path.join(OUT_DIR, "devnet-locker-live.json");
  const timestampedPath = path.join(OUT_DIR, `devnet-locker-live-${Date.now()}.json`);

  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(timestampedPath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify(output, null, 2));
  console.log(`Wrote ${latestPath}`);
  console.log(`Wrote ${timestampedPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
