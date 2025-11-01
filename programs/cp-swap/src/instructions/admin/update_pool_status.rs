use crate::states::*;
use crate::error::ErrorCode;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdatePoolStatus<'info> {
    /// Must be the protocol owner from the AMM config
    pub authority: Signer<'info>,

    /// The AMM config that owns this pool
    #[account(address = pool_state.load()?.amm_config)]
    pub amm_config: Account<'info, AmmConfig>,

    #[account(
        mut,
        constraint = authority.key() == amm_config.protocol_owner @ ErrorCode::InvalidOwner
    )]
    pub pool_state: AccountLoader<'info, PoolState>,
}

pub fn update_pool_status(ctx: Context<UpdatePoolStatus>, status: u8) -> Result<()> {
    require_gte!(255, status);
    let mut pool_state = ctx.accounts.pool_state.load_mut()?;
    pool_state.set_status(status);
    pool_state.recent_epoch = Clock::get()?.epoch;
    Ok(())
}
