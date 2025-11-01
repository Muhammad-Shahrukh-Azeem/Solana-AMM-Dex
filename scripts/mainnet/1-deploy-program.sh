#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 MAINNET DEPLOYMENT - STEP 1: Deploy Program
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MAINNET DEPLOYMENT - STEP 1: Deploy Program"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check network
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current Cluster: $CURRENT_CLUSTER"
echo ""

if [[ "$CURRENT_CLUSTER" != *"mainnet"* ]]; then
    echo "⚠️  WARNING: You are NOT on mainnet!"
    echo "   Current: $CURRENT_CLUSTER"
    echo ""
    echo "Options:"
    echo "  1. Switch to mainnet"
    echo "  2. Continue on current network (devnet/testnet)"
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

# Estimate cost
echo "📊 Deployment Cost Estimate:"
echo "   Program Deployment: ~5-10 SOL"
echo "   Buffer Account: ~2-3 SOL"
echo "   Total: ~7-13 SOL"
echo ""

if (( $(echo "$BALANCE < 15" | bc -l) )); then
    echo "⚠️  WARNING: Low balance! Recommended: 15+ SOL"
    echo ""
fi

# Build program
echo "🔨 Building program..."
anchor build
echo "✅ Build complete"
echo ""

# Get program ID from Anchor.toml
PROGRAM_ID=$(grep "kedolik_cp_swap" Anchor.toml | grep -o '[A-Za-z0-9]\{32,\}')
echo "📋 Program ID: $PROGRAM_ID"
echo ""

# Determine network name and cluster flag
if [[ "$CURRENT_CLUSTER" == *"mainnet"* ]]; then
    NETWORK_NAME="MAINNET"
    CLUSTER_FLAG="mainnet"
elif [[ "$CURRENT_CLUSTER" == *"devnet"* ]]; then
    NETWORK_NAME="DEVNET"
    CLUSTER_FLAG="devnet"
elif [[ "$CURRENT_CLUSTER" == *"testnet"* ]]; then
    NETWORK_NAME="TESTNET"
    CLUSTER_FLAG="testnet"
else
    NETWORK_NAME="CUSTOM NETWORK"
    CLUSTER_FLAG="devnet"
fi

# Check if program exists
if solana account $PROGRAM_ID &>/dev/null; then
    echo "⚠️  Program already exists on $NETWORK_NAME!"
    echo ""
    read -p "Do you want to UPGRADE the existing program? (yes/no): " UPGRADE
    if [ "$UPGRADE" != "yes" ]; then
        echo "❌ Aborted"
        exit 1
    fi
    
    echo ""
    echo "🔄 Upgrading program on $NETWORK_NAME..."
    anchor upgrade --provider.cluster $CLUSTER_FLAG --program-id $PROGRAM_ID target/deploy/kedolik_cp_swap.so
    
else
    echo "📝 Deploying NEW program..."
    echo ""
    read -p "Confirm deployment to $NETWORK_NAME? (type 'DEPLOY' to confirm): " CONFIRM
    if [ "$CONFIRM" != "DEPLOY" ]; then
        echo "❌ Aborted"
        exit 1
    fi
    
    echo ""
    echo "🚀 Deploying to $NETWORK_NAME..."
    anchor deploy --provider.cluster $CLUSTER_FLAG
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STEP 1 COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "🔗 Explorer: https://explorer.solana.com/address/$PROGRAM_ID"
echo ""
echo "➡️  Next: Run ./scripts/mainnet/2-create-config.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

