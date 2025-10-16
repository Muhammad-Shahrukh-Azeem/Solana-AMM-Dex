use crate::error::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;
use std::ops::DerefMut;

#[derive(Accounts)]
pub struct UpdateProtocolTokenConfig<'info> {
    /// Authority that can update the config
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Protocol token config to update
    #[account(
        mut,
        seeds = [
            PROTOCOL_TOKEN_CONFIG_SEED.as_bytes(),
        ],
        bump = protocol_token_config.bump,
        constraint = protocol_token_config.authority == authority.key() @ ErrorCode::InvalidOwner
    )]
    pub protocol_token_config: Account<'info, ProtocolTokenConfig>,
}

pub fn update_protocol_token_config(
    ctx: Context<UpdateProtocolTokenConfig>,
    discount_rate: Option<u64>,
    treasury: Option<Pubkey>,
    protocol_token_per_usd: Option<u64>,
    new_authority: Option<Pubkey>,
) -> Result<()> {
    let protocol_config = ctx.accounts.protocol_token_config.deref_mut();
    
    if let Some(rate) = discount_rate {
        require_gt!(rate, 0, ErrorCode::InvalidInput);
        require_gt!(10000, rate, ErrorCode::InvalidInput); // Max 100% discount
        protocol_config.discount_rate = rate;
    }
    
    if let Some(new_treasury) = treasury {
        protocol_config.treasury = new_treasury;
    }
    
    if let Some(price) = protocol_token_per_usd {
        require_gt!(price, 0, ErrorCode::InvalidInput);
        protocol_config.protocol_token_per_usd = price;
    }
    
    if let Some(new_auth) = new_authority {
        protocol_config.authority = new_auth;
    }
    
    Ok(())
}

