use anchor_lang::prelude::*;

pub const AMM_CONFIG_SEED: &str = "amm_config";

/// Holds the current owner of the factory
#[account]
#[derive(Default, Debug)]
pub struct AmmConfig {
    /// Bump to identify PDA
    pub bump: u8,
    /// Status to control if new pool can be create
    pub disable_create_pool: bool,
    /// Config index
    pub index: u16,
    /// The trade fee, denominated in hundredths of a bip (10^-6)
    pub trade_fee_rate: u64,
    /// The protocol fee
    pub protocol_fee_rate: u64,
    /// The fund fee, denominated in hundredths of a bip (10^-6)
    pub fund_fee_rate: u64,
    /// Fee for create a new pool
    pub create_pool_fee: u64,
    /// Address of the protocol fee owner
    pub protocol_owner: Pubkey,
    /// Address of the fund fee owner
    pub fund_owner: Pubkey,
    /// The pool creator fee, denominated in hundredths of a bip (10^-6)
    pub creator_fee_rate: u64,
    /// The mint address of the fee token (for discount payments)
    pub fee_token_mint: Pubkey,
    /// The discount rate when paying with fee token, denominated in basis points (10000 = 100%)
    /// Example: 2000 = 20% discount
    pub fee_token_discount_rate: u64,
    /// padding
    pub padding: [u64; 10],
}

impl AmmConfig {
    pub const LEN: usize = 8 + 1 + 1 + 2 + 4 * 8 + 32 * 2 + 8 + 32 + 8 + 8 * 10;
}
