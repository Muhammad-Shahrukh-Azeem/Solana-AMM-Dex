use crate::error::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;
use std::ops::DerefMut;

#[derive(Accounts)]
pub struct CreateProtocolTokenConfig<'info> {
    /// Payer for the account creation
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Initialize protocol token config state account
    #[account(
        init,
        seeds = [
            PROTOCOL_TOKEN_CONFIG_SEED.as_bytes(),
        ],
        bump,
        payer = payer,
        space = ProtocolTokenConfig::LEN
    )]
    pub protocol_token_config: Account<'info, ProtocolTokenConfig>,

    pub system_program: Program<'info, System>,
}

pub fn create_protocol_token_config(
    ctx: Context<CreateProtocolTokenConfig>,
    protocol_token_mint: Pubkey,
    discount_rate: u64,
    authority: Pubkey,
    treasury: Pubkey,
    protocol_token_per_usd: u64,
) -> Result<()> {
    // Validate parameters
    require_gt!(discount_rate, 0, ErrorCode::InvalidInput);
    require_gt!(10000, discount_rate, ErrorCode::InvalidInput); // Max 100% discount
    require_gt!(protocol_token_per_usd, 0, ErrorCode::InvalidInput);
    
    let protocol_config = ctx.accounts.protocol_token_config.deref_mut();
    protocol_config.bump = ctx.bumps.protocol_token_config;
    protocol_config.protocol_token_mint = protocol_token_mint;
    protocol_config.discount_rate = discount_rate;
    protocol_config.authority = authority;
    protocol_config.treasury = treasury;
    protocol_config.price_oracle = Pubkey::default(); // No oracle by default
    protocol_config.protocol_token_per_usd = protocol_token_per_usd;
    
    Ok(())
}

