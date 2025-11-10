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
    /// KEDOLOG/USDC pool - primary price reference for KEDOLOG
    pub kedolog_usdc_pool: Pubkey,
    /// SOL/USDC pool - price reference for SOL
    pub sol_usdc_pool: Pubkey,
    /// KEDOLOG/SOL pool - alternative price path for KEDOLOG
    pub kedolog_sol_pool: Pubkey,
    /// USDC mint address (for validation)
    pub usdc_mint: Pubkey,
    /// padding
    pub padding: [u64; 3],
}

impl ProtocolTokenConfig {
    pub const LEN: usize = 8 + 1 + 32 + 8 + 32 + 32 + 32 + 32 + 32 + 32 + 8 * 3;
}

