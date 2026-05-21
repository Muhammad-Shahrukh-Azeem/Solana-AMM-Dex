# Kedolik Stake Lock V1 Frontend Integration

## Devnet Addresses

- Program ID: `6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW`
- ProgramData: `9YB6N5m85wC2rGLaAmzXEEUbJ1stL7daTBrjzvePfefr`
- Upgrade authority: `68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot`
- Admin config PDA: `6zJinApyxvq5FK84oQjvuwj4i1xnoLNbD28WEmmyDQPR`
- Current staking admin: `68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot`
- IDL: `staking-locking/target/idl/kedolik_stake_lock.json`
- Frontend config export: `staking-locking/deployments/frontend-stake-lock-v1-devnet.ts`

The first devnet staking pool instance is listed below. The admin panel can create additional staking instances by calling `initializeStakingPool` directly, or the admin can run `setup-devnet-lean-staking.js` once per staking instance.

## Live Devnet Staking Instance

### 0.5 Token Per Second Pool

This staking pool has been created and funded:

- Label: `devnet-0.5-token-per-second-staking`
- Pool ID: `1777925778090`
- Pool: `7UX7n95Ga4pk6U6Gg3eCztXCvrE2ADmVqP2DTf1hFh77`
- Stake mint: `3uSQheD8cTnWQxzBn334PMQJHHYUHs6ReYube7gAGiSX`
- Reward mint: `3uSQheD8cTnWQxzBn334PMQJHHYUHs6ReYube7gAGiSX`
- Stake vault: `337VMUg8rAhMF5Yw9atffsK7uCmq7Ep4duiLTHnGkZ4Z`
- Reward vault: `9hsApn46BAwerVAnBNFs974yYqFWTeJjzYEczb6mjYce`
- Reward funded: `43200000000000` raw = `43200` UI tokens
- Reward duration: `86400` seconds
- Reward rate per second: `500000000` raw = `0.5` UI token/sec
- Create pool tx: `ZBsjasxfKf4tSUf4z2n5whCwVRmr2pn55WFMMYGRUogpxmRpXtsMTf7sVeuoc3H4ecuTAoaxybTLk42yQSeYZqY`
- Fund rewards tx: `3v21rYuUq9dK2cJNKRBURzbq77vcErKsvyxCg9K28Tv8nMVicXGdfMogGK4RvbNEkirczn6yVz4kK9JGAA7NqS6F`

Current decoded pool state shows `totalStaked = 12000000000` raw = `12` UI stake tokens.

### Original Test Pool

This earlier staking pool has also been created and funded:

- Label: `devnet-test-staking`
- Pool ID: `1777923694977`
- Pool: `HXL4Z5EFpzQzQ1FGrWqrpfiJeDUewETfeg1vuZDEK9J1`
- Stake mint: `3uSQheD8cTnWQxzBn334PMQJHHYUHs6ReYube7gAGiSX`
- Reward mint: `ACEkFGhT9C1ypsZR2nyrvLGMsZ1288CFckujMMpjwZNv`
- Stake vault: `9GRiwYsNjHccVGWX4TfWphhSXoVxaSZStCQqhdMKHn44`
- Reward vault: `FxHQ8RcCNroyHbvMiCETXLNLpC1qvP2Qxa8fJkD7HDtg`
- Reward funded: `100000000` raw = `0.1` UI token
- Reward duration: `2592000` seconds
- Reward rate per second: `38` raw units
- Create pool tx: `5y4rer9zr62CLE3MYKLpYEfgy1LRMnEG3MUUqmC2URebYqtFundec8uxvBsSeYEcxDkGosjJ9nsiRCz2iY7kUXT1`
- Fund rewards tx: `5Uwvtn7kxR2xarNVzAL3V5K6TvLfNYNQHRA2ZBE4TUkA1u92v1LWHaUgmw8owxnMeaiAFzYHAP2b8Qgnorrt9rNS`

Current decoded pool state shows `totalStaked = 10000000000` raw = `10` UI stake tokens.

