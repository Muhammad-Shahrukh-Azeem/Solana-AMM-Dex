#!/usr/bin/env bash
set -euo pipefail

URL="${SOLANA_URL:-devnet}"
DECIMALS="${DECIMALS:-9}"
AMOUNT="${AMOUNT:-1000000000}"
LABEL="${LABEL:-KEDOLIK_TEST}"

echo "Creating test token for $LABEL on $URL"
MINT_OUTPUT="$(spl-token create-token --decimals "$DECIMALS" --url "$URL")"
echo "$MINT_OUTPUT"
MINT="$(printf '%s\n' "$MINT_OUTPUT" | awk '/Creating token/ {print $3}')"

if [ -z "$MINT" ]; then
  echo "Failed to parse mint address."
  exit 1
fi

ACCOUNT_OUTPUT="$(spl-token create-account "$MINT" --url "$URL")"
echo "$ACCOUNT_OUTPUT"
ACCOUNT="$(printf '%s\n' "$ACCOUNT_OUTPUT" | awk '/Creating account/ {print $3}')"

if [ -z "$ACCOUNT" ]; then
  echo "Failed to parse token account address."
  exit 1
fi

spl-token mint "$MINT" "$AMOUNT" "$ACCOUNT" --url "$URL"

echo
echo "Created test token:"
echo "  mint:    $MINT"
echo "  account: $ACCOUNT"
echo "  amount:  $AMOUNT"
