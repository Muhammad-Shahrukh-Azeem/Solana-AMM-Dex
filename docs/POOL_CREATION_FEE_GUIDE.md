# 💰 Pool Creation Fee - Complete Guide

## ✅ **YES, It's Implemented!**

Pool creation fee is **fully implemented** in your contract. Users pay a fee (in SOL) when creating a new pool.

---

## 🎯 **Where Does the Fee Go?**

### **Fee Receiver Address (Hardcoded):**
```
67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
```

**This address receives ALL pool creation fees automatically!**

### **Code Location:**
`programs/cp-swap/src/lib.rs` (Lines 30-33):

```rust
pub mod create_pool_fee_receiver {
    use super::{pubkey, Pubkey};
    pub const ID: Pubkey = pubkey!("67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa");
}
```

---

## 💰 **How It Works**

### **When Someone Creates a Pool:**

```
Step 1: User calls initialize(pool)
   ↓
Step 2: Contract checks: create_pool_fee > 0?
   ↓
Step 3: If YES:
   - Transfer fee from user to 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
   - Fee is in SOL (native Solana)
   ↓
Step 4: Pool is created
```

### **Code Implementation:**
`programs/cp-swap/src/instructions/initialize.rs` (Lines 294-317):

```rust
// Charge the fee to create a pool
if ctx.accounts.amm_config.create_pool_fee != 0 {
    invoke(
        &system_instruction::transfer(
            ctx.accounts.creator.key,
            &ctx.accounts.create_pool_fee.key(),  // Goes to 67D6TM...
            u64::from(ctx.accounts.amm_config.create_pool_fee),
        ),
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.create_pool_fee.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
}
```

---

## 🔧 **Setting the Fee to 0.15 SOL**

### **Current Status:**
By default, the pool creation fee is **0 SOL** (disabled).

### **Enable 0.15 SOL Fee:**

```bash
npx ts-node scripts/set-pool-creation-fee.ts
```

**What it does:**
- ✅ Sets `create_pool_fee` to 150,000,000 lamports (0.15 SOL)
- ✅ Updates the AMM config
- ✅ Applies to all future pool creations

**Output:**
```
💰 Setting Pool Creation Fee
============================================================

📊 Current Configuration:
   Create Pool Fee: 0 lamports (0 SOL)

🔄 Updating Pool Creation Fee...
   New Fee: 150000000 lamports (0.15 SOL)
   Fee Receiver: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa

✅ Pool Creation Fee Updated!

📊 Updated Configuration:
   Create Pool Fee: 150000000 lamports (0.15 SOL)

💡 Important Notes:
   1. Users must pay 0.15 SOL to create a pool
   2. Fee goes to: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
   3. This address is hardcoded in the program
   4. To change the receiver, update lib.rs and redeploy
```

---

## 🔍 **Check Who Controls the Fee Receiver**

### **Check the Wallet:**

```bash
# Check balance
solana balance 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa --url devnet

# View on explorer
https://explorer.solana.com/address/67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa?cluster=devnet
```

### **⚠️ IMPORTANT:**

**This address is hardcoded in your program!**

If you want to change it to a different wallet:

1. **Edit** `programs/cp-swap/src/lib.rs` (line 32)
2. **Replace** the address with your desired wallet
3. **Rebuild**: `anchor build`
4. **Redeploy**: `anchor deploy`

---

## 💡 **Example Scenario**

### **User Creates a Pool:**

```
User: Alice wants to create SOL/USDC pool
   ↓
Alice's Balance: 10 SOL
   ↓
Pool Creation Fee: 0.15 SOL
   ↓
Transaction:
   - Alice pays: 0.15 SOL
   - Fee goes to: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
   - Alice's new balance: 9.85 SOL
   ↓
Pool Created Successfully! ✅
```

---

## 📊 **Fee Comparison**

### **Pool Creation Fee:**
```
Amount: 0.15 SOL (one-time)
When: When creating a new pool
Goes to: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa (hardcoded)
Claimable: No (goes directly to receiver)
```

### **Trade Fees (Different!):**
```
Amount: 0.25% per swap
When: Every swap transaction
Goes to:
  - 0.20% → Liquidity Providers (stays in pool)
  - 0.05% → Protocol Owner (claimable)
```

### **KEDOL Discount Fee:**
```
Amount: 0.04% in KEDOL (instead of 0.05% SOL)
When: Swap with KEDOL payment option
Goes to: Protocol treasury (your wallet)
```

---

## 🔧 **Configuration Commands**

### **Set Pool Creation Fee:**
```bash
# Set to 0.15 SOL
npx ts-node scripts/set-pool-creation-fee.ts
```

### **Check Current Fee:**
```bash
# View AMM config
solana account <AMM_CONFIG_ADDRESS> --url devnet
```

### **Disable Pool Creation Fee:**
```typescript
// Set fee to 0
await program.methods
  .updateAmmConfig(
    5, // param: 5 = create_pool_fee
    new BN(0) // 0 SOL
  )
  .accounts({
    owner: adminWallet,
    ammConfig,
  })
  .rpc();
```

---

## 🎯 **Changing the Fee Receiver**

### **Option 1: Change Before Deployment (Recommended)**

**Edit** `programs/cp-swap/src/lib.rs`:

```rust
pub mod create_pool_fee_receiver {
    use super::{pubkey, Pubkey};
    // Change this to YOUR wallet:
    pub const ID: Pubkey = pubkey!("YOUR_WALLET_ADDRESS_HERE");
}
```

**Then:**
```bash
anchor build
anchor deploy --provider.cluster devnet
```

---

### **Option 2: Upgrade Existing Program**

If you've already deployed:

1. **Edit** `lib.rs` with new address
2. **Build**: `anchor build`
3. **Upgrade**: `anchor upgrade target/deploy/kedolik_cp_swap.so --program-id <PROGRAM_ID> --provider.cluster devnet`

**⚠️ Note:** Program upgrades require the upgrade authority.

---

## 📋 **Summary**

### **Pool Creation Fee:**
```
✅ Implemented: YES
✅ Default: 0 SOL (disabled)
✅ Recommended: 0.15 SOL
✅ Receiver: 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa
✅ Changeable: Yes (by editing lib.rs and redeploying)
✅ Automatic: Yes (no claiming needed)
```

### **To Enable:**
```bash
# 1. Set the fee
npx ts-node scripts/set-pool-creation-fee.ts

# 2. Done! Users now pay 0.15 SOL per pool
```

### **To Change Receiver:**
```bash
# 1. Edit programs/cp-swap/src/lib.rs (line 32)
# 2. Replace address with your wallet
# 3. Rebuild and redeploy
anchor build
anchor deploy --provider.cluster devnet
```

---

## 🚨 **Important Notes**

1. **Fee is in SOL** (native Solana), not SPL tokens
2. **Fee is one-time** per pool creation
3. **Fee goes directly** to receiver (no claiming needed)
4. **Receiver is hardcoded** in program (can't change without redeploying)
5. **Fee is optional** (can be set to 0 to disable)

---

## ✅ **Quick Commands**

```bash
# Enable 0.15 SOL pool creation fee
npx ts-node scripts/set-pool-creation-fee.ts

# Check fee receiver balance
solana balance 67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa --url devnet

# View fee receiver on explorer
https://explorer.solana.com/address/67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa?cluster=devnet
```

---

**Pool creation fee is ready to use! Just run the script to enable it!** 🚀

