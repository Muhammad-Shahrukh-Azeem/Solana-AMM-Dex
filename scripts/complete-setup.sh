#!/bin/bash

# 🎯 Complete Setup Script
# Runs all remaining setup steps after deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Set environment
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

echo "=================================="
echo "🎯 Complete Setup"
echo "=================================="
echo ""

# Step 1: Activate KEDOL Discount
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 1: Activating KEDOL Discount${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/activate-kedol-discount.ts

# Step 2: Create KEDOL/USDC Pool
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 2: Creating KEDOL/USDC Pool${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/create-kedol-usdc-pool.ts

# Step 3: Update KEDOL Price
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 3: Updating KEDOL Price${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/update-kedol-price-from-pool.ts --once

# Step 4: Test Swaps
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 4: Testing Swaps${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Skipping tests (run manually if needed)${NC}"
# npx ts-node scripts/test-swap-with-pyth.ts

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}📋 Summary:${NC}"
echo -e "   ✅ KEDOL discount activated"
echo -e "   ✅ KEDOL/USDC pool created"
echo -e "   ✅ KEDOL price updated"
echo -e ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo -e "   1. Test swaps: ${YELLOW}npx ts-node scripts/test-swap-with-pyth.ts${NC}"
echo -e "   2. Create more pools as needed"
echo -e "   3. Deploy to mainnet when ready"
echo -e ""
echo -e "${GREEN}🎉 Your DEX is ready!${NC}\n"

