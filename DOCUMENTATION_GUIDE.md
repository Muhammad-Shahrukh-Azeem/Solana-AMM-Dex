# 📚 Documentation Quick Reference

## 🎯 What You Need to Know

All documentation is now organized in the `docs/` folder. Here's what each file contains:

---

## 📖 Essential Documents

### 1. **[docs/README.md](./docs/README.md)** - START HERE
   - Complete documentation index
   - Quick links to all guides
   - Current deployment info

### 2. **[docs/NEW_DEPLOYMENT_ADDRESSES.md](./docs/NEW_DEPLOYMENT_ADDRESSES.md)**
   - All contract addresses (Program ID, configs, etc.)
   - Transaction signatures
   - Fee configuration values

### 3. **[docs/FRONTEND_UPDATE_GUIDE.md](./docs/FRONTEND_UPDATE_GUIDE.md)**
   - Complete frontend integration guide
   - Code examples for swaps, pools, etc.
   - Account derivation examples

---

## 💰 Fee & Feature Guides

### 4. **[docs/KEDOLOG_DISCOUNT_GUIDE.md](./docs/KEDOLOG_DISCOUNT_GUIDE.md)**
   - How the 20% discount works
   - Integration examples
   - Price calculation logic

### 5. **[docs/POOL_CREATION_FEE_GUIDE.md](./docs/POOL_CREATION_FEE_GUIDE.md)**
   - 0.15 SOL pool creation fee explained
   - How it's charged (direct SOL transfer)
   - Fee receiver address

### 6. **[docs/FEE_DISTRIBUTION_EXPLAINED.md](./docs/FEE_DISTRIBUTION_EXPLAINED.md)**
   - How fees are split (0.20% LP, 0.05% protocol)
   - Fee accumulation and claiming

### 7. **[docs/FINAL_FEE_STRUCTURE.md](./docs/FINAL_FEE_STRUCTURE.md)**
   - Complete breakdown of all fees
   - Examples and calculations

---

## 🔧 Technical Details

### 8. **[docs/KEDOLOG_BACKEND_CONFIRMED.md](./docs/KEDOLOG_BACKEND_CONFIRMED.md)**
   - Proof that backend is configured correctly
   - Debugging checklist for frontend
   - Common integration mistakes

### 9. **[docs/POOL_FEE_DIRECT_SOL.md](./docs/POOL_FEE_DIRECT_SOL.md)**
   - Why we use direct SOL (not WSOL)
   - Benefits and implementation

### 10. **[docs/SECURITY.md](./docs/SECURITY.md)**
   - Security considerations
   - Best practices

---

## 🌐 Integration Guides

### 11. **[docs/VITE_INTEGRATION_GUIDE.md](./docs/VITE_INTEGRATION_GUIDE.md)**
   - Specific guide for Vite projects
   - Setup and configuration

### 12. **[docs/KEDOLOG_DISCOUNT_FEATURE.md](./docs/KEDOLOG_DISCOUNT_FEATURE.md)**
   - Detailed discount feature implementation
   - Frontend code examples

---

## 🚀 Quick Commands

### Check Fees:
```bash
npx ts-node scripts/check-fees.ts
```

### Update KEDOLOG Price:
```bash
npx ts-node scripts/fetch-kedolog-price-from-pool.ts
```

### Deploy:
```bash
./scripts/deploy.sh devnet  # or mainnet
```

---

## 📊 Current Status

✅ **Deployed on Devnet**  
✅ **All Features Working**  
✅ **Documentation Organized**  
✅ **Ready for Integration**  

---

## 🎯 For Different Roles

### If you're a **Frontend Developer**:
1. Read [docs/FRONTEND_UPDATE_GUIDE.md](./docs/FRONTEND_UPDATE_GUIDE.md)
2. Check [docs/KEDOLOG_DISCOUNT_GUIDE.md](./docs/KEDOLOG_DISCOUNT_GUIDE.md)
3. Use [docs/NEW_DEPLOYMENT_ADDRESSES.md](./docs/NEW_DEPLOYMENT_ADDRESSES.md) for addresses

### If you're **Deploying to Mainnet**:
1. Read [docs/NEW_DEPLOYMENT_ADDRESSES.md](./docs/NEW_DEPLOYMENT_ADDRESSES.md)
2. Run `./scripts/deploy.sh mainnet`
3. Update addresses in your config

### If you're **Debugging**:
1. Check [docs/KEDOLOG_BACKEND_CONFIRMED.md](./docs/KEDOLOG_BACKEND_CONFIRMED.md)
2. Run `npx ts-node scripts/check-fees.ts`
3. Verify on-chain config

---

**Everything is in `docs/` - start with [docs/README.md](./docs/README.md)!**
