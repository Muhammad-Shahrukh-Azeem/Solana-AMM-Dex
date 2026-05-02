#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/ubuntu/raydium-cp-swap/staking-locking"
WALLET="${SOLANA_WALLET:-$HOME/.config/solana/mainnet-deployer.json}"
URL="${SOLANA_URL:-devnet}"

echo "Using wallet: $WALLET"
echo "Using cluster: $URL"
solana balance -u "$URL" -k "$WALLET"

echo
echo "Deploying Kedolik Locker..."
solana program deploy -u "$URL" \
  --keypair "$WALLET" \
  --program-id "$ROOT_DIR/locker-workspace/target/deploy/locker-keypair.json" \
  "$ROOT_DIR/locker-workspace/target/deploy/locker.so"

echo
echo "Deploying Kedolik Mint Wrapper..."
solana program deploy -u "$URL" \
  --keypair "$WALLET" \
  --program-id "$ROOT_DIR/quarry-workspace/target/deploy/quarry_mint_wrapper-keypair.json" \
  "$ROOT_DIR/quarry-workspace/target/deploy/quarry_mint_wrapper.so"

echo
echo "Deploying Kedolik Staking..."
solana program deploy -u "$URL" \
  --keypair "$WALLET" \
  --program-id "$ROOT_DIR/quarry-workspace/target/deploy/quarry_mine-keypair.json" \
  "$ROOT_DIR/quarry-workspace/target/deploy/quarry_mine.so"

echo
echo "Prepared devnet program IDs:"
echo "  locker:               9mtTTmx6ncn7FKfE9oyeiURctm2fZUN6kPLAbPLoXuvU"
echo "  kedolik_mint_wrapper: EzMFbFNvJMFmts6LchtweBq1VKTsfpDpJknGu4kLiH85"
echo "  kedolik_staking:      3dAuLSedbDtzha2uV7K8Mf63ottPCYyMJwRuvouiZ85J"
