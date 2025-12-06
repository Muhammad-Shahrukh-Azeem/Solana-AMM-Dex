#!/bin/bash

# 🚀 Complete Devnet Deployment and Testing Script
# This script deploys your contract, creates pools, and tests everything

set -e  # Exit on error

echo "=================================="
echo "🚀 Devnet Deployment & Testing"
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

# Step 2: KEDOL Token (Optional - skip if already exists)
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 2: KEDOL Token Setup${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if devnet-addresses.json exists and has kedologMint
if [ -f "devnet-addresses.json" ]; then
    EXISTING_KEDOLOG=$(cat devnet-addresses.json | grep -o '"kedologMint"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$EXISTING_KEDOLOG" ]; then
        echo -e "${BLUE}✅ Using existing KEDOL token: $EXISTING_KEDOLOG${NC}"
    else
        echo -e "${YELLOW}Creating new KEDOL token...${NC}"
        ./scripts/create-kedol.sh
    fi
else
    echo -e "${YELLOW}Creating new KEDOL token...${NC}"
    ./scripts/create-kedol.sh
fi

# Step 3: Create Test Tokens
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 3: Creating Test Tokens${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

./scripts/create-test-tokens.sh

# Step 4: Initialize Configs
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 4: Initializing Configs${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

npx ts-node scripts/init-devnet-config.ts

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}📝 Next Steps:${NC}"
echo -e "   1. Create KEDOL/USDC pool"
echo -e "   2. Run: npx ts-node scripts/create-kedol-usdc-pool.ts"
echo -e "   3. Update KEDOL price: npx ts-node scripts/update-kedol-price-from-pool.ts --once"
echo -e "   4. Test swaps: anchor test"

echo -e "\n${BLUE}📋 Important Addresses:${NC}"
echo -e "   Program ID: $PROGRAM_ID"
echo -e "   Check devnet-addresses.json for token addresses"

echo -e "\n${GREEN}🎉 Ready to create pools and test!${NC}\n"

