# 🚀 Frontend Integration Instructions

## ✅ Contract is Ready!

Your contract has been successfully configured with all 3 reference pools. Now update your frontend to use the correct addresses.

---

## 📋 New Deployment Addresses (Devnet)

```typescript
// Program & Config
PROGRAM_ID: "4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf"
PROTOCOL_TOKEN_CONFIG: "3TLoGQXLQyyExNUekdtjinSig9uBnrwLZXHbJ4ECBrq3"
AMM_CONFIG: "BvNxXvJbJLgEhSCuoVyHwsTWZeFMLfwdzqP1ynuimVRW"

// Reference Pools (for pricing)
KEDOLOG_USDC_POOL: "BE1AdLaWKGPV61cmdV2W6aw7GY5fBRc59noUascPBje"
SOL_USDC_POOL: "4pS9NNCmuSxCeE2KStwnVLujouoAPRuFJnmKd12fjs1U"
KEDOLOG_SOL_POOL: "DLUJbJopAcZXvu7a2g8sY2CrqJyjtRx48G6M1WbFGiBn"
```

---

## 🔧 Step 1: Update IDL

Copy the new IDL from:
```
/home/ubuntu/raydium-cp-swap/target/idl/kedolik_cp_swap.json
```

Replace your frontend's IDL file with this new version.

---

## 🔧 Step 2: Update Addresses

Update your frontend config with addresses from `reference-pools-devnet-1762747951626.json`:

```typescript
// src/config/addresses.ts (or similar)
import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf');
export const PROTOCOL_TOKEN_CONFIG = new PublicKey('3TLoGQXLQyyExNUekdtjinSig9uBnrwLZXHbJ4ECBrq3');
export const AMM_CONFIG = new PublicKey('BvNxXvJbJLgEhSCuoVyHwsTWZeFMLfwdzqP1ynuimVRW');

// Reference Pools
export const KEDOLOG_USDC_POOL = new PublicKey('BE1AdLaWKGPV61cmdV2W6aw7GY5fBRc59noUascPBje');
export const KEDOLOG_USDC_VAULT_0 = new PublicKey('Gg2roHP4aRbNvjbQRj7cxB1XvLKdBw45UkrNn9eeC8DJ');
export const KEDOLOG_USDC_VAULT_1 = new PublicKey('2yVnJLxM9Dw8YHxrEQQgvPJ12RXYXcqdYyLXftYzbJCt');

export const SOL_USDC_POOL = new PublicKey('4pS9NNCmuSxCeE2KStwnVLujouoAPRuFJnmKd12fjs1U');
export const SOL_USDC_VAULT_0 = new PublicKey('E2TxGdGJyk1yWG3oYMcRtcw8hcQiLGugjwCxWYTFE3S8');
export const SOL_USDC_VAULT_1 = new PublicKey('J2219iKwxifoweHJW5beAmT7KYWzUpqjscQviMKew4Qa');

export const KEDOLOG_SOL_POOL = new PublicKey('DLUJbJopAcZXvu7a2g8sY2CrqJyjtRx48G6M1WbFGiBn');
export const KEDOLOG_SOL_VAULT_0 = new PublicKey('H9Bxiu8YuUV8zkshUFBMHX8fPYEShL4tWZiZtzXJe92K');
export const KEDOLOG_SOL_VAULT_1 = new PublicKey('FXsF5NZjcQxbU761XgA3fAHGdbcYDMPZxihEmfAK9ma');
```

---

## 🔧 Step 3: Update Swap Function

### **CRITICAL: `remainingAccounts` Order**

The contract expects `remainingAccounts` in this **EXACT** order:

```
[0]: KEDOLOG/USDC Pool Address
[1]: KEDOLOG/USDC Vault 0
[2]: KEDOLOG/USDC Vault 1
[3]: SOL/USDC Pool Address (optional, for SOL swaps)
[4]: SOL/USDC Vault 0 (optional, for SOL swaps)
[5]: SOL/USDC Vault 1 (optional, for SOL swaps)
```

### **Example: USDC → SOL Swap**

```typescript
import {
  KEDOLOG_USDC_POOL,
  KEDOLOG_USDC_VAULT_0,
  KEDOLOG_USDC_VAULT_1,
  SOL_USDC_POOL,
  SOL_USDC_VAULT_0,
  SOL_USDC_VAULT_1,
} from './config/addresses';

// For USDC → SOL swap, pass BOTH reference pools
const remainingAccounts = [
  // KEDOLOG/USDC (always required)
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_1, isSigner: false, isWritable: false },
  
  // SOL/USDC (for SOL swaps)
  { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: SOL_USDC_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: SOL_USDC_VAULT_1, isSigner: false, isWritable: false },
];

await program.methods
  .swapBaseInputWithProtocolToken(/* ... params ... */)
  .accounts({
    // ... your accounts ...
  })
  .remainingAccounts(remainingAccounts)
  .rpc();
```

### **Example: USDC → KEDOLOG Swap**

