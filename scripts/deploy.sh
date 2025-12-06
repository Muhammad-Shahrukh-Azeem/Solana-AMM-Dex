#!/bin/bash

# 🚀 Universal Deployment Script (Devnet/Mainnet)
# Usage: ./scripts/deploy.sh [devnet|mainnet]

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get network from argument or default to devnet
NETWORK=${1:-devnet}

if [ "$NETWORK" != "devnet" ] && [ "$NETWORK" != "mainnet" ]; then
    echo -e "${RED}❌ Invalid network. Use 'devnet' or 'mainnet'${NC}"
    echo "Usage: ./scripts/deploy.sh [devnet|mainnet]"
    exit 1
fi

# Set RPC URL based on network
if [ "$NETWORK" == "mainnet" ]; then
    CLUSTER="mainnet-beta"
    NETWORK_URL="https://api.mainnet-beta.solana.com"
    MIN_BALANCE=10
else
    CLUSTER="devnet"
    NETWORK_URL="https://api.devnet.solana.com"
    MIN_BALANCE=2
fi

echo "=================================="
echo "🚀 Program Deployment"
echo "=================================="
echo -e "${BLUE}📡 Network: $NETWORK${NC}"
echo -e "${BLUE}🔗 RPC: $NETWORK_URL${NC}"

# Check balance
BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')
echo -e "\n${BLUE}💰 Current Balance: $BALANCE SOL${NC}"

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    if [ "$NETWORK" == "devnet" ]; then
        echo -e "${YELLOW}⚠️  Low balance! Requesting airdrop...${NC}"
        solana airdrop 2 --url $CLUSTER || echo "Airdrop failed (rate limit?)"
        sleep 2
    else
        echo -e "${RED}❌ Insufficient balance for mainnet deployment!${NC}"
        echo -e "${RED}   You need at least $MIN_BALANCE SOL${NC}"
        exit 1
    fi
fi

# Confirmation for mainnet
if [ "$NETWORK" == "mainnet" ]; then
    echo -e "\n${YELLOW}⚠️  MAINNET DEPLOYMENT${NC}"
    echo -e "${YELLOW}   This will deploy to PRODUCTION${NC}"
    echo -e "${YELLOW}   Estimated cost: ~5-10 SOL${NC}"
    read -p "Continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Build and Deploy
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Building and Deploying Program${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

anchor build
anchor deploy --provider.cluster $CLUSTER

PROGRAM_ID=$(solana address -k target/deploy/kedolik_cp_swap-keypair.json)
echo -e "\n${GREEN}✅ Program Deployed!${NC}"
echo -e "${BLUE}   Program ID: $PROGRAM_ID${NC}"
echo -e "${BLUE}   Network: $NETWORK${NC}"

# Save deployment info
cat > deployed-${NETWORK}.json << EOF
{
  "programId": "$PROGRAM_ID",
  "network": "$NETWORK",
  "cluster": "$CLUSTER",
  "rpcUrl": "$NETWORK_URL",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployedBy": "$(solana address)"
}
EOF

echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}📝 Deployment info saved to: deployed-${NETWORK}.json${NC}"

echo -e "\n${BLUE}📋 Important Addresses:${NC}"
echo -e "   Program ID: $PROGRAM_ID"
echo -e "   Deployer: $(solana address)"
echo -e "   Network: $NETWORK"

if [ "$NETWORK" == "mainnet" ]; then
    echo -e "\n${YELLOW}🎯 Next Steps (Mainnet):${NC}"
    echo -e "   1. Initialize AMM config:"
    echo -e "      ${GREEN}NETWORK=mainnet npx ts-node scripts/config/init-config.ts${NC}"
    echo -e ""
    echo -e "   2. Set up KEDOL (if needed):"
    echo -e "      ${GREEN}NETWORK=mainnet npx ts-node scripts/config/setup-kedol.ts${NC}"
    echo -e ""
    echo -e "   3. Create pools and test thoroughly before announcing!"
else
    echo -e "\n${YELLOW}🎯 Next Steps (Devnet):${NC}"
    echo -e "   1. Configure KEDOL:"
    echo -e "      ${GREEN}./scripts/quick-setup-kedol.sh YOUR_KEDOLOG_MINT${NC}"
    echo -e ""
    echo -e "   2. Initialize config:"
    echo -e "      ${GREEN}npx ts-node scripts/config/init-config.ts${NC}"
    echo -e ""
    echo -e "   3. Test everything before mainnet deployment"
fi

echo ""

