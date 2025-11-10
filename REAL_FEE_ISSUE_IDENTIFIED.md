# 🚨 REAL Fee Issue Identified

## 📊 Your Transactions (Corrected Analysis)

### Transaction 1: KEDOLOG → SOL
```
Input: 757.547964 KEDOLOG
Output: 0.000995 SOL
Fee: 0.398071709 KEDOLOG
```

### Transaction 2: SOL → KEDOLOG
```
Input: 0.000995 SOL
Output: 753.762737 KEDOLOG  
Fee: 2.736008616 KEDOLOG (equivalent)
```

**You ARE swapping equivalent amounts!** But fees are 7x different!

---

## 🎯 The Root Cause

The protocol fee is calculated as **0.05% of INPUT amount**:

### Transaction 1 (KEDOLOG → SOL):
```
Input: 757.547964 KEDOLOG
Protocol fee (0.05%): 757.547964 × 0.0005 = 0.378774 KEDOLOG
With 25% discount: 0.378774 × 0.75 = 0.284 KEDOLOG

But actual fee charged: 0.398 KEDOLOG
```

### Transaction 2 (SOL → KEDOLOG):
```
Input: 0.000995 SOL  
Protocol fee (0.05%): 0.000995 × 0.0005 = 0.0000004975 SOL
With 25% discount: 0.0000004975 × 0.75 = 0.000000373125 SOL

Convert to USD: 0.000000373125 × $175 = $0.0000653
Convert to KEDOLOG: $0.0000653 ÷ $0.00134 = 0.0487 KEDOLOG

But actual fee charged: 2.736 KEDOLOG
```

---

## 🐛 The Problem with My Fix

When I fixed "Case 0" (KEDOLOG input), I made it return the fee amount directly:

```rust
if *input_token_mint == protocol_token_config.protocol_token_mint {
    // Fee is already in KEDOLOG!
    return Ok(fee_amount_in_input_token);  // ← This is WRONG!
}
```

**Why this is wrong:**

The `fee_amount_in_input_token` passed to this function is:
- **0.284 KEDOLOG** (for Transaction 1)
- **0.000000373125 SOL** (for Transaction 2, needs conversion)

When input is KEDOLOG, returning 0.284 KEDOLOG is correct!
When input is SOL, converting 0.000000373125 SOL to KEDOLOG should give ~0.0487 KEDOLOG

**But you're being charged 2.736 KEDOLOG for Transaction 2!**

This means there's ANOTHER bug in the SOL → KEDOLOG conversion!

---

## 🔍 Let Me Check the SOL Pricing Logic

The issue must be in how the contract calculates the SOL price or converts SOL fees to KEDOLOG.

Let me verify the SOL/USDC pool reserves and price calculation...

---

## 🚨 WAIT! I See It Now!

Looking at your transaction 2 screenshot more carefully:

```
Transfer from AaPg85...5CqH3D to JAaHqf...tDYiqa for 0.009665732 WSOL
```

**You're transferring 0.009665732 SOL, not 0.000995 SOL!**

So the actual input is **0.009665732 SOL**, which is about **10x more** than 0.000995 SOL!

Let me recalculate:

### Transaction 2 (Corrected):
```
Input: 0.009665732 SOL (NOT 0.000995!)
Protocol fee (0.05%): 0.009665732 × 0.0005 = 0.000004832866 SOL
With 25% discount: 0.000004832866 × 0.75 = 0.0000036246495 SOL

Convert to USD: 0.0000036246495 × $175 = $0.000634
Convert to KEDOLOG: $0.000634 ÷ $0.00134 = 0.473 KEDOLOG

But actual fee charged: 2.736 KEDOLOG (still 5.8x more!)
```

---

## 🎯 The Real Issue

Even with the corrected input amount, the fee is still wrong!

**Expected**: 0.473 KEDOLOG
**Actual**: 2.736 KEDOLOG

**This is 5.8x more than expected!**

---

## 🔧 Possible Causes

1. **SOL price is wrong** - Contract might be reading wrong price from SOL/USDC pool
2. **KEDOLOG price is wrong** - Contract might be reading wrong price from KEDOLOG/USDC pool
3. **Scaling error** - There might still be a scaling bug in the conversion
4. **Pool reserves** - The reference pools might have imbalanced reserves

---

## 📋 What I Need to Debug

1. **Check transaction logs** - What prices is the contract actually using?
2. **Verify pool reserves** - Are the SOL/USDC and KEDOLOG/USDC pools correct?
3. **Trace the calculation** - Step through the exact math the contract is doing

**Please provide the FULL transaction signature for Transaction 2** so I can check the on-chain logs!

