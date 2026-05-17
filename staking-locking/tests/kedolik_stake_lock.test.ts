import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  createAccount,
  createMint,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { KedolikStakeLock } from "../target/types/kedolik_stake_lock";

describe("kedolik stake lock", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const authority = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.KedolikStakeLock as Program<KedolikStakeLock>;
  const [adminConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    program.programId
  );

  let poolNonce = Date.now();
  const nextPoolId = () => new BN(poolNonce++);
  const toLeBytes = (value: BN) => value.toArrayLike(Buffer, "le", 8);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const expectReject = async (promise: Promise<unknown>, message: string) => {
    let rejected = false;
    try {
      await promise;
    } catch (_err) {
      rejected = true;
    }
    assert.isTrue(rejected, message);
  };

  const derivePoolAccounts = (
    stakeMint: PublicKey,
    rewardMint: PublicKey,
    poolId: BN
  ) => {
    const [pool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("staking_pool"),
        adminConfig.toBuffer(),
        stakeMint.toBuffer(),
        rewardMint.toBuffer(),
        toLeBytes(poolId),
      ],
      program.programId
    );
    const [poolAdmin] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_admin"), pool.toBuffer()],
      program.programId
    );
    const [stakeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake_vault"), pool.toBuffer()],
      program.programId
    );
    const [rewardVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), pool.toBuffer()],
      program.programId
    );

    return { pool, poolAdmin, stakeVault, rewardVault };
  };

  before(async () => {
    await program.methods
      .initializeAdminConfig()
      .accounts({
        authority: authority.publicKey,
        adminConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("restricts staking pool creation to the admin and transfers admin authority", async () => {
    const nextAdmin = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      nextAdmin.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig, "confirmed");

    const stakeMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    const rewardMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    const poolId = nextPoolId();
    const { pool, poolAdmin, stakeVault, rewardVault } = derivePoolAccounts(
      stakeMint,
      rewardMint,
      poolId
    );

    await expectReject(
      program.methods
        .initializeStakingPool(poolId, new BN(1), new BN(3_600))
        .accounts({
          authority: nextAdmin.publicKey,
          adminConfig,
          stakeMint,
          rewardMint,
          pool,
          poolAdmin,
          stakeVault,
          rewardVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nextAdmin])
        .rpc(),
      "non-admin should not create staking pools"
    );

    await program.methods
      .transferAdminAuthority(nextAdmin.publicKey)
      .accounts({
        adminConfig,
        authority: authority.publicKey,
      })
      .rpc();

    const movedConfig = await program.account.adminConfig.fetch(adminConfig);
    assert.equal(movedConfig.authority.toString(), nextAdmin.publicKey.toString());

    await program.methods
      .initializeStakingPool(poolId, new BN(1), new BN(3_600))
      .accounts({
        authority: nextAdmin.publicKey,
        adminConfig,
        stakeMint,
        rewardMint,
        pool,
        poolAdmin,
        stakeVault,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([nextAdmin])
      .rpc();

    const poolAdminAccount = await program.account.stakingPoolAdmin.fetch(poolAdmin);
    assert.equal(poolAdminAccount.creator.toString(), nextAdmin.publicKey.toString());

    await program.methods
      .transferAdminAuthority(authority.publicKey)
      .accounts({
        adminConfig,
        authority: nextAdmin.publicKey,
      })
      .signers([nextAdmin])
      .rpc();
  });

  it("stakes, earns rewards, unstakes, and closes the position", async () => {
    const stakeMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    const rewardMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    const ownerStakeToken = await createAccount(
      provider.connection,
      authority.payer,
      stakeMint,
      authority.publicKey
    );
    const ownerRewardToken = await createAccount(
      provider.connection,
      authority.payer,
      rewardMint,
      authority.publicKey
    );

    await mintTo(
      provider.connection,
      authority.payer,
      stakeMint,
      ownerStakeToken,
      authority.publicKey,
      1_000_000
    );
    await mintTo(
      provider.connection,
      authority.payer,
      rewardMint,
      ownerRewardToken,
      authority.publicKey,
      1_000_000
    );

    const poolId = nextPoolId();
    const { pool, poolAdmin, stakeVault, rewardVault } = derivePoolAccounts(
      stakeMint,
      rewardMint,
      poolId
    );
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), pool.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeStakingPool(poolId, new BN(10), new BN(60))
      .accounts({
        authority: authority.publicKey,
        adminConfig,
        stakeMint,
        rewardMint,
        pool,
        poolAdmin,
        stakeVault,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await program.methods
      .fundRewards(new BN(10_000))
      .accounts({
        funder: authority.publicKey,
        pool,
        funderRewardToken: ownerRewardToken,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await program.methods
      .openPosition()
      .accounts({
        owner: authority.publicKey,
        pool,
        poolAdmin,
        position,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .stake(new BN(1_000))
      .accounts({
        owner: authority.publicKey,
        pool,
        poolAdmin,
        position,
        ownerStakeToken,
        stakeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await sleep(2_200);

    await program.methods
      .setRewardRate(new BN(0))
      .accounts({
        adminConfig,
        pool,
        poolAdmin,
        authority: authority.publicKey,
      })
      .rpc();

    const rewardBefore = await getAccount(provider.connection, ownerRewardToken);
    await program.methods
      .claimRewards()
      .accounts({
        owner: authority.publicKey,
        pool,
        poolAdmin,
        position,
        ownerRewardToken,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const rewardAfter = await getAccount(provider.connection, ownerRewardToken);

    assert.isAbove(
      Number(rewardAfter.amount - rewardBefore.amount),
      0,
      "owner should receive staking rewards"
    );

    await program.methods
      .unstake(new BN(1_000))
      .accounts({
        owner: authority.publicKey,
        pool,
        poolAdmin,
        position,
        ownerStakeToken,
        stakeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const stakeAfter = await getAccount(provider.connection, ownerStakeToken);
    assert.equal(stakeAfter.amount.toString(), "1000000");

    await program.methods
      .closePosition()
      .accounts({
        owner: authority.publicKey,
        pool,
        position,
      })
      .rpc();

    const closedPosition = await provider.connection.getAccountInfo(position);
    assert.isNull(closedPosition);
  });

  it("lets only the pool creator reclaim leftover rewards after expiry", async () => {
    const attacker = Keypair.generate();
    const stakeMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    const rewardMint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    const adminRewardToken = await createAccount(
      provider.connection,
      authority.payer,
      rewardMint,
      authority.publicKey
    );
    const attackerRewardToken = await createAccount(
      provider.connection,
      authority.payer,
      rewardMint,
      attacker.publicKey
    );

    await mintTo(
      provider.connection,
      authority.payer,
      rewardMint,
      adminRewardToken,
      authority.publicKey,
      10_000
    );

    const poolId = nextPoolId();
    const { pool, poolAdmin, stakeVault, rewardVault } = derivePoolAccounts(
      stakeMint,
      rewardMint,
      poolId
    );

    await program.methods
      .initializeStakingPool(poolId, new BN(10), new BN(2))
      .accounts({
        authority: authority.publicKey,
        adminConfig,
        stakeMint,
        rewardMint,
        pool,
        poolAdmin,
        stakeVault,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    await program.methods
      .fundRewards(new BN(1_000))
      .accounts({
        funder: authority.publicKey,
        pool,
        funderRewardToken: adminRewardToken,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await sleep(2_500);

    await expectReject(
      program.methods
        .reclaimUnclaimedRewards()
        .accounts({
          authority: attacker.publicKey,
          pool,
          poolAdmin,
          rewardVault,
          adminRewardToken: attackerRewardToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc(),
      "non-creator should not reclaim rewards"
    );

    const adminBefore = await getAccount(provider.connection, adminRewardToken);
    await program.methods
      .reclaimUnclaimedRewards()
      .accounts({
        authority: authority.publicKey,
        pool,
        poolAdmin,
        rewardVault,
        adminRewardToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const adminAfter = await getAccount(provider.connection, adminRewardToken);
    const vaultAfter = await getAccount(provider.connection, rewardVault);

    assert.equal((adminAfter.amount - adminBefore.amount).toString(), "1000");
    assert.equal(vaultAfter.amount.toString(), "0");
  });

  it("locks tokens, blocks early unlock, and unlocks after expiry", async () => {
    const mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    const ownerToken = await createAccount(
      provider.connection,
      authority.payer,
      mint,
      authority.publicKey
    );

    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      ownerToken,
      authority.publicKey,
      10_000
    );

    const lockId = nextPoolId();
    const [tokenLock] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("lock"),
        authority.publicKey.toBuffer(),
        mint.toBuffer(),
        toLeBytes(lockId),
      ],
      program.programId
    );
    const [lockVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("lock_vault"), tokenLock.toBuffer()],
      program.programId
    );

    const unlockTs = new BN(Math.floor(Date.now() / 1000) + 3);

    await program.methods
      .createLock(lockId, new BN(2_500), unlockTs)
      .accounts({
        owner: authority.publicKey,
        mint,
        tokenLock,
        lockVault,
        ownerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const lockedBalance = await getAccount(provider.connection, lockVault);
    assert.equal(lockedBalance.amount.toString(), "2500");

    await expectReject(
      program.methods
        .unlock()
        .accounts({
          owner: authority.publicKey,
          mint,
          tokenLock,
          vault: lockVault,
          ownerToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "early unlock should fail"
    );

    await sleep(3_500);

    await program.methods
      .unlock()
      .accounts({
        owner: authority.publicKey,
        mint,
        tokenLock,
        vault: lockVault,
        ownerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const ownerAfterUnlock = await getAccount(provider.connection, ownerToken);
    assert.equal(ownerAfterUnlock.amount.toString(), "10000");

    const closedLock = await provider.connection.getAccountInfo(tokenLock);
    const closedVault = await provider.connection.getAccountInfo(lockVault);
    assert.isNull(closedLock);
    assert.isNull(closedVault);
  });
});
