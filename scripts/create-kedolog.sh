#!/bin/bash

# Create KEDOL token on devnet
set -e

echo "🪙 Creating KEDOL Token on Devnet"
echo "===================================="
echo ""

# Check if we're on devnet
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ ! $CLUSTER == *"devnet"* ]]; then
    echo "⚠️  Warning: Not connected to devnet!"
    echo "Switch to devnet with: solana config set --url devnet"
    exit 1
fi

# Check balance
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "Current balance: $BALANCE SOL"
if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo "⚠️  Low balance! You need at least 1 SOL"
    echo "Get more from: https://faucet.solana.com/"
    exit 1
fi

echo ""
echo "Creating KEDOL token (9 decimals)..."
KEDOLOG_MINT=$(spl-token create-token --decimals 9 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo "✅ KEDOL Mint: $KEDOLOG_MINT"
echo ""

echo "Creating token account..."
spl-token create-account $KEDOLOG_MINT --url devnet
echo ""

echo "Minting 1 Billion KEDOL..."
spl-token mint $KEDOLOG_MINT 1000000000 --url devnet
echo ""

echo "======================================"
echo "✅ KEDOL Created Successfully!"
echo "======================================"
echo ""
echo "📝 KEDOL Mint Address:"
echo "$KEDOLOG_MINT"
echo ""
echo "💾 Save this to devnet-addresses.json"
echo ""

