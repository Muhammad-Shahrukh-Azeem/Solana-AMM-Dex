# 🔄 Frontend Update Guide - Adding KEDOLOG Discount Feature

**For**: Existing frontend that already has pool creation and swaps working  
**What's New**: KEDOLOG discount feature + pool creation fee  
**Date**: October 30, 2025

---

## 📋 What Changed in the Contract

### **1. New Swap Instruction Added**
- **Old**: Only `swap_base_input` (normal swap)
- **New**: Added `swap_base_input_with_protocol_token` (KEDOLOG discount swap)
- **Impact**: Users can now choose between two swap methods

### **2. Pool Creation Fee Added**
- **Old**: Pool creation was free
- **New**: 0.15 SOL fee charged when creating pools (configurable, currently 0)
- **Impact**: Need to inform users about the fee

### **3. New Account: ProtocolTokenConfig**
- Stores KEDOLOG discount settings
- PDA: `["protocol_token_config"]`
- Contains: discount rate, KEDOLOG price, treasury address

---

## 💰 Fee Structure (Explain to Users)

### **Option 1: Normal Swap (Existing)**
```
User swaps 100 SOL
├─ Total Fee: 0.25% = 0.25 SOL
│  ├─ LP Fee: 0.20 SOL → Stays in pool
│  └─ Protocol Fee: 0.05 SOL → Goes to protocol
└─ User receives: 99.75 SOL worth of output token
```

### **Option 2: KEDOLOG Discount Swap (NEW)**
```
User swaps 100 SOL (assuming 1 SOL = $100)
├─ LP Fee: 0.20 SOL → Stays in pool (same as normal)
├─ Protocol Fee: 0.04% paid in KEDOLOG
│  ├─ Normal would be: 0.05 SOL = $5
│  ├─ With 20% discount: $4 worth
│  └─ User pays: ~40 KEDOLOG (based on current price)
└─ User receives: 99.80 SOL worth of output token

💡 User saves: 0.05 SOL + gets 20% discount = Better deal!
```

**Key Point**: With KEDOLOG discount, users get MORE output tokens AND pay less in fees!

---

## 🎨 UI Changes Needed

### **1. Add Swap Method Toggle**

```typescript
// Add to your swap component
const [useKedologDiscount, setUseKedologDiscount] = useState(false);

// UI element
<div className="swap-method-selector">
  <label>
    <input 
      type="checkbox" 
      checked={useKedologDiscount}
      onChange={(e) => setUseKedologDiscount(e.target.checked)}
    />
    Pay protocol fee with KEDOLOG (Save 20%!)
  </label>
  
  {useKedologDiscount && (
    <div className="discount-info">
      ✅ You'll save 20% on protocol fees
      ✅ You'll receive more output tokens
      💰 Estimated KEDOLOG needed: {calculateKedologFee()} KEDOLOG
    </div>
  )}
</div>
```

### **2. Update Pool Creation UI**

```typescript
// Add fee warning
<div className="pool-creation-fee-notice">
  ⚠️ Pool creation fee: 0.15 SOL
  This fee helps prevent spam pools.
</div>
```

---

## 💻 Code Changes Required

### **Change 1: Update IDL**

```bash
# Replace your old IDL with the new one
cp /path/to/new/kedolik_cp_swap.json your-frontend/src/idl/
```

**New IDL location**: `target/idl/kedolik_cp_swap.json`

---

### **Change 2: Add KEDOLOG Discount Swap Function**

Add this new function alongside your existing `normalSwap` function:

