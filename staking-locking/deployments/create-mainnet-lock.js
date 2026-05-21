#!/usr/bin/env node

const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} = require("@solana/web3.js");
const {
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const PROGRAM_ID = new PublicKey("6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW");
const MAIN_TOKEN_MINT = "FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN";
const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const ROOT_DIR = path.resolve(__dirname, "..");
const IDL_PATH = process.env.IDL_PATH || path.join(ROOT_DIR, "target", "idl", "kedolik_stake_lock.json");
const DEFAULT_WALLET = "~/.config/solana/mainnet-deployer.json";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

function expandHome(filePath) {
  if (!filePath.startsWith("~")) {
    return filePath;
  }
  return path.join(os.homedir(), filePath.slice(1));
}

function loadKeypair(filePath) {
  const raw = JSON.parse(fs.readFileSync(expandHome(filePath), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function u64Le(value) {
  return new anchor.BN(value.toString()).toArrayLike(Buffer, "le", 8);
}

function parseUiAmount(value, decimals) {
  const [whole, fraction = ""] = value.trim().split(".");
  const padded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

async function assertMainnet(connection) {
  const genesisHash = await connection.getGenesisHash();
  if (genesisHash !== MAINNET_GENESIS_HASH) {
    throw new Error(`Refusing to run: RPC is not mainnet-beta. Genesis hash: ${genesisHash}`);
  }
}

async function assertLegacyMint(connection, mint) {
  const accountInfo = await connection.getAccountInfo(mint);
  if (!accountInfo) {
    throw new Error(`Mint does not exist: ${mint.toString()}`);
  }
  if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error(`Mint is not a standard SPL Token mint. Owner: ${accountInfo.owner.toString()}`);
  }
  if (accountInfo.data.length !== 82) {
    throw new Error(`Mint has unexpected size ${accountInfo.data.length}; expected 82.`);
  }
}

async function main() {
  if (process.env.CONFIRM_MAINNET_LOCK !== "YES") {
    throw new Error("Set CONFIRM_MAINNET_LOCK=YES to create a mainnet token lock.");
  }

  const clusterUrl = process.env.ANCHOR_PROVIDER_URL || process.env.SOLANA_URL || DEFAULT_RPC;
  const walletPath = process.env.ANCHOR_WALLET || process.env.SOLANA_WALLET || DEFAULT_WALLET;
  const owner = loadKeypair(walletPath);
  const connection = new anchor.web3.Connection(clusterUrl, "confirmed");
  await assertMainnet(connection);

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);

  const mint = new PublicKey(requireEnv("TOKEN_MINT", MAIN_TOKEN_MINT));
  await assertLegacyMint(connection, mint);
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  const amountRaw = process.env.AMOUNT_RAW
    ? BigInt(process.env.AMOUNT_RAW)
    : parseUiAmount(requireEnv("AMOUNT"), mintInfo.decimals);
  const unlockTs = BigInt(requireEnv("UNLOCK_TS"));
  const lockId = BigInt(process.env.LOCK_ID || Date.now().toString());

  if (amountRaw <= 0n) {
    throw new Error("AMOUNT or AMOUNT_RAW must be greater than zero");
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (unlockTs <= now) {
    throw new Error(`UNLOCK_TS must be in the future. Now: ${now.toString()}`);
  }

  const ownerToken = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    owner.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_PROGRAM_ID
  );
  const ownerAccount = await getAccount(
    connection,
    ownerToken.address,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  if (ownerAccount.amount < amountRaw) {
    throw new Error(
      `Owner token account has ${ownerAccount.amount.toString()} raw tokens, needs ${amountRaw.toString()}`
    );
  }

  const [tokenLock] = PublicKey.findProgramAddressSync(
    [Buffer.from("lock"), owner.publicKey.toBuffer(), mint.toBuffer(), u64Le(lockId)],
    PROGRAM_ID
  );
  const [lockVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("lock_vault"), tokenLock.toBuffer()],
    PROGRAM_ID
  );

  const signature = await program.methods
    .createLock(
      new anchor.BN(lockId.toString()),
      new anchor.BN(amountRaw.toString()),
      new anchor.BN(unlockTs.toString())
    )
    .accounts({
      owner: owner.publicKey,
      mint,
      tokenLock,
      lockVault,
      ownerToken: ownerToken.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  const output = {
    cluster: clusterUrl,
    programId: PROGRAM_ID.toString(),
    owner: owner.publicKey.toString(),
    mint: mint.toString(),
    ownerToken: ownerToken.address.toString(),
    lockId: lockId.toString(),
    tokenLock: tokenLock.toString(),
    lockVault: lockVault.toString(),
    amountRaw: amountRaw.toString(),
    unlockTs: unlockTs.toString(),
    signature,
  };

  const outPath = path.join(__dirname, `mainnet-lock-${lockId.toString()}.json`);
  const latestPath = path.join(__dirname, "mainnet-lock-latest.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
  console.log(`Wrote ${latestPath}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
