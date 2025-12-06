# 🎯 KEDOL Discount Feature - Complete Guide

## ✅ Setup Complete!

The KEDOL discount feature is now **fully configured and active**!

---

## 📊 Current Configuration

```
KEDOL Price:     1 KEDOL = 0.10 USDC (10 KEDOL per 1 USD)
Discount Rate:     20% (when paying with KEDOL)
Protocol Fee:      0.05% (normal) → 0.04% (with KEDOL discount)
LP Fee:            0.20% (always the same, no discount)
```

---

## 🎯 How It Works

### **For Users:**

When swapping tokens, users have **2 options**:

#### **Option 1: Pay with SOL (Normal)**
```
Swap 100 SOL → Receive 99.75 SOL worth of tokens
- LP Fee: 0.20 SOL (goes to liquidity providers)
- Protocol Fee: 0.05 SOL (goes to protocol owner)
```

#### **Option 2: Pay with KEDOL (Discounted)**
```
Swap 100 SOL → Receive 99.80 SOL worth of tokens
- LP Fee: 0.20 SOL (goes to liquidity providers)
- Protocol Fee: 0.04% paid in KEDOL (20% discount!)
```

**Users save 0.01% when paying with KEDOL!**

---

## 🔧 How to Use (Frontend Integration)

### **Step 1: Check if User Has KEDOL**

```typescript
import { getAssociatedTokenAddress } from "@solana/spl-token";

const kedologMint = new PublicKey("22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx");
const userKedologAccount = await getAssociatedTokenAddress(
  kedologMint,
  userWallet.publicKey
);

const kedologBalance = await connection.getTokenAccountBalance(userKedologAccount);
const hasKedolog = kedologBalance.value.uiAmount > 0;
```

### **Step 2: Show Discount Option**

```typescript
if (hasKedolog) {
  // Show checkbox or toggle:
  // ☑ Pay protocol fee with KEDOL (Save 20%!)
}
```

### **Step 3: Call the Correct Instruction**

```typescript
if (useKedologDiscount) {
  // Use swap_base_input_with_protocol_token
  await program.methods
    .swapBaseInputWithProtocolToken(
      amountIn,
      minimumAmountOut
    )
    .accounts({
      // ... all accounts including protocol_token_user_account
    })
    .rpc();
} else {
  // Use regular swap_base_input
  await program.methods
    .swapBaseInput(
      amountIn,
      minimumAmountOut
    )
    .accounts({
      // ... regular accounts
    })
    .rpc();
}
```

---

## ❓ FAQ

### **Q: Is the discount automatic?**
**A:** No! Users must **explicitly choose** to pay with KEDOL. It's an optional feature.

### **Q: Is it enabled for all pools?**
**A:** Yes! Once the `ProtocolTokenConfig` is created (which you've done), the discount is available for **all pools** on your platform.

### **Q: Do I need to add pool addresses?**
**A:** No! The contract automatically calculates the KEDOL price from the `protocol_token_per_usd` value you just set.

### **Q: How often should I update the price?**
**A:** Run the price update script whenever KEDOL's price changes significantly:

```bash
npx ts-node scripts/fetch-kedol-price-from-pool.ts
```

You can automate this with a cron job or run it manually.

### **Q: What if a user doesn't have enough KEDOL?**
**A:** The transaction will fail. Your frontend should:
1. Check KEDOL balance before showing the discount option
2. Calculate required KEDOL amount and show it to the user
3. Only allow the discount if they have enough KEDOL

### **Q: Can I change the discount rate?**
**A:** Yes! As the authority, you can update it:

```bash
# Update to 25% discount
npx ts-node scripts/update-discount-rate.ts --rate 2500
```

---

## 📊 Price Calculation Example

Let's say a user swaps 100 SOL:

### **Normal Swap:**
- Trade Fee: 0.25% = 0.25 SOL
- LP gets: 0.20 SOL
- Protocol gets: 0.05 SOL (in SOL)
- User receives: 99.75 SOL worth of tokens

### **With KEDOL Discount:**
- Trade Fee: 0.24% = 0.24 SOL (only LP fee charged in swap)
- LP gets: 0.20 SOL
- Protocol gets: 0.04% in KEDOL tokens
  - 0.04% of 100 SOL = 0.04 SOL worth
  - At 10 KEDOL per USD, if SOL = $150:
  - 0.04 SOL = $6
  - User pays: 60 KEDOL
- User receives: 99.80 SOL worth of tokens

**User saves: 0.05 SOL worth = $7.50!**

---

## 🔍 Monitoring

### **Check Current Price:**
```bash
npx ts-node scripts/fetch-kedol-price-from-pool.ts
```

### **View Protocol Token Config:**
```bash
solana account 7ZRkzDLJQkhYvoyKKJXHjk1qy1ArKtX8iqbNF7F4sETv --url devnet
```

### **Check KEDOL Treasury Balance:**
The KEDOL fees are sent to the treasury address configured in the `ProtocolTokenConfig`.

---

## 🎉 Summary

✅ **KEDOL discount is ACTIVE**  
✅ **Price is set**: 1 KEDOL = 0.10 USDC  
✅ **Discount rate**: 20%  
✅ **Available for**: ALL pools  
✅ **User choice**: OPTIONAL (users choose at swap time)  

---

## 🚀 Next Steps

1. **Update your frontend** to show the discount option
2. **Test the feature** with a small swap
3. **Monitor the price** and update periodically
4. **Promote the feature** to your users!

---

**Need help? Check the frontend integration guide in `FRONTEND_UPDATE_GUIDE.md`**

