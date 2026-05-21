#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/ubuntu/raydium-cp-swap/staking-locking"
WALLET="${SOLANA_WALLET:-$HOME/.config/solana/mainnet-deployer.json}"
URL="${SOLANA_URL:-devnet}"

echo "Using wallet: $WALLET"
echo "Using cluster: $URL"
solana balance -u "$URL" -k "$WALLET"

echo
echo "Deploying Kedolik lean staking/locking..."
solana program deploy -u "$URL" \
  --keypair "$WALLET" \
  --program-id "$ROOT_DIR/target/deploy/kedolik_stake_lock-keypair.json" \
  "$ROOT_DIR/target/deploy/kedolik_stake_lock.so"

echo
echo "Prepared devnet program ID:"
echo "  kedolik_stake_lock: 6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW"
