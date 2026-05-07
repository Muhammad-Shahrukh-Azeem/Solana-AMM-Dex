use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, CloseAccount, InitializeAccount, Mint, Token, TokenAccount, Transfer,
};

declare_id!("6M6TzGRSRqYxYmAihrXgF6MrmrCJno4RK9mEDdtkanCW");

const REWARD_PRECISION: u128 = 1_000_000_000_000;
const TOKEN_ACCOUNT_LEN: usize = 165;

#[program]
pub mod kedolik_stake_lock {
    use super::*;

    pub fn initialize_admin_config(ctx: Context<InitializeAdminConfig>) -> Result<()> {
        let admin_config = &mut ctx.accounts.admin_config;
        admin_config.authority = ctx.accounts.authority.key();
        admin_config.bump = ctx.bumps.admin_config;
        Ok(())
    }

    pub fn transfer_admin_authority(
        ctx: Context<TransferAdminAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(
            new_authority,
            Pubkey::default(),
            ErrorCode::InvalidAuthority
        );
        ctx.accounts.admin_config.authority = new_authority;
        Ok(())
    }

    pub fn initialize_staking_pool(
        ctx: Context<InitializeStakingPool>,
        pool_id: u64,
        reward_rate_per_second: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let now = Clock::get()?.unix_timestamp;

        pool.pool_id = pool_id;
        pool.admin_config = ctx.accounts.admin_config.key();
        pool.stake_mint = ctx.accounts.stake_mint.key();
        pool.reward_mint = ctx.accounts.reward_mint.key();
        pool.stake_vault = ctx.accounts.stake_vault.key();
        pool.reward_vault = ctx.accounts.reward_vault.key();
        pool.total_staked = 0;
        pool.reward_rate_per_second = reward_rate_per_second;
        pool.last_update_ts = now;
        pool.reward_per_token_stored = 0;
        pool.bump = ctx.bumps.pool;
        pool.stake_vault_bump = ctx.bumps.stake_vault;
        pool.reward_vault_bump = ctx.bumps.reward_vault;

        initialize_token_account(
            &ctx.accounts.stake_vault,
            &ctx.accounts.stake_mint,
            &ctx.accounts.pool.to_account_info(),
            &ctx.accounts.rent,
            &ctx.accounts.token_program,
        )?;
        initialize_token_account(
            &ctx.accounts.reward_vault,
            &ctx.accounts.reward_mint,
            &ctx.accounts.pool.to_account_info(),
            &ctx.accounts.rent,
            &ctx.accounts.token_program,
        )?;

        Ok(())
    }

    pub fn set_reward_rate(ctx: Context<SetRewardRate>, reward_rate_per_second: u64) -> Result<()> {
        sync_pool(&mut ctx.accounts.pool)?;
        ctx.accounts.pool.reward_rate_per_second = reward_rate_per_second;
        Ok(())
    }

    pub fn fund_rewards(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        transfer_tokens(
            &ctx.accounts.funder_reward_token,
            &ctx.accounts.reward_vault,
            &ctx.accounts.funder,
            &ctx.accounts.token_program,
            amount,
        )
    }

    pub fn open_position(ctx: Context<OpenPosition>) -> Result<()> {
        sync_pool(&mut ctx.accounts.pool)?;

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.pool = ctx.accounts.pool.key();
        position.amount = 0;
        position.rewards_owed = 0;
        position.reward_per_token_paid = ctx.accounts.pool.reward_per_token_stored;
        position.bump = ctx.bumps.position;

        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        sync_pool(&mut ctx.accounts.pool)?;
        sync_position(&ctx.accounts.pool, &mut ctx.accounts.position)?;

        ctx.accounts.position.amount = checked_add(ctx.accounts.position.amount, amount)?;
        ctx.accounts.pool.total_staked = checked_add(ctx.accounts.pool.total_staked, amount)?;

        transfer_tokens(
            &ctx.accounts.owner_stake_token,
            &ctx.accounts.stake_vault,
            &ctx.accounts.owner,
            &ctx.accounts.token_program,
            amount,
        )
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        sync_pool(&mut ctx.accounts.pool)?;
        sync_position(&ctx.accounts.pool, &mut ctx.accounts.position)?;

        require!(
            ctx.accounts.position.amount >= amount,
            ErrorCode::InsufficientStakedBalance
        );

        ctx.accounts.position.amount = checked_sub(ctx.accounts.position.amount, amount)?;
        ctx.accounts.pool.total_staked = checked_sub(ctx.accounts.pool.total_staked, amount)?;

        transfer_from_pool(
            &ctx.accounts.pool,
            &ctx.accounts.stake_vault,
            &ctx.accounts.owner_stake_token,
            &ctx.accounts.token_program,
            amount,
        )
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        sync_pool(&mut ctx.accounts.pool)?;
        sync_position(&ctx.accounts.pool, &mut ctx.accounts.position)?;

        let amount = ctx.accounts.position.rewards_owed;
        require!(amount > 0, ErrorCode::NoRewards);
        require!(
            ctx.accounts.reward_vault.amount >= amount,
            ErrorCode::InsufficientRewardVault
        );

        ctx.accounts.position.rewards_owed = 0;

        transfer_from_pool(
            &ctx.accounts.pool,
            &ctx.accounts.reward_vault,
            &ctx.accounts.owner_reward_token,
            &ctx.accounts.token_program,
            amount,
        )
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        require!(
            ctx.accounts.position.amount == 0,
            ErrorCode::PositionNotEmpty
        );
        require!(
            ctx.accounts.position.rewards_owed == 0,
            ErrorCode::PositionNotEmpty
        );
        Ok(())
    }

