use anchor_lang::prelude::*;

pub const PROTOCOL_TOKEN_CONFIG_SEED: &str = "protocol_token_config";

/// Configuration for protocol token fee payment feature
#[account]
#[derive(Default, Debug)]
pub struct ProtocolTokenConfig {
    /// Bump to identify PDA
    pub bump: u8,
    /// Protocol token mint address (e.g., KEDOLOG token)
    pub protocol_token_mint: Pubkey,
    /// Discount rate when paying fees with protocol token (e.g., 2000 = 20% discount, 2500 = 25% discount)
    pub discount_rate: u64,
    /// Authority that can update this config
    pub authority: Pubkey,
    /// Protocol token treasury to receive fee payments
    pub treasury: Pubkey,
    /// Price oracle account (optional - if zero address, uses simple pool-based pricing)
    pub price_oracle: Pubkey,
    /// Manual price ratio: protocol_token_per_usd (scaled by 10^6)
    /// Example: if 1 USD = 10 KEDOLOG, this would be 10_000_000
    pub protocol_token_per_usd: u64,
    /// padding
    pub padding: [u64; 5],
}

impl ProtocolTokenConfig {
    pub const LEN: usize = 8 + 1 + 32 + 8 + 32 + 32 + 32 + 8 + 8 * 5;
}

