# 💰 FEE DISTRIBUTION EXPLAINED (Simple Version)

## 🎯 **SCENARIO: 100 SOL SWAP WITH 1% FEE**

Let's say you configure fees like this:

```typescript
tradeFeeRate: 10000,      // 1% trade fee
protocolFeeRate: 200000,  // 20% of trade fee
fundFeeRate: 0,           // 0%
creatorFeeRate: 5000,     // 0.5% creator fee
```

---

## 📊 **STEP-BY-STEP FEE CALCULATION**

### **User Swaps 100 SOL**

```
┌─────────────────────────────────────────────────┐
│ Step 1: Calculate Trade Fee                    │
└─────────────────────────────────────────────────┘
Trade Fee = 100 SOL × 1% = 1 SOL

┌─────────────────────────────────────────────────┐
│ Step 2: Split Trade Fee                        │
└─────────────────────────────────────────────────┘
Protocol Fee = 1 SOL × 20% = 0.2 SOL
Fund Fee = 1 SOL × 0% = 0 SOL
Remaining in pool = 1 - 0.2 - 0 = 0.8 SOL

┌─────────────────────────────────────────────────┐
│ Step 3: Calculate Creator Fee                  │
└─────────────────────────────────────────────────┘
Creator Fee = 100 SOL × 0.5% = 0.5 SOL

┌─────────────────────────────────────────────────┐
│ Step 4: Execute Swap                           │
└─────────────────────────────────────────────────┘
Amount used for swap = 100 - 1 - 0.5 = 98.5 SOL
User receives = USDC equivalent of 98.5 SOL

┌─────────────────────────────────────────────────┐
│ TOTAL FEES: 1.5 SOL                            │
└─────────────────────────────────────────────────┘
```

---

## 🎯 **WHERE DO THE FEES GO?**

### **1. Protocol Fee: 0.2 SOL → Protocol Owner (YOU)**

**Code Reference:** `programs/cp-swap/src/states/pool.rs` (Lines 339-342)

```rust
self.protocol_fees_token_0 = self
    .protocol_fees_token_0
    .checked_add(protocol_fee)  // Adds 0.2 SOL here
    .unwrap();
```

**✅ Stored in Pool** (NOT sent immediately)
**✅ Claimable** by calling `collect_protocol_fee`

```typescript
// YOU (admin) can claim anytime:
await program.methods
  .collectProtocolFee(
    new anchor.BN(200000000), // 0.2 SOL in lamports
    new anchor.BN(0)
  )
  .accounts({
    owner: yourAdminWallet,
    // ... other accounts
  })
  .rpc();
```

**❌ Does NOT go automatically to your wallet**
**✅ You must claim it manually**

---

### **2. Liquidity Provider Share: 0.8 SOL → Stays in Pool**

**Code Reference:** `programs/cp-swap/src/curve/calculator.rs` (Lines 119-123)

```rust
let output_amount_swapped = ConstantProductCurve::swap_base_input_without_fees(
    input_amount_less_fees,  // 98.5 SOL (after fees)
    input_vault_amount,
    output_vault_amount,
);
```

**✅ Automatically stays in the pool**
**✅ NOT claimable separately**
**✅ Increases pool value for all LP token holders**

**How Liquidity Providers Benefit:**
```
Before swap:
- Pool has: 1000 SOL + 50,000 USDC
- Your LP tokens = 10% of pool
- Your share = 100 SOL + 5,000 USDC

After swap (with 0.8 SOL staying in pool):
- Pool has: 1000.8 SOL + 49,500 USDC
- Your LP tokens = still 10% of pool
- Your share = 100.08 SOL + 4,950 USDC

You gained 0.08 SOL automatically! 🎉
```

**When do LPs get their share?**
- When they withdraw liquidity using `withdraw` function
- The 0.8 SOL is distributed proportionally to all LP holders
- No claiming needed - it's automatic!

---

### **3. Creator Fee: 0.5 SOL → Pool Creator**

**Code Reference:** `programs/cp-swap/src/states/pool.rs` (Lines 346-347)

```rust
self.creator_fees_token_0 =
    self.creator_fees_token_0.checked_add(creator_fee).unwrap();  // Adds 0.5 SOL
```

**✅ Stored in Pool** (NOT sent immediately)
**✅ Claimable** by calling `collect_creator_fee`

```typescript
// Pool creator can claim anytime:
await program.methods
  .collectCreatorFee()
  .accounts({
    creator: poolCreatorWallet,  // Must be the person who created the pool
    // ... other accounts
  })
  .rpc();
```

**❌ Does NOT go automatically to creator's wallet**
**✅ Creator must claim it manually**

---

## 📋 **SUMMARY TABLE**

| Fee Type | Amount | Goes To | Automatic? | How to Get It? |
|----------|--------|---------|------------|----------------|
| **Trade Fee** | 1 SOL | Split below | N/A | N/A |
| **Protocol Fee** | 0.2 SOL | Protocol Owner (YOU) | ❌ No | Call `collect_protocol_fee` |
| **LP Share** | 0.8 SOL | All LP Token Holders | ✅ Yes | Automatically in pool, get it when you withdraw |
| **Creator Fee** | 0.5 SOL | Pool Creator | ❌ No | Call `collect_creator_fee` |
| **TOTAL** | 1.5 SOL | - | - | - |