    pub fn create_lock(
        ctx: Context<CreateLock>,
        lock_id: u64,
        amount: u64,
        unlock_ts: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            unlock_ts > Clock::get()?.unix_timestamp,
            ErrorCode::InvalidUnlockTime
        );

        let token_lock = &mut ctx.accounts.token_lock;
        token_lock.owner = ctx.accounts.owner.key();
        token_lock.mint = ctx.accounts.mint.key();
        token_lock.vault = ctx.accounts.lock_vault.key();
        token_lock.lock_id = lock_id;
        token_lock.amount = amount;
        token_lock.unlock_ts = unlock_ts;
        token_lock.bump = ctx.bumps.token_lock;
        token_lock.vault_bump = ctx.bumps.lock_vault;

        initialize_token_account(
            &ctx.accounts.lock_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_lock.to_account_info(),
            &ctx.accounts.rent,
            &ctx.accounts.token_program,
        )?;

        transfer_tokens(
            &ctx.accounts.owner_token,
            &ctx.accounts.lock_vault,
            &ctx.accounts.owner,
            &ctx.accounts.token_program,
            amount,
        )
    }

    pub fn unlock(ctx: Context<Unlock>) -> Result<()> {
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.token_lock.unlock_ts,
            ErrorCode::LockNotExpired
        );

        let amount = ctx.accounts.vault.amount;
        require!(
            amount >= ctx.accounts.token_lock.amount,
            ErrorCode::InvalidLockVault
        );

        transfer_from_lock(
            &ctx.accounts.token_lock,
            &ctx.accounts.vault,
            &ctx.accounts.owner_token,
            &ctx.accounts.token_program,
            amount,
        )?;

        close_lock_vault(
            &ctx.accounts.token_lock,
            &ctx.accounts.vault,
            &ctx.accounts.owner,
            &ctx.accounts.token_program,
        )
    }
}

