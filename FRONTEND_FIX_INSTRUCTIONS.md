# 🔧 Frontend Fix Instructions - KEDOLOG Discount Calculation

**Date**: November 10, 2025  
**Issue**: KEDOLOG fee calculation is incorrect for certain token pairs  
**Status**: Contract is fixed, frontend needs updates

---

## 🎯 **What Needs to Be Fixed**

The frontend KEDOLOG fee calculation is showing incorrect amounts for some swaps because:

1. **SOL → KEDOLOG swaps**: Frontend is NOT passing the SOL/USDC pool in `remainingAccounts`
2. **Fee calculation logic**: Frontend might be using wrong price for some token pairs

---

## 📋 **Required Changes**

### **1. Update `remainingAccounts` Logic**

The contract expects different accounts based on the swap pair:

#### **For USDC → Any Token (or Any Token → USDC)**
```typescript
remainingAccounts: [
  // KEDOLOG/USDC pool (for KEDOLOG price)
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_1, isSigner: false, isWritable: false },
]
```

#### **For SOL → Any Token (or Any Token → SOL) - EXCEPT SOL ↔ USDC**
```typescript
remainingAccounts: [
  // KEDOLOG/USDC pool (for KEDOLOG price)
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_1, isSigner: false, isWritable: false },
  
  // SOL/USDC pool (for SOL price)
  { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: SOL_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: SOL_VAULT_1, isSigner: false, isWritable: false },
]
```

#### **For SOL ↔ USDC (Direct Swap)**
```typescript
remainingAccounts: [
  // KEDOLOG/USDC pool (for KEDOLOG price)
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_VAULT_1, isSigner: false, isWritable: false },
  
  // SOL/USDC pool (for SOL price) - OPTIONAL but recommended
  { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: SOL_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: SOL_VAULT_1, isSigner: false, isWritable: false },
]
```

---

## 🔍 **How to Determine Which Accounts to Pass**

```typescript
function getRemainingAccountsForSwap(
  inputMint: PublicKey,
  outputMint: PublicKey
): AccountMeta[] {
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  const USDC_MINT = new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32'); // Your USDC mint
  
  // Always include KEDOLOG/USDC pool
  const accounts: AccountMeta[] = [
    { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
    { pubkey: KEDOLOG_VAULT_0, isSigner: false, isWritable: false },
    { pubkey: KEDOLOG_VAULT_1, isSigner: false, isWritable: false },
  ];
  
  // Check if we need SOL/USDC pool
  const inputIsSol = inputMint.equals(SOL_MINT);
  const outputIsSol = outputMint.equals(SOL_MINT);
  const inputIsUsdc = inputMint.equals(USDC_MINT);
  const outputIsUsdc = outputMint.equals(USDC_MINT);
  
  // Add SOL/USDC pool if either token is SOL (and the other is NOT USDC in the same pool)
  if ((inputIsSol || outputIsSol) && !(inputIsSol && outputIsUsdc) && !(outputIsSol && inputIsUsdc)) {
    accounts.push(
      { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
      { pubkey: SOL_VAULT_0, isSigner: false, isWritable: false },
      { pubkey: SOL_VAULT_1, isSigner: false, isWritable: false },
    );
  }
  
  // For SOL ↔ USDC swaps, also add SOL/USDC pool (contract uses current pool reserves)
  if ((inputIsSol && outputIsUsdc) || (outputIsSol && inputIsUsdc)) {
    accounts.push(
      { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
      { pubkey: SOL_VAULT_0, isSigner: false, isWritable: false },
      { pubkey: SOL_VAULT_1, isSigner: false, isWritable: false },
    );
  }
  
  return accounts;
}
```

---

## 💰 **Frontend Fee Calculation Logic**

The frontend should calculate the KEDOLOG fee the **same way** the contract does:

### **Step 1: Get USD Value of Fee**

```typescript
function calculateFeeInUsd(
  feeAmountInInputToken: number,
  inputTokenMint: PublicKey,
  inputTokenDecimals: number,
  outputTokenMint: PublicKey,
): number {
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  const USDC_MINT = new PublicKey('2YAPUKzhzPDnV3gxHew5kUUt1L157Tdrdbv7Gbbg3i32');
  
  // Case 1: Input is USDC - direct USD value
  if (inputTokenMint.equals(USDC_MINT)) {
    return feeAmountInInputToken; // Already in USD
  }
  
  // Case 2: Input is SOL - get SOL price from SOL/USDC pool
  if (inputTokenMint.equals(SOL_MINT)) {
    const solPrice = getSolPriceFromPool(); // Read from SOL/USDC pool
    return feeAmountInInputToken * solPrice;
  }
  
  // Case 3: Other tokens - would need 1-hop pricing (not implemented yet)
  throw new Error('Unsupported token pair');
}
```

### **Step 2: Apply Discount**

```typescript
const protocolFeeRate = 0.0005; // 0.05% = 500 / 1,000,000
const discountRate = 0.25; // 25% = 2500 / 10,000

const feeUsd = calculateFeeInUsd(amountIn, inputMint, inputDecimals, outputMint);
const protocolFeeUsd = feeUsd * protocolFeeRate;
const discountedFeeUsd = protocolFeeUsd * (1 - discountRate); // Apply 25% discount
```

### **Step 3: Convert to KEDOLOG**

```typescript
const kedologPrice = getKedologPriceFromPool(); // Read from KEDOLOG/USDC pool
const kedologFee = discountedFeeUsd / kedologPrice;
```

---

