# 📚 Kedolik CP-Swap Documentation

Complete documentation for the Kedolik Constant Product AMM with KEDOLOG discount feature.

---

## 🚀 Quick Start

### For Deployment & Configuration:
1. **[Deployment Addresses](./NEW_DEPLOYMENT_ADDRESSES.md)** - All deployed contract addresses and config
2. **[Pool Creation Fee Guide](./POOL_CREATION_FEE_GUIDE.md)** - How the 0.15 SOL pool fee works
3. **[Fee Structure](./FINAL_FEE_STRUCTURE.md)** - Complete breakdown of all fees

### For Frontend Integration:
1. **[Frontend Integration Guide](./FRONTEND_UPDATE_GUIDE.md)** - Complete integration instructions
2. **[KEDOLOG Discount Feature](./KEDOLOG_DISCOUNT_FEATURE.md)** - How to implement the discount
3. **[Vite Integration](./VITE_INTEGRATION_GUIDE.md)** - Specific guide for Vite projects

### For Backend Verification:
1. **[KEDOLOG Backend Confirmed](./KEDOLOG_BACKEND_CONFIRMED.md)** - Proof that backend is configured
2. **[KEDOLOG Discount Guide](./KEDOLOG_DISCOUNT_GUIDE.md)** - Complete feature documentation

---

## 📊 Current Deployment (Devnet)

```
Program ID:              2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi
AMM Config:              6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt
Protocol Token Config:   7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv
KEDOLOG Mint:            22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx
```

---

## 💰 Fee Structure

| Fee Type | Amount | Recipient |
|----------|--------|-----------|
| **Pool Creation** | 0.15 SOL | Fee Receiver (67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa) |
| **Trade Fee (Total)** | 0.25% | Split between LP & Protocol |
| - LP Fee | 0.20% | Liquidity Providers |
| - Protocol Fee | 0.05% | Protocol Owner (JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa) |
| **KEDOLOG Discount** | 20% | On protocol fee only (0.05% → 0.04%) |

---

## 🎯 Key Features

✅ **Constant Product AMM** - Standard x*y=k formula  
✅ **Token2022 Support** - Works with both Token and Token2022  
✅ **Pool Creation Fee** - 0.15 SOL per pool (direct SOL transfer)  
✅ **KEDOLOG Discount** - 20% off protocol fees when paying with KEDOLOG  
✅ **Flexible Fee Structure** - Configurable fees for protocol, LP, and creator  

---

## 🔧 Useful Scripts

### Check Fees:
```bash
npx ts-node scripts/check-fees.ts
```

### Update KEDOLOG Price:
```bash
npx ts-node scripts/fetch-kedolog-price-from-pool.ts
```

### Deploy to Mainnet:
```bash
./scripts/deploy.sh mainnet
```

---

## 📖 Documentation Index

### Essential Guides:
- [NEW_DEPLOYMENT_ADDRESSES.md](./NEW_DEPLOYMENT_ADDRESSES.md) - All contract addresses
- [FRONTEND_UPDATE_GUIDE.md](./FRONTEND_UPDATE_GUIDE.md) - Frontend integration
- [KEDOLOG_DISCOUNT_GUIDE.md](./KEDOLOG_DISCOUNT_GUIDE.md) - Discount feature guide
- [POOL_CREATION_FEE_GUIDE.md](./POOL_CREATION_FEE_GUIDE.md) - Pool fee explanation

### Technical Details:
- [FEE_DISTRIBUTION_EXPLAINED.md](./FEE_DISTRIBUTION_EXPLAINED.md) - How fees are distributed
- [FINAL_FEE_STRUCTURE.md](./FINAL_FEE_STRUCTURE.md) - Complete fee breakdown
- [KEDOLOG_BACKEND_CONFIRMED.md](./KEDOLOG_BACKEND_CONFIRMED.md) - Backend verification
- [POOL_FEE_DIRECT_SOL.md](./POOL_FEE_DIRECT_SOL.md) - Direct SOL transfer explanation

### Integration:
- [VITE_INTEGRATION_GUIDE.md](./VITE_INTEGRATION_GUIDE.md) - Vite-specific integration
- [KEDOLOG_DISCOUNT_FEATURE.md](./KEDOLOG_DISCOUNT_FEATURE.md) - Discount implementation
- [SECURITY.md](./SECURITY.md) - Security considerations

---

## 🆘 Support

For issues or questions:
1. Check the relevant guide above
2. Run the diagnostic scripts
3. Verify on-chain configuration

---

## 🎉 Status

✅ **Deployed on Devnet**  
✅ **All Features Working**  
✅ **Ready for Frontend Integration**  
✅ **Ready for Mainnet Deployment**  

---

**Last Updated:** October 31, 2025
