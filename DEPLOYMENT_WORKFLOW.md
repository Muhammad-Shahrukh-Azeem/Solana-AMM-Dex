# 🚀 Complete Deployment Workflow with Pool-Based Pricing

## 📋 Overview

This guide walks you through deploying the contract with pool-based pricing for the KEDOLOG discount feature.

## 🔄 Deployment Steps

### Step 1: Deploy Program & Create Configs

```bash
# This will:
# - Deploy the program
# - Create AMM config (1 SOL pool fee)
# - Create KEDOLOG config (25% discount, price_pool = default for now)
npx ts-node scripts/deploy-fresh-auto.ts
```

**What happens:**
- ✅ Program deployed
- ✅ AMM Config created with 1 SOL pool creation fee
- ✅ KEDOLOG Config created with 25% discount
- ⏳ Price pool = `11111111111111111111111111111111` (default, to be set later)

### Step 2: Create KEDOLOG/USDC Pool from Frontend

After deployment, create your KEDOLOG/USDC pool:

1. Go to your frontend
2. Create a new pool with:
   - Token A: KEDOLOG (`22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx`)
   - Token B: USDC
   - Initial liquidity (e.g., 1000 KEDOLOG + equivalent USDC)
3. **Save the pool address!**

### Step 3: Set the Price Pool

```bash
# This will update the KEDOLOG config to use your pool for pricing
npx ts-node scripts/set-kedolog-price-pool.ts
```

**The script will:**
1. Ask for your KEDOLOG/USDC pool address
2. Verify the pool exists and contains KEDOLOG
3. Fetch the vault addresses
4. Update the protocol token config
5. Display the vault addresses for frontend integration

### Step 4: Update Frontend

Add the pool vaults as remaining accounts when swapping with KEDOLOG:

```typescript
// Example swap with KEDOLOG discount
const tx = await program.methods
  .swapBaseInputWithProtocolToken(amountIn, minimumAmountOut)
  .accounts({
    payer: wallet.publicKey,
    authority,
    ammConfig,
    protocolTokenConfig,
    poolState,
    inputTokenAccount,
    outputTokenAccount,
    protocolTokenAccount,
    protocolTokenTreasury,
    inputVault,
    outputVault,
    inputTokenProgram,
    outputTokenProgram,
    protocolTokenProgram,
    inputTokenMint,
    outputTokenMint,
    protocolTokenMint,
    observationState,
    inputTokenOracle,
    protocolTokenOracle,
  })
  .remainingAccounts([
    // These vault addresses are from Step 3
    { pubkey: kedologUsdcPool_token0Vault, isSigner: false, isWritable: false },
    { pubkey: kedologUsdcPool_token1Vault, isSigner: false, isWritable: false },
  ])
  .rpc();
```

## 🎯 How Pool-Based Pricing Works

1. **User initiates swap** with KEDOLOG discount
2. **Frontend passes pool vaults** as remaining accounts
3. **Contract reads vault balances:**
   - KEDOLOG reserve
   - USDC reserve
4. **Contract calculates price:**
   ```
   KEDOLOG_price_in_USD = USDC_reserve / KEDOLOG_reserve
   ```
5. **Contract determines fee:**
   ```
   KEDOLOG_fee = (protocol_fee_in_USD / KEDOLOG_price_in_USD)
   ```
6. **User pays with KEDOLOG** at real-time pool price

## ✅ Benefits

- ✅ **Real-time pricing** - Always reflects current market price
- ✅ **No manual updates** - Price updates automatically with pool trades
- ✅ **Accurate fees** - Based on actual liquidity
- ✅ **Arbitrage-proof** - Uses same pool as your DEX

## 📊 Pricing Priority

The contract uses this priority for KEDOLOG pricing:

1. **Pool vaults** (if provided in remaining accounts) ← **Primary method**
2. **Pyth oracle** (if KEDOLOG is listed on Pyth)
3. **Manual config** (deprecated, only as fallback)

## 🔧 Configuration Files

After deployment, you'll have:

```json
// deployed-devnet-fresh.json (or deployed-mainnet-fresh.json)
{
  "network": "devnet",
  "programId": "47TgfB8vwsKkN6BVHk25ZyMjrovqW9wCQBG1u7SGqqXc",
  "ammConfig": {
    "index": 0,
    "address": "GJ9pr999jqk6zeZFEeZmL8XgcnEDFzhrf1XoCkehthdB",
    ...
  },
  "kedologConfig": {
    "address": "8uSFyQa9gMYUqDz8iuRG8s1eFCk2eBuR7ipwyhdQe1Z",
    "mint": "22NataEERKBqvBt3SFYJj5oE1fqiTx4HbsxU1FuSNWbx",
    "discountRate": 2500,
    "treasury": "67D6TM8PTsuv8nU5PnUP3dV6j8kW3rmTD9KNufcEUPCa"
  },
  ...
}
```

## 🚨 Important Notes

1. **Pool must have liquidity** - Ensure sufficient liquidity for accurate pricing
2. **Vaults are read-only** - No writes, minimal gas cost
3. **Optional feature** - If vaults not provided, falls back to Pyth/manual pricing
4. **Update anytime** - You can change the price pool later if needed

## 📝 Quick Reference

| Script | Purpose |
|--------|---------|
| `deploy-fresh-auto.ts` | Deploy program + create configs |
| `set-kedolog-price-pool.ts` | Set pool address after pool creation |

## 🎉 You're Done!

After completing these steps, your contract will automatically fetch KEDOLOG prices from your pool in real-time!

