# Kedolik DEX - Complete Implementation Guide

## Table of Contents
1. [Project Overview](#overview)
2. [What's Been Done](#completed)
3. [Pyth Oracle Explanation](#pyth-oracle)
4. [Fee Discount Implementation](#fee-discount)
5. [Next Steps](#next-steps)
6. [Testing Guide](#testing)
7. [Deployment](#deployment)

---

## Overview

**Kedolik DEX** - A constant product AMM forked from Raydium, with custom fee discount feature.

**Key Feature:** Users can pay trading fees with KEDOLIK (K token) and get 20% discount.

### How It Works:
```
Normal Swap:
├─ Fee: 10 USDC (1%)
└─ User pays in swap token

With K Token:
├─ Fee: 10 USDC worth
├─ Discount: 20% off
├─ Effective: 8 USDC worth
├─ Convert: 8 USDC → 80 K tokens (if K = $0.10)
└─ User pays 80 K tokens, gets full swap output!
```

---

## Completed

### ✅ Rebranding (100%)
- All files renamed from `raydium` to `kedolik`
- Program: `kedolik_cp_swap`
- Tests passing: 10/10 ✓

### ✅ State Structures (100%)
- **AmmConfig** - Added `fee_token_mint` and `fee_token_discount_rate`
- **PoolState** - Added `fee_token_vault` and `collected_fee_token_amount`

### ✅ Pyth Oracle Integration (100%)
- Added `pyth-sdk-solana` dependency
- Created `PythOracle` helper module
- Price conversion functions ready

---

## Pyth Oracle

### What It Does:
**Pyth provides real-time cryptocurrency prices on-chain.**

- Updates every 400ms
- Used by Jupiter, Mango, Drift
- Accurate and reliable

### How We Use It:

```rust
// 1. Get prices from Pyth accounts (passed as parameters)
let usdc_price = PythOracle::get_price(&usdc_price_feed)?; // $1.00
let k_price = PythOracle::get_price(&k_price_feed)?;       // $0.10

// 2. Convert fee value to K tokens
let k_amount = PythOracle::convert_token_amount(
    fee_in_usdc,      // 8 USDC
    usdc_price,       // $1.00
    k_price,          // $0.10
    decimals...
); // Result: 80 K tokens

// 3. Transfer K tokens from user
transfer(user_k_account → fee_vault, 80 K tokens);

// 4. Execute swap with full output
```

### Pyth Price Feed Addresses:

**Mainnet:**
- SOL/USD: `H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG`
- USDC/USD: `Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD`

**Devnet:**
- SOL/USD: `J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix`
- USDC/USD: `5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7`

**For K Token:**
- If listed on exchanges → Pyth will have feed
- If not → Use K/SOL pool price + SOL/USD Pyth price
- Or create fixed ratio in config (fallback)

---

## Fee Discount Implementation

### Complete Code Available!

📄 **See `K_TOKEN_FEE_IMPLEMENTATION.md` for:**
- Complete working code for K token fee payment
- Full explanation of Pyth Oracle integration
- Test examples
- Alternative approaches (Pyth vs Fixed price)

### Quick Summary:

```rust
pub fn swap_base_input(
    ctx: Context<Swap>,
    amount_in: u64,
    minimum_amount_out: u64,
    use_fee_token: bool,
) -> Result<()> {
    if use_fee_token {
        // 1. Calculate normal fee
        let fee = calculate_fee(amount_in, pool.trade_fee_rate)?;
        
        // 2. Apply 20% discount
        let discounted = fee * 80 / 100; // 80% of original
        
        // 3. Get Pyth prices
        let input_price = PythOracle::get_price(&ctx.accounts.input_price_feed)?;
        let k_price = PythOracle::get_price(&ctx.accounts.k_price_feed)?;
        
        // 4. Convert to K tokens
        let k_amount = PythOracle::convert_token_amount(
            discounted,
            input_price,
            k_price,
            ...decimals
        )?;
        
        // 5. Transfer K tokens
        transfer_checked(
            ctx.accounts.user_k_account,
            ctx.accounts.fee_vault,
            k_amount,
        )?;
        
        // 6. Update tracking
        pool.collected_fee_token_amount += k_amount;
        
        // 7. Execute swap with FULL output (no fee deduction)
        execute_swap_with_full_output(...)?;
    } else {
        // Normal swap with standard fee
        execute_normal_swap(...)?;
    }
    
    Ok(())
}
```

---

## Next Steps

### Phase 1: Implementation (1-2 hours)

```bash
# 1. Update swap instructions
# Edit: programs/cp-swap/src/instructions/swap_base_input.rs
# Edit: programs/cp-swap/src/instructions/swap_base_output.rs
# Edit: programs/cp-swap/src/lib.rs

# 2. Build
rustup override set nightly
anchor build
rustup override set 1.81.0

# 3. Verify build
ls -lh target/deploy/kedolik_cp_swap.so
```

### Phase 2: Testing (30 min)

```bash
# Create test file
# tests/fee_discount.test.ts

# Run tests
anchor test --skip-build
```

### Phase 3: Deployment

**Devnet:**
```bash
solana config set --url devnet
solana airdrop 2
anchor deploy
```

**Mainnet:**
```bash
solana config set --url mainnet-beta
anchor deploy
# NOTE: Ensure you have enough SOL for deployment (~5-10 SOL)
```

---

## Testing

### Test Scenarios:

1. **Baseline**: Normal swap without K token
2. **K Token Payment**: Swap with 20% discount
3. **Price Volatility**: Test with different Pyth prices
4. **Insufficient Balance**: User doesn't have enough K tokens
5. **Vault Accumulation**: Verify K tokens accumulate in fee vault
6. **Edge Cases**: Zero fee, max fee, etc.

### Example Test:

```typescript
it("Swap with K token (20% discount via Pyth)", async () => {
  // Setup
  const swapAmount = 1000 * 10**6; // 1000 USDC
  const normalFee = swapAmount * 0.01; // 10 USDC
  const discountedFee = normalFee * 0.8; // 8 USDC worth
  
  // Get Pyth prices
  const usdcPrice = await getPythPrice(USDC_PRICE_FEED);
  const kPrice = await getPythPrice(K_PRICE_FEED);
  
  // Calculate expected K tokens
  const expectedK = (discountedFee * usdcPrice) / kPrice;
  
  // Execute swap
  await program.methods
    .swapBaseInput(swapAmount, minOut, true) // use_fee_token: true
    .accounts({
      ...normalAccounts,
      inputPriceFeed: USDC_PRICE_FEED,
      kPriceFeed: K_PRICE_FEED,
      userKAccount: userKTokenAccount,
      feeVault: kFeeVault,
    })
    .rpc();
  
  // Verify
  const kBalance = await getTokenBalance(userKTokenAccount);
  assert.equal(kBalance, initialK - expectedK);
  
  const vaultBalance = await getTokenBalance(kFeeVault);
  assert.equal(vaultBalance, expectedK);
});
```

---

## Configuration

### Create AMM Config:

```rust
create_amm_config(
    ctx,
    index: 0,
    trade_fee_rate: 2500,           // 0.25%
    protocol_fee_rate: 500,         // 20% of fee
    fund_fee_rate: 500,             // 20% of fee
    create_pool_fee: 0,
    creator_fee_rate: 0,
    fee_token_mint: K_TOKEN_MINT,   // Your K token
    fee_token_discount_rate: 2000,  // 20% discount
)
```

---

## File Structure

```
kedolik-cp-swap/
├── programs/cp-swap/
│   ├── src/
│   │   ├── lib.rs                      # Main program
│   │   ├── states/
│   │   │   ├── config.rs               # AmmConfig (fee token fields)
│   │   │   └── pool.rs                 # PoolState (fee vault fields)
│   │   ├── instructions/
│   │   │   ├── swap_base_input.rs      # TO UPDATE
│   │   │   ├── swap_base_output.rs     # TO UPDATE
│   │   │   └── admin/create_config.rs  # ✓ Updated
│   │   ├── utils/
│   │   │   └── pyth.rs                 # ✓ Pyth oracle helper
│   │   └── error.rs                    # ✓ Error codes
│   └── Cargo.toml                      # ✓ Pyth dependency
├── tests/
│   ├── initialize.test.ts              # ✓ 10 tests passing
│   ├── swap.test.ts                    # ✓ Passing
│   ├── deposit.test.ts                 # ✓ Passing
│   ├── withdraw.test.ts                # ✓ Passing
│   └── fee_discount.test.ts            # TO CREATE
└── target/deploy/
    ├── kedolik_cp_swap.so              # ✓ 642KB
    └── kedolik_cp_swap-keypair.json    # ✓ Program ID
```

---

## Summary

### ✅ Done:
- Rebranding complete
- State structures ready
- Pyth oracle integrated
- Build system working
- All tests passing

### 🔄 Remaining (~1-2 hours):
- Update swap instructions with Pyth logic
- Add K token payment flow
- Create comprehensive tests

### 🎯 Result:
Users can pay fees with K token at 20% discount using real-time Pyth prices!

---

## Quick Commands

```bash
# Build
rustup override set nightly && anchor build && rustup override set 1.81.0

# Test
anchor test --skip-build

# Deploy Devnet
solana config set --url devnet && anchor deploy

# Deploy Mainnet
solana config set --url mainnet-beta && anchor deploy
```

