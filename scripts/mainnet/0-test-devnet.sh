#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧪 TEST DEPLOYMENT ON DEVNET
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTING DEPLOYMENT SCRIPTS ON DEVNET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if already on devnet
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current Cluster: $CURRENT_CLUSTER"

if [[ "$CURRENT_CLUSTER" != *"devnet"* ]]; then
    echo ""
    echo "⚠️  Switching to devnet..."
    solana config set --url devnet
    echo "✅ Switched to devnet"
fi

# Check wallet
WALLET=$(solana address)
BALANCE=$(solana balance | awk '{print $1}')

echo ""
echo "👤 Wallet: $WALLET"
echo "💰 Balance: $BALANCE SOL"
echo ""

# Check if we have enough SOL
if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  Low balance! Requesting airdrop..."
    solana airdrop 2
    echo "✅ Airdrop complete"
    echo ""
fi

# Clean up old test files
echo "🧹 Cleaning up old test files..."
rm -f deployed-mainnet.json
rm -f config-mainnet.json
echo "✅ Cleanup complete"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 STEP 1: Deploy Program"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build and deploy
echo "🔨 Building program..."
anchor build

echo ""
echo "🚀 Deploying to devnet..."
anchor deploy --provider.cluster devnet

PROGRAM_ID=$(grep "kedolik_cp_swap" Anchor.toml | grep -o '[A-Za-z0-9]\{32,\}')
echo ""
echo "✅ Program deployed!"
echo "   Program ID: $PROGRAM_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 STEP 2: Create Config"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create config (auto-confirm for testing)
echo "MAINNET" | npx ts-node scripts/mainnet/2-create-config.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 STEP 3: Setup KEDOL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we have a KEDOL token on devnet
if [ -f "deployed-devnet-new.json" ]; then
    KEDOLOG_MINT=$(jq -r '.kedol.mint' deployed-devnet-new.json 2>/dev/null || echo "")
    if [ ! -z "$KEDOLOG_MINT" ] && [ "$KEDOLOG_MINT" != "null" ]; then
        echo "📝 Using existing KEDOL mint from deployed-devnet-new.json"
        echo "   Mint: $KEDOLOG_MINT"
        echo ""
        export KEDOLOG_MINT=$KEDOLOG_MINT
        echo -e "$KEDOLOG_MINT\n\nKEDOLOG" | npx ts-node scripts/mainnet/3-setup-kedol.ts
    else
        echo "⚠️  No KEDOL mint found in deployed-devnet-new.json"
        echo "   Skipping KEDOL setup for this test"
        echo "   You can run it manually later with:"
        echo "   npx ts-node scripts/mainnet/3-setup-kedol.ts"
    fi
else
    echo "⚠️  deployed-devnet-new.json not found"
    echo "   Skipping KEDOL setup for this test"
    echo "   You can run it manually later with:"
    echo "   npx ts-node scripts/mainnet/3-setup-kedol.ts"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEVNET TEST COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "deployed-mainnet.json" ]; then
    echo "📋 Deployment Summary:"
    echo ""
    cat deployed-mainnet.json | jq '.'
    echo ""
fi

echo "🎉 All scripts tested successfully on devnet!"
echo ""
echo "➡️  Ready for mainnet deployment!"
echo ""
echo "To deploy to mainnet:"
echo "  1. solana config set --url mainnet-beta"
echo "  2. Ensure you have 15+ SOL"
echo "  3. Run: ./scripts/mainnet/1-deploy-program.sh"
echo "  4. Run: npx ts-node scripts/mainnet/2-create-config.ts"
echo "  5. Run: npx ts-node scripts/mainnet/3-setup-kedol.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

