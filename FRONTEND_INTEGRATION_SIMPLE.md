# Frontend Integration - Super Simple Guide

## 🎯 What You Need to Know

The contract now handles ALL pricing logic automatically. You just need to pass pool and vault addresses.

---

## 📦 Step 1: Fetch Reference Data (Once at Startup)

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

// Your config addresses (from deployment)
const PROTOCOL_TOKEN_CONFIG = new PublicKey('YOUR_PROTOCOL_CONFIG_ADDRESS');

// Fetch pool addresses from config
async function fetchReferenceData(program: Program) {
  // Get pool addresses from config
  const config = await program.account.protocolTokenConfig.fetch(PROTOCOL_TOKEN_CONFIG);
  
  const kedologUsdcPool = config.kedologUsdcPool;
  const solUsdcPool = config.solUsdcPool;
  
  // Get vault addresses from pools
  const kedologPoolState = await program.account.poolState.fetch(kedologUsdcPool);
  const kedologVault0 = kedologPoolState.token0Vault;
  const kedologVault1 = kedologPoolState.token1Vault;
  
  const solPoolState = await program.account.poolState.fetch(solUsdcPool);
  const solVault0 = solPoolState.token0Vault;
  const solVault1 = solPoolState.token1Vault;
  
  // Cache these for all swaps
  return {
    kedologUsdcPool,
    kedologVault0,
    kedologVault1,
    solUsdcPool,
    solVault0,
    solVault1,
  };
}
```

---

## 💱 Step 2: For Each Swap

```typescript
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

async function buildSwapRemainingAccounts(
  poolAddress: PublicKey,
  program: Program,
  referenceData: any // from Step 1
) {
  // Get current swap pool info
  const poolState = await program.account.poolState.fetch(poolAddress);
  
  // Check if this is a SOL pair
  const isSOLPair = 
    poolState.token0Mint.equals(SOL_MINT) || 
    poolState.token1Mint.equals(SOL_MINT);
  
  // Build remaining accounts
  const remainingAccounts = [];
  
  // Always pass KEDOLOG/USDC pool + vaults
  remainingAccounts.push(
    { pubkey: referenceData.kedologUsdcPool, isSigner: false, isWritable: false },
    { pubkey: referenceData.kedologVault0, isSigner: false, isWritable: false },
    { pubkey: referenceData.kedologVault1, isSigner: false, isWritable: false }
  );
  
  // If SOL pair, also pass SOL/USDC pool + vaults
  if (isSOLPair) {
    remainingAccounts.push(
      { pubkey: referenceData.solUsdcPool, isSigner: false, isWritable: false },
      { pubkey: referenceData.solVault0, isSigner: false, isWritable: false },
      { pubkey: referenceData.solVault1, isSigner: false, isWritable: false }
    );
  }
  
  return remainingAccounts;
}
```

---

## 🚀 Step 3: Execute Swap

```typescript
async function swapWithKedologDiscount(
  program: Program,
  poolAddress: PublicKey,
  amountIn: BN,
  minimumAmountOut: BN,
  referenceData: any,
  // ... other parameters
) {
  // Build remaining accounts
  const remainingAccounts = await buildSwapRemainingAccounts(
    poolAddress,
    program,
    referenceData
  );
  
  // Execute swap
  const tx = await program.methods
    .swapBaseInputWithProtocolToken(amountIn, minimumAmountOut)
    .accounts({
      payer: wallet.publicKey,
      authority: authority,
      ammConfig: AMM_CONFIG,
      protocolTokenConfig: PROTOCOL_TOKEN_CONFIG,
      poolState: poolAddress,
      inputTokenAccount: userInputAccount,
      outputTokenAccount: userOutputAccount,
      protocolTokenAccount: userKedologAccount,
      protocolTokenTreasury: feeReceiverKedologAccount,
      inputVault: inputVault,
      outputVault: outputVault,
      inputTokenProgram: TOKEN_PROGRAM_ID,
      outputTokenProgram: TOKEN_PROGRAM_ID,
      protocolTokenProgram: TOKEN_PROGRAM_ID,
      inputTokenMint: inputMint,
      outputTokenMint: outputMint,
      protocolTokenMint: KEDOLOG_MINT,
      observationState: poolState.observationKey,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();
    
  return tx;
}
```

---

## ✅ That's It!

### What Changed:
- ❌ **REMOVED**: Oracle parameters
- ❌ **REMOVED**: Pyth imports
- ❌ **REMOVED**: Oracle address management
- ✅ **ADDED**: Fetch pool addresses from config
- ✅ **ADDED**: Fetch vault addresses from pools
- ✅ **ADDED**: Pass pools + vaults in `remainingAccounts`

### What the Contract Does Automatically:
1. ✅ Verifies pool addresses match config
2. ✅ Reads vault addresses from pools
3. ✅ Verifies vault addresses match
4. ✅ Calculates USD value from pool ratios
5. ✅ Converts to KEDOLOG amount
6. ✅ Applies 25% discount

### Benefits:
- 🎯 **Simple**: Just fetch addresses and pass them
- 🔒 **Secure**: Contract verifies everything
- ⚡ **Fast**: Real-time pricing from pools
- 🎨 **Clean**: No oracle management
- ✅ **Consistent**: Same fees for same USD value

---

## 🐛 Debugging

If swap fails, check:
1. Pool addresses are correct (from config)
2. Vault addresses are correct (from pools)
3. Passing correct number of accounts (3 for USDC pairs, 6 for SOL pairs)
4. User has enough KEDOLOG tokens

---

## 📚 Full Documentation

See `IMPLEMENTATION_GUIDE.md` for complete details, examples, and testing scenarios.

