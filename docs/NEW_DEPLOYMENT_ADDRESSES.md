# 🎉 NEW DEPLOYMENT - Fresh Contract Addresses

**Deployed**: October 30, 2025  
**Network**: Devnet  
**Status**: ✅ Ready for Frontend Integration

---

## 🆕 NEW CONTRACT ADDRESSES

### **Program (NEW)**
```
Program ID: 2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi
```
**⚠️ IMPORTANT**: This is a COMPLETELY NEW deployment with a NEW program ID!

### **Configuration Accounts (NEW)**
```
AMM Config: 6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt
Protocol Token Config: 7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv
```

### **Token Addresses (SAME)**
```
KEDOL Mint: 22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx
Protocol Owner: JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa
Pool Creation Fee Receiver: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
```

---

## 📋 For Frontend Team

### **Update Your Config File**

```typescript
// OLD (Remove these)
const OLD_PROGRAM_ID = "GCm8bqvSuJ4nwj3SN3pk2eSJWTwcRjkU6KhXE96AnBod";
const OLD_AMM_CONFIG = "DUzS92SbYFFN66vPGUoJqwqS2rfEBmB8CvX1EinesMZG";
const OLD_PROTOCOL_CONFIG = "JA8cRHzw2iDEh79iSHtbLa7dJU7R7KoDCWT4sJQbWvGV";

// NEW (Use these)
export const CONTRACT_CONFIG = {
  programId: "2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi", // ⚠️ CHANGED
  ammConfig: "6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt", // ⚠️ CHANGED
  protocolTokenConfig: "7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv", // ⚠️ CHANGED
  kedologMint: "22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx", // ✅ SAME
  network: "devnet",
};
```

### **Update IDL File**

```bash
# Copy the NEW IDL
cp target/idl/kedolik_cp_swap.json your-frontend/src/idl/

# The IDL now has the new program ID:
# "address": "2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi"
```

---

## ✅ What's Configured

### **Fee Structure**
- ✅ Trade Fee: 0.25%
- ✅ LP Fee: 0.20%
- ✅ Protocol Fee: 0.05%
- ✅ Pool Creation Fee: 0 SOL (can be updated to 0.15 SOL)

### **KEDOL Discount**
- ✅ Discount Rate: 20%
- ✅ KEDOL Price: 10 per USD
- ✅ Treasury: JAaHqf4p14eNij84tygdF1nQkKV8MU3h7Pi4VCtDYiqa

---

## 🔄 Migration Steps

### **For Frontend**

1. **Update Program ID**
   ```typescript
   // Change from:
   "GCm8bqvSuJ4nwj3SN3pk2eSJWTwcRjkU6KhXE96AnBod"
   
   // To:
   "2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi"
   ```

2. **Update Config Addresses**
   ```typescript
   ammConfig: "6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt"
   protocolTokenConfig: "7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv"
   ```

3. **Copy New IDL**
   ```bash
   cp target/idl/kedolik_cp_swap.json frontend/src/idl/
   ```

4. **Test on Devnet**
   - Create a test pool
   - Test normal swap
   - Test KEDOL discount swap
   - Verify fees

---

## 📊 Comparison

| Item | Old Address | New Address |
|------|-------------|-------------|
| **Program ID** | `GCm8bqvSuJ4nwj3SN3pk2eSJWTwcRjkU6KhXE96AnBod` | `2LdLPZbRokzmcJyFE7fLyTgMKNxuR9PE6PKfunn6fkUi` ⚠️ |
| **AMM Config** | `DUzS92SbYFFN66vPGUoJqwqS2rfEBmB8CvX1EinesMZG` | `6cYBQxes3T5CRStVgKNV4GiURNu2nCcUwmHwEWCcP4Zt` ⚠️ |
| **Protocol Config** | `JA8cRHzw2iDEh79iSHtbLa7dJU7R7KoDCWT4sJQbWvGV` | `7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv` ⚠️ |
| **KEDOL Mint** | `22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx` | `22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx` ✅ |

---

## 🎯 What Changed vs What Stayed Same

### **Changed ⚠️**
- Program ID (completely new deployment)
- AMM Config address (derived from new program ID)
- Protocol Token Config address (derived from new program ID)

### **Stayed Same ✅**
- KEDOL token mint
- Fee structure (0.25% total)
- Discount rate (20%)
- Pool creation fee receiver address
- Protocol owner address

---

## 🚀 Ready to Use!

Your new contract is:
- ✅ Deployed on devnet
- ✅ Configured with fees
- ✅ KEDOL discount activated
- ✅ Ready for frontend integration

**Files to Give Frontend:**
1. `target/idl/kedolik_cp_swap.json` (NEW IDL with new program ID)
2. `FRONTEND_UPDATE_GUIDE.md` (Integration guide)
3. `QUICK_UPDATE_SUMMARY.md` (Quick reference)
4. This file (`NEW_DEPLOYMENT_ADDRESSES.md`)

---

## 📝 Transactions

- **Program Deploy**: `27KXiKyCnEhNRJRf9qmcazhsZERFQRBChEpk9iQa6aXfKCSWU75mmUw8woj73XxGpuSbeH4BQ9bcVDqKWo4SRbmQ`
- **AMM Config**: `3o36K6ND62zrv4NjmapTckVQeeTDDpRUVXXLzNgKLcrneR99WVczE7cwnacCcLTwyAWhegKoXaStJNqxNwSJggyS`
- **Protocol Config**: `4ATxeCpzcFZvvo5S4bTdaTPz8KDgj6aPciTXUddDbyfGJQ9hrgTFJDCBEAjJbwGeCzSDhuqjPEvJjqNLaBb4QMPn`

---

**🎉 New deployment complete! Update your frontend with the new addresses above.**

