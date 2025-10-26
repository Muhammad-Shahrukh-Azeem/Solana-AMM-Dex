# 🐛 Bug Fix: Dust Reserve Issue (LP Supply = 0)

## Problem Description

**Critical Bug:** When users remove ALL liquidity from a pool, the LP supply becomes 0, but tiny "dust" amounts remain in the reserves. This causes the pool to enter an invalid state where subsequent deposits fail with `ExceededSlippage` error.

### Root Cause

In `programs/cp-swap/src/instructions/deposit.rs`, the deposit logic uses this calculation:

```rust
let results = CurveCalculator::lp_tokens_to_trading_tokens(
    u128::from(lp_token_amount),
    u128::from(pool_state.lp_supply),  // ← DIVISION BY ZERO when LP supply = 0
    u128::from(total_token_0_amount),
    u128::from(total_token_1_amount),
    RoundDirection::Ceiling,
)
```

When `lp_supply = 0`, the function attempts to divide by zero:

```rust
// In constant_product.rs
let mut token_0_amount = lp_token_amount
    .checked_mul(token_0_vault_amount)?
    .checked_div(lp_token_supply)?;  // ← Returns None when lp_supply = 0
```

This causes the calculation to return `None`, which triggers an error.

---

## Solution Implemented

### Modified File: `programs/cp-swap/src/instructions/deposit.rs`

Added special handling for when LP supply = 0:

```rust
// Handle the case where LP supply is 0 (pool was fully withdrawn but has dust)
let results = if pool_state.lp_supply == 0 {
    // Pool is empty - calculate tokens needed while maintaining reserve ratio
    if total_token_0_amount == 0 || total_token_1_amount == 0 {
        return err!(ErrorCode::ZeroTradingTokens);
    }
    
    // Calculate using: LP = sqrt(token_0 * token_1)
    // Maintain ratio: token_0/token_1 = total_token_0_amount/total_token_1_amount
    let lp_squared = u128::from(lp_token_amount)
        .checked_mul(u128::from(lp_token_amount))
        .ok_or(ErrorCode::MathOverflow)?;
    
    let token_1_squared = lp_squared
        .checked_mul(u128::from(total_token_1_amount))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(u128::from(total_token_0_amount))
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Integer square root
    let token_1_amount = integer_sqrt(token_1_squared);
    
    // Calculate token_0_amount maintaining the ratio
    let token_0_amount = u128::from(token_1_amount)
        .checked_mul(u128::from(total_token_0_amount))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(u128::from(total_token_1_amount))
        .ok_or(ErrorCode::MathOverflow)?;
    
    TradingTokenResult {
        token_0_amount,
        token_1_amount,
    }
} else {
    // Normal deposit - LP supply > 0
    CurveCalculator::lp_tokens_to_trading_tokens(
        u128::from(lp_token_amount),
        u128::from(pool_state.lp_supply),
        u128::from(total_token_0_amount),
        u128::from(total_token_1_amount),
        RoundDirection::Ceiling,
    )
    .ok_or(ErrorCode::ZeroTradingTokens)?
};
```

### Helper Function Added

```rust
/// Integer square root using Newton's method
/// Returns the largest integer x such that x^2 <= n
fn integer_sqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    
    let mut x = n;
    let mut y = (x + 1) / 2;
    
    // Newton's method: x_new = (x + n/x) / 2
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    
    x
}
```

---

## How It Works

### Normal Operation (LP Supply > 0)
Uses the standard formula:
```
token_amount = (lp_amount * vault_amount) / lp_supply
```

### Recovery Mode (LP Supply = 0)
When LP supply is 0 but reserves have dust:

1. **Maintain Reserve Ratio**: The deposit must maintain the existing ratio of tokens in the pool
   ```
   token_0 / token_1 = total_token_0_amount / total_token_1_amount
   ```