#[derive(Accounts)]
pub struct InitializeAdminConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + AdminConfig::LEN,
        seeds = [b"admin_config"],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAdminAuthority<'info> {
    #[account(
        mut,
        has_one = authority @ ErrorCode::Unauthorized,
        seeds = [b"admin_config"],
        bump = admin_config.bump
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct InitializeStakingPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ ErrorCode::Unauthorized,
        seeds = [b"admin_config"],
        bump = admin_config.bump
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub stake_mint: Account<'info, Mint>,
    pub reward_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::LEN,
        seeds = [
            b"staking_pool",
            admin_config.key().as_ref(),
            stake_mint.key().as_ref(),
            reward_mint.key().as_ref(),
            &pool_id.to_le_bytes(),
        ],
        bump
    )]
    pub pool: Account<'info, StakingPool>,
    #[account(
        init,
        payer = authority,
        space = TOKEN_ACCOUNT_LEN,
        owner = token::ID,
        seeds = [b"stake_vault", pool.key().as_ref()],
        bump
    )]
    /// CHECK: Created in this instruction as an SPL Token account owned by the Token program.
    pub stake_vault: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = TOKEN_ACCOUNT_LEN,
        owner = token::ID,
        seeds = [b"reward_vault", pool.key().as_ref()],
        bump
    )]
    /// CHECK: Created in this instruction as an SPL Token account owned by the Token program.
    pub reward_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetRewardRate<'info> {
    #[account(
        has_one = authority @ ErrorCode::Unauthorized,
        seeds = [b"admin_config"],
        bump = admin_config.bump
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut, has_one = admin_config)]
    pub pool: Account<'info, StakingPool>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FundRewards<'info> {
    pub funder: Signer<'info>,
    pub pool: Account<'info, StakingPool>,
    #[account(
        mut,
        constraint = funder_reward_token.mint == pool.reward_mint @ ErrorCode::InvalidMint,
        constraint = funder_reward_token.owner == funder.key() @ ErrorCode::Unauthorized
    )]
    pub funder_reward_token: Account<'info, TokenAccount>,
    #[account(mut, address = pool.reward_vault)]
    pub reward_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, StakingPool>,
    #[account(
        init,
        payer = owner,
        space = 8 + StakePosition::LEN,
        seeds = [b"position", pool.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, StakePosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, StakingPool>,
    #[account(mut, has_one = owner, has_one = pool)]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        constraint = owner_stake_token.mint == pool.stake_mint @ ErrorCode::InvalidMint,
        constraint = owner_stake_token.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub owner_stake_token: Account<'info, TokenAccount>,
    #[account(mut, address = pool.stake_vault)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, StakingPool>,
    #[account(mut, has_one = owner, has_one = pool)]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        constraint = owner_stake_token.mint == pool.stake_mint @ ErrorCode::InvalidMint,
        constraint = owner_stake_token.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub owner_stake_token: Account<'info, TokenAccount>,
    #[account(mut, address = pool.stake_vault)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, StakingPool>,
    #[account(mut, has_one = owner, has_one = pool)]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        constraint = owner_reward_token.mint == pool.reward_mint @ ErrorCode::InvalidMint,
        constraint = owner_reward_token.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub owner_reward_token: Account<'info, TokenAccount>,
    #[account(mut, address = pool.reward_vault)]
    pub reward_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub pool: Account<'info, StakingPool>,
    #[account(mut, close = owner, has_one = owner, has_one = pool)]
    pub position: Account<'info, StakePosition>,
}

#[derive(Accounts)]
#[instruction(lock_id: u64)]
pub struct CreateLock<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = owner,
        space = 8 + TokenLock::LEN,
        seeds = [
            b"lock",
            owner.key().as_ref(),
            mint.key().as_ref(),
            &lock_id.to_le_bytes(),
        ],
        bump
    )]
    pub token_lock: Account<'info, TokenLock>,
    #[account(
        init,
        payer = owner,
        space = TOKEN_ACCOUNT_LEN,
        owner = token::ID,
        seeds = [b"lock_vault", token_lock.key().as_ref()],
        bump
    )]
    /// CHECK: Created in this instruction as an SPL Token account owned by the Token program.
    pub lock_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = owner_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = owner_token.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unlock<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = owner,
        has_one = owner,
        has_one = mint,
        has_one = vault
    )]
    pub token_lock: Account<'info, TokenLock>,
    #[account(mut, address = token_lock.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token.mint == token_lock.mint @ ErrorCode::InvalidMint,
        constraint = owner_token.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct AdminConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

impl AdminConfig {
    pub const LEN: usize = 32 + 1;
}

#[account]
pub struct StakingPool {
    pub pool_id: u64,
    pub admin_config: Pubkey,
    pub stake_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub stake_vault: Pubkey,
    pub reward_vault: Pubkey,
    pub total_staked: u64,
    pub reward_rate_per_second: u64,
    pub last_update_ts: i64,
    pub reward_per_token_stored: u128,
    pub bump: u8,
    pub stake_vault_bump: u8,
    pub reward_vault_bump: u8,
}

impl StakingPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 16 + 1 + 1 + 1;
}

#[account]
pub struct StakePosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub rewards_owed: u64,
    pub reward_per_token_paid: u128,
    pub bump: u8,
}

impl StakePosition {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 16 + 1;
}

