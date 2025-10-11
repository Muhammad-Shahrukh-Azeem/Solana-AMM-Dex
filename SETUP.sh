#!/bin/bash
# =============================================================================
# Raydium CP Swap - Complete Setup Script for WSL/Linux
# =============================================================================
# This script sets up everything from scratch including all prerequisites
# Run this in WSL/Linux after cloning the repository
#
# Usage: bash SETUP.sh
# =============================================================================

set -e  # Exit on error

echo "=============================================="
echo "Raydium CP Swap - Complete Setup"
echo "=============================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# =============================================================================
# Step 1: Install Rust
# =============================================================================
echo -e "${BLUE}Step 1: Installing Rust 1.81.0...${NC}"
if command -v rustc &> /dev/null; then
    echo -e "${GREEN}Rust is already installed: $(rustc --version)${NC}"
else
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.81.0
    source $HOME/.cargo/env
    echo -e "${GREEN}Rust 1.81.0 installed successfully${NC}"
fi

# Ensure correct version
source $HOME/.cargo/env
rustup default 1.81.0

# =============================================================================
# Step 2: Install Solana CLI
# =============================================================================
echo ""
echo -e "${BLUE}Step 2: Installing Solana CLI 2.1.0...${NC}"
if command -v solana &> /dev/null; then
    echo -e "${GREEN}Solana is already installed: $(solana --version)${NC}"
else
    sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    echo -e "${GREEN}Solana CLI 2.1.0 installed successfully${NC}"
fi

# Add Solana to PATH for this session
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# =============================================================================
# Step 3: Create Solana Keypair
# =============================================================================
echo ""
echo -e "${BLUE}Step 3: Setting up Solana keypair...${NC}"
if [ ! -f ~/.config/solana/id.json ]; then
    echo -e "${YELLOW}Creating new Solana keypair...${NC}"
    solana-keygen new --no-bip39-passphrase
    echo -e "${GREEN}Keypair created at ~/.config/solana/id.json${NC}"
else
    echo -e "${GREEN}Solana keypair already exists${NC}"
fi

# =============================================================================
# Step 4: Install Node.js via NVM
# =============================================================================
echo ""
echo -e "${BLUE}Step 4: Installing Node.js 20.x via NVM...${NC}"
if [ ! -d "$HOME/.nvm" ]; then
    echo -e "${YELLOW}Installing NVM...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
fi

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js 20 (LTS - minimum 20.18.0 required)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
    nvm install 20
    nvm use 20
    echo -e "${GREEN}Node.js installed: $(node --version)${NC}"
else
    CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_VERSION="20.18.0"
    echo -e "${GREEN}Node.js is already installed: v${CURRENT_NODE_VERSION}${NC}"
    
    # Check if current version is sufficient
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$CURRENT_NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ] && [ "$CURRENT_NODE_VERSION" != "$REQUIRED_VERSION" ]; then
        echo -e "${GREEN}Node.js version is sufficient${NC}"
    else
        echo -e "${YELLOW}Node.js version too old (need >= 20.18.0), upgrading...${NC}"
        nvm install 20
        nvm use 20
        echo -e "${GREEN}Upgraded to: $(node --version)${NC}"
    fi
fi

# =============================================================================
# Step 5: Install Yarn
# =============================================================================
echo ""
echo -e "${BLUE}Step 5: Installing Yarn...${NC}"
if ! command -v yarn &> /dev/null; then
    npm install -g yarn
    echo -e "${GREEN}Yarn installed: $(yarn --version)${NC}"
else
    echo -e "${GREEN}Yarn is already installed: $(yarn --version)${NC}"
fi

# =============================================================================
# Step 6: Install Anchor
# =============================================================================
echo ""
echo -e "${BLUE}Step 6: Installing Anchor CLI 0.31.0...${NC}"
if ! command -v anchor &> /dev/null; then
    echo -e "${YELLOW}Installing AVM (Anchor Version Manager)...${NC}"
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force || {
        echo -e "${YELLOW}AVM installation failed, trying alternative method...${NC}"
        cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.0 anchor-cli --locked --force
    }
    
    # Install Anchor 0.31.0
    if command -v avm &> /dev/null; then
        avm install 0.31.0
        avm use 0.31.0
    fi
    echo -e "${GREEN}Anchor installed successfully${NC}"
else
    echo -e "${GREEN}Anchor is already installed: $(anchor --version)${NC}"
fi

