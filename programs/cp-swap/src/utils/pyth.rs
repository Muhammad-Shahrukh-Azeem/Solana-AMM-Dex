use anchor_lang::prelude::*;
use crate::error::ErrorCode;

/// Helper functions for working with Pyth oracle price feeds
pub struct PythOracle;

impl PythOracle {
    /// Get the current price from a Pyth price feed account
    /// Returns the price scaled by the confidence interval
    /// Price format: price * 10^-expo (convert to base units)
    pub fn get_price(price_feed: &AccountInfo) -> Result<(i64, i32, u64)> {
        // Load the price feed data from the account
        let price_feed_data = price_feed.try_borrow_data()
            .map_err(|_| error!(ErrorCode::InvalidPriceFeed))?;
        
        // Parse the Pyth price feed
        let price_account: &pyth_sdk_solana::state::SolanaPriceAccount = 
            pyth_sdk_solana::state::load_price_account(&price_feed_data)
                .map_err(|_| error!(ErrorCode::InvalidPriceFeed))?;
        
        // Get current price
        let current_timestamp = Clock::get()?.unix_timestamp;
        let price_data = price_account.to_price_feed(&price_feed.key())
            .get_price_no_older_than(current_timestamp, 60)
            .ok_or(error!(ErrorCode::InvalidPriceData))?;
        
        // Returns: (price, exponent, confidence)
        Ok((price_data.price, price_data.expo, price_data.conf))
    }

    /// Calculate the equivalent amount of token B needed for token A value
    /// 
    /// # Arguments
    /// * `amount_a` - Amount in token A (with decimals)
    /// * `price_a` - Price of token A from Pyth (price * 10^expo_a)
    /// * `expo_a` - Price exponent for token A
    /// * `price_b` - Price of token B from Pyth (price * 10^expo_b)
    /// * `expo_b` - Price exponent for token B
    /// * `decimals_a` - Token A decimals
    /// * `decimals_b` - Token B decimals
    /// 
    /// # Returns
    /// Equivalent amount in token B
    /// 
    /// # Formula
    /// value_a = amount_a * price_a * 10^expo_a / 10^decimals_a
    /// amount_b = value_a / (price_b * 10^expo_b) * 10^decimals_b
    ///          = (amount_a * price_a * 10^expo_a * 10^decimals_b) / (price_b * 10^expo_b * 10^decimals_a)
    pub fn convert_token_amount(
        amount_a: u64,
        price_a: i64,
        expo_a: i32,
        price_b: i64,
        expo_b: i32,
        decimals_a: u8,
        decimals_b: u8,
    ) -> Result<u64> {
        require!(price_a > 0, ErrorCode::InvalidPriceData);
        require!(price_b > 0, ErrorCode::InvalidPriceData);

        // Convert to u128 for safe calculation
        let amount_a_u128 = amount_a as u128;
        let price_a_u128 = price_a as u128;
        let price_b_u128 = price_b as u128;

        // Calculate: amount_a * price_a
        let numerator = amount_a_u128
            .checked_mul(price_a_u128)
            .ok_or(ErrorCode::MathOverflow)?;

        // Adjust for exponents: numerator * 10^(expo_a - expo_b)
        let expo_diff = expo_a - expo_b;
        let numerator_adjusted = if expo_diff >= 0 {
            numerator
                .checked_mul(10u128.pow(expo_diff.abs() as u32))
                .ok_or(ErrorCode::MathOverflow)?
        } else {
            numerator
                .checked_div(10u128.pow(expo_diff.abs() as u32))
                .ok_or(ErrorCode::MathOverflow)?
        };

        // Adjust for decimals: numerator * 10^decimals_b / 10^decimals_a
        let decimal_diff = decimals_b as i32 - decimals_a as i32;
        let numerator_final = if decimal_diff >= 0 {
            numerator_adjusted
                .checked_mul(10u128.pow(decimal_diff.abs() as u32))
                .ok_or(ErrorCode::MathOverflow)?
        } else {
            numerator_adjusted
                .checked_div(10u128.pow(decimal_diff.abs() as u32))
                .ok_or(ErrorCode::MathOverflow)?
        };

        // Divide by price_b
        let result = numerator_final
            .checked_div(price_b_u128)
            .ok_or(ErrorCode::MathOverflow)?;

        // Convert back to u64
        u64::try_from(result).map_err(|_| error!(ErrorCode::MathOverflow))
    }
}

