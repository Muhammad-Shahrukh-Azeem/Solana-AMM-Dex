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

# Step 1: Activate KEDOLOG Discount
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 1: Activating KEDOLOG Discount${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/activate-kedolog-discount.ts

# Step 2: Create KEDOLOG/USDC Pool
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 2: Creating KEDOLOG/USDC Pool${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/create-kedolog-usdc-pool.ts

# Step 3: Update KEDOLOG Price
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 3: Updating KEDOLOG Price${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx ts-node scripts/update-kedolog-price-from-pool.ts --once

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
echo -e "   ✅ KEDOLOG discount activated"
echo -e "   ✅ KEDOLOG/USDC pool created"
echo -e "   ✅ KEDOLOG price updated"
echo -e ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo -e "   1. Test swaps: ${YELLOW}npx ts-node scripts/test-swap-with-pyth.ts${NC}"
echo -e "   2. Create more pools as needed"
echo -e "   3. Deploy to mainnet when ready"
echo -e ""
echo -e "${GREEN}🎉 Your DEX is ready!${NC}\n"

