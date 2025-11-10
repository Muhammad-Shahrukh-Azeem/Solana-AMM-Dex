# 🐛 KEDOLOG Fee Calculation Bug Analysis

## 📊 Problem Summary

You reported two issues:

### Issue 1: Different fees for equivalent swaps
- **SOL → KEDOLOG**: Swapping 0.000995 SOL shows fee of **0.04 KEDOLOG** ✅ (correct on-chain)
- **KEDOLOG → SOL**: Swapping 753 KEDOLOG (equivalent value) shows fee of **211.81 KEDOLOG** ❌ (frontend), but only **0.04 KEDOLOG** charged on-chain

### Issue 2: Frontend calculation mismatch
- Frontend shows: **211.81 KEDOLOG**
- Actual on-chain charge: **0.04 KEDOLOG** (100x less!)

---

## 🔍 Root Cause Analysis

### The Core Problem

When swapping **KEDOLOG → SOL**, the contract enters "Case 0" in the pricing logic:

```rust
// Line 299-317 in price_oracle.rs
if *input_token_mint == protocol_token_config.protocol_token_mint {
    // Case 0: Input is KEDOLOG itself - get KEDOLOG price directly
    let kedolog_price_usd = get_kedolog_usdc_price(...)?;
    
    // Convert KEDOLOG fee to USD
    let fee_usd = (fee_amount_in_input_token as u128)
        .checked_mul(kedolog_price_usd)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10u128.pow(input_token_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;
    
    fee_usd
}

// Then later (line 548-559):
// Convert USD back to KEDOLOG
let kedolog_amount = (fee_value_in_usd * 10^9) / kedolog_price_usd;
```

### What's Happening

1. **Fee amount**: 211.81 KEDOLOG (in smallest units: 211,810,000,000)
2. **KEDOLOG price**: ~$0.00134 (scaled: 1,341,000)
3. **Step 1**: Convert KEDOLOG → USD
   - `fee_usd = (211,810,000,000 * 1,341,000) / 10^9`
   - `fee_usd = 283,997,310` (scaled USD)
4. **Step 2**: Convert USD → KEDOLOG
   - `kedolog_amount = (283,997,310 * 10^9) / 1,341,000`
   - `kedolog_amount = 211,810,000,000` ✅ Should work!

**BUT** there's a scaling issue causing the final result to be 100x less!

---

## 🎯 The Real Issue

### Case 0 Logic is Wrong

When the **input token IS KEDOLOG**, and the **fee is paid IN KEDOLOG**, the contract should:

**❌ Current behavior:**
1. Take KEDOLOG fee amount
2. Convert to USD
3. Convert back to KEDOLOG
4. Return result (with scaling errors)

**✅ Correct behavior:**
1. Recognize fee is already in KEDOLOG
2. **Return the fee amount directly** (no conversion needed!)

### Why This Matters

- **SOL → KEDOLOG swap**: 
  - Fee is in SOL
  - Contract converts SOL → USD → KEDOLOG ✅ Correct
  
- **KEDOLOG → SOL swap**:
  - Fee is in KEDOLOG
  - Contract converts KEDOLOG → USD → KEDOLOG ❌ Unnecessary!
  - Should just return the KEDOLOG fee amount directly

---

## 🔧 The Fix

### Option 1: Direct Return (Simplest)

When input token is KEDOLOG, just return the fee amount:

```rust
if *input_token_mint == protocol_token_config.protocol_token_mint {
    // Case 0: Input is KEDOLOG - fee is already in KEDOLOG!
    msg!("Case 0: Input token is KEDOLOG - fee already in protocol token");
    
    // The fee is already in KEDOLOG, no conversion needed
    // Just verify it's non-zero and return it
    require_gt!(fee_amount_in_input_token, 0, ErrorCode::InvalidInput);
    
    msg!("KEDOLOG fee amount (no conversion needed): {}", fee_amount_in_input_token);
    
    return Ok(fee_amount_in_input_token);
}
```

### Option 2: Fix the Scaling (More Complex)

Keep the current logic but fix the scaling math. However, this is unnecessarily complex since we're converting KEDOLOG → USD → KEDOLOG.

---

## 📝 Why Frontend Shows Wrong Amount

The frontend is likely calculating the fee correctly, but the contract's "Case 0" logic is returning a different value due to the circular conversion and scaling issues.

**Frontend calculation:**
- Reads pool reserves
- Calculates: `fee_in_kedolog = (fee_in_sol * sol_price) / kedolog_price`
- Shows: 211.81 KEDOLOG

**Contract calculation (Case 0):**
- Takes: 211.81 KEDOLOG
- Converts: KEDOLOG → USD → KEDOLOG
- Returns: 0.04 KEDOLOG (due to scaling bug)

---

## ✅ Recommended Solution

**Implement Option 1** - When the input token is KEDOLOG, the fee is already in KEDOLOG, so just return it directly without any conversion.

This will:
1. ✅ Fix the 100x discrepancy
2. ✅ Make KEDOLOG → SOL fees match SOL → KEDOLOG fees (for equivalent USD amounts)
3. ✅ Simplify the code
4. ✅ Remove unnecessary conversions
5. ✅ Eliminate scaling errors

---

## 🎯 Expected Results After Fix

### Before Fix:
- **SOL → KEDOLOG** (0.000995 SOL): Fee = 0.04 KEDOLOG ✅
- **KEDOLOG → SOL** (753 KEDOLOG): Fee = 0.04 KEDOLOG (but shows 211.81) ❌

### After Fix:
- **SOL → KEDOLOG** (0.000995 SOL): Fee = 0.04 KEDOLOG ✅
- **KEDOLOG → SOL** (753 KEDOLOG): Fee = 211.81 KEDOLOG ✅

**Both fees should be equivalent in USD value!**

If 0.000995 SOL ≈ $0.175, then the fee should be:
- Protocol fee (0.05%): $0.0000875
- With 25% discount: $0.000065625
- In KEDOLOG ($0.00134 per KEDOLOG): **0.049 KEDOLOG** ✅

So the correct fee is **~0.05 KEDOLOG**, not 211.81 KEDOLOG!

---

## 🚨 Clarification from Screenshots

Based on user's description:

### Transaction 1 (SOL → KEDOLOG):
- Swapping: 0.001 SOL → KEDOLOG
- Protocol fee: **0.4 KEDOLOG** (shown and charged correctly) ✅

### Transaction 2 (KEDOLOG → SOL):
- Swapping: Equivalent KEDOLOG → SOL
- Frontend shows: **211.81 KEDOLOG**
- Contract charges: **0.04 KEDOLOG** (100x less!) ❌

**The issue**: When swapping KEDOLOG → SOL, the contract charges 100x less than what the frontend calculates.

---

## 🎯 Final Diagnosis

The bug is in **Case 0** of the pricing logic. When the input token is KEDOLOG:

1. The contract calculates the USD value of the KEDOLOG fee
2. Then converts that USD value back to KEDOLOG
3. But there's a scaling error causing the result to be wrong

**The fix**: When input token is KEDOLOG, the fee is already in KEDOLOG, so just return it directly without any conversion!

---

## 📋 Implementation Steps

1. ✅ Identify the bug (DONE)
2. ⏳ Fix `price_oracle.rs` Case 0 logic
3. ⏳ Rebuild and redeploy contract
4. ⏳ Test both swap directions
5. ⏳ Verify fees are equivalent for equivalent USD amounts

