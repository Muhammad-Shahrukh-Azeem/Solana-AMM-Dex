#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 COMPLETE MAINNET DEPLOYMENT - ALL STEPS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 COMPLETE MAINNET DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will run all deployment steps:"
echo "  1. Deploy Program"
echo "  2. Create AMM Config (1 SOL pool fee)"
echo "  3. Setup KEDOL Discount (25%)"
echo ""

# Check network
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current Cluster: $CURRENT_CLUSTER"
echo ""

if [[ "$CURRENT_CLUSTER" != *"mainnet"* ]]; then
    echo "⚠️  WARNING: You are NOT on mainnet!"
    echo "   Current: $CURRENT_CLUSTER"
    echo ""
    read -p "Switch to mainnet? (yes/no): " SWITCH
    if [ "$SWITCH" == "yes" ]; then
        solana config set --url https://api.mainnet-beta.solana.com
        echo "✅ Switched to mainnet"
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Check wallet
WALLET=$(solana address)
BALANCE=$(solana balance | awk '{print $1}')

echo ""
echo "👤 Wallet: $WALLET"
echo "💰 Balance: $BALANCE SOL"
echo ""

if (( $(echo "$BALANCE < 15" | bc -l) )); then
    echo "⚠️  WARNING: Low balance! Recommended: 15+ SOL"
    echo ""
    read -p "Continue anyway? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        echo "❌ Aborted"
        exit 1
    fi
fi

# Final confirmation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  FINAL CONFIRMATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You are about to deploy to MAINNET with real SOL!"
echo ""
read -p "Type 'DEPLOY TO MAINNET' to confirm: " CONFIRM

if [ "$CONFIRM" != "DEPLOY TO MAINNET" ]; then
    echo ""
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Deploy Program
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1/3: Deploy Program"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./scripts/mainnet/1-deploy-program.sh

echo ""
echo "✅ Step 1 Complete!"
echo ""
sleep 2

# Step 2: Create Config
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2/3: Create AMM Config"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./scripts/mainnet/2-create-config.sh

echo ""
echo "✅ Step 2 Complete!"
echo ""
sleep 2

# Step 3: Setup KEDOL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3/3: Setup KEDOL Discount"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./scripts/mainnet/3-setup-kedol.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 COMPLETE MAINNET DEPLOYMENT FINISHED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "deployed-mainnet.json" ]; then
    echo "📋 Deployment Summary:"
    echo ""
    cat deployed-mainnet.json | jq '.' || cat deployed-mainnet.json
    echo ""
fi

echo "📁 Files Created:"
echo "   ✅ deployed-mainnet.json"
echo "   ✅ target/idl/kedolik_cp_swap.json"
echo ""
echo "📋 Next Steps:"
echo "   1. Copy deployed-mainnet.json to your frontend"
echo "   2. Copy target/idl/kedolik_cp_swap.json to your frontend"
echo "   3. Create your first pool from the frontend (costs 1 SOL)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

