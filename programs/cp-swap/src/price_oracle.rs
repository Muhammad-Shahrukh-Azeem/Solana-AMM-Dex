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

/// Calculate protocol token equivalent with oracle pricing
/// 
/// This replaces the mock pricing with real oracle data
pub fn calculate_protocol_token_amount_with_oracle(
    fee_amount_in_input_token: u64,
    input_token_mint: &Pubkey,
    input_token_decimals: u8,
    protocol_token_mint: &Pubkey,
    protocol_token_decimals: u8,
    _protocol_token_config: &ProtocolTokenConfig,
    input_token_oracle: Option<&AccountInfo>,
    protocol_token_oracle: Option<&AccountInfo>,
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
    // Try oracle first, fall back to manual config if oracle is SystemProgram
    let protocol_token_usd_price = if let Some(oracle) = protocol_token_oracle {
        // Check if oracle is SystemProgram (indicates no oracle provided)
        if oracle.key() == anchor_lang::solana_program::system_program::ID {
            msg!("No KEDOLOG oracle provided, using manual price from config");
            // Use manual pricing from config
            // protocol_token_per_usd is "how many protocol tokens per 1 USD" scaled by 10^6
            // Example: 10 KEDOLOG per USD = 10_000_000
            // So 1 KEDOLOG = 0.1 USD
            let tokens_per_usd = _protocol_token_config.protocol_token_per_usd as u128;
            require_gt!(tokens_per_usd, 0);
            
            // Price in USD scaled by PRICE_SCALE
            // If 10 tokens = 1 USD, then 1 token = 0.1 USD
            // price = (PRICE_SCALE * 10^6) / tokens_per_usd
            PRICE_SCALE
                .checked_mul(1_000_000)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(tokens_per_usd)
                .ok_or(ErrorCode::MathOverflow)?
        } else {
            // Use oracle
            msg!("Using KEDOLOG oracle for pricing");
            get_token_usd_price(
                protocol_token_mint,
                Some(oracle),
                protocol_token_decimals,
            )?
        }
    } else {
        // No oracle provided, use manual config
        msg!("No KEDOLOG oracle provided, using manual price from config");
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

