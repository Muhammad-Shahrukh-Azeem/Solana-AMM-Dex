# Kedolik Stake Lock Mainnet Deployment

This deployment uses the optimized combined program for both staking and locking.

Program ID:

```text
6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW
```

Main token mint checked for compatibility:

```text
FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN
```

## 1. Deploy Or Upgrade Program

Default wallet:

```text
~/.config/solana/mainnet-deployer.json
```

Run:

```bash
cd /home/ubuntu/raydium-cp-swap/staking-locking
./deployments/deploy-mainnet-stake-lock.sh
```

For non-interactive use:

```bash
CONFIRM_MAINNET_DEPLOY=YES \
SOLANA_WALLET=~/.config/solana/mainnet-deployer.json \
SOLANA_URL=mainnet-beta \
./deployments/deploy-mainnet-stake-lock.sh
```

The script validates mainnet by genesis hash before deploying.

Dry run without deploying:

```bash
cd /home/ubuntu/raydium-cp-swap/staking-locking
SKIP_BUILD=true DRY_RUN=true ./deployments/deploy-mainnet-stake-lock.sh
```

Expected final rent locked for the program is about `2.92265016 SOL` plus small transaction fees.
For a fresh deploy, keep around `6 SOL` available because Solana deployment may temporarily fund an upload buffer before closing it.

## 2. Create A Mainnet Staking Pool

Example with the main token used for both staking and rewards:

```bash
cd /home/ubuntu/raydium-cp-swap/staking-locking
CONFIRM_MAINNET_STAKING=YES \
TOKEN_MINT=FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN \
REWARD_AMOUNT=43200 \
REWARD_DURATION_SECONDS=86400 \
node deployments/setup-mainnet-lean-staking.js
```

For a 0.5 token per second pool, with 9 token decimals:

```bash
CONFIRM_MAINNET_STAKING=YES \
TOKEN_MINT=FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN \
REWARD_AMOUNT=43200 \
REWARD_DURATION_SECONDS=86400 \
REWARD_RATE_PER_SECOND=500000000 \
node deployments/setup-mainnet-lean-staking.js
```

If the admin does not have enough reward tokens, the script exits before funding.
If `FUND_REWARDS=false` is set, it creates the pool without funding it.

## 3. Create A Mainnet Token Lock

Use a Unix timestamp for `UNLOCK_TS`.

```bash
cd /home/ubuntu/raydium-cp-swap/staking-locking
CONFIRM_MAINNET_LOCK=YES \
TOKEN_MINT=FUHwFRWE52FJXC4KoySzy9h6nNmRrppUg5unS4mKEDQN \
AMOUNT=100 \
UNLOCK_TS=1798761600 \
node deployments/create-mainnet-lock.js
```

## 4. Transfer Staking Admin

```bash
cd /home/ubuntu/raydium-cp-swap/staking-locking
CONFIRM_MAINNET_ADMIN_TRANSFER=YES \
NEW_AUTHORITY=<new-admin-wallet> \
node deployments/transfer-mainnet-staking-admin.js
```

## Output Files

The scripts write handoff files into `staking-locking/deployments/`:

- `mainnet-deploy-latest.json`
- `kedolik_stake_lock.mainnet.idl.json`
- `mainnet-admin-config.json`
- `mainnet-lean-staking-latest.json`
- `mainnet-lock-latest.json`