```typescript
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

async function swapWithKedologDiscount(
  poolAddress: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: number,
  minimumAmountOut: number
) {
  // Get pool state (same as before)
  const poolState = await program.account.poolState.fetch(poolAddress);
  
  // Get protocol token config (NEW)
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );
  
  const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);
  
  // Get authority PDA (same as before)
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    program.programId
  );
  
  // Get user token accounts (same as before)
  const userInputAccount = await getAssociatedTokenAddress(inputMint, wallet.publicKey);
  const userOutputAccount = await getAssociatedTokenAddress(outputMint, wallet.publicKey);
  
  // Get user KEDOLOG account (NEW)
  const userKedologAccount = await getAssociatedTokenAddress(
    config.protocolTokenMint, 
    wallet.publicKey
  );
  
  // Get treasury KEDOLOG account (NEW)
  const treasuryKedologAccount = await getAssociatedTokenAddress(
    config.protocolTokenMint,
    config.treasury
  );
  
  // Get vault PDAs (same as before)
  const [inputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault_seed"), poolAddress.toBuffer(), inputMint.toBuffer()],
    program.programId
  );
  
  const [outputVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault_seed"), poolAddress.toBuffer(), outputMint.toBuffer()],
    program.programId
  );
  
  // Execute swap with KEDOLOG discount (NEW INSTRUCTION)
  const tx = await program.methods
    .swapBaseInputWithProtocolToken(
      new BN(amountIn),
      new BN(minimumAmountOut)
    )
    .accountsPartial({
      payer: wallet.publicKey,
      authority,
      ammConfig: poolState.ammConfig,
      poolState: poolAddress,
      inputTokenAccount: userInputAccount,
      outputTokenAccount: userOutputAccount,
      inputVault,
      outputVault,
      protocolTokenConfig,
      protocolTokenMint: config.protocolTokenMint,
      userProtocolTokenAccount: userKedologAccount,
      treasuryProtocolTokenAccount: treasuryKedologAccount,
      inputTokenProgram: TOKEN_PROGRAM_ID,
      outputTokenProgram: TOKEN_PROGRAM_ID,
      protocolTokenProgram: TOKEN_PROGRAM_ID,
      inputTokenMint: inputMint,
      outputTokenMint: outputMint,
      observationState: poolState.observationKey,
      // For manual pricing (current setup)
      inputTokenOracle: SystemProgram.programId,
      protocolTokenOracle: SystemProgram.programId,
    })
    .rpc();
  
  return tx;
}
```

---

### **Change 3: Update Your Swap Handler**

Modify your existing swap function to support both methods:

```typescript
async function handleSwap() {
  try {
    let tx;
    
    if (useKedologDiscount) {
      // NEW: Use KEDOLOG discount
      tx = await swapWithKedologDiscount(
        poolAddress,
        inputMint,
        outputMint,
        amountIn,
        minimumAmountOut
      );
    } else {
      // EXISTING: Normal swap (keep your existing code)
      tx = await normalSwap(
        poolAddress,
        inputMint,
        outputMint,
        amountIn,
        minimumAmountOut
      );
    }
    
    console.log("Swap successful:", tx);
    // ... rest of your success handling
  } catch (error) {
    console.error("Swap failed:", error);
    // ... rest of your error handling
  }
}
```

---

### **Change 4: Calculate KEDOLOG Fee (for UI display)**

Add this helper function to show users how much KEDOLOG they'll need:

```typescript
async function calculateKedologFee(amountIn: number, inputTokenPrice: number) {
  // Get protocol token config
  const [protocolTokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_token_config")],
    program.programId
  );
  
  const config = await program.account.protocolTokenConfig.fetch(protocolTokenConfig);
  
  // Calculate protocol fee in USD
  const amountInUsd = amountIn * inputTokenPrice;
  const protocolFeeRate = 500; // 0.05%
  const discountRate = config.discountRate.toNumber(); // e.g., 2000 = 20%
  const protocolFeeUsd = (amountInUsd * protocolFeeRate) / 1_000_000;
  const discountedFeeUsd = (protocolFeeUsd * (10000 - discountRate)) / 10000;
  
  // Convert to KEDOLOG
  const kedologPerUsd = config.protocolTokenPerUsd.toNumber() / 1_000_000;
  const kedologFee = discountedFeeUsd * kedologPerUsd;
  
  return kedologFee;
}

// Usage in UI
const estimatedKedologFee = await calculateKedologFee(amountIn, inputTokenPrice);
```

---

### **Change 5: Pool Creation (No Code Change Needed)**

Your existing pool creation code will work as-is. The contract will automatically charge the 0.15 SOL fee if configured.

**Just update the UI to inform users:**

```typescript
<div className="pool-creation-notice">
  <h3>Pool Creation</h3>
  <ul>
    <li>Initial liquidity required</li>
    <li>⚠️ Pool creation fee: 0.15 SOL</li>
    <li>This fee helps prevent spam pools</li>
  </ul>
</div>
```

---

## 📊 Contract Addresses (Update These)

```typescript
// Update your config file
export const CONTRACT_ADDRESSES = {
  programId: "GCm8bqvSuJ4nwj3SN3pk2eSJWTwcRjkU6KhXE96AnBod",
  ammConfig: "DUzS92SbYFFN66vPGUoJqwqS2rfEBmB8CvX1EinesMZG",
  protocolTokenConfig: "JA8cRHzw2iDEh79iSHtbLa7dJU7R7KoDCWT4sJQbWvGV",
  kedologMint: "22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx",
};
```

