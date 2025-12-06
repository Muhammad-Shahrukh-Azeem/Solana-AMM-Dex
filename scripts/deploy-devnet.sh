#!/bin/bash

# Kedolik CP-Swap Devnet Deployment Script
# This script will deploy everything needed for devnet testing

set -e

echo "🚀 Kedolik CP-Swap Devnet Deployment"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on devnet
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo -e "${BLUE}Current cluster: $CLUSTER${NC}"

if [[ ! $CLUSTER == *"devnet"* ]]; then
    echo -e "${YELLOW}⚠️  Warning: Not connected to devnet!${NC}"
    echo "Switch to devnet with: solana config set --url devnet"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check balance
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo -e "${BLUE}Current balance: $BALANCE SOL${NC}"

if (( $(echo "$BALANCE < 3" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Low balance! You need at least 3 SOL for deployment${NC}"
    echo "Getting airdrops..."
    solana airdrop 2 --url devnet || true
    sleep 2
    solana airdrop 2 --url devnet || true
    sleep 2
fi

echo ""
echo "Step 1: Building program..."
echo "----------------------------"
anchor build

echo ""
echo "Step 2: Deploying to devnet..."
echo "-------------------------------"
anchor deploy --provider.cluster devnet

PROGRAM_ID=$(solana address -k target/deploy/kedolik_cp_swap-keypair.json)
echo -e "${GREEN}✅ Program deployed!${NC}"
echo -e "${GREEN}Program ID: $PROGRAM_ID${NC}"

echo ""
echo "Step 3: Creating KEDOL token..."
echo "----------------------------------"
echo "Run this command manually and save the mint address:"
echo ""
echo -e "${YELLOW}spl-token create-token --decimals 9 --url devnet${NC}"
echo ""
echo "Then create an account and mint supply:"
echo -e "${YELLOW}spl-token create-account <KEDOLOG_MINT> --url devnet${NC}"
echo -e "${YELLOW}spl-token mint <KEDOLOG_MINT> 1000000000 --url devnet${NC}"
echo ""

echo "Step 4: Creating test tokens..."
echo "--------------------------------"
echo "Create these tokens for testing:"
echo ""
echo "USDC (6 decimals):"
echo -e "${YELLOW}spl-token create-token --decimals 6 --url devnet${NC}"
echo ""
echo "SOL wrapper (9 decimals):"
echo -e "${YELLOW}spl-token create-token --decimals 9 --url devnet${NC}"
echo ""
echo "ETH (18 decimals):"
echo -e "${YELLOW}spl-token create-token --decimals 18 --url devnet${NC}"
echo ""
echo "BTC (8 decimals):"
echo -e "${YELLOW}spl-token create-token --decimals 8 --url devnet${NC}"
echo ""

echo "Step 5: Save addresses..."
echo "-------------------------"
echo "Create a file 'devnet-addresses.json' with:"
echo ""
cat << EOF
{
  "network": "devnet",
  "programId": "$PROGRAM_ID",
  "kedologMint": "PASTE_YOUR_KEDOLOG_MINT",
  "testTokens": {
    "usdc": "PASTE_TEST_USDC_MINT",
    "sol": "PASTE_TEST_SOL_MINT",
    "eth": "PASTE_TEST_ETH_MINT",
    "btc": "PASTE_TEST_BTC_MINT"
  }
}
EOF
echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create KEDOL and test tokens (commands above)"
echo "2. Run: ts-node scripts/init-devnet-config.ts"
echo "3. Update your website with the program ID and IDL"
echo "4. Start testing!"
echo ""
echo "📚 Full guide: See DEVNET_DEPLOYMENT.md"


