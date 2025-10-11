#!/bin/bash
# =============================================================================
# Quick Fix: Upgrade Node.js to >= 20.18.0
# =============================================================================
# Run this if you get Node.js version compatibility errors
# Usage: bash FIX_NODE_VERSION.sh
# =============================================================================

set -e

echo "=============================================="
echo "Upgrading Node.js to Latest 20.x"
echo "=============================================="
echo ""

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Current Node.js version: $(node --version)"
echo ""
echo "Installing latest Node.js 20.x..."
nvm install 20
nvm use 20
echo ""
echo "New Node.js version: $(node --version)"
echo ""

# Verify version is sufficient
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED="20.18.0"

if [ "$(printf '%s\n' "$REQUIRED" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED" ]; then
    echo "✓ Node.js version is now compatible (>= 20.18.0)"
    echo ""
    echo "Now running: yarn install"
    yarn install
    echo ""
    echo "=============================================="
    echo "✓ Fixed! Dependencies installed successfully"
    echo "=============================================="
else
    echo "✗ Warning: Node.js version is still too old"
    echo "  Required: >= 20.18.0"
    echo "  Current: $NODE_VERSION"
    exit 1
fi