#[account]
pub struct TokenLock {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub lock_id: u64,
    pub amount: u64,
    pub unlock_ts: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl TokenLock {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

fn sync_pool(pool: &mut Account<StakingPool>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    if now <= pool.last_update_ts {
        return Ok(());
    }

    if pool.total_staked > 0 && pool.reward_rate_per_second > 0 {
        let elapsed = now
            .checked_sub(pool.last_update_ts)
            .ok_or(ErrorCode::MathOverflow)? as u128;
        let reward = elapsed
            .checked_mul(pool.reward_rate_per_second as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        let increment = reward
            .checked_mul(REWARD_PRECISION)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(pool.total_staked as u128)
            .ok_or(ErrorCode::MathOverflow)?;

        pool.reward_per_token_stored = pool
            .reward_per_token_stored
            .checked_add(increment)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    pool.last_update_ts = now;
    Ok(())
}

fn sync_position(pool: &StakingPool, position: &mut Account<StakePosition>) -> Result<()> {
    if position.amount > 0 {
        let delta = pool
            .reward_per_token_stored
            .checked_sub(position.reward_per_token_paid)
            .ok_or(ErrorCode::MathOverflow)?;
        let earned = (position.amount as u128)
            .checked_mul(delta)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(REWARD_PRECISION)
            .ok_or(ErrorCode::MathOverflow)?;
        let earned = u64::try_from(earned).map_err(|_| ErrorCode::MathOverflow)?;
        position.rewards_owed = checked_add(position.rewards_owed, earned)?;
    }

    position.reward_per_token_paid = pool.reward_per_token_stored;
    Ok(())
}

fn checked_add(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b).ok_or(ErrorCode::MathOverflow.into())
}

fn checked_sub(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b).ok_or(ErrorCode::MathOverflow.into())
}

fn transfer_tokens<'info>(
    from: &Account<'info, TokenAccount>,
    to: &impl ToAccountInfo<'info>,
    authority: &Signer<'info>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
    )
}

fn initialize_token_account<'info>(
    account: &UncheckedAccount<'info>,
    mint: &Account<'info, Mint>,
    authority: &AccountInfo<'info>,
    rent: &Sysvar<'info, Rent>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    token::initialize_account(CpiContext::new(
        token_program.to_account_info(),
        InitializeAccount {
            account: account.to_account_info(),
            mint: mint.to_account_info(),
            authority: authority.to_account_info(),
            rent: rent.to_account_info(),
        },
    ))
}

fn transfer_from_pool<'info>(
    pool: &Account<'info, StakingPool>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let pool_id = pool.pool_id.to_le_bytes();
    let seeds = &[
        b"staking_pool".as_ref(),
        pool.admin_config.as_ref(),
        pool.stake_mint.as_ref(),
        pool.reward_mint.as_ref(),
        pool_id.as_ref(),
        &[pool.bump],
    ];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer,
        ),
        amount,
    )
}

fn transfer_from_lock<'info>(
    token_lock: &Account<'info, TokenLock>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let lock_id = token_lock.lock_id.to_le_bytes();
    let seeds = &[
        b"lock".as_ref(),
        token_lock.owner.as_ref(),
        token_lock.mint.as_ref(),
        lock_id.as_ref(),
        &[token_lock.bump],
    ];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: token_lock.to_account_info(),
            },
            signer,
        ),
        amount,
    )
}

fn close_lock_vault<'info>(
    token_lock: &Account<'info, TokenLock>,
    vault: &Account<'info, TokenAccount>,
    destination: &Signer<'info>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let lock_id = token_lock.lock_id.to_le_bytes();
    let seeds = &[
        b"lock".as_ref(),
        token_lock.owner.as_ref(),
        token_lock.mint.as_ref(),
        lock_id.as_ref(),
        &[token_lock.bump],
    ];
    let signer = &[&seeds[..]];

    token::close_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        CloseAccount {
            account: vault.to_account_info(),
            destination: destination.to_account_info(),
            authority: token_lock.to_account_info(),
        },
        signer,
    ))
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("The provided mint does not match this account.")]
    InvalidMint,
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("Not enough tokens are staked.")]
    InsufficientStakedBalance,
    #[msg("There are no rewards to claim.")]
    NoRewards,
    #[msg("The reward vault does not contain enough tokens.")]
    InsufficientRewardVault,
    #[msg("Unlock time must be in the future.")]
    InvalidUnlockTime,
    #[msg("The lock has not expired yet.")]
    LockNotExpired,
    #[msg("The lock vault balance is invalid.")]
    InvalidLockVault,
    #[msg("The stake position still has staked tokens or unclaimed rewards.")]
    PositionNotEmpty,
    #[msg("The new authority address is invalid.")]
    InvalidAuthority,
}
