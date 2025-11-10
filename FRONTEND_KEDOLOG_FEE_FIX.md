# Frontend KEDOLOG Fee Calculation Fix

## 🐛 **The Problem**

For **SOL → KEDOLOG** swaps, the frontend is showing **2134 KEDOLOG** fee instead of the correct **~0.49 KEDOLOG**.

**Root cause**: Frontend is using wrong SOL price (764,419 instead of 175)

---

## ✅ **The Fix**

### **1. Pass Correct Accounts for SOL-based Swaps**

When swapping **SOL → Any Token** (except SOL → USDC direct), pass **6 accounts** in `remainingAccounts`:

```typescript
// For SOL → KEDOLOG, SOL → Other tokens
remainingAccounts: [
  // KEDOLOG/USDC pool (indices 0-2)
  { pubkey: 'BE1AdLaWKGPV61cmdV2W6aw7GY5fBRc59noUascPBje', isSigner: false, isWritable: false },
  { pubkey: 'Gg2roHP4aRbNvjbQRj7cxB1XvLKdBw45UkrNn9eeC8DJ', isSigner: false, isWritable: false },
  { pubkey: '2yVnJLxM9Dw8YHxrEQQgvPJ12RXYXcqdYyLXftYzbJCt', isSigner: false, isWritable: false },
  
  // SOL/USDC pool (indices 3-5) - ADD THESE!
  { pubkey: '4pS9NNCmuSxCeE2KStwnVLujouoAPRuFJnmKd12fjs1U', isSigner: false, isWritable: false },
  { pubkey: 'E2TxGdGJyk1yWG3oYMcRtcw8hcQiLGugjwCxWYTFE3S8', isSigner: false, isWritable: false },
  { pubkey: 'J2219iKwxifoweHJW5beAmT7KYWzUpqjscQviMKew4Qa', isSigner: false, isWritable: false },
]
```

### **2. Fix SOL Price Calculation**

```typescript
// ❌ WRONG - Don't use this:
const solPrice = 764419.76; // Hardcoded or wrong source

// ✅ CORRECT - Read from SOL/USDC pool:
const solVaultBalance = await connection.getTokenAccountBalance(SOL_VAULT);
const usdcVaultBalance = await connection.getTokenAccountBalance(USDC_VAULT);

const solReserve = parseFloat(solVaultBalance.value.amount) / 1e9;
const usdcReserve = parseFloat(usdcVaultBalance.value.amount) / 1e6;

const solPrice = usdcReserve / solReserve; // Should be ~175
```

### **3. Calculate KEDOLOG Fee Correctly**

```typescript
// Example: 0.01 SOL → KEDOLOG swap
const amountIn = 0.01; // SOL
const solPrice = 175.33; // From SOL/USDC pool
const kedologPrice = 0.001341; // From KEDOLOG/USDC pool

// Step 1: Convert to USD
const amountInUsd = amountIn * solPrice; // 0.01 * 175.33 = 1.7533 USD

// Step 2: Calculate protocol fee
const protocolFeeRate = 0.0005; // 0.05%
const protocolFeeUsd = amountInUsd * protocolFeeRate; // 1.7533 * 0.0005 = 0.00087665 USD

// Step 3: Apply 25% discount
const discountRate = 0.25;
const discountedFeeUsd = protocolFeeUsd * (1 - discountRate); // 0.00087665 * 0.75 = 0.00065749 USD

// Step 4: Convert to KEDOLOG
const kedologFee = discountedFeeUsd / kedologPrice; // 0.00065749 / 0.001341 = 0.49 KEDOLOG ✅
```

---

## 📋 **Quick Reference**

| Swap Type | Accounts Needed | Count |
|-----------|----------------|-------|
| USDC → Any | KEDOLOG/USDC pool + vaults | 3 |
| Any → USDC | KEDOLOG/USDC pool + vaults | 3 |
| SOL → Any (not USDC) | KEDOLOG/USDC + SOL/USDC pools + vaults | 6 |
| Any (not USDC) → SOL | KEDOLOG/USDC + SOL/USDC pools + vaults | 6 |
| SOL ↔ USDC | KEDOLOG/USDC + SOL/USDC pools + vaults | 6 |

---

## 🎯 **Expected Results**

| Swap | Amount | Expected KEDOLOG Fee |
|------|--------|---------------------|
| 1 USDC → SOL | 1 USDC | ~0.28 KEDOLOG |
| 0.005 SOL → USDC | ~$0.88 | ~0.28 KEDOLOG |
| 0.01 SOL → KEDOLOG | ~$1.75 | ~0.49 KEDOLOG |

All fees should match between frontend display and actual on-chain transaction!