## 🔧 **Reference Pool Addresses (Devnet)**

Use these addresses from the generated config file:

```typescript
// From reference-pools-devnet-1762745361622.json
export const KEDOLOG_USDC_POOL = new PublicKey('BE1AdLaWKGPV61cmdV2W6aw7GY5fBRc59noUascPBje');
export const KEDOLOG_VAULT_0 = new PublicKey('Gg2roHP4aRbNvjbQRj7cxB1XvLKdBw45UkrNn9eeC8DJ');
export const KEDOLOG_VAULT_1 = new PublicKey('2yVnJLxM9Dw8YHxrEQQgvPJ12RXYXcqdYyLXftYzbJCt');

export const SOL_USDC_POOL = new PublicKey('4pS9NNCmuSxCeE2KStwnVLujouoAPRuFJnmKd12fjs1U');
export const SOL_VAULT_0 = new PublicKey('E2TxGdGJyk1yWG3oYMcRtcw8hcQiLGugjwCxWYTFE3S8');
export const SOL_VAULT_1 = new PublicKey('J2219iKwxifoweHJW5beAmT7KYWzUpqjscQviMKew4Qa');

export const KEDOLOG_SOL_POOL = new PublicKey('DLUJbJopAcZXvu7a2g8sY2CrqJyjtRx48G6M1WbFGiBn');
export const KEDOLOG_SOL_VAULT_0 = new PublicKey('H9Bxiu8YuUV8zkshUFBMHX8fPYEShL4tWZiZtzXJe92K');
export const KEDOLOG_SOL_VAULT_1 = new PublicKey('FXsF5NZjcQxbU761XgA3fAHGdbcYDMPZxihEmfAK9ma');
```

---

## 🐛 **Current Issue**

Based on the logs, the frontend is:
1. ✅ Correctly calculating the fee for USDC-based swaps
2. ❌ **NOT passing SOL/USDC pool** for SOL → KEDOLOG swaps
3. ❌ Using an incorrect SOL price (764,331 instead of ~175)

### **What's Happening Now**

```typescript
// Frontend logs show:
inputTokenPrice: 764419.7559184263  // ❌ WRONG! Should be ~175

// This is causing:
amountInUsd: 7643.319647  // ❌ WRONG! Should be ~1.75
kedologFee: 2134.2302     // ❌ WRONG! Should be ~0.29
```

### **What Should Happen**

```typescript
// Correct calculation:
const solPrice = 175.33;              // ✅ From SOL/USDC pool
const amountIn = 0.01;                // SOL
const amountInUsd = 0.01 * 175.33;    // = 1.7533 USD
const protocolFeeUsd = 1.7533 * 0.0005; // = 0.00087665 USD
const discountedFeeUsd = 0.00087665 * 0.75; // = 0.00065749 USD (25% discount)
const kedologPrice = 0.001341;        // From KEDOLOG/USDC pool
const kedologFee = 0.00065749 / 0.001341; // = 0.49 KEDOLOG ✅
```

---

## ✅ **Testing Checklist**

After implementing the fix, test these scenarios:

### **1. USDC → SOL**
- [ ] Frontend shows correct KEDOLOG fee (~0.29 for 1 USDC)
- [ ] Transaction succeeds
- [ ] On-chain fee matches frontend calculation

### **2. SOL → USDC**
- [ ] Frontend shows correct KEDOLOG fee (~0.29 for 0.005 SOL @ $175)
- [ ] Transaction succeeds
- [ ] On-chain fee matches frontend calculation

### **3. SOL → KEDOLOG**
- [ ] Frontend shows correct KEDOLOG fee (~0.49 for 0.01 SOL @ $175)
- [ ] Transaction succeeds
- [ ] On-chain fee matches frontend calculation
- [ ] **MUST pass 6 accounts in remainingAccounts**

### **4. KEDOLOG → SOL**
- [ ] Frontend shows correct KEDOLOG fee
- [ ] Transaction succeeds
- [ ] On-chain fee matches frontend calculation
- [ ] **MUST pass 6 accounts in remainingAccounts**

---

## 🚨 **Critical Points**

1. **Always pass KEDOLOG/USDC pool** (3 accounts)
2. **Pass SOL/USDC pool** (3 more accounts) when:
   - Input is SOL (and output is NOT USDC in a direct swap)
   - Output is SOL (and input is NOT USDC in a direct swap)
   - Input is SOL and output is USDC (for accurate pricing)
   - Output is SOL and input is USDC (for accurate pricing)

3. **Use dynamic prices**:
   - Read SOL price from SOL/USDC pool reserves
   - Read KEDOLOG price from KEDOLOG/USDC pool reserves
   - Never use hardcoded prices

4. **Match contract logic exactly**:
   - Protocol fee rate: 0.05% (500 / 1,000,000)
   - Discount rate: 25% (2500 / 10,000)
   - Apply discount to protocol fee, not total fee

---

## 📞 **Need Help?**

If you encounter issues:

1. **Check the transaction logs** - they show exactly what the contract is doing
2. **Verify remainingAccounts order** - must match the contract's expectations
3. **Compare frontend calculation with on-chain result** - they should match exactly
4. **Test on devnet first** - don't deploy to mainnet until all tests pass

---

## 🎯 **Expected Outcome**

After this fix:
- ✅ Frontend KEDOLOG fee = On-chain KEDOLOG fee (for all token pairs)
- ✅ All swaps work without errors
- ✅ Dynamic pricing for all tokens
- ✅ Correct 25% discount applied

**Current Program ID (Devnet)**: `4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf`