## Replaced Legacy Devnet Programs

- Old staking program: `3dAuLSedbDtzha2uV7K8Mf63ottPCYyMJwRuvouiZ85J`
- Old mint wrapper program: `EzMFbFNvJMFmts6LchtweBq1VKTsfpDpJknGu4kLiH85`
- Old locking program: `9mtTTmx6ncn7FKfE9oyeiURctm2fZUN6kPLAbPLoXuvU`
- New combined program: `6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW`

## PDA Seeds

- Admin config PDA seeds: `["admin_config"]`
- Staking pool PDA seeds: `["staking_pool", adminConfig, stakeMint, rewardMint, poolIdLeU64]`
- Stake vault PDA seeds: `["stake_vault", pool]`
- Reward vault PDA seeds: `["reward_vault", pool]`
- User stake position PDA seeds: `["position", pool, user]`
- Token lock PDA seeds: `["lock", owner, mint, lockIdLeU64]`
- Lock vault PDA seeds: `["lock_vault", tokenLock]`

`poolId` and `lockId` are unsigned 64-bit integers encoded little-endian.

## Admin Methods

- `initializeAdminConfig()`: one-time admin config creation.
- `transferAdminAuthority(newAuthority)`: current admin transfers staking admin rights.
- `initializeStakingPool(poolId, rewardRatePerSecond)`: current admin creates a staking pool.
- `setRewardRate(rewardRatePerSecond)`: current admin updates emissions.
- `fundRewards(amount)`: transfers reward tokens from the funder token account into the pool reward vault.

## User Methods

- `openPosition()`: creates the user's stake position for a pool.
- `stake(amount)`: transfers stake tokens into the pool vault.
- `claimRewards()`: claims accrued reward tokens.
- `unstake(amount)`: withdraws staked tokens.
- `closePosition()`: closes an empty position and returns rent.
- `createLock(lockId, amount, unlockTs)`: locks tokens until a unix timestamp.
- `unlock()`: unlocks after `unlockTs`, closes the lock vault, and returns rent.

## Admin Panel Flow

1. Load `adminConfig` and fetch `program.account.adminConfig`.
2. Check `adminConfig.authority` against the connected wallet.
3. Only show staking-instance creation controls when the connected wallet equals the current staking admin.
4. Admin enters:
   - stake mint
   - reward mint
   - pool id
   - reward amount or reward rate
   - reward duration
5. Derive `pool`, `stakeVault`, and `rewardVault`.
6. Send `initializeStakingPool(poolId, rewardRatePerSecond)`.
7. Ensure the admin has a reward token account.
8. Send `fundRewards(amount)` to move reward tokens into the reward vault.
9. Store the created pool address and pool id in the website config/database.

Users never need admin rights. They only need the selected `pool`, their token accounts, and the user methods listed above.

## Setup Script

Create and fund a devnet staking pool:

```bash
TOKEN_MINT=<mint> \
REWARD_AMOUNT=<ui_amount> \
REWARD_DURATION_SECONDS=<seconds> \
node staking-locking/deployments/setup-devnet-lean-staking.js
```

For different staking and reward tokens:

```bash
STAKE_MINT=<stake_mint> \
REWARD_MINT=<reward_mint> \
REWARD_AMOUNT=<ui_amount> \
REWARD_DURATION_SECONDS=<seconds> \
node staking-locking/deployments/setup-devnet-lean-staking.js
```

Transfer admin authority:

```bash
NEW_AUTHORITY=<wallet> node staking-locking/deployments/transfer-devnet-staking-admin.js
```

Initialize the admin config without creating a pool:

```bash
node staking-locking/deployments/initialize-devnet-staking-admin.js
```

The setup script writes the latest pool config here:

```text
staking-locking/deployments/devnet-lean-staking-latest.json
```

## Frontend Migration Prompt

