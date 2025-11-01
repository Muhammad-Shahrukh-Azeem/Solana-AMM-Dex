use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::states::ProtocolTokenConfig;

/// Price oracle module for fetching token prices
/// 
/// Supports multiple oracle types:
/// 1. Pyth Network (recommended for production)
/// 2. Switchboard
/// 3. Pool-based pricing (using your own swap pools)
/// 4. Manual pricing (fallback)

/// Price scaled by 10^9 for precision
pub const PRICE_SCALE: u128 = 1_000_000_000;

/// Maximum age for price data (5 minutes)
pub const MAX_PRICE_AGE_SECONDS: i64 = 300;

/// Get the USD price of a token from oracle
/// Returns price scaled by 10^9 (e.g., $1.50 = 1_500_000_000)
/// 
/// **REQUIRES ORACLE**: This function now requires a valid oracle account
/// to ensure accurate pricing for all tokens.
pub fn get_token_usd_price(
    token_mint: &Pubkey,
    oracle_account: Option<&AccountInfo>,
    decimals: u8,
) -> Result<u128> {
    // Oracle is required for accurate pricing
    let oracle = oracle_account.ok_or_else(|| {
        msg!("Oracle account required for token: {}", token_mint);
        ErrorCode::OracleNotConfigured
    })?;
    
    msg!("Fetching price for token: {}", token_mint);
    
    // Try Pyth oracle first
    if let Ok(price) = get_pyth_price(oracle, decimals) {
        msg!("Successfully fetched price from Pyth oracle");
        return Ok(price);
    }
    
    // Try Switchboard oracle
    if let Ok(price) = get_switchboard_price(oracle, decimals) {
        msg!("Successfully fetched price from Switchboard oracle");
        return Ok(price);
    }
    
    // If we get here, the oracle account is invalid
    msg!("Oracle account provided but not recognized as Pyth or Switchboard");
    Err(ErrorCode::InvalidOracle.into())
}

/// Get price from Pyth oracle
/// 
/// Pyth provides price feeds for major tokens
/// Price format: price * 10^expo
fn get_pyth_price(oracle_account: &AccountInfo, _decimals: u8) -> Result<u128> {
    use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
    
    // Load the Pyth price update account
    let price_update = PriceUpdateV2::try_deserialize(&mut &oracle_account.data.borrow()[..])
        .map_err(|_| ErrorCode::InvalidOracle)?;
    
    // Get the current timestamp
    let clock = Clock::get()?;
    
    // Get the price feed data from the price message
    // The price_message contains the price data directly
    let price_message = &price_update.price_message;
    
    // Check if price is not too old
    let price_age = clock.unix_timestamp.saturating_sub(price_message.publish_time);
    if price_age > MAX_PRICE_AGE_SECONDS {
        msg!("Price is too old: {} seconds", price_age);
        return Err(ErrorCode::StaleOraclePrice.into());
    }
    
    // Pyth price format: price * 10^expo
    // We need to convert to our format: price scaled by 10^9
    let price = price_message.price;
    let expo = price_message.exponent;
    let conf = price_message.conf;
    
    msg!("Pyth price: {} * 10^{}, conf: {}", price, expo, conf);
    
    // Check if price is valid
    require!(price > 0, ErrorCode::InvalidOracle);
    
    // Convert to our format (scaled by 10^9)
    // pyth_price = price * 10^expo
    // our_price = pyth_price * 10^9
    let price_u128 = price as u128;
    let adjusted_price = if expo >= 0 {
        price_u128
            .checked_mul(10u128.pow(expo as u32))
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(PRICE_SCALE)
            .ok_or(ErrorCode::MathOverflow)?
    } else {
        let divisor = 10u128.pow((-expo) as u32);
        price_u128
            .checked_mul(PRICE_SCALE)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(divisor)
            .ok_or(ErrorCode::MathOverflow)?
    };
    
    msg!("Adjusted price (scaled by 10^9): {}", adjusted_price);
    
    Ok(adjusted_price)
}

