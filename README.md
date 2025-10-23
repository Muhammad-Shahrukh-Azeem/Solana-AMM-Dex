# Kedolik CP-Swap

A Constant Product Automated Market Maker (AMM) built on Solana using the Anchor framework.

## 🚀 Quick Links

- **Program ID:** `F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc`
- **Network:** Solana Devnet
- **Explorer:** [View on Solana Explorer](https://explorer.solana.com/address/F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc?cluster=devnet)

## 📚 Documentation

### For Deployment Details
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Complete deployment details including all addresses, steps, and wallet information

### For Frontend Integration
- **[VITE_INTEGRATION_GUIDE.md](./VITE_INTEGRATION_GUIDE.md)** - Complete guide for integrating with your Vite-based frontend

### Additional Resources
- **[WHAT_IS_CP_SWAP.md](./WHAT_IS_CP_SWAP.md)** - Understanding Constant Product AMMs
- **[QUICK_START.md](./QUICK_START.md)** - Fast reference guide
- **[DEVNET_SETUP_COMPLETE.md](./DEVNET_SETUP_COMPLETE.md)** - Detailed deployment guide

## 🔑 Key Addresses

```typescript
// Program
PROGRAM_ID: "F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc"
AMM_CONFIG: "3EUgq3MYni6ui7EWnQaDfRXdJTqYPN4GsFFYd1Nb7ab6"

// Protocol Token
KEDOLOG: "DhKDRUdDLeSGM8tQjsCF8vewTffPFZwi3voZunY7RNsW"

// Test Tokens
USDC: "2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32"
SOL:  "6xuEzd4YE3XRXWdSRKZ6V2LELkR6tocvPcnu18E8rwjv"
ETH:  "CTHA8taNT2LgyQyj2xVD38nmnxTsCbAJ22Vsee4RvHF3"
BTC:  "ErGy4n8vBRw2mscMgbZg5rf3SdyDdk11LsaXKG8JJsoa"
```

## 🎯 What is CP-Swap?

CP-Swap is a **Constant Product** Automated Market Maker that uses the formula:

```
x × y = k
```

This is the same algorithm used by Uniswap V2, Raydium, and PancakeSwap. It automatically calculates token prices based on the ratio of tokens in liquidity pools.

**Key Features:**
- ✅ Permissionless pool creation
- ✅ Automatic price discovery
- ✅ Protocol token fee discounts (20% off with KEDOLOG)
- ✅ Token2022 support
- ✅ Configurable fee structure

## 🛠️ For Developers

### Prerequisites
- Node.js 16+
- Rust 1.70+
- Solana CLI 1.16+
- Anchor 0.31.1

### Building the Program

```bash
# Install dependencies
npm install

# Build program
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Frontend Integration

See **[VITE_INTEGRATION_GUIDE.md](./VITE_INTEGRATION_GUIDE.md)** for complete integration instructions.

**Quick Start:**

```bash
# Install dependencies in your Vite project
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token

# Copy required files
cp target/idl/kedolik_cp_swap.json your-project/src/idl/
cp WEBSITE_CONFIG.ts your-project/src/config/
cp devnet-addresses.json your-project/src/config/
```

## 📦 Project Structure

```
raydium-cp-swap/
├── programs/
│   └── cp-swap/
│       └── src/
│           ├── lib.rs                    # Program entry point
│           ├── instructions/             # All instructions
│           ├── states/                   # Account states
│           ├── curve/                    # AMM math
│           └── error.rs                  # Error codes
├── tests/                                # Integration tests
├── scripts/                              # Deployment scripts
├── target/
│   ├── deploy/                           # Compiled program
│   └── idl/                              # Program IDL
├── DEPLOYMENT_SUMMARY.md                 # 📋 All deployment details
├── VITE_INTEGRATION_GUIDE.md             # 🚀 Frontend integration guide
├── devnet-addresses.json                 # All deployed addresses
└── WEBSITE_CONFIG.ts                     # Ready-to-use config
```

## 🎨 Features

### Core AMM Features
- **Create Pools:** Create liquidity pools for any token pair
- **Swap Tokens:** Trade tokens using the constant product formula
- **Add Liquidity:** Provide liquidity and earn fees
- **Remove Liquidity:** Withdraw your liquidity at any time

### Advanced Features
- **Protocol Token Discount:** Pay fees with KEDOLOG for 20% discount
- **Transfer Fee Support:** Compatible with Token2022 transfer fees
- **Configurable Fees:** Flexible fee structure (trade, protocol, creator)
- **Price Oracle Ready:** Prepared for dynamic price feeds

## 💰 Fee Structure

| Fee Type | Rate | Description |
|----------|------|-------------|
| Trade Fee | 1% | Fee on every swap |
| Protocol Fee | 100% | All trade fees go to protocol |
| Protocol Token Discount | 20% | Discount when paying with KEDOLOG |

## 🧪 Testing

```bash
# Run all tests
anchor test

# Run specific test
anchor test --skip-local-validator tests/swap.test.ts

# Watch logs
solana logs F3mHkHDh3A61A3mp9dd35DzhypacRRKeEKYDNh4dQqRc --url devnet
```

## 📖 Learn More

- **Solana Documentation:** https://docs.solana.com/
- **Anchor Documentation:** https://www.anchor-lang.com/
- **Uniswap V2 Whitepaper:** https://uniswap.org/whitepaper.pdf

## 🔒 Security

- ⚠️ This is a devnet deployment for testing purposes
- ⚠️ Get a professional audit before mainnet deployment
- ⚠️ Keep your wallet private key secure
- ⚠️ Never commit private keys to version control

## 📞 Support

For questions or issues:
1. Check the documentation files
2. Review the integration guide
3. Test on devnet first
4. Review Solana Explorer for transaction details

## 📝 License

This project is licensed under the MIT License.

---

**Status:** ✅ Deployed on Devnet  
**Last Updated:** October 22, 2025  
**Ready for:** Frontend Integration & Testing

## 🚀 Next Steps

1. ✅ Program deployed
2. ✅ Tokens created
3. ✅ AMM config initialized
4. ✅ Documentation complete
5. ⏳ **Frontend integration** ← You are here
6. ⏳ Testing & refinement
7. ⏳ Mainnet preparation

**Start with:** [VITE_INTEGRATION_GUIDE.md](./VITE_INTEGRATION_GUIDE.md)