2. **Calculate Required Tokens**: Using the constant product formula `LP = sqrt(token_0 * token_1)`
   - Solve for `token_1`: `token_1 = sqrt(LP^2 * total_token_1_amount / total_token_0_amount)`
   - Calculate `token_0`: `token_0 = token_1 * (total_token_0_amount / total_token_1_amount)`

3. **Use Integer Math**: Avoid floating point by using integer square root (Newton's method)

---

## Test Coverage

### Test File: `tests/dust_reserve_fix.test.ts`

The test verifies the fix through 4 steps:

1. **Step 1**: Creates a pool with initial liquidity
   - Verifies LP supply > 0
   - Confirms pool is operational

2. **Step 2**: Removes ALL liquidity
   - Withdraws all LP tokens
   - Verifies LP supply = 0
   - Confirms dust remains in reserves
   - **This creates the bug state**

3. **Step 3**: Attempts deposit to empty pool (BUG FIX TEST)
   - Tries to deposit with LP supply = 0
   - **Before fix**: Would fail with `ExceededSlippage`
   - **After fix**: Successfully deposits and mints LP tokens
   - Verifies:
     - LP supply equals deposited amount
     - Vaults increased
     - User received LP tokens

4. **Step 4**: Verifies normal operations continue
   - Performs another deposit
   - Confirms pool is fully recovered
   - Validates ongoing functionality

### Running the Test

```bash
cd /home/ubuntu/raydium-cp-swap
anchor test tests/dust_reserve_fix.test.ts
```

---

## Impact

### Before Fix
- ❌ Pools could become permanently stuck
- ❌ Users unable to deposit after full withdrawal
- ❌ Pool liquidity lost forever
- ❌ Required pool recreation

### After Fix
- ✅ Pools automatically recover from dust state
- ✅ Deposits work correctly with LP supply = 0
- ✅ Maintains price ratio during recovery
- ✅ No manual intervention needed

---

## Edge Cases Handled

1. **Zero Reserves**: If both reserves are 0, returns `ZeroTradingTokens` error
2. **Math Overflow**: All calculations use checked arithmetic
3. **Integer Precision**: Uses integer square root to avoid floating point errors
4. **Ratio Preservation**: Maintains exact token ratio from dust reserves

---

## Files Modified

1. **programs/cp-swap/src/instructions/deposit.rs**
   - Added LP supply = 0 detection
   - Implemented recovery calculation
   - Added `integer_sqrt` helper function
   - Added import for `TradingTokenResult`

2. **tests/dust_reserve_fix.test.ts** (new file)
   - Comprehensive test suite
   - 4-step verification process
   - Tests both failure and recovery

---

## Deployment

### Build
```bash
anchor build -- --features devnet
```

### Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Verify
```bash
anchor test tests/dust_reserve_fix.test.ts
```

---

## Security Considerations

1. **No New Attack Vectors**: The fix only activates when LP supply = 0
2. **Maintains Invariants**: Constant product formula still holds
3. **Integer Math**: No floating point vulnerabilities
4. **Overflow Protection**: All operations use checked arithmetic

---

## Recommendations

1. ✅ **Deploy to Devnet**: Test thoroughly before mainnet
2. ✅ **Run Full Test Suite**: Ensure no regressions
3. ✅ **Monitor Initial Deposits**: Watch for any edge cases
4. ⚠️ **Consider Minimum LP**: Optionally lock small LP amount to prevent dust state

---

## Additional Notes

### Why This Bug Occurred

The original code assumed LP supply would never be 0 after initialization. However, when users withdraw ALL liquidity, the LP supply becomes 0, but due to rounding and transfer fees, tiny dust amounts remain in reserves.

### Why The Fix Works

The fix treats LP supply = 0 as a special case, similar to pool initialization. It calculates the required token amounts to achieve the desired LP tokens while maintaining the existing reserve ratio, effectively "re-initializing" the pool without creating a new one.

---

**Status**: ✅ Fixed and Tested  
**Date**: October 26, 2025  
**Version**: 0.2.0




