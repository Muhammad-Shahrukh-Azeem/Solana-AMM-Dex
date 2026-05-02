const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ACCOUNT_SIZE,
  createInitializeMintInstruction,
  createInitializeAccountInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction,
} = require("@solana/spl-token");

const DEPLOYER_PATH =
  process.env.SOLANA_WALLET ||
  path.join(process.env.HOME, ".config/solana/mainnet-deployer.json");
const OUT_DIR = path.join(
  "/home/ubuntu/raydium-cp-swap",
  "staking-locking",
  "deployments"
);
const RPC_URL = process.env.SOLANA_URL || clusterApiUrl("devnet");

const PROGRAM_IDS = {
  mintWrapper: new PublicKey("EzMFbFNvJMFmts6LchtweBq1VKTsfpDpJknGu4kLiH85"),
  staking: new PublicKey("3dAuLSedbDtzha2uV7K8Mf63ottPCYyMJwRuvouiZ85J"),
  locker: new PublicKey("9mtTTmx6ncn7FKfE9oyeiURctm2fZUN6kPLAbPLoXuvU"),
};

const DECIMALS = 9;
const ONE = 10n ** 9n;
const STAKE_MINT_AMOUNT = 1_000_000n * ONE;
const SEEDED_STAKE_AMOUNT = 100n * ONE;
const ANNUAL_REWARDS_RATE = 3_153_600n * ONE; // 0.1 token/sec ~= 3,153,600 tokens/year
const REWARD_ALLOWANCE = 100_000_000n * ONE;
const REWARD_HARD_CAP = 1_000_000_000n * ONE;
const REWARDS_SHARE = 1n;

function loadKeypair(filePath) {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function discriminator(name) {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64Buffer(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function ix(programId, method, keys, ...argBuffers) {
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.concat([discriminator(method), ...argBuffers]),
  });
}

async function send(label, payer, connection, instructions, extraSigners = []) {
  const tx = new Transaction().add(...instructions);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, ...extraSigners], {
    commitment: "confirmed",
  });
  console.log(`${label}: ${signature}`);
  return signature;
}

async function maybeCreateAta(connection, payer, mint, owner) {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
  const existing = await connection.getAccountInfo(ata);
  if (!existing) {
    await send("create ATA", payer, connection, [
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        TOKEN_PROGRAM_ID
      ),
    ]);
  }
  return ata;
}

function pubkeyString(v) {
  return v.toBase58();
}