```typescript
// For USDC → KEDOLOG swap, only pass KEDOLOG/USDC pool
const remainingAccounts = [
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_1, isSigner: false, isWritable: false },
];
```

### **Example: SOL → USDC Swap**

```typescript
// For SOL → USDC swap, pass BOTH reference pools
const remainingAccounts = [
  // KEDOLOG/USDC (always required)
  { pubkey: KEDOLOG_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: KEDOLOG_USDC_VAULT_1, isSigner: false, isWritable: false },
  
  // SOL/USDC (for SOL swaps)
  { pubkey: SOL_USDC_POOL, isSigner: false, isWritable: false },
  { pubkey: SOL_USDC_VAULT_0, isSigner: false, isWritable: false },
  { pubkey: SOL_USDC_VAULT_1, isSigner: false, isWritable: false },
];
```

---

## 🔧 Step 4: Remove Oracle Accounts

The new contract **NO LONGER uses Pyth oracles**. Remove these accounts from your swap instruction:

```typescript
// ❌ REMOVE THESE:
// input_token_oracle: ...
// protocol_token_oracle: ...
```

Your swap instruction should now look like:

```typescript
await program.methods
  .swapBaseInputWithProtocolToken(
    amountIn,
    minimumAmountOut
  )
  .accounts({
    payer: wallet.publicKey,
    authority: poolAuthority,
    ammConfig: AMM_CONFIG,
    poolState: poolAddress,
    inputTokenAccount: userInputTokenAccount,
    outputTokenAccount: userOutputTokenAccount,
    inputVault: poolInputVault,
    outputVault: poolOutputVault,
    inputTokenProgram: TOKEN_PROGRAM_ID,
    outputTokenProgram: TOKEN_PROGRAM_ID,
    inputTokenMint: inputMint,
    outputTokenMint: outputMint,
    protocolTokenConfig: PROTOCOL_TOKEN_CONFIG,
    protocolTokenMint: KEDOLOG_MINT,
    protocolTokenTreasury: treasuryKedologAccount,
    userProtocolTokenAccount: userKedologAccount,
    protocolTokenProgram: TOKEN_PROGRAM_ID,
    // ❌ NO MORE ORACLE ACCOUNTS!
  })
  .remainingAccounts(remainingAccounts) // ✅ Pass reference pools here
  .rpc();
```

---

## 🧪 Step 5: Test

1. **Clear browser cache** and reload your frontend
2. **Reconnect wallet**
3. **Test these swaps:**
   - ✅ USDC → SOL (should charge ~0.294 KEDOLOG)
   - ✅ SOL → USDC (should charge ~0.294 KEDOLOG)
   - ✅ USDC → KEDOLOG (should work)
   - ✅ KEDOLOG → USDC (should work)

---

## 🔍 Troubleshooting

### Error: `AccountDiscriminatorMismatch`

**Cause:** Wrong order in `remainingAccounts`

**Fix:** Make sure you pass **Pool FIRST, then Vault0, then Vault1** for each reference pool!

```typescript
// ✅ CORRECT:
[Pool, Vault0, Vault1, Pool, Vault0, Vault1]

// ❌ WRONG:
[Vault0, Vault1, Pool, ...]
```

### Error: `InvalidInput` with `Left: 0, Right: 0`

**Cause:** Frontend is using old pool addresses or wrong program ID

**Fix:** Make sure all addresses are from the NEW program: `4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf`

### Error: Wrong KEDOLOG fee amount

**Cause:** Frontend calculation doesn't match contract

**Fix:** The contract now handles ALL pricing logic. Just pass the correct `remainingAccounts` and let the contract calculate the fee!

---

## 📊 Expected Results

| Swap | Amount | Expected KEDOLOG Fee |
|------|--------|---------------------|
| 1 USDC → SOL | 1 USDC | ~0.294 KEDOLOG |
| 0.005 SOL → USDC | ~1 USDC | ~0.294 KEDOLOG |
| 1 USDC → KEDOLOG | 1 USDC | ~0.294 KEDOLOG |

All equivalent USD value swaps should charge the **same KEDOLOG fee** (with 25% discount applied).

---

## 🎉 You're Done!

Once you update these 4 things:
1. ✅ New IDL
2. ✅ New addresses
3. ✅ Correct `remainingAccounts` order
4. ✅ Remove oracle accounts

Your swaps should work perfectly! 🚀

---

## 📄 Reference Files

- **Pool addresses:** `reference-pools-devnet-1762747951626.json`
- **IDL:** `target/idl/kedolik_cp_swap.json`
- **Deployment info:** `deployed-devnet-1762736115069.json`

---

## 💡 Need Help?

If you encounter any issues, check:
1. Browser console for detailed error logs
2. Solana Explorer for transaction details
3. Make sure you're using the correct network (devnet)
4. Verify all addresses match the JSON files

---

**Last Updated:** 2025-11-10 04:12 UTC
**Network:** Devnet
**Program ID:** `4LyaQt2uNYX7zJABAVa56th8U68brWHWLioAYZSbCeEf`