# =============================================================================
# Step 7: Verify Cargo.lock (check for stale kedolik references)
# =============================================================================
echo ""
echo -e "${BLUE}Step 7: Verifying Cargo.lock...${NC}"
if grep -q "kedolik" Cargo.lock 2>/dev/null; then
    echo -e "${YELLOW}Found stale references in Cargo.lock${NC}"
    echo -e "${YELLOW}Restoring original Cargo.lock from git...${NC}"
    git restore Cargo.lock 2>/dev/null || {
        echo -e "${RED}Could not restore from git. Trying to fix manually...${NC}"
        rm -f Cargo.lock
        cargo generate-lockfile
    }
    echo -e "${GREEN}Cargo.lock fixed${NC}"
else
    echo -e "${GREEN}Cargo.lock is clean${NC}"
fi

# =============================================================================
# Step 8: Install Node Dependencies
# =============================================================================
echo ""
echo -e "${BLUE}Step 8: Installing Node.js dependencies...${NC}"
yarn install
echo -e "${GREEN}Dependencies installed${NC}"

# =============================================================================
# Step 9: Build the Anchor Program
# =============================================================================
echo ""
echo -e "${BLUE}Step 9: Building Anchor program (this may take a few minutes)...${NC}"
anchor build
echo -e "${GREEN}Build completed successfully${NC}"

# =============================================================================
# Step 10: Verify Build Artifacts
# =============================================================================
echo ""
echo -e "${BLUE}Step 10: Verifying build artifacts...${NC}"
if [ -f "target/deploy/raydium_cp_swap.so" ]; then
    echo -e "${GREEN}✓ Program binary found: target/deploy/raydium_cp_swap.so${NC}"
    ls -lh target/deploy/raydium_cp_swap.so
elif [ -f "target/deploy/kedolik_cp_swap.so" ]; then
    echo -e "${YELLOW}⚠ Warning: Binary has old name (kedolik_cp_swap.so)${NC}"
    echo -e "${YELLOW}  Run 'anchor clean && anchor build' to fix this${NC}"
else
    echo -e "${RED}✗ Error: Program binary not found${NC}"
    exit 1
fi

if [ -f "target/deploy/raydium_cp_swap-keypair.json" ]; then
    echo -e "${GREEN}✓ Program keypair found${NC}"
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/raydium_cp_swap-keypair.json)
    echo -e "${GREEN}  Program ID: ${PROGRAM_ID}${NC}"
elif [ -f "target/deploy/kedolik_cp_swap-keypair.json" ]; then
    echo -e "${YELLOW}⚠ Using old keypair name${NC}"
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/kedolik_cp_swap-keypair.json)
    echo -e "${YELLOW}  Program ID: ${PROGRAM_ID}${NC}"
fi

# =============================================================================
# Step 11: Environment Configuration
# =============================================================================
echo ""
echo -e "${BLUE}Step 11: Checking environment configuration...${NC}"
echo -e "${GREEN}✓ Solana cluster: $(solana config get | grep 'RPC URL' | awk '{print $3}')${NC}"
echo -e "${GREEN}✓ Wallet: $(solana config get | grep 'Keypair Path' | awk '{print $3}')${NC}"

# =============================================================================
# Setup Complete
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Run tests:"
echo -e "   ${YELLOW}anchor test${NC}"
echo ""
echo "2. Or run individual test files:"
echo -e "   ${YELLOW}anchor test tests/initialize.test.ts${NC}"
echo -e "   ${YELLOW}anchor test tests/swap.test.ts${NC}"
echo -e "   ${YELLOW}anchor test tests/deposit.test.ts${NC}"
echo -e "   ${YELLOW}anchor test tests/withdraw.test.ts${NC}"
echo ""
echo "3. Build only:"
echo -e "   ${YELLOW}anchor build${NC}"
echo ""
echo "4. Clean build:"
echo -e "   ${YELLOW}anchor clean && anchor build${NC}"
echo ""
echo "5. Deploy to devnet:"
echo -e "   ${YELLOW}solana config set --url devnet${NC}"
echo -e "   ${YELLOW}solana airdrop 2${NC}"
echo -e "   ${YELLOW}anchor deploy${NC}"
echo ""
echo "=============================================="
echo -e "${BLUE}Environment Variables (add to ~/.bashrc or ~/.zshrc):${NC}"
echo ""
echo 'export PATH="$HOME/.cargo/bin:$PATH"'
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"'
echo 'export NVM_DIR="$HOME/.nvm"'
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
echo ""
echo "=============================================="

