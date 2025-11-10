#!/bin/bash

echo "🧹 Cleaning up any existing validators..."
pkill -9 -f solana-test-validator 2>/dev/null
sleep 3

echo "🚀 Running anchor test..."
echo ""

cd /home/ubuntu/raydium-cp-swap
anchor test 2>&1

echo ""
echo "✅ Tests complete!"