function keyMeta(pubkey, isSigner, isWritable) {
  return { pubkey, isSigner, isWritable };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const connection = new Connection(RPC_URL, "confirmed");
  const payer = loadKeypair(DEPLOYER_PATH);

  console.log(`RPC: ${RPC_URL}`);
  console.log(`Deployer: ${payer.publicKey.toBase58()}`);

  const mintWrapperBase = Keypair.generate();
  const rewarderBase = Keypair.generate();
  const rewardMint = Keypair.generate();
  const stakeMint = Keypair.generate();
  const claimFeeAccount = Keypair.generate();
  const minerVault = Keypair.generate();

  const [mintWrapperPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("MintWrapper"), mintWrapperBase.publicKey.toBuffer()],
    PROGRAM_IDS.mintWrapper
  );
  const [rewarderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("Rewarder"), rewarderBase.publicKey.toBuffer()],
    PROGRAM_IDS.staking
  );
  const [minterPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("MintWrapperMinter"),
      mintWrapperPda.toBuffer(),
      rewarderPda.toBuffer(),
    ],
    PROGRAM_IDS.mintWrapper
  );
  const [quarryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("Quarry"), rewarderPda.toBuffer(), stakeMint.publicKey.toBuffer()],
    PROGRAM_IDS.staking
  );
  const [minerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("Miner"), quarryPda.toBuffer(), payer.publicKey.toBuffer()],
    PROGRAM_IDS.staking
  );

  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const tokenRent = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

  const signatures = {};

  signatures.createRewardMint = await send(
    "create reward mint",
    payer,
    connection,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: rewardMint.publicKey,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        rewardMint.publicKey,
        DECIMALS,
        mintWrapperPda,
        mintWrapperPda,
        TOKEN_PROGRAM_ID
      ),
    ],
    [rewardMint]
  );

  signatures.newWrapper = await send(
    "new mint wrapper",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.mintWrapper,
        "new_wrapper_v2",
        [
          keyMeta(mintWrapperBase.publicKey, true, false),
          keyMeta(mintWrapperPda, false, true),
          keyMeta(payer.publicKey, false, false),
          keyMeta(rewardMint.publicKey, false, false),
          keyMeta(TOKEN_PROGRAM_ID, false, false),
          keyMeta(payer.publicKey, true, true),
          keyMeta(SystemProgram.programId, false, false),
        ],
        u64Buffer(REWARD_HARD_CAP)
      ),
    ],
    [mintWrapperBase]
  );

  const rewardTokenAta = await maybeCreateAta(
    connection,
    payer,
    rewardMint.publicKey,
    payer.publicKey
  );

  signatures.createClaimFeeAccount = await send(
    "create claim fee token account",
    payer,
    connection,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: claimFeeAccount.publicKey,
        lamports: tokenRent,
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        claimFeeAccount.publicKey,
        rewardMint.publicKey,
        rewarderPda,
        TOKEN_PROGRAM_ID
      ),
    ],
    [claimFeeAccount]
  );

  signatures.newRewarder = await send(
    "new rewarder",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "new_rewarder_v2",
        [
          keyMeta(rewarderBase.publicKey, true, false),
          keyMeta(rewarderPda, false, true),
          keyMeta(payer.publicKey, false, false),
          keyMeta(payer.publicKey, true, true),
          keyMeta(SystemProgram.programId, false, false),
          keyMeta(mintWrapperPda, false, false),
          keyMeta(rewardMint.publicKey, false, false),
          keyMeta(claimFeeAccount.publicKey, false, false),
        ]
      ),
    ],
    [rewarderBase]
  );

  signatures.newMinter = await send(
    "new minter",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.mintWrapper,
        "new_minter_v2",
        [
          keyMeta(mintWrapperPda, false, true),
          keyMeta(payer.publicKey, true, false),
          keyMeta(rewarderPda, false, false),
          keyMeta(minterPda, false, true),
          keyMeta(payer.publicKey, true, true),
          keyMeta(SystemProgram.programId, false, false),
        ]
      ),
    ]
  );

  signatures.minterUpdate = await send(
    "set minter allowance",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.mintWrapper,
        "minter_update",
        [
          keyMeta(mintWrapperPda, false, true),
          keyMeta(payer.publicKey, true, false),
          keyMeta(minterPda, false, true),
        ],
        u64Buffer(REWARD_ALLOWANCE)
      ),
    ]
  );

  signatures.createStakeMint = await send(
    "create stake mint",
    payer,
    connection,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: stakeMint.publicKey,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        stakeMint.publicKey,
        DECIMALS,
        payer.publicKey,
        payer.publicKey,
        TOKEN_PROGRAM_ID
      ),
    ],
    [stakeMint]
  );

  const stakeTokenAta = await maybeCreateAta(
    connection,
    payer,
    stakeMint.publicKey,
    payer.publicKey
  );

  signatures.mintStakeTokens = await send(
    "mint stake tokens to deployer",
    payer,
    connection,
    [
      createMintToInstruction(
        stakeMint.publicKey,
        stakeTokenAta,
        payer.publicKey,
        BigInt(STAKE_MINT_AMOUNT),
        [],
        TOKEN_PROGRAM_ID
      ),
    ]
  );

  signatures.createQuarry = await send(
    "create quarry",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "create_quarry_v2",
        [
          keyMeta(quarryPda, false, true),
          keyMeta(payer.publicKey, true, false),
          keyMeta(rewarderPda, false, true),
          keyMeta(stakeMint.publicKey, false, false),
          keyMeta(payer.publicKey, true, true),
          keyMeta(SystemProgram.programId, false, false),
        ]
      ),
    ]
  );

  signatures.setAnnualRewards = await send(
    "set annual rewards",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "set_annual_rewards",
        [
          keyMeta(payer.publicKey, true, false),
          keyMeta(rewarderPda, false, true),
        ],
        u64Buffer(ANNUAL_REWARDS_RATE)
      ),
    ]
  );

  signatures.setRewardsShare = await send(
    "set rewards share",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "set_rewards_share",
        [
          keyMeta(payer.publicKey, true, false),
          keyMeta(rewarderPda, false, true),
          keyMeta(quarryPda, false, true),
        ],
        u64Buffer(REWARDS_SHARE)
      ),
    ]
  );

  signatures.updateQuarryRewards = await send(
    "update quarry rewards",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "update_quarry_rewards",
        [
          keyMeta(quarryPda, false, true),
          keyMeta(rewarderPda, false, false),
        ]
      ),
    ]
  );

  signatures.createMinerVault = await send(
    "create miner vault",
    payer,
    connection,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: minerVault.publicKey,
        lamports: tokenRent,
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        minerVault.publicKey,
        stakeMint.publicKey,
        minerPda,
        TOKEN_PROGRAM_ID
      ),
    ],
    [minerVault]
  );

  signatures.createMiner = await send(
    "create miner",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "create_miner_v2",
        [
          keyMeta(payer.publicKey, true, false),
          keyMeta(minerPda, false, true),
          keyMeta(quarryPda, false, true),
          keyMeta(rewarderPda, false, false),
          keyMeta(SystemProgram.programId, false, false),
          keyMeta(payer.publicKey, true, true),
          keyMeta(stakeMint.publicKey, false, false),
          keyMeta(minerVault.publicKey, false, false),
          keyMeta(TOKEN_PROGRAM_ID, false, false),
        ]
      ),
    ]
  );

  signatures.stakeTokens = await send(
    "seed stake position",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "stake_tokens",
        [
          keyMeta(payer.publicKey, true, false),
          keyMeta(minerPda, false, true),
          keyMeta(quarryPda, false, true),
          keyMeta(minerVault.publicKey, false, true),
          keyMeta(stakeTokenAta, false, true),
          keyMeta(TOKEN_PROGRAM_ID, false, false),
          keyMeta(rewarderPda, false, false),
        ],
        u64Buffer(SEEDED_STAKE_AMOUNT)
      ),
    ]
  );

  console.log("Waiting 3 seconds so rewards accrue...");
  await sleep(3000);

  signatures.claimRewards = await send(
    "claim rewards",
    payer,
    connection,
    [
      ix(
        PROGRAM_IDS.staking,
        "claim_rewards_v2",
        [
          keyMeta(mintWrapperPda, false, true),
          keyMeta(PROGRAM_IDS.mintWrapper, false, false),
          keyMeta(minterPda, false, true),
          keyMeta(rewardMint.publicKey, false, true),
          keyMeta(rewardTokenAta, false, true),
          keyMeta(claimFeeAccount.publicKey, false, true),
          keyMeta(payer.publicKey, true, false),
          keyMeta(minerPda, false, true),
          keyMeta(quarryPda, false, true),
          keyMeta(TOKEN_PROGRAM_ID, false, false),
          keyMeta(rewarderPda, false, false),
        ]
      ),
    ]
  );

  const walletStakeBalance = await connection.getTokenAccountBalance(stakeTokenAta);
  const walletRewardBalance = await connection.getTokenAccountBalance(rewardTokenAta);
  const claimFeeBalance = await connection.getTokenAccountBalance(claimFeeAccount.publicKey);

  const output = {
    status: "live",
    network: "devnet",
    rpc_url: RPC_URL,
    deployer_wallet: pubkeyString(payer.publicKey),
    programs: {
      kedolik_mint_wrapper: pubkeyString(PROGRAM_IDS.mintWrapper),
      kedolik_staking: pubkeyString(PROGRAM_IDS.staking),
      kedolik_locker: pubkeyString(PROGRAM_IDS.locker),
    },
    staking_setup: {
      mint_wrapper_base: pubkeyString(mintWrapperBase.publicKey),
      mint_wrapper: pubkeyString(mintWrapperPda),
      rewarder_base: pubkeyString(rewarderBase.publicKey),
      rewarder: pubkeyString(rewarderPda),
      minter: pubkeyString(minterPda),
      quarry: pubkeyString(quarryPda),
      miner: pubkeyString(minerPda),
      miner_vault: pubkeyString(minerVault.publicKey),
      reward_token_mint: pubkeyString(rewardMint.publicKey),
      reward_token_account: pubkeyString(rewardTokenAta),
      claim_fee_token_account: pubkeyString(claimFeeAccount.publicKey),
      stake_token_mint: pubkeyString(stakeMint.publicKey),
      stake_token_account: pubkeyString(stakeTokenAta),
      annual_rewards_rate: ANNUAL_REWARDS_RATE.toString(),
      rewards_share: REWARDS_SHARE.toString(),
      seeded_stake_amount: SEEDED_STAKE_AMOUNT.toString(),
    },
    balances: {
      wallet_stake_token_account_amount: walletStakeBalance.value.amount,
      wallet_reward_token_account_amount: walletRewardBalance.value.amount,
      claim_fee_token_account_amount: claimFeeBalance.value.amount,
    },
    signatures,
  };

  const latestPath = path.join(OUT_DIR, "devnet-staking-live.json");
  const timestampedPath = path.join(
    OUT_DIR,
    `devnet-staking-live-${Date.now()}.json`
  );

  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(timestampedPath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify(output, null, 2));
  console.log(`Wrote ${latestPath}`);
  console.log(`Wrote ${timestampedPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
