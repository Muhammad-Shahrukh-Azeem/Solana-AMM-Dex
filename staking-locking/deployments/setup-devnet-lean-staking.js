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
const ROOT_DIR = path.resolve(__dirname, "..");
const IDL_PATH = path.join(ROOT_DIR, "target", "idl", "kedolik_stake_lock.json");
const DEFAULT_WALLET = "~/.config/solana/mainnet-deployer.json";

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

async function main() {
  const clusterUrl = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const walletPath = process.env.ANCHOR_WALLET || DEFAULT_WALLET;
  const admin = loadKeypair(walletPath);
  const connection = new anchor.web3.Connection(clusterUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new anchor.Program(idl, provider);

  const tokenMint = process.env.TOKEN_MINT;
  const stakeMint = new PublicKey(requireEnv("STAKE_MINT", tokenMint));
  const rewardMint = new PublicKey(requireEnv("REWARD_MINT", tokenMint || stakeMint.toString()));
  const rewardMintInfo = await getMint(connection, rewardMint);

  const rewardAmountRaw = process.env.REWARD_AMOUNT_RAW
    ? BigInt(process.env.REWARD_AMOUNT_RAW)
    : parseUiAmount(requireEnv("REWARD_AMOUNT"), rewardMintInfo.decimals);
  const rewardDurationSeconds = BigInt(requireEnv("REWARD_DURATION_SECONDS"));
  const rewardRatePerSecond = process.env.REWARD_RATE_PER_SECOND
    ? BigInt(process.env.REWARD_RATE_PER_SECOND)
    : rewardAmountRaw / rewardDurationSeconds;

  if (rewardAmountRaw <= 0n) {
    throw new Error("REWARD_AMOUNT or REWARD_AMOUNT_RAW must be greater than zero");
  }
  if (rewardDurationSeconds <= 0n) {
    throw new Error("REWARD_DURATION_SECONDS must be greater than zero");
  }
  if (rewardRatePerSecond <= 0n) {
    throw new Error("Reward rate rounded to zero. Increase reward amount or duration precision.");
  }

  const poolId = BigInt(process.env.POOL_ID || Date.now().toString());
  const [adminConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    PROGRAM_ID
  );
  const [pool] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("staking_pool"),
      adminConfig.toBuffer(),
      stakeMint.toBuffer(),
      rewardMint.toBuffer(),
      u64Le(poolId),
    ],
    PROGRAM_ID
  );
  const [stakeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), pool.toBuffer()],
    PROGRAM_ID
  );
  const [rewardVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("reward_vault"), pool.toBuffer()],
    PROGRAM_ID
  );

  console.log("Cluster:", clusterUrl);
  console.log("Admin:", admin.publicKey.toString());
  console.log("Program:", PROGRAM_ID.toString());
  console.log("Admin config:", adminConfig.toString());
  console.log("Pool id:", poolId.toString());
  console.log("Pool:", pool.toString());

  const adminConfigInfo = await connection.getAccountInfo(adminConfig);
  if (!adminConfigInfo) {
    console.log("Initializing admin config...");
    await program.methods
      .initializeAdminConfig()
      .accounts({
        authority: admin.publicKey,
        adminConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    const config = await program.account.adminConfig.fetch(adminConfig);
    if (!config.authority.equals(admin.publicKey)) {
      throw new Error(
        `Wallet is not staking admin. Current admin is ${config.authority.toString()}`
      );
    }
  }

  const poolInfo = await connection.getAccountInfo(pool);
  if (!poolInfo) {
    console.log("Creating staking pool...");
    await program.methods
      .initializeStakingPool(
        new anchor.BN(poolId.toString()),
        new anchor.BN(rewardRatePerSecond.toString())
      )
      .accounts({
        authority: admin.publicKey,
        adminConfig,
        stakeMint,
        rewardMint,
        pool,
        stakeVault,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  } else {
    console.log("Pool already exists, skipping create.");
  }

  if (process.env.FUND_REWARDS !== "false") {
    console.log("Funding reward vault...");
    const adminRewardToken = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      rewardMint,
      admin.publicKey
    );
    const rewardAccount = await getAccount(connection, adminRewardToken.address);
    if (rewardAccount.amount < rewardAmountRaw) {
      throw new Error(
        `Admin reward account has ${rewardAccount.amount.toString()} raw tokens, needs ${rewardAmountRaw.toString()}`
      );
    }
    await program.methods
      .fundRewards(new anchor.BN(rewardAmountRaw.toString()))
      .accounts({
        funder: admin.publicKey,
        pool,
        funderRewardToken: adminRewardToken.address,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  const output = {
    cluster: clusterUrl,
    programId: PROGRAM_ID.toString(),
    admin: admin.publicKey.toString(),
    adminConfig: adminConfig.toString(),
    poolId: poolId.toString(),
    stakeMint: stakeMint.toString(),
    rewardMint: rewardMint.toString(),
    pool: pool.toString(),
    stakeVault: stakeVault.toString(),
    rewardVault: rewardVault.toString(),
    rewardAmountRaw: rewardAmountRaw.toString(),
    rewardDurationSeconds: rewardDurationSeconds.toString(),
    rewardRatePerSecond: rewardRatePerSecond.toString(),
  };

  const outPath = path.join(__dirname, `devnet-lean-staking-${poolId.toString()}.json`);
  const latestPath = path.join(__dirname, "devnet-lean-staking-latest.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