---

## ✅ Testing Checklist

### **Test Normal Swap (Existing)**
- [ ] Swap works as before
- [ ] Fees are correct (0.25%)
- [ ] User receives expected output

### **Test KEDOLOG Discount Swap (New)**
- [ ] Toggle appears in UI
- [ ] KEDOLOG fee calculation is correct
- [ ] Swap executes successfully
- [ ] User receives MORE output than normal swap
- [ ] KEDOLOG is deducted from user's wallet
- [ ] Error handling if user doesn't have enough KEDOLOG

### **Test Pool Creation (Updated)**
- [ ] Pool creation still works
- [ ] 0.15 SOL fee is charged (if configured)
- [ ] User is informed about the fee
- [ ] Error handling if user doesn't have enough SOL

---

## 🎯 Summary of Changes

### **What to Add:**
1. ✅ New swap function: `swapWithKedologDiscount()`
2. ✅ UI toggle: "Pay with KEDOLOG"
3. ✅ KEDOLOG fee calculator
4. ✅ Pool creation fee notice

### **What to Update:**
1. ✅ IDL file (replace old with new)
2. ✅ Contract addresses
3. ✅ Swap handler (add conditional logic)

### **What Stays the Same:**
1. ✅ Normal swap function (no changes)
2. ✅ Pool creation function (no changes)
3. ✅ Liquidity deposit/withdraw (no changes)

---

## 📝 User-Facing Copy (for UI)

### **Swap Method Selector**
```
□ Pay protocol fee with KEDOLOG (Save 20%!)

Benefits:
• 20% discount on protocol fees
• Receive more output tokens
• Support the KEDOLOG ecosystem

Estimated KEDOLOG needed: 40 KEDOLOG
```

### **Pool Creation Notice**
```
⚠️ Pool Creation Fee: 0.15 SOL

This one-time fee helps prevent spam pools and ensures 
quality liquidity on the platform.
```

### **Fee Breakdown (Info Modal)**
```
Fee Structure:

Normal Swap:
• Total Fee: 0.25%
  - LP Fee: 0.20% (goes to liquidity providers)
  - Protocol Fee: 0.05% (goes to protocol)

KEDOLOG Discount Swap:
• LP Fee: 0.20% (same as normal)
• Protocol Fee: 0.04% paid in KEDOLOG (20% discount!)
• You receive MORE output tokens!
```

---

## 🚀 Deployment Steps

1. **Update IDL**
   ```bash
   cp target/idl/kedolik_cp_swap.json frontend/src/idl/
   ```

2. **Update Contract Addresses**
   - Update your config file with new addresses

3. **Add New Functions**
   - Add `swapWithKedologDiscount()` function
   - Add `calculateKedologFee()` helper

4. **Update UI**
   - Add swap method toggle
   - Add pool creation fee notice
   - Add fee breakdown info

5. **Test on Devnet**
   - Test both swap methods
   - Test pool creation with fee
   - Verify all calculations

6. **Deploy to Production**
   - Deploy frontend
   - Monitor for errors
   - Collect user feedback

---

## ❓ FAQ for Users

**Q: What's the difference between normal swap and KEDOLOG discount swap?**  
A: KEDOLOG discount swap gives you 20% off protocol fees and more output tokens, but requires KEDOLOG tokens.

**Q: Do I need KEDOLOG to swap?**  
A: No! Normal swaps work without KEDOLOG. The discount is optional.

**Q: How much KEDOLOG do I need?**  
A: It depends on your swap size. The UI will show you the estimated amount before you swap.

**Q: What if I don't have enough KEDOLOG?**  
A: You can use the normal swap method, or buy KEDOLOG first.

**Q: Why is there a pool creation fee?**  
A: The 0.15 SOL fee helps prevent spam pools and ensures quality liquidity.

**Q: Can I get the pool creation fee back?**  
A: No, this is a one-time fee that goes to the protocol.

---

## 🔗 Contract Details

**Program ID**: `GCm8bqvSuJ4nwj3SN3pk2eSJWTwcRjkU6KhXE96AnBod`  
**Network**: Devnet (ready for mainnet)  
**KEDOLOG Mint**: `22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx`

---

**That's it!** These are the only changes needed to add KEDOLOG discount support to your existing frontend. 🚀

