#!/bin/bash

# 🪙 Use Existing KEDOLOG Token
# This script helps you configure your existing KEDOLOG token

echo "🪙 Configure Existing KEDOLOG Token"
echo "===================================="

# Prompt for KEDOLOG mint address
echo ""
echo "Please enter your existing KEDOLOG mint address:"
read -p "KEDOLOG Mint: " KEDOLOG_MINT

if [ -z "$KEDOLOG_MINT" ]; then
    echo "❌ Error: KEDOLOG mint address is required"
    exit 1
fi

echo ""
echo "Verifying token on devnet..."

# Verify the token exists
TOKEN_INFO=$(spl-token display $KEDOLOG_MINT --url devnet 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Error: Could not find token on devnet"
    echo "   Make sure the address is correct and the token exists on devnet"
    exit 1
fi

echo "✅ Token found on devnet!"
echo ""
echo "$TOKEN_INFO"

# Create or update devnet-addresses.json
if [ -f "devnet-addresses.json" ]; then
    echo ""
    echo "Updating devnet-addresses.json..."
    
    # Use jq to update if available, otherwise manual
    if command -v jq &> /dev/null; then
        cat devnet-addresses.json | jq --arg mint "$KEDOLOG_MINT" '.kedologMint = $mint' > devnet-addresses.json.tmp
        mv devnet-addresses.json.tmp devnet-addresses.json
    else
        # Manual update (simple replacement)
        sed -i "s/\"kedologMint\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"kedologMint\": \"$KEDOLOG_MINT\"/g" devnet-addresses.json
    fi
else
    echo ""
    echo "Creating devnet-addresses.json..."
    cat > devnet-addresses.json << EOF
{
  "network": "devnet",
  "kedologMint": "$KEDOLOG_MINT",
  "testTokens": {}
}
EOF
fi

echo ""
echo "======================================"
echo "✅ KEDOLOG Token Configured!"
echo "======================================"
echo ""
echo "📝 KEDOLOG Mint: $KEDOLOG_MINT"
echo "💾 Saved to: devnet-addresses.json"
echo ""
echo "🎯 Next Steps:"
echo "   1. Run deployment: ./scripts/deploy-and-test-devnet.sh"
echo "   2. The script will use your existing KEDOLOG token"
echo ""