```text
Update the frontend staking and locking integration from the old Kedolik Quarry/Jupiter-derived contracts to the new combined Anchor program.

Use devnet program ID 6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW and IDL staking-locking/target/idl/kedolik_stake_lock.json.

Remove dependencies on the old staking program 3dAuLSedbDtzha2uV7K8Mf63ottPCYyMJwRuvouiZ85J, old mint-wrapper program EzMFbFNvJMFmts6LchtweBq1VKTsfpDpJknGu4kLiH85, and old locking program 9mtTTmx6ncn7FKfE9oyeiURctm2fZUN6kPLAbPLoXuvU.

Add an admin staking-instance page. Load the admin config PDA 6zJinApyxvq5FK84oQjvuwj4i1xnoLNbD28WEmmyDQPR and only show create/update staking controls if the connected wallet equals adminConfig.authority. The current devnet admin is 68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot.

Admin create staking flow:
1. Collect stakeMint, rewardMint, poolId, reward amount, and reward duration.
2. Compute rewardRatePerSecond = rewardAmountRaw / rewardDurationSeconds.
3. Derive pool with seeds ["staking_pool", adminConfig, stakeMint, rewardMint, poolIdLeU64].
4. Derive stakeVault with seeds ["stake_vault", pool].
5. Derive rewardVault with seeds ["reward_vault", pool].
6. Call initializeStakingPool(poolId, rewardRatePerSecond) with authority, adminConfig, stakeMint, rewardMint, pool, stakeVault, rewardVault, tokenProgram, systemProgram, and rent.
7. Call fundRewards(amount) with funder, pool, funderRewardToken, rewardVault, and tokenProgram.
8. Save pool, poolId, stakeMint, rewardMint, stakeVault, rewardVault, and rewardRatePerSecond.

Admin transfer flow:
Call transferAdminAuthority(newAuthority) from the current admin wallet. After success, refetch adminConfig and require the new wallet for admin actions.

User staking flow:
1. Derive position with seeds ["position", pool, userWallet].
2. If missing, call openPosition().
3. Call stake(amount) to stake.
4. Call claimRewards() to claim.
5. Call unstake(amount) to unstake.
6. Call closePosition() only when amount and rewards owed are zero.

User locking flow:
1. Collect mint, amount, lockId, unlockTs.
2. Derive tokenLock with seeds ["lock", ownerWallet, mint, lockIdLeU64].
3. Derive lockVault with seeds ["lock_vault", tokenLock].
4. Call createLock(lockId, amount, unlockTs).
5. After unlockTs, call unlock(); this returns tokens and closes lock accounts.
```

## Deployment Size And Cost Reduction

| Deployment item | Old size bytes | Old deploy cost SOL | New size bytes | New/current cost SOL | Savings |
|---|---:|---:|---:|---:|---:|
| Staking program | 606,584 | 4.22719016 | included below | included below | replaced |
| Mint wrapper program | 304,736 | 2.12483808 | removed | 0 | 2.12483808 SOL |
| Locking program | 579,216 | 4.03657388 | included below | included below | replaced |
| Old combined deploy-only | 1,490,536 | 10.38860212 | 387,752 | 2.70603068 actual devnet spend | 7.68257144 SOL |
| Old all-in observed with setup | 1,490,536 | 10.41081316 | 387,752 | 2.70603068 actual devnet spend | 7.70478248 SOL |

The new current cost includes the initial lean deploy, the admin-enabled upgrade, and admin config initialization. A clean fresh deploy of the current admin-enabled binary would be close to the same, with small differences from transaction/write fees.

## Account Rent Estimates

| Account/action | Rent SOL | Notes |
|---|---:|---|
| Admin config | 0.00117624 | Already initialized on devnet |
| Staking pool account | 0.00241512 | One per staking instance |
| SPL token vault/account | 0.00203928 | Stake vault and reward vault |
| Create staking pool rent only | 0.00649368 | Pool + stake vault + reward vault, before tx fee |
| User stake position | 0.00162168 | One per user per pool, reclaimable via `closePosition` |
| Token lock account | 0.00179568 | One per lock, reclaimable on `unlock` |
| Create lock rent only | 0.00383496 | Lock account + vault, before tx fee |
