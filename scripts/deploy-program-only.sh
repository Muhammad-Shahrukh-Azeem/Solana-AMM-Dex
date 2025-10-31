#!/bin/bash

# 🚀 Deploy Program Only (Skip Token Creation)
# Use this if you already have tokens in your wallet

set -e  # Exit on error

echo "=================================="
echo "🚀 Program Deployment (No Tokens)"
echo "=================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CLUSTER="devnet"
NETWORK_URL="https://api.devnet.solana.com"

echo -e "\n${BLUE}📡 Network: $CLUSTER${NC}"
echo -e "${BLUE}🔗 RPC: $NETWORK_URL${NC}"

# Check balance
BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')
echo -e "\n${BLUE}💰 Current Balance: $BALANCE SOL${NC}"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Low balance! Requesting airdrop...${NC}"
    solana airdrop 2 --url $CLUSTER || echo "Airdrop failed (rate limit?)"
    sleep 2
fi

# Step 1: Build and Deploy
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 1: Building and Deploying Program${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

anchor build
anchor deploy --provider.cluster $CLUSTER

PROGRAM_ID=$(solana address -k target/deploy/kedolik_cp_swap-keypair.json)
echo -e "\n${GREEN}✅ Program Deployed!${NC}"
echo -e "${BLUE}   Program ID: $PROGRAM_ID${NC}"

# Save program ID
echo "{\"programId\": \"$PROGRAM_ID\", \"network\": \"$CLUSTER\"}" > deployed-program.json

# Step 2: Check KEDOLOG
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 2: Checking KEDOLOG Configuration${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "devnet-addresses.json" ]; then
    KEDOLOG_MINT=$(cat devnet-addresses.json | grep -o '"kedologMint"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$KEDOLOG_MINT" ]; then
        echo -e "${GREEN}✅ KEDOLOG configured: $KEDOLOG_MINT${NC}"
    else
        echo -e "${YELLOW}⚠️  KEDOLOG not configured in devnet-addresses.json${NC}"
        echo -e "${YELLOW}   Run: ./scripts/quick-setup-kedolog.sh YOUR_KEDOLOG_MINT${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  devnet-addresses.json not found${NC}"
    echo -e "${YELLOW}   Run: ./scripts/quick-setup-kedolog.sh YOUR_KEDOLOG_MINT${NC}"
fi

# Step 3: Initialize Configs
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 3: Initializing AMM Config${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Set ANCHOR_WALLET if not set
if [ -z "$ANCHOR_WALLET" ]; then
    export ANCHOR_WALLET=~/.config/solana/id.json
fi

npx ts-node scripts/init-devnet-config.ts

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}📝 Next Steps:${NC}"
echo -e "   1. Activate KEDOLOG discount:"
echo -e "      ${YELLOW}npx ts-node scripts/activate-kedolog-discount.ts${NC}"
echo -e ""
echo -e "   2. Create KEDOLOG/USDC pool (or any pool):"
echo -e "      ${YELLOW}npx ts-node scripts/create-kedolog-usdc-pool.ts${NC}"
echo -e ""
echo -e "   3. Update KEDOLOG price from pool:"
echo -e "      ${YELLOW}npx ts-node scripts/update-kedolog-price-from-pool.ts --once${NC}"
echo -e ""
echo -e "   4. (Optional) Enable pool creation fee (0.15 SOL):"
echo -e "      ${YELLOW}npx ts-node scripts/set-pool-creation-fee.ts${NC}"
echo -e ""
echo -e "   5. Test swaps with Pyth pricing:"
echo -e "      ${YELLOW}npx ts-node scripts/test-swap-with-pyth.ts${NC}"

echo -e "\n${BLUE}📋 Important Addresses:${NC}"
echo -e "   Program ID: $PROGRAM_ID"
if [ ! -z "$KEDOLOG_MINT" ]; then
    echo -e "   KEDOLOG: $KEDOLOG_MINT"
fi

echo -e "\n${GREEN}🎉 Ready to configure and test!${NC}\n"

