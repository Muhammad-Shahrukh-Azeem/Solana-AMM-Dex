#!/bin/bash
# Kedolik DEX Test Runner
# This script runs the test suite with proper environment setup

set -e

cd "$(dirname "$0")"

# Source environment
source ~/.nvm/nvm.sh
nvm use 20

# Set Anchor provider URL
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# Check if test validator is running
if ! curl -s http://127.0.0.1:8899 > /dev/null 2>&1; then
    echo "⚠️  Solana test validator is not running"
    echo "Please start it in a separate terminal with:"
    echo "  solana-test-validator --reset --quiet"
    exit 1
fi

echo "✅ Test validator is running"

# Rebuild program
echo "🔨 Rebuilding program..."
cd programs/cp-swap
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cargo build-sbf 2>&1 | tail -10
cd ../..

# Deploy program to test validator
echo "📦 Deploying program to test validator..."
if [ -f "target/deploy/kedolik_cp_swap.so" ]; then
    ~/.local/share/solana/install/active_release/bin/solana program deploy \
        target/deploy/kedolik_cp_swap.so \
        --program-id target/deploy/kedolik_cp_swap-keypair.json \
        --url http://127.0.0.1:8899 \
        --commitment confirmed || {
        echo "⚠️  Failed to deploy program. Make sure test validator is running."
        exit 1
    }
    echo "✅ Program deployed successfully"
else
    echo "❌ Program binary not found. Run 'cargo build-sbf' first."
    exit 1
fi

echo "Running test suite..."

# Run tests
./node_modules/.bin/ts-mocha -p ./tsconfig.json -t 1000000 \
    tests/deposit.test.ts \
    tests/initialize.test.ts \
    tests/swap.test.ts \
    tests/withdraw.test.ts

echo "✅ Tests completed"

