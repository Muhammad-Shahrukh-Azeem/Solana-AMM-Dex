#!/bin/bash
# =============================================================================
# Rebuild Kedolik Swap after rebranding
# =============================================================================
set -e

echo "=========================================="
echo "Rebuilding Kedolik Swap"
echo "=========================================="
echo ""

# Setup environment
source ~/.cargo/env 2>/dev/null || true
source ~/.nvm/nvm.sh 2>/dev/null || true
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Clean previous build
echo "Cleaning previous build artifacts..."
rm -rf target/deploy target/idl target/types
echo "✓ Cleaned"
echo ""

# Switch to nightly for IDL generation
echo "Switching to Rust nightly for IDL generation..."
rustup override set nightly
echo "Using: $(rustc --version)"
echo ""

# Build
echo "Building Kedolik Swap program..."
anchor build

# Switch back to stable
echo ""
echo "Switching back to Rust 1.81.0..."
rustup override set 1.81.0
echo "Using: $(rustc --version)"
echo ""

# Verify build
if [ -f "target/deploy/kedolik_cp_swap.so" ]; then
    echo "=========================================="
    echo "✓ Build Successful!"
    echo "=========================================="
    echo ""
    echo "Program binary:"
    ls -lh target/deploy/kedolik_cp_swap.so
    echo ""
    if [ -f "target/deploy/kedolik_cp_swap-keypair.json" ]; then
        PROGRAM_ID=$(solana-keygen pubkey target/deploy/kedolik_cp_swap-keypair.json)
        echo "Program ID: $PROGRAM_ID"
        echo ""
    fi
    if [ -f "target/idl/kedolik_cp_swap.json" ]; then
        echo "IDL generated:"
        ls -lh target/idl/kedolik_cp_swap.json
    fi
    if [ -f "target/types/kedolik_cp_swap.ts" ]; then
        echo "TypeScript types generated:"
        ls -lh target/types/kedolik_cp_swap.ts
    fi
    echo ""
    echo "=========================================="
    echo "Ready to test!"
    echo "=========================================="
    echo ""
    echo "Run: anchor test --skip-build"
else
    echo "=========================================="
    echo "✗ Build failed!"
    echo "=========================================="
    exit 1
fi