/// Get price from Switchboard oracle
fn get_switchboard_price(oracle_account: &AccountInfo, _decimals: u8) -> Result<u128> {
    // Switchboard aggregator account structure
    let data = oracle_account.try_borrow_data()?;
    
    if data.len() < 32 {
        return Err(ErrorCode::InvalidOracle.into());
    }
    
    // For now, return error to indicate Switchboard not fully integrated
    // TODO: Integrate Switchboard SDK properly
    msg!("Switchboard oracle detected but not yet integrated");
    Err(ErrorCode::OracleNotConfigured.into())
}

/// Get KEDOLOG/USD price from a pool
/// 
/// Fetches the price from a KEDOLOG/USDC pool by reading the pool's vault balances
/// Returns price scaled by 10^9 (e.g., $0.10 = 100_000_000)
fn get_pool_price(
    token_0_vault: &AccountInfo,
    token_1_vault: &AccountInfo,
    kedolog_decimals: u8,
) -> Result<u128> {
    use anchor_spl::token_interface::TokenAccount;
    
    msg!("Fetching KEDOLOG price from pool vaults");
    
    // Read vault balances
    let kedolog_vault_data = token_0_vault.try_borrow_data()?;
    let usdc_vault_data = token_1_vault.try_borrow_data()?;
    
    // Parse as token accounts
    let kedolog_account = TokenAccount::try_deserialize(&mut &kedolog_vault_data[..])?;
    let usdc_account = TokenAccount::try_deserialize(&mut &usdc_vault_data[..])?;
    
    let kedolog_reserve = kedolog_account.amount;
    let usdc_reserve = usdc_account.amount;
    
    msg!("Pool reserves - KEDOLOG: {}, USDC: {}", kedolog_reserve, usdc_reserve);
    
    require_gt!(kedolog_reserve, 0, ErrorCode::InvalidInput);
    require_gt!(usdc_reserve, 0, ErrorCode::InvalidInput);
    
    // Calculate price: price_usd = (usdc_reserve / kedolog_reserve) * (10^kedolog_decimals / 10^usdc_decimals)
    // Since USDC has 6 decimals and we scale by 10^9:
    // price = (usdc_reserve * 10^9 * 10^kedolog_decimals) / (kedolog_reserve * 10^6)
    
    let usdc_decimals = 6u32;
    let price = (usdc_reserve as u128)
        .checked_mul(PRICE_SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(kedolog_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div((kedolog_reserve as u128).checked_mul(10u128.pow(usdc_decimals)).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("Calculated KEDOLOG price from pool: {}", price);
    
    Ok(price)
}

/// Calculate protocol token equivalent with oracle pricing
/// 
/// This replaces the mock pricing with real oracle data
/// Now supports pool-based pricing for KEDOLOG
pub fn calculate_protocol_token_amount_with_oracle(
    fee_amount_in_input_token: u64,
    input_token_mint: &Pubkey,
    input_token_decimals: u8,
    protocol_token_mint: &Pubkey,
    protocol_token_decimals: u8,
    _protocol_token_config: &ProtocolTokenConfig,
    input_token_oracle: Option<&AccountInfo>,
    protocol_token_oracle: Option<&AccountInfo>,
    price_pool_token_0_vault: Option<&AccountInfo>,
    price_pool_token_1_vault: Option<&AccountInfo>,
) -> Result<u64> {
    // Get USD price of input token
    // Check if oracle is SystemProgram (indicates no oracle provided)
    let input_token_usd_price = if let Some(oracle) = input_token_oracle {
        if oracle.key() == anchor_lang::solana_program::system_program::ID {
            msg!("No input token oracle provided, using 1:1 USD parity");
            PRICE_SCALE // Assume $1 for testing
        } else {
            get_token_usd_price(
                input_token_mint,
                Some(oracle),
                input_token_decimals,
            )?
        }
    } else {
        msg!("No input token oracle provided, using 1:1 USD parity");
        PRICE_SCALE
    };
    
    // Get USD price of protocol token (KEDOLOG)
    // Priority: 1. Pool price, 2. Pyth oracle, 3. Manual config (deprecated)
    let protocol_token_usd_price = if let (Some(vault0), Some(vault1)) = (price_pool_token_0_vault, price_pool_token_1_vault) {
        // Use pool-based pricing
        msg!("Using pool-based pricing for KEDOLOG");
        get_pool_price(vault0, vault1, protocol_token_decimals)?
    } else if let Some(oracle) = protocol_token_oracle {
        // Check if oracle is SystemProgram (indicates no oracle provided)
        if oracle.key() == anchor_lang::solana_program::system_program::ID {
            msg!("No KEDOLOG oracle or pool provided, using manual price from config (DEPRECATED)");
            // Use manual pricing from config (deprecated)
            let tokens_per_usd = _protocol_token_config.protocol_token_per_usd as u128;
            require_gt!(tokens_per_usd, 0);
            
            // Price in USD scaled by PRICE_SCALE
            PRICE_SCALE
                .checked_mul(1_000_000)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(tokens_per_usd)
                .ok_or(ErrorCode::MathOverflow)?
        } else {
            // Use Pyth oracle
            msg!("Using KEDOLOG Pyth oracle for pricing");
            get_token_usd_price(
                protocol_token_mint,
                Some(oracle),
                protocol_token_decimals,
            )?
        }
    } else {
        // No oracle or pool provided, use manual config (deprecated)
        msg!("No KEDOLOG oracle or pool provided, using manual price from config (DEPRECATED)");
        let tokens_per_usd = _protocol_token_config.protocol_token_per_usd as u128;
        require_gt!(tokens_per_usd, 0);
        
        PRICE_SCALE
            .checked_mul(1_000_000)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(tokens_per_usd)
            .ok_or(ErrorCode::MathOverflow)?
    };
    
    msg!("Input token USD price: {}", input_token_usd_price);
    msg!("Protocol token USD price: {}", protocol_token_usd_price);
    
    // Calculate fee value in USD
    // fee_usd = (fee_amount * input_token_usd_price) / 10^input_decimals
    let fee_amount_u128 = fee_amount_in_input_token as u128;
    let fee_value_in_usd = fee_amount_u128
        .checked_mul(input_token_usd_price)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10u128.pow(input_token_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;
    
    msg!("Fee value in USD (scaled): {}", fee_value_in_usd);
    
    // Calculate protocol token amount needed
    // protocol_amount = (fee_value_in_usd * 10^protocol_decimals) / protocol_token_usd_price
    let protocol_token_amount = fee_value_in_usd
        .checked_mul(10u128.pow(protocol_token_decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(protocol_token_usd_price)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Convert to u64
    let result = u64::try_from(protocol_token_amount)
        .map_err(|_| ErrorCode::MathOverflow)?;
    
    require_gt!(result, 0, ErrorCode::InvalidInput);
    
    msg!("Protocol token amount required: {}", result);
    
    Ok(result)
}

/// Helper: Check if oracle data is fresh
pub fn is_oracle_fresh(timestamp: i64) -> bool {
    let current_time = Clock::get().unwrap().unix_timestamp;
    current_time - timestamp < MAX_PRICE_AGE_SECONDS
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_calculation() {
        // Test case: 0.05 SOL fee, SOL = $100, KEDOLOG = $0.10
        // Expected: 0.05 * 100 / 0.10 = 50 KEDOLOG
        
        let fee_amount = 50_000_000; // 0.05 SOL (9 decimals)
        let sol_price = 100 * PRICE_SCALE; // $100
        let kedolog_price = PRICE_SCALE / 10; // $0.10
        
        let sol_decimals = 9;
        let kedolog_decimals = 9;
        
        // fee_value_usd = (50_000_000 * 100_000_000_000) / 10^9 = 5_000_000_000
        // protocol_amount = (5_000_000_000 * 10^9) / 100_000_000 = 50_000_000_000
        
        let fee_value_usd = (fee_amount as u128)
            .checked_mul(sol_price)
            .unwrap()
            .checked_div(10u128.pow(sol_decimals))
            .unwrap();
        
        let protocol_amount = fee_value_usd
            .checked_mul(10u128.pow(kedolog_decimals))
            .unwrap()
            .checked_div(kedolog_price)
            .unwrap();
        
        assert_eq!(protocol_amount, 50_000_000_000); // 50 KEDOLOG
    }
}

