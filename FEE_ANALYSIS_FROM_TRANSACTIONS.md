# 🔍 Fee Analysis from Your Actual Transactions

## 📊 Transaction Details

### Transaction 1: KEDOLOG → SOL
```
Input: Some amount of KEDOLOG
Output: 0.000995 SOL (received)
Fee charged: 0.398071709 KEDOLOG
```

### Transaction 2: SOL → KEDOLOG  
```
Input: 0.009665732 SOL
Output: 7,296.022979 KEDOLOG (received)
Fee charged: 2.736008616 KEDOLOG (equivalent)
```

---

## 🎯 The Key Question

**Are these "equivalent" swaps?**

Let's check the SOL amounts:
- Transaction 1: **0.000995 SOL** (output)
- Transaction 2: **0.009665732 SOL** (input)

**NO! Transaction 2 uses ~10x more SOL!**

---

## 💡 Understanding the Fee Calculation

### How Protocol Fees Work

The protocol fee is calculated as **0.05% of the INPUT amount**:

```
Protocol Fee = Input Amount × 0.05%
```

Then a **25% discount** is applied when paying in KEDOLOG:

```
Discounted Fee = Protocol Fee × 0.75
```

### Transaction 1: KEDOLOG → SOL

Let's work backwards from the fee:

```
Fee in KEDOLOG: 0.398071709
This is 0.05% × 0.75 (discount) = 0.0375% of input

Input KEDOLOG = 0.398071709 ÷ 0.000375 = 1,061.52 KEDOLOG
```

So you swapped **~1,061 KEDOLOG** → **0.000995 SOL**

### Transaction 2: SOL → KEDOLOG

```
Input: 0.009665732 SOL
Protocol fee (0.05%): 0.009665732 × 0.0005 = 0.000004832866 SOL
With 25% discount: 0.000004832866 × 0.75 = 0.0000036246495 SOL

Converting to KEDOLOG:
SOL price: ~$175
KEDOLOG price: ~$0.00134

Fee in USD: 0.0000036246495 × $175 = $0.000634
Fee in KEDOLOG: $0.000634 ÷ $0.00134 = 0.473 KEDOLOG
```

**But the actual fee charged was 2.736 KEDOLOG!**

This suggests the fee calculation might be using a different SOL price or there's still an issue.

---

## 🔍 Let's Verify with Actual Pool Prices

From your reference pools file, let me calculate the actual prices:

### KEDOLOG/USDC Pool
```
Token0 (KEDOLOG): 77,594.685455419
Token1 (USDC): 104.069115

KEDOLOG price = 104.069115 ÷ 77,594.685455419 = $0.001341 per KEDOLOG
```

### SOL/USDC Pool
```
Token0 (SOL): 1
Token1 (USDC): 151,621

SOL price = 151,621 ÷ 1 = $151,621 per SOL (WRONG!)
```

**Wait, this can't be right!** Let me check the actual reserves...

---

## 🚨 Possible Issues

1. **Pool reserves are imbalanced** - The SOL/USDC pool might have very low liquidity
2. **Fee calculation is using wrong price** - The contract might be reading prices incorrectly
3. **Different swap amounts** - You're not actually swapping equivalent amounts

---

## 📋 What We Need to Verify

Please provide:

1. **Transaction 1 details**:
   - How much KEDOLOG did you INPUT?
   - How much SOL did you receive?
   - What was the KEDOLOG fee?

2. **Transaction 2 details**:
   - How much SOL did you INPUT?
   - How much KEDOLOG did you receive?
   - What was the KEDOLOG fee (in KEDOLOG)?

3. **Are you trying to swap equivalent USD amounts?**
   - If so, what USD amount?

---

## 🎯 Expected Behavior

For truly equivalent swaps (same USD value):

### Example: $1 worth of tokens

**Swap 1: $1 of KEDOLOG → SOL**
- Input: $1 ÷ $0.00134 = 746 KEDOLOG
- Protocol fee: 746 × 0.0005 = 0.373 KEDOLOG
- With 25% discount: 0.373 × 0.75 = **0.28 KEDOLOG**

**Swap 2: $1 of SOL → KEDOLOG**
- Input: $1 ÷ $175 = 0.0057 SOL
- Protocol fee: 0.0057 × 0.0005 = 0.00000285 SOL
- In USD: 0.00000285 × $175 = $0.0004988
- With 25% discount: $0.0004988 × 0.75 = $0.000374
- In KEDOLOG: $0.000374 ÷ $0.00134 = **0.28 KEDOLOG**

**✅ Both fees should be ~0.28 KEDOLOG**

---

## 🔧 Next Steps

1. **Verify you're swapping equivalent USD amounts**
2. **Check the actual input amounts** in both transactions
3. **Verify pool reserves** are correct
4. **Check transaction logs** for price calculations

Please share:
- The FULL transaction signatures
- Screenshots showing the INPUT amounts (not just output)
- What you're trying to achieve (swap same USD value both ways?)