---

## 🔑 **KEY POINTS**

### **For Liquidity Providers (LPs):**
- ✅ **Fees automatically accumulate in the pool**
- ✅ **No need to claim anything**
- ✅ **Your LP tokens become more valuable over time**
- ✅ **Get your share when you withdraw liquidity**

**Example:**
```
You deposit: 10 SOL + 500 USDC
You get: 100 LP tokens (10% of pool)

After 1000 swaps with 0.8 SOL fee each:
Pool gains: 800 SOL in LP fees
Your 10% share = 80 SOL extra!

When you withdraw your 100 LP tokens:
You get: 90 SOL + 500 USDC (your original + your share of fees)
```

### **For Protocol Owner (YOU):**
- ❌ **Fees do NOT go to your wallet automatically**
- ✅ **Fees accumulate in each pool**
- ✅ **You must call `collect_protocol_fee` to claim**
- ✅ **Can claim from multiple pools**

### **For Pool Creators:**
- ❌ **Fees do NOT go to wallet automatically**
- ✅ **Fees accumulate in the pool they created**
- ✅ **Must call `collect_creator_fee` to claim**
- ✅ **Incentive to create popular pools**

---

## ⚙️ **HOW TO CONFIGURE FEES**

### **Option 1: Update Existing Config**

```typescript
import * as anchor from "@coral-xyz/anchor";

// Set trade fee to 1%
await program.methods
  .updateAmmConfig(
    0,  // param 0 = trade_fee_rate
    new anchor.BN(10000)  // 10000 / 1,000,000 = 1%
  )
  .accounts({
    owner: adminWallet.publicKey,
    ammConfig: ammConfigAddress,
  })
  .rpc();

// Set protocol fee to 20% of trade fee
await program.methods
  .updateAmmConfig(
    1,  // param 1 = protocol_fee_rate
    new anchor.BN(200000)  // 200000 / 1,000,000 = 20%
  )
  .accounts({
    owner: adminWallet.publicKey,
    ammConfig: ammConfigAddress,
  })
  .rpc();

// Set creator fee to 0.5%
await program.methods
  .updateAmmConfig(
    6,  // param 6 = creator_fee_rate
    new anchor.BN(5000)  // 5000 / 1,000,000 = 0.5%
  )
  .accounts({
    owner: adminWallet.publicKey,
    ammConfig: ammConfigAddress,
  })
  .rpc();
```

### **Update Parameters:**
```
0 = trade_fee_rate      (total swap fee)
1 = protocol_fee_rate   (your cut of trade fee)
2 = fund_fee_rate       (treasury cut of trade fee)
3 = owner               (change admin)
4 = fund_owner          (change treasury)
5 = create_pool_fee     (one-time pool creation fee)
6 = creator_fee_rate    (pool creator's cut)
```

---

## 🧮 **FEE CALCULATION FORMULAS**

### **All fees use denominator: 1,000,000**

```typescript
// Trade Fee (deducted from swap amount)
trade_fee = swap_amount × (trade_fee_rate / 1,000,000)

// Protocol Fee (percentage of trade fee)
protocol_fee = trade_fee × (protocol_fee_rate / 1,000,000)

// Fund Fee (percentage of trade fee)
fund_fee = trade_fee × (fund_fee_rate / 1,000,000)

// LP Share (what's left of trade fee)
lp_share = trade_fee - protocol_fee - fund_fee

// Creator Fee (separate from trade fee)
creator_fee = swap_amount × (creator_fee_rate / 1,000,000)

// Total user pays
total_fee = trade_fee + creator_fee
```

---

## 💡 **RECOMMENDED CONFIGURATIONS**

### **Low Fee (Competitive)**
```typescript
tradeFeeRate: 2500,      // 0.25%
protocolFeeRate: 200000, // 20% of trade fee = 0.05%
creatorFeeRate: 1000,    // 0.1%
// User pays: 0.35% total
// You get: 0.05%
// LPs get: 0.2% (stays in pool)
// Creator gets: 0.1%
```

### **Medium Fee (Balanced)**
```typescript
tradeFeeRate: 5000,      // 0.5%
protocolFeeRate: 200000, // 20% of trade fee = 0.1%
creatorFeeRate: 2000,    // 0.2%
// User pays: 0.7% total
// You get: 0.1%
// LPs get: 0.4% (stays in pool)
// Creator gets: 0.2%
```

### **High Fee (Maximum Revenue)**
```typescript
tradeFeeRate: 10000,     // 1%
protocolFeeRate: 300000, // 30% of trade fee = 0.3%
creatorFeeRate: 5000,    // 0.5%
// User pays: 1.5% total
// You get: 0.3%
// LPs get: 0.7% (stays in pool)
// Creator gets: 0.5%
```

---

## 🚀 **NEXT STEPS**

1. **Decide your fee structure** (see recommendations above)
2. **Update AMM config** using the scripts provided
3. **Create a fee collection script** for protocol fees
4. **Monitor fee accumulation** in your pools
5. **Claim fees regularly** to your wallet

---

**Need help setting up fee collection? Let me know!** 🎯

