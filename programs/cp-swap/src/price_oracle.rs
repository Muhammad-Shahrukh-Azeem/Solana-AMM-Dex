use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;
use crate::error::ErrorCode;
use crate::states::{ProtocolTokenConfig, PoolState};

/// Price scaled by 10^9 for precision
pub const PRICE_SCALE: u128 = 1_000_000_000;

/// SOL mint address (wrapped SOL)
pub const SOL_MINT: &str = "So11111111111111111111111111111111111111112";

/// Load pool state from account and get vault addresses
fn get_pool_vaults(pool_account: &AccountInfo) -> Result<(Pubkey, Pubkey)> {
    let pool_data = pool_account.try_borrow_data()?;
    // Don't skip discriminator - try_deserialize expects it and validates it
    let pool_state = PoolState::try_deserialize(&mut &pool_data[..])?;
    Ok((pool_state.token_0_vault, pool_state.token_1_vault))
}

/// Get price from a pool by reading vault balances
/// Returns price scaled by 10^9
/// 
/// For a Token0/Token1 pool:
/// price_of_token0_in_token1 = token1_reserve / token0_reserve
fn get_pool_price(
    token_0_vault: &AccountInfo,
    token_1_vault: &AccountInfo,
    token_0_decimals: u8,
    token_1_decimals: u8,
) -> Result<u128> {
    // Read vault balances
    let vault_0_data = token_0_vault.try_borrow_data()?;
    let vault_1_data = token_1_vault.try_borrow_data()?;
    
    // Parse as token accounts
    let vault_0_account = TokenAccount::try_deserialize(&mut &vault_0_data[..])?;
    let vault_1_account = TokenAccount::try_deserialize(&mut &vault_1_data[..])?;
    
    let reserve_0 = vault_0_account.amount;
    let reserve_1 = vault_1_account.amount;
    
    require_gt!(reserve_0, 0, ErrorCode::InvalidInput);
    require_gt!(reserve_1, 0, ErrorCode::InvalidInput);
    
    msg!("Pool reserves - Token0: {}, Token1: {}", reserve_0, reserve_1);
    
    // Calculate price: price = (reserve_1 * 10^9 * 10^token0_decimals) / (reserve_0 * 10^token1_decimals)
    let price = (reserve_1 as u128)
        .checked_mul(PRICE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(token_0_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(
            (reserve_0 as u128)
                .checked_mul(10u128.pow(token_1_decimals as u32))
                .ok_or(ErrorCode::MathOverflow)?
        )
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("Calculated price (scaled by 10^9): {}", price);
    
    Ok(price)
}

/// Get price of base token in quote token, automatically detecting token order
/// Returns price scaled by 10^9
fn get_token_price_in_quote<'info>(
    vault_0: &AccountInfo<'info>,
    vault_1: &AccountInfo<'info>,
    base_mint: &Pubkey,
    quote_mint: &Pubkey,
    base_decimals: u8,
    quote_decimals: u8,
) -> Result<u128> {
    // SAFETY: We need to read account data that may already be borrowed by the swap instruction.
    // This is safe because:
    // 1. We only READ the data (no mutation)
    // 2. The data won't change during our read (atomic operation)
    // 3. We're reading token account balances which are stable during the instruction
    let vault_0_data = unsafe { &*vault_0.data.as_ptr() };
    let vault_1_data = unsafe { &*vault_1.data.as_ptr() };
    
    let vault_0_account = TokenAccount::try_deserialize(&mut &vault_0_data[..])?;
    let vault_1_account = TokenAccount::try_deserialize(&mut &vault_1_data[..])?;
    
    // Determine which vault is base and which is quote
    let (base_reserve, quote_reserve) = if vault_0_account.mint == *base_mint && vault_1_account.mint == *quote_mint {
        msg!("Token order: base=vault0, quote=vault1");
        (vault_0_account.amount, vault_1_account.amount)
    } else if vault_1_account.mint == *base_mint && vault_0_account.mint == *quote_mint {
        msg!("Token order: base=vault1, quote=vault0");
        (vault_1_account.amount, vault_0_account.amount)
    } else {
        msg!("ERROR: Pool does not contain expected token pair");
        msg!("Expected: {} / {}", base_mint, quote_mint);
        msg!("Found: {} / {}", vault_0_account.mint, vault_1_account.mint);
        return Err(ErrorCode::InvalidInput.into());
    };
    
    require_gt!(base_reserve, 0, ErrorCode::InvalidInput);
    require_gt!(quote_reserve, 0, ErrorCode::InvalidInput);
    
    msg!("Base reserve: {}, Quote reserve: {}", base_reserve, quote_reserve);
    
    // Calculate price: price = (quote_reserve * 10^9 * 10^base_decimals) / (base_reserve * 10^quote_decimals)
    let price = (quote_reserve as u128)
        .checked_mul(PRICE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(base_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(
            (base_reserve as u128)
                .checked_mul(10u128.pow(quote_decimals as u32))
                .ok_or(ErrorCode::MathOverflow)?
        )
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("Calculated price (scaled): {}", price);
    
    Ok(price)
}

/// Get KEDOLOG price in USDC from KEDOLOG/USDC pool
fn get_kedolog_usdc_price<'info>(
    kedolog_vault: &AccountInfo<'info>,
    usdc_vault: &AccountInfo<'info>,
    kedolog_mint: &Pubkey,
) -> Result<u128> {
    msg!("Fetching KEDOLOG/USDC price");
    
    // SAFETY: Read account data without borrowing to avoid conflicts
    let vault_0_data = unsafe { &*kedolog_vault.data.as_ptr() };
    let vault_1_data = unsafe { &*usdc_vault.data.as_ptr() };
    
    let vault_0_account = TokenAccount::try_deserialize(&mut &vault_0_data[..])?;
    let vault_1_account = TokenAccount::try_deserialize(&mut &vault_1_data[..])?;
    
    // Determine which vault is KEDOLOG and which is USDC
    let (kedolog_reserve, usdc_reserve) = if vault_0_account.mint == *kedolog_mint {
        msg!("KEDOLOG is vault 0, USDC is vault 1");
        (vault_0_account.amount, vault_1_account.amount)
    } else if vault_1_account.mint == *kedolog_mint {
        msg!("KEDOLOG is vault 1, USDC is vault 0");
        (vault_1_account.amount, vault_0_account.amount)
    } else {
        msg!("ERROR: Neither vault matches KEDOLOG mint");
        return Err(ErrorCode::InvalidInput.into());
    };
    
    require_gt!(kedolog_reserve, 0, ErrorCode::InvalidInput);
    require_gt!(usdc_reserve, 0, ErrorCode::InvalidInput);
    
    msg!("KEDOLOG reserve: {}, USDC reserve: {}", kedolog_reserve, usdc_reserve);
    
    // Price of KEDOLOG in USDC
    // KEDOLOG has 9 decimals, USDC has 6 decimals
    let price = (usdc_reserve as u128)
        .checked_mul(PRICE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(9))  // KEDOLOG decimals
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(
            (kedolog_reserve as u128)
                .checked_mul(10u128.pow(6))  // USDC decimals
                .ok_or(ErrorCode::MathOverflow)?
        )
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("KEDOLOG price in USDC: {}", price);
    
    Ok(price)
}

/// Get SOL price in USDC from SOL/USDC pool
fn get_sol_usdc_price(
    sol_vault: &AccountInfo,
    usdc_vault: &AccountInfo,
) -> Result<u128> {
    msg!("Fetching SOL/USDC price");
    
    let sol_mint = Pubkey::try_from(SOL_MINT).unwrap();
    
    // Read vault data to determine which is which
    let vault_0_data = sol_vault.try_borrow_data()?;
    let vault_1_data = usdc_vault.try_borrow_data()?;
    
    let vault_0_account = TokenAccount::try_deserialize(&mut &vault_0_data[..])?;
    let vault_1_account = TokenAccount::try_deserialize(&mut &vault_1_data[..])?;
    
    // Determine which vault is SOL and which is USDC
    let (sol_reserve, usdc_reserve) = if vault_0_account.mint == sol_mint {
        msg!("SOL is vault 0, USDC is vault 1");
        (vault_0_account.amount, vault_1_account.amount)
    } else if vault_1_account.mint == sol_mint {
        msg!("SOL is vault 1, USDC is vault 0");
        (vault_1_account.amount, vault_0_account.amount)
    } else {
        msg!("ERROR: Neither vault matches SOL mint");
        return Err(ErrorCode::InvalidInput.into());
    };
    
    require_gt!(sol_reserve, 0, ErrorCode::InvalidInput);
    require_gt!(usdc_reserve, 0, ErrorCode::InvalidInput);
    
    msg!("SOL reserve: {}, USDC reserve: {}", sol_reserve, usdc_reserve);
    
    // Price of SOL in USDC
    // SOL has 9 decimals, USDC has 6 decimals
    let price = (usdc_reserve as u128)
        .checked_mul(PRICE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(9))  // SOL decimals
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(
            (sol_reserve as u128)
                .checked_mul(10u128.pow(6))  // USDC decimals
                .ok_or(ErrorCode::MathOverflow)?
        )
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("SOL price in USDC: {}", price);
    
    Ok(price)
}

/// Calculate protocol token amount needed to pay fee
/// 
/// This is the main entry point for KEDOLOG fee calculation.
/// It automatically detects the token pair and calculates the USD value,
/// then converts to KEDOLOG amount.
/// 
/// # Arguments
/// * `fee_amount_in_input_token` - The fee amount in input token units
/// * `input_token_mint` - The mint of the input token
/// * `input_token_decimals` - Decimals of input token
/// * `output_token_mint` - The mint of the output token
/// * `output_token_decimals` - Decimals of output token
/// * `protocol_token_config` - The KEDOLOG config with reference pools
/// * `protocol_token_decimals` - KEDOLOG decimals (9)
/// * `kedolog_usdc_pool` - KEDOLOG/USDC pool account (contract reads vaults)
/// * `sol_usdc_pool` - SOL/USDC pool account (optional, contract reads vaults)
pub fn calculate_protocol_token_amount<'info>(
    fee_amount_in_input_token: u64,
    input_token_mint: &Pubkey,
    input_token_decimals: u8,
    output_token_mint: &Pubkey,
    output_token_decimals: u8,
    protocol_token_config: &ProtocolTokenConfig,
    protocol_token_decimals: u8,
    kedolog_usdc_pool: &AccountInfo<'info>,
    sol_usdc_pool: Option<&AccountInfo<'info>>,
    remaining_accounts: &[AccountInfo<'info>],
    // Optional: current swap pool info (to avoid reading vaults that are already borrowed)
    current_pool_input_vault_amount: Option<u64>,
    current_pool_output_vault_amount: Option<u64>,
) -> Result<u64> {
    msg!("=== KEDOLOG Fee Calculation ===");
    msg!("Fee amount in input token: {}", fee_amount_in_input_token);
    msg!("Input token mint: {}", input_token_mint);
    msg!("Output token mint: {}", output_token_mint);
    
    let sol_mint = Pubkey::try_from(SOL_MINT).unwrap();
    let usdc_mint = protocol_token_config.usdc_mint;
    
    // Verify KEDOLOG/USDC pool matches config
    require!(kedolog_usdc_pool.key() == protocol_token_config.kedolog_usdc_pool, ErrorCode::InvalidInput);
    
    // Get vault accounts from remaining_accounts
    // We trust the frontend to pass the correct vaults since we verified the pool address
    // remaining_accounts format: [vault_0, vault_1, (sol_vault_0, sol_vault_1)]
    require!(remaining_accounts.len() >= 2, ErrorCode::InvalidInput);
    let kedolog_usdc_vault_0 = &remaining_accounts[0];
    let kedolog_usdc_vault_1 = &remaining_accounts[1];
    
    // Determine the token pair type and calculate USD value
    let fee_value_in_usd = if *input_token_mint == usdc_mint {
        // Case 1: Input is USDC - direct USD value
        msg!("Case 1: Input token is USDC (direct USD value)");
        let fee_usd = (fee_amount_in_input_token as u128)
            .checked_mul(PRICE_SCALE)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10u128.pow(input_token_decimals as u32))
            .ok_or(ErrorCode::MathOverflow)?;
        fee_usd
    } else if *input_token_mint == sol_mint {
        // Case 2: Input is SOL - need SOL/USDC price
        msg!("Case 2: Input token is SOL");
        
        // Special case: If output is USDC, we're swapping in the SOL/USDC pool itself
        // Use the current pool's vault balances instead of trying to read the reference pool
        if *output_token_mint == usdc_mint && current_pool_input_vault_amount.is_some() && current_pool_output_vault_amount.is_some() {
            msg!("Special case: SOL->USDC swap, using current pool reserves");
            let sol_reserve = current_pool_input_vault_amount.unwrap();
            let usdc_reserve = current_pool_output_vault_amount.unwrap();
            
            msg!("SOL reserve: {}, USDC reserve: {}", sol_reserve, usdc_reserve);
            
            // Calculate SOL price from current pool reserves
            // price = (usdc_reserve * PRICE_SCALE * 10^sol_decimals) / (sol_reserve * 10^usdc_decimals)
            let sol_price_usd = (usdc_reserve as u128)
                .checked_mul(PRICE_SCALE)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_mul(10u128.pow(9))  // SOL decimals
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(
                    (sol_reserve as u128)
                        .checked_mul(10u128.pow(6))  // USDC decimals
                        .ok_or(ErrorCode::MathOverflow)?
                )
                .ok_or(ErrorCode::MathOverflow)?;
            
            msg!("SOL price (scaled): {}", sol_price_usd);
            
            let fee_usd = (fee_amount_in_input_token as u128)
                .checked_mul(sol_price_usd)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(10u128.pow(input_token_decimals as u32))
                .ok_or(ErrorCode::MathOverflow)?;
            
            msg!("Fee USD (scaled): {}", fee_usd);
            fee_usd
        } else {
            // Normal case: Read SOL price from SOL/USDC pool
            require!(sol_usdc_pool.is_some(), ErrorCode::InvalidInput);
            require!(remaining_accounts.len() >= 4, ErrorCode::InvalidInput);
            
            let sol_pool = sol_usdc_pool.unwrap();
            
            // Verify SOL/USDC pool matches config
            require!(sol_pool.key() == protocol_token_config.sol_usdc_pool, ErrorCode::InvalidInput);
            
            // Get vault accounts from remaining_accounts
            let sol_usdc_vault_0 = &remaining_accounts[2];
            let sol_usdc_vault_1 = &remaining_accounts[3];
            
            // Use get_token_price_in_quote which automatically detects token order
            let sol_price_usd = get_token_price_in_quote(
                sol_usdc_vault_0,
                sol_usdc_vault_1,
                &sol_mint,
                &usdc_mint,
                9,  // SOL decimals
                6,  // USDC decimals
            )?;
            
            // Calculate USD value of fee
            msg!("SOL price (scaled): {}", sol_price_usd);
            msg!("Fee amount in SOL: {}", fee_amount_in_input_token);
            
            let fee_usd = (fee_amount_in_input_token as u128)
                .checked_mul(sol_price_usd)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(10u128.pow(input_token_decimals as u32))
                .ok_or(ErrorCode::MathOverflow)?;
            
            msg!("Fee USD (scaled): {}", fee_usd);
            fee_usd
        }
    } else {
        // Case 3: Token pair with intermediate hop (1-hop support)
        // Check if input token has a USDC or SOL pool
        msg!("Case 3: Checking for intermediate hop via USDC or SOL");
        
        // We need at least 6 accounts for 1-hop: [kedolog pool (3), intermediate pool (3)]
        // If we have 9 accounts, we have: [kedolog pool (3), intermediate pool (3), final pool (3)]
        
        if remaining_accounts.len() >= 4 {
            // We have an intermediate pool provided
            // Format: [kedolog_vault_0, kedolog_vault_1, intermediate_vault_0, intermediate_vault_1, ...]
            
            let intermediate_vault_0 = &remaining_accounts[2];
            let intermediate_vault_1 = &remaining_accounts[3];
            
            msg!("Attempting 1-hop price discovery");
            
            // Read intermediate pool vaults to determine tokens
            let vault_0_data = intermediate_vault_0.try_borrow_data()?;
            let vault_1_data = intermediate_vault_1.try_borrow_data()?;
            
            let vault_0_account = TokenAccount::try_deserialize(&mut &vault_0_data[..])?;
            let vault_1_account = TokenAccount::try_deserialize(&mut &vault_1_data[..])?;
            
            let intermediate_mint_0 = vault_0_account.mint;
            let intermediate_mint_1 = vault_1_account.mint;
            
            // Check if this pool connects input token to USDC or SOL
            let connects_to_usdc = intermediate_mint_0 == usdc_mint || intermediate_mint_1 == usdc_mint;
            let connects_to_sol = intermediate_mint_0 == sol_mint || intermediate_mint_1 == sol_mint;
            let has_input_token = intermediate_mint_0 == *input_token_mint || intermediate_mint_1 == *input_token_mint;
            
            if has_input_token && connects_to_usdc {
                // Input token has direct USDC pool
                msg!("Found intermediate pool: Input Token → USDC");
                
                let input_price_usdc = get_token_price_in_quote(
                    intermediate_vault_0,
                    intermediate_vault_1,
                    input_token_mint,
                    &usdc_mint,
                    input_token_decimals,
                    6, // USDC decimals
                )?;
                
                // Calculate USD value of fee
                // input_price_usdc is scaled by PRICE_SCALE
                let fee_usd_actual = (fee_amount_in_input_token as u128)
                    .checked_mul(input_price_usdc)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(10u128.pow(input_token_decimals as u32))
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(PRICE_SCALE)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                // Scale back up for consistency
                let fee_usd = fee_usd_actual
                    .checked_mul(PRICE_SCALE)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                fee_usd
            } else if has_input_token && connects_to_sol {
                // Input token has SOL pool, need SOL/USDC price too
                msg!("Found intermediate pool: Input Token → SOL → USDC");
                
                require!(remaining_accounts.len() >= 6, ErrorCode::InvalidInput);
                
                // Get input token price in SOL
                let input_price_sol = get_token_price_in_quote(
                    intermediate_vault_0,
                    intermediate_vault_1,
                    input_token_mint,
                    &sol_mint,
                    input_token_decimals,
                    9, // SOL decimals
                )?;
                
                // Get SOL price in USDC from additional vaults
                let sol_usdc_vault_0 = &remaining_accounts[4];
                let sol_usdc_vault_1 = &remaining_accounts[5];
                
                let sol_price_usd = get_sol_usdc_price(
                    sol_usdc_vault_0,
                    sol_usdc_vault_1,
                )?;
                
                // Calculate input token price in USD: input_sol_price * sol_usd_price
                // Both are scaled by PRICE_SCALE, so divide once to get price still scaled by PRICE_SCALE
                let input_price_usd = input_price_sol
                    .checked_mul(sol_price_usd)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(PRICE_SCALE)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                // Calculate USD value of fee
                // input_price_usd is scaled by PRICE_SCALE
                let fee_usd_actual = (fee_amount_in_input_token as u128)
                    .checked_mul(input_price_usd)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(10u128.pow(input_token_decimals as u32))
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(PRICE_SCALE)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                // Scale back up for consistency
                let fee_usd = fee_usd_actual
                    .checked_mul(PRICE_SCALE)
                    .ok_or(ErrorCode::MathOverflow)?;
                
                fee_usd
            } else {
                msg!("ERROR: No valid price path found");
                return Err(ErrorCode::InvalidInput.into());
            }
        } else {
            msg!("ERROR: Unsupported token pair - no intermediate pool provided");
            return Err(ErrorCode::InvalidInput.into());
        }
    };
    
    msg!("Fee value in USD (scaled): {}", fee_value_in_usd);
    msg!("PRICE_SCALE: {}", PRICE_SCALE);
    
    // Get KEDOLOG price in USDC
    let kedolog_price_usd = get_kedolog_usdc_price(
        kedolog_usdc_vault_0,
        kedolog_usdc_vault_1,
        &protocol_token_config.protocol_token_mint,
    )?;
    
    msg!("KEDOLOG price in USD (scaled): {}", kedolog_price_usd);
    msg!("Protocol token decimals: {}", protocol_token_decimals);
    
    // Calculate KEDOLOG amount needed
    // Both fee_value_in_usd and kedolog_price_usd are scaled by PRICE_SCALE
    // kedolog_amount = (fee_usd_scaled * 10^kedolog_decimals) / kedolog_price_scaled
    let intermediate = fee_value_in_usd
        .checked_mul(10u128.pow(protocol_token_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("Intermediate (fee_usd * 10^decimals): {}", intermediate);
    
    let kedolog_amount = intermediate
        .checked_div(kedolog_price_usd)
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("KEDOLOG amount (raw): {}", kedolog_amount);
    
    // Convert to u64
    let result = u64::try_from(kedolog_amount)
        .map_err(|_| ErrorCode::MathOverflow)?;
    
    require_gt!(result, 0, ErrorCode::InvalidInput);
    
    msg!("KEDOLOG amount required (final): {}", result);
    msg!("=== End Calculation ===");
    
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_calculation() {
        // Test case: 0.05 SOL fee, SOL = $200, KEDOLOG = $0.0017
        // Expected: 0.05 * 200 / 0.0017 ≈ 5882 KEDOLOG
        
        let fee_amount = 50_000_000; // 0.05 SOL (9 decimals)
        let sol_price = 200 * PRICE_SCALE; // $200
        let kedolog_price = PRICE_SCALE / 588; // ~$0.0017
        
        let sol_decimals = 9;
        let kedolog_decimals = 9;
        
        // fee_value_usd = (50_000_000 * 200_000_000_000) / 10^9 = 10_000_000_000
        let fee_value_usd = (fee_amount as u128)
            .checked_mul(sol_price)
            .unwrap()
            .checked_div(10u128.pow(sol_decimals))
            .unwrap();
        
        // kedolog_amount = (10_000_000_000 * 10^9) / (1_000_000_000 / 588)
        let kedolog_amount = fee_value_usd
            .checked_mul(10u128.pow(kedolog_decimals))
            .unwrap()
            .checked_div(kedolog_price)
            .unwrap();
        
        assert!(kedolog_amount > 5_000_000_000); // Should be around 5882 KEDOLOG
        assert!(kedolog_amount < 6_000_000_000);
    }
}
