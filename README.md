# Kedolik CP-Swap

A Solana-based Constant Product AMM (Automated Market Maker) with KEDOLOG token discount feature.

## 🚀 Quick Start

### Devnet Deployment
```bash
# Deploy to devnet
./scripts/deploy.sh devnet

# Initialize configuration
npx ts-node scripts/config/init-config.ts

# Activate KEDOLOG discount
npx ts-node scripts/activate-kedolog-discount.ts
```

### Mainnet Deployment
```bash
# Deploy to mainnet
./scripts/deploy.sh mainnet
```

---

## 📊 Current Deployment (Devnet)

```
Program ID:              2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi
AMM Config:              6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt
Protocol Token Config:   7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv
KEDOLOG Mint:            22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx
```

See [docs/NEW_DEPLOYMENT_ADDRESSES.md](./docs/NEW_DEPLOYMENT_ADDRESSES.md) for complete details.

---

## 💰 Fee Structure

| Fee Type | Amount | Description |
|----------|--------|-------------|
| Pool Creation | 0.15 SOL | One-time fee when creating a pool |
| Trade Fee | 0.25% | Total fee on each swap |
| - LP Fee | 0.20% | Goes to liquidity providers |
| - Protocol Fee | 0.05% | Goes to protocol owner |
| KEDOLOG Discount | 20% | Discount on protocol fee when paying with KEDOLOG |

---

## 🎯 Key Features

- ✅ **Constant Product AMM** - Standard x*y=k formula
- ✅ **Token & Token2022 Support** - Compatible with both token standards
- ✅ **Pool Creation Fee** - 0.15 SOL per pool (direct SOL transfer)
- ✅ **KEDOLOG Discount** - 20% off protocol fees
- ✅ **Flexible Configuration** - Adjustable fees and parameters

---

## 📚 Documentation

All documentation is in the [`docs/`](./docs/) folder:

- **[Complete Documentation Index](./docs/README.md)** - Start here
- **[Frontend Integration Guide](./docs/FRONTEND_UPDATE_GUIDE.md)** - For frontend developers
- **[KEDOLOG Discount Guide](./docs/KEDOLOG_DISCOUNT_GUIDE.md)** - Discount feature details
- **[Deployment Addresses](./docs/NEW_DEPLOYMENT_ADDRESSES.md)** - All contract addresses

---

## 🔧 Useful Commands

### Check Accumulated Fees
```bash
npx ts-node scripts/check-fees.ts
```

### Update KEDOLOG Price
```bash
npx ts-node scripts/fetch-kedolog-price-from-pool.ts
```

### Run Tests
```bash
anchor test
```

---

## 🏗️ Project Structure

```
raydium-cp-swap/
├── programs/cp-swap/     # Solana program (Rust)
├── scripts/              # Deployment & management scripts
├── tests/                # Integration tests
├── docs/                 # Complete documentation
└── target/               # Build artifacts & IDL
```

---

## 🛠️ Development

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Anchor 0.29+
- Node.js 18+

### Build
```bash
anchor build
```

### Test
```bash
anchor test
```

### Deploy
```bash
./scripts/deploy.sh <network>  # devnet or mainnet
```

---

## 📖 Learn More

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Constant Product AMM](https://docs.uniswap.org/protocol/V2/concepts/protocol-overview/how-uniswap-works)

---

## 📄 License

See [LICENSE](./LICENSE) file for details.

---

## 🆘 Support

For detailed guides and troubleshooting, see the [documentation](./docs/README.md).

---

**Status:** ✅ Deployed on Devnet | ✅ Ready for Mainnet
