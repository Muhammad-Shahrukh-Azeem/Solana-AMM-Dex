#!/bin/bash

# 🪙 Quick KEDOLOG Setup
# Usage: ./scripts/quick-setup-kedolog.sh YOUR_KEDOLOG_MINT_ADDRESS

if [ -z "$1" ]; then
    echo "❌ Error: KEDOLOG mint address is required"
    echo ""
    echo "Usage:"
    echo "  ./scripts/quick-setup-kedolog.sh YOUR_KEDOLOG_MINT_ADDRESS"
    echo ""
    echo "Example:"
    echo "  ./scripts/quick-setup-kedolog.sh 22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx"
    exit 1
fi

KEDOLOG_MINT=$1

echo "🪙 Quick KEDOLOG Setup"
echo "===================================="
echo ""
echo "KEDOLOG Mint: $KEDOLOG_MINT"
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
echo ""

# Create devnet-addresses.json
echo "Creating devnet-addresses.json..."
cat > devnet-addresses.json << EOF
{
  "network": "devnet",
  "kedologMint": "$KEDOLOG_MINT",
  "testTokens": {}
}
EOF

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

