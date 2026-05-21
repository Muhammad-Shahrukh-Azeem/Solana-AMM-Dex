#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROGRAM_ID="${PROGRAM_ID:-6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW}"
MAINNET_GENESIS_HASH="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
SOLANA_URL="${SOLANA_URL:-mainnet-beta}"
WALLET="${SOLANA_WALLET:-$HOME/.config/solana/mainnet-deployer.json}"
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-$ROOT_DIR/target/deploy/kedolik_stake_lock-keypair.json}"
PROGRAM_SO="${PROGRAM_SO:-$ROOT_DIR/target/deploy/kedolik_stake_lock.so}"
MAX_SIGN_ATTEMPTS="${MAX_SIGN_ATTEMPTS:-50}"
IDL_PATH="$ROOT_DIR/target/idl/kedolik_stake_lock.json"
MAINNET_IDL_PATH="$SCRIPT_DIR/kedolik_stake_lock.mainnet.idl.json"
SUMMARY_PATH="$SCRIPT_DIR/mainnet-deploy-latest.json"

if [[ ! -f "$WALLET" ]]; then
  echo "Missing deployer wallet: $WALLET" >&2
  exit 1
fi

if [[ ! -f "$PROGRAM_KEYPAIR" ]]; then
  echo "Missing program keypair: $PROGRAM_KEYPAIR" >&2
  echo "Build once first if needed, or set PROGRAM_KEYPAIR=/path/to/program-keypair.json" >&2
  exit 1
fi

GENESIS_HASH="$(solana genesis-hash -u "$SOLANA_URL")"
if [[ "$GENESIS_HASH" != "$MAINNET_GENESIS_HASH" ]]; then
  echo "Refusing to deploy: SOLANA_URL is not mainnet-beta." >&2
  echo "URL: $SOLANA_URL" >&2
  echo "Genesis hash: $GENESIS_HASH" >&2
  exit 1
fi

PROGRAM_KEYPAIR_ID="$(solana address -k "$PROGRAM_KEYPAIR")"
if [[ "$PROGRAM_KEYPAIR_ID" != "$PROGRAM_ID" ]]; then
  echo "Program keypair does not match expected program id." >&2
  echo "Expected: $PROGRAM_ID" >&2
  echo "Actual:   $PROGRAM_KEYPAIR_ID" >&2
  exit 1
fi

DEPLOYER="$(solana address -k "$WALLET")"
echo "Mainnet deployment target verified."
echo "Cluster:          $SOLANA_URL"
echo "Genesis hash:     $GENESIS_HASH"
echo "Deployer wallet:  $DEPLOYER"
echo "Program id:       $PROGRAM_ID"
echo "Program keypair:  $PROGRAM_KEYPAIR"
echo
solana balance -u "$SOLANA_URL" -k "$WALLET"
echo

if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  echo "Building Anchor program..."
  (cd "$ROOT_DIR" && anchor build)
fi

if [[ ! -f "$PROGRAM_SO" ]]; then
  echo "Missing built program binary: $PROGRAM_SO" >&2
  exit 1
fi

if [[ ! -f "$IDL_PATH" ]]; then
  echo "Missing built IDL: $IDL_PATH" >&2
  exit 1
fi

PROGRAM_SIZE="$(wc -c < "$PROGRAM_SO" | tr -d ' ')"
PROGRAMDATA_SIZE="$((PROGRAM_SIZE + 45))"
echo "Built program size:      $PROGRAM_SIZE bytes"
echo "ProgramData account size: $PROGRAMDATA_SIZE bytes"
solana rent "$PROGRAMDATA_SIZE" -u "$SOLANA_URL"
echo

if [[ "${DRY_RUN:-false}" == "true" ]]; then
  echo "Dry run complete. No mainnet deployment was sent."
  exit 0
fi

if [[ "${CONFIRM_MAINNET_DEPLOY:-}" != "YES" ]]; then
  echo "This will deploy or upgrade a real mainnet program."
  read -r -p "Type DEPLOY_MAINNET to continue: " CONFIRMATION
  if [[ "$CONFIRMATION" != "DEPLOY_MAINNET" ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

echo "Deploying/upgrading program on mainnet..."
solana program deploy -u "$SOLANA_URL" \
  --keypair "$WALLET" \
  --program-id "$PROGRAM_KEYPAIR" \
  --use-rpc \
  --max-sign-attempts "$MAX_SIGN_ATTEMPTS" \
  "$PROGRAM_SO"

echo
solana program show "$PROGRAM_ID" -u "$SOLANA_URL"
cp "$IDL_PATH" "$MAINNET_IDL_PATH"

echo
echo "Initializing staking admin config if needed..."
CONFIRM_MAINNET_ADMIN=YES \
ANCHOR_PROVIDER_URL="$SOLANA_URL" \
ANCHOR_WALLET="$WALLET" \
node "$SCRIPT_DIR/initialize-mainnet-staking-admin.js"

cat > "$SUMMARY_PATH" <<EOF
{
  "cluster": "$SOLANA_URL",
  "programId": "$PROGRAM_ID",
  "deployer": "$DEPLOYER",
  "programKeypair": "$PROGRAM_KEYPAIR",
  "programBinary": "$PROGRAM_SO",
  "programSize": $PROGRAM_SIZE,
  "programDataSize": $PROGRAMDATA_SIZE,
  "idl": "$MAINNET_IDL_PATH",
  "deployedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "Mainnet deploy handoff written to: $SUMMARY_PATH"
echo "Mainnet IDL written to: $MAINNET_IDL_PATH"
