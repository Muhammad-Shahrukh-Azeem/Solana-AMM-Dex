#!/bin/bash

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOY COMPLETELY NEW PROGRAM + CONFIGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current network
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current Cluster: $CURRENT_CLUSTER"

# Determine network name
if [[ "$CURRENT_CLUSTER" == *"devnet"* ]]; then
    NETWORK_NAME="DEVNET"
elif [[ "$CURRENT_CLUSTER" == *"testnet"* ]]; then
    NETWORK_NAME="TESTNET"
elif [[ "$CURRENT_CLUSTER" == *"mainnet"* ]]; then
    NETWORK_NAME="MAINNET"
else
    NETWORK_NAME="UNKNOWN"
fi

# Get wallet info
WALLET=$(solana address)
BALANCE=$(solana balance | awk '{print $1}')

echo "👤 Wallet: $WALLET"
echo "💰 Balance: $BALANCE SOL"
echo ""

# Check balance
BALANCE_NUM=$(echo $BALANCE | sed 's/[^0-9.]//g')
if (( $(echo "$BALANCE_NUM < 5" | bc -l) )); then
    echo "⚠️  WARNING: Low balance! Recommended: 10+ SOL for deployment"
    echo ""
fi

echo "This will:"
echo "  1. Generate NEW program keypair"
echo "  2. Update program ID in code"
echo "  3. Build program"
echo "  4. Deploy program"
echo "  5. Create AMM config (1 SOL pool fee)"
echo "  6. Create KEDOLOG config (25% discount)"
echo ""

read -p "⚠️  Deploy NEW program to $NETWORK_NAME? Type 'DEPLOY' to confirm: " CONFIRM

if [ "$CONFIRM" != "DEPLOY" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 STEP 1: Generate New Program Keypair"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backup old keypair if exists
if [ -f "target/deploy/kedolik_cp_swap-keypair.json" ]; then
    TIMESTAMP=$(date +%s)
    mv target/deploy/kedolik_cp_swap-keypair.json "target/deploy/kedolik_cp_swap-keypair-backup-$TIMESTAMP.json"
    echo "✅ Backed up old keypair"
fi

# Generate new keypair
solana-keygen new --no-bip39-passphrase -o target/deploy/kedolik_cp_swap-keypair.json --force
NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/kedolik_cp_swap-keypair.json)

echo ""
echo "✅ New Program ID: $NEW_PROGRAM_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 STEP 2: Update Program ID in Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Update lib.rs
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"$NEW_PROGRAM_ID\")/" programs/cp-swap/src/lib.rs
echo "✅ Updated programs/cp-swap/src/lib.rs"

# Update Anchor.toml
sed -i "/\[programs.localnet\]/,/^$/s/kedolik_cp_swap = \"[^\"]*\"/kedolik_cp_swap = \"$NEW_PROGRAM_ID\"/" Anchor.toml
sed -i "/\[programs.devnet\]/,/^$/s/kedolik_cp_swap = \"[^\"]*\"/kedolik_cp_swap = \"$NEW_PROGRAM_ID\"/" Anchor.toml
echo "✅ Updated Anchor.toml"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 STEP 3: Build Program"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

anchor build

echo ""
echo "✅ Build complete"

# Update IDL with new program ID
sed -i "s/\"address\": \"[^\"]*\"/\"address\": \"$NEW_PROGRAM_ID\"/" target/idl/kedolik_cp_swap.json
echo "✅ Updated IDL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 STEP 4: Deploy Program"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

solana program deploy target/deploy/kedolik_cp_swap.so

echo ""
echo "✅ Program deployed!"
echo ""

# Wait for deployment to settle
echo "⏳ Waiting for deployment to settle..."
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  STEP 5 & 6: Create Configs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the config creation script
npx ts-node scripts/deploy-configs-only.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 New Program ID: $NEW_PROGRAM_ID"
echo ""
echo "📝 Next Steps:"
echo "   1. Create KEDOLOG/USDC pool from frontend"
echo "   2. Get the pool address from transaction"
echo "   3. Run: npx ts-node scripts/set-kedolog-price-pool.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

