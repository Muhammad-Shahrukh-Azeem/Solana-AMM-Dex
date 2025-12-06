#!/bin/bash

# Create test tokens on devnet for testing
# These simulate real tokens like USDC, SOL, ETH, BTC

set -e

echo "🪙 Creating Test Tokens on Devnet"
echo "=================================="
echo ""

# Check if we're on devnet
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ ! $CLUSTER == *"devnet"* ]]; then
    echo "⚠️  Warning: Not connected to devnet!"
    echo "Switch to devnet with: solana config set --url devnet"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create tokens
echo "Creating USDC (6 decimals)..."
USDC_MINT=$(spl-token create-token --decimals 6 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ USDC Mint: $USDC_MINT${NC}"
spl-token create-account $USDC_MINT --url devnet
spl-token mint $USDC_MINT 1000000 --url devnet  # 1M USDC
echo ""

echo "Creating SOL wrapper (9 decimals)..."
SOL_MINT=$(spl-token create-token --decimals 9 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ SOL Mint: $SOL_MINT${NC}"
spl-token create-account $SOL_MINT --url devnet
spl-token mint $SOL_MINT 10000 --url devnet  # 10K SOL
echo ""

echo "Creating ETH (18 decimals)..."
ETH_MINT=$(spl-token create-token --decimals 18 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ ETH Mint: $ETH_MINT${NC}"
spl-token create-account $ETH_MINT --url devnet
spl-token mint $ETH_MINT 1000 --url devnet  # 1K ETH
echo ""

echo "Creating BTC (8 decimals)..."
BTC_MINT=$(spl-token create-token --decimals 8 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ BTC Mint: $BTC_MINT${NC}"
spl-token create-account $BTC_MINT --url devnet
spl-token mint $BTC_MINT 100 --url devnet  # 100 BTC
echo ""

echo "Creating KEDOL (9 decimals)..."
KEDOLOG_MINT=$(spl-token create-token --decimals 9 --url devnet 2>&1 | grep "Creating token" | awk '{print $3}')
echo -e "${GREEN}✅ KEDOL Mint: $KEDOLOG_MINT${NC}"
spl-token create-account $KEDOLOG_MINT --url devnet
spl-token mint $KEDOLOG_MINT 1000000000 --url devnet  # 1B KEDOL
echo ""

echo "======================================"
echo -e "${GREEN}✅ All tokens created!${NC}"
echo "======================================"
echo ""
echo "📝 Save these addresses:"
echo ""
echo "USDC:    $USDC_MINT"
echo "SOL:     $SOL_MINT"
echo "ETH:     $ETH_MINT"
echo "BTC:     $BTC_MINT"
echo "KEDOL: $KEDOLOG_MINT"
echo ""
echo "Add them to devnet-addresses.json:"
echo ""
cat << EOF
{
  "network": "devnet",
  "kedologMint": "$KEDOLOG_MINT",
  "testTokens": {
    "usdc": "$USDC_MINT",
    "sol": "$SOL_MINT",
    "eth": "$ETH_MINT",
    "btc": "$BTC_MINT"
  }
}
EOF
echo ""


