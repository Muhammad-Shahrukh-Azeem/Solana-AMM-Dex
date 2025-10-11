#!/bin/bash
# =============================================================================
# Build IDL with Rust Nightly (workaround for proc-macro2 issue)
# =============================================================================
set -e

echo "Building IDL with Rust nightly workaround..."
echo ""

# Setup environment
source ~/.cargo/env 2>/dev/null || true
source ~/.nvm/nvm.sh 2>/dev/null || true
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Get current directory
PROJ_DIR="$(pwd)"

# Check current Rust version
echo "Current Rust version: $(rustc --version)"

# Temporarily switch to nightly for this directory only
echo "Temporarily switching to Rust nightly..."
rustup toolchain install nightly --profile minimal
rustup override set nightly

echo "Now using: $(rustc --version)"
echo ""

# Clean any partial builds
echo "Cleaning previous build artifacts..."
rm -rf target/idl target/types
mkdir -p target/idl target/types

# Build with nightly (this will generate the IDL)
echo "Building with Anchor (this will generate IDL)..."
anchor build

# Switch back to stable
echo ""
echo "Switching back to Rust 1.81.0..."
rustup override set 1.81.0

echo "Now using: $(rustc --version)"
echo ""

# Verify IDL was created
if [ -f "target/idl/raydium_cp_swap.json" ]; then
    echo "✓ IDL generated successfully!"
    ls -lh target/idl/
    echo ""
fi

if [ -f "target/types/raydium_cp_swap.ts" ]; then
    echo "✓ TypeScript types generated successfully!"
    ls -lh target/types/
    echo ""
fi

echo "==================================="
echo "✓ IDL build complete!"
echo "==================================="
echo ""
echo "You can now run: anchor test --skip-build"

