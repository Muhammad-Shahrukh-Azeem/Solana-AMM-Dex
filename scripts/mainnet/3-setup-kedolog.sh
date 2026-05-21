#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 MAINNET DEPLOYMENT - STEP 3: Setup KEDOL Discount
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MAINNET DEPLOYMENT - STEP 3: Setup KEDOL Discount"
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

# Check if KEDOLOG_MINT is set
if [ -z "$KEDOLOG_MINT" ]; then
    echo "⚠️  KEDOLOG_MINT environment variable not set"
    echo ""
    echo "You can either:"
    echo "  1. Set it now: export KEDOLOG_MINT=<your-mint-address>"
    echo "  2. The script will prompt you for it"
    echo ""
fi

# Configuration
echo "⚙️  Configuration:"
echo "   KEDOL Discount: 25%"
echo "   Reduced Protocol Fee: 0.0375% (from 0.05%)"
echo ""

# Run TypeScript script
echo "🔄 Running KEDOL setup..."
echo ""

npx ts-node scripts/mainnet/3-setup-kedol.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STEP 3 COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 MAINNET DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Next Steps:"
echo "   1. Copy deployed-mainnet.json to your frontend"
echo "   2. Copy target/idl/kedolik_cp_swap.json to your frontend"
echo "   3. Create your first pool from the frontend (costs 1 SOL)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

