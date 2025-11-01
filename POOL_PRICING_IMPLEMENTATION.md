# 🎯 Pool-Based Pricing Implementation

## ✅ COMPLETED

The contract now supports **automatic price fetching from your KEDOLOG/USDC pool**!

### How It Works:

When users swap and pay fees with KEDOLOG, the contract:
1. Checks if price pool vaults are provided in the transaction
2. Reads the KEDOLOG and USDC reserves from the vaults
3. Calculates the real-time price: `price = (USDC_reserve / KEDOLOG_reserve)`
4. Uses this price to determine how many KEDOLOG tokens to charge

### Pricing Priority:

1. **Pool-based pricing** (if vaults provided) - Most accurate, real-time ✅
2. **Pyth oracle** (if available) - For when KEDOLOG is listed
3. **Manual config** (deprecated) - Fallback only

## 📝 Frontend Integration

To use pool-based pricing, pass the KEDOLOG/USDC pool vaults as remaining accounts:

```typescript
// When calling swap_base_input_with_protocol_token:
const tx = await program.methods
  .swapBaseInputWithProtocolToken(amountIn, minimumAmountOut)
  .accounts({
    // ... regular accounts ...
  })
  .remainingAccounts([
    { pubkey: kedologUsdcPool_token0Vault, isSigner: false, isWritable: false },
    { pubkey: kedologUsdcPool_token1Vault, isSigner: false, isWritable: false },
  ])
  .rpc();
```

### Getting the Vault Addresses:

```typescript
// Fetch the KEDOLOG/USDC pool state
const poolState = await program.account.poolState.fetch(kedologUsdcPoolAddress);

// Get vault addresses
const token0Vault = poolState.token0Vault; // KEDOLOG vault
const token1Vault = poolState.token1Vault; // USDC vault
```

## 🔧 Configuration

You still need to set the `price_pool` in the protocol token config (for reference):

```bash
# Update the config with your KEDOLOG/USDC pool address
npx ts-node scripts/update-kedolog-pool.ts
```

## 🚀 Benefits

- ✅ Real-time pricing based on actual pool liquidity
- ✅ No manual price updates needed
- ✅ Accurate fee calculations
- ✅ Automatic arbitrage prevention

## ⚠️ Important Notes

1. The pool vaults are **optional** - if not provided, falls back to Pyth oracle or manual price
2. Make sure the pool has sufficient liquidity for accurate pricing
3. The vaults are read-only (no writes), so gas cost is minimal

