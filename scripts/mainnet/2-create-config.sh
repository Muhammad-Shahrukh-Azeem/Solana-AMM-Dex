#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 MAINNET DEPLOYMENT - STEP 2: Create AMM Config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MAINNET DEPLOYMENT - STEP 2: Create AMM Config"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check network
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current Cluster: $CURRENT_CLUSTER"
echo ""

if [[ "$CURRENT_CLUSTER" != *"mainnet"* ]]; then
    echo "⚠️  You are on: $CURRENT_CLUSTER"
    echo ""
    echo "Options:"
    echo "  1. Switch to mainnet"
    echo "  2. Continue on current network"
    echo "  3. Abort"
    echo ""
    read -p "Choose (1/2/3): " CHOICE
    
    if [ "$CHOICE" == "1" ]; then
        solana config set --url https://api.mainnet-beta.solana.com
        echo "✅ Switched to mainnet"
    elif [ "$CHOICE" == "2" ]; then
        echo "✅ Continuing on $CURRENT_CLUSTER"
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Check wallet
WALLET=$(solana address)
BALANCE=$(solana balance | awk '{print $1}')

echo "👤 Wallet: $WALLET"
echo "💰 Balance: $BALANCE SOL"
echo ""

if (( $(echo "$BALANCE < 0.1" | bc -l) )); then
    echo "⚠️  WARNING: Low balance!"
    echo ""
fi

# Configuration
echo "⚙️  Configuration:"
echo "   Pool Creation Fee: 1 SOL"
echo "   Trade Fee: 0.25%"
echo "   Protocol Fee: 0.05%"
echo "   LP Fee: 0.20%"
echo ""

# Run TypeScript script
echo "🔄 Running config creation..."
echo ""

npx ts-node scripts/mainnet/2-create-config.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STEP 2 COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "➡️  Next: Run ./scripts/mainnet/3-setup-kedol.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

