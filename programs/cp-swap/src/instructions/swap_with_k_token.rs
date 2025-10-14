use crate::curve::calculator::CurveCalculator;
use crate::error::ErrorCode;
use crate::states::*;
use crate::utils::token::*;
use crate::utils::PythOracle;
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

/// Swap with K token fee payment for 20% discount
#[derive(Accounts)]
pub struct SwapWithKToken<'info> {
    /// The user performing the swap
    pub payer: Signer<'info>,

    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            crate::AUTH_SEED.as_bytes(),
        ],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    /// The factory state to read protocol fees
    #[account(address = pool_state.load()?.amm_config)]
    pub amm_config: Box<Account<'info, AmmConfig>>,

    /// The program account of the pool in which the swap will be performed
    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>,

    /// The user token account for input token
    #[account(mut)]
    pub input_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The user token account for output token
    #[account(mut)]
    pub output_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The vault token account for input token
    #[account(
        mut,
        constraint = input_vault.key() == pool_state.load()?.token_0_vault || input_vault.key() == pool_state.load()?.token_1_vault
    )]
    pub input_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The vault token account for output token
    #[account(
        mut,
        constraint = output_vault.key() == pool_state.load()?.token_0_vault || output_vault.key() == pool_state.load()?.token_1_vault
    )]
    pub output_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// SPL program for input token transfers
    pub input_token_program: Interface<'info, TokenInterface>,

    /// SPL program for output token transfers
    pub output_token_program: Interface<'info, TokenInterface>,

    /// The mint of input token
    #[account(
        address = input_vault.mint
    )]
    pub input_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The mint of output token
    #[account(
        address = output_vault.mint
    )]
    pub output_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The program account for the most recent oracle observation
    #[account(mut, address = pool_state.load()?.observation_key)]
    pub observation_state: AccountLoader<'info, ObservationState>,

    /// The user token account for K token payment
    #[account(mut)]
    pub k_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint for K token
    #[account(address = k_token_account.mint)]
    pub k_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The pool's K token vault (receives discounted fee payment)
    #[account(
        mut,
        address = pool_state.load()?.fee_token_vault
    )]
    pub k_token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pyth price feed for input token
    /// CHECK: Validated by Pyth SDK
    pub input_token_price_feed: AccountInfo<'info>,

    /// Pyth price feed for K token
    /// CHECK: Validated by Pyth SDK
    pub k_token_price_feed: AccountInfo<'info>,

    /// SPL program for K token transfers
    pub k_token_program: Interface<'info, TokenInterface>,
}

pub fn swap_with_k_token(
    ctx: Context<SwapWithKToken>,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Result<()> {
    let block_timestamp = solana_program::clock::Clock::get()?.unix_timestamp as u64;
    let pool_id = ctx.accounts.pool_state.key();
    let pool_state = &mut ctx.accounts.pool_state.load_mut()?;
    
    // Verify pool is open for swaps
    if !pool_state.get_status_by_bit(PoolStatusBitIndex::Swap)
        || block_timestamp < pool_state.open_time
    {
        return err!(ErrorCode::NotApproved);
    }
    
    // Verify fee discount is enabled
    require!(
        ctx.accounts.amm_config.fee_token_mint != Pubkey::default(),
        ErrorCode::FeeDiscountNotEnabled
    );
    
    require!(
        ctx.accounts.k_token_mint.key() == ctx.accounts.amm_config.fee_token_mint,
        ErrorCode::InvalidFeeToken
    );

    let transfer_fee =
        get_transfer_fee(&ctx.accounts.input_token_mint.to_account_info(), amount_in)?;
    // Take transfer fees into account for actual amount transferred in
    let actual_amount_in = amount_in.saturating_sub(transfer_fee);
    require_gt!(actual_amount_in, 0);

    let SwapParams {
        trade_direction,
        total_input_token_amount,
        total_output_token_amount,
        token_0_price_x64,
        token_1_price_x64,
        is_creator_fee_on_input,
    } = pool_state.get_swap_params(
        ctx.accounts.input_vault.key(),
        ctx.accounts.output_vault.key(),
        ctx.accounts.input_vault.amount,
        ctx.accounts.output_vault.amount,
    )?;

    let creator_fee_rate =
        pool_state.adjust_creator_fee_rate(ctx.accounts.amm_config.creator_fee_rate);
    let result = CurveCalculator::swap_base_input(
        u128::from(actual_amount_in),
        u128::from(total_input_token_amount),
        u128::from(total_output_token_amount),
        ctx.accounts.amm_config.trade_fee_rate,
        creator_fee_rate,
        ctx.accounts.amm_config.protocol_fee_rate,
        ctx.accounts.amm_config.fund_fee_rate,
        is_creator_fee_on_input,
    )
    .ok_or(ErrorCode::ZeroTradingTokens)?;

    // Calculate 20% discount on trade fee
    let discount_rate = ctx.accounts.amm_config.fee_token_discount_rate;
    let discounted_fee = (result.trade_fee as u128)
        .checked_mul(discount_rate as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    
    // Get prices from Pyth oracles
    let (input_price, input_expo, _) = PythOracle::get_price(&ctx.accounts.input_token_price_feed)?;
    let (k_price, k_expo, _) = PythOracle::get_price(&ctx.accounts.k_token_price_feed)?;
    
    // Convert discounted fee amount to K token amount
    let k_token_fee_amount = PythOracle::convert_token_amount(
        discounted_fee as u64,
        input_price,
        input_expo,
        k_price,
        k_expo,
        ctx.accounts.input_token_mint.decimals,
        ctx.accounts.k_token_mint.decimals,
    )?;
    
    // Verify user has enough K tokens
    require!(
        ctx.accounts.k_token_account.amount >= k_token_fee_amount,
        ErrorCode::InsufficientFeeTokenBalance
    );

    let (input_transfer_amount, input_transfer_fee) = (amount_in, transfer_fee);
    let (output_transfer_amount, output_transfer_fee) = {
        let amount_out = u64::try_from(result.output_amount).unwrap();
        let transfer_fee = get_transfer_fee(
            &ctx.accounts.output_token_mint.to_account_info(),
            amount_out,
        )?;
        let amount_received = amount_out.checked_sub(transfer_fee).unwrap();
        require_gt!(amount_received, 0);
        require_gte!(
            amount_received,
            minimum_amount_out,
            ErrorCode::ExceededSlippage
        );
        (amount_out, transfer_fee)
    };

    // Transfer input tokens from user to vault
    transfer_from_user_to_pool_vault(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.input_token_account.to_account_info(),
        ctx.accounts.input_vault.to_account_info(),
        ctx.accounts.input_token_mint.to_account_info(),
        ctx.accounts.input_token_program.to_account_info(),
        input_transfer_amount,
        ctx.accounts.input_token_mint.decimals,
    )?;

    // Transfer K tokens from user to pool's fee vault
    transfer_from_user_to_pool_vault(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.k_token_account.to_account_info(),
        ctx.accounts.k_token_vault.to_account_info(),
        ctx.accounts.k_token_mint.to_account_info(),
        ctx.accounts.k_token_program.to_account_info(),
        k_token_fee_amount,
        ctx.accounts.k_token_mint.decimals,
    )?;

    // Transfer output tokens from vault to user
    transfer_from_pool_vault_to_user(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.output_vault.to_account_info(),
        ctx.accounts.output_token_account.to_account_info(),
        ctx.accounts.output_token_mint.to_account_info(),
        ctx.accounts.output_token_program.to_account_info(),
        output_transfer_amount,
        ctx.accounts.output_token_mint.decimals,
        &[&[crate::AUTH_SEED.as_bytes(), &[ctx.bumps.authority]]],
    )?;

    // Update pool state with fees
    pool_state.update_fees(
        u64::try_from(result.protocol_fee).unwrap(),
        u64::try_from(result.fund_fee).unwrap(),
        u64::try_from(result.creator_fee).unwrap(),
        trade_direction,
    )?;

    // Track K token fees collected
    pool_state.collected_fee_token_amount = pool_state
        .collected_fee_token_amount
        .checked_add(k_token_fee_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Update observation
    let mut observation_state = ctx.accounts.observation_state.load_mut()?;
    observation_state.update(block_timestamp, token_0_price_x64, token_1_price_x64);

    // Emit swap event
    emit!(SwapEvent {
        pool_id,
        input_vault_before: total_input_token_amount,
        output_vault_before: total_output_token_amount,
        input_amount: u64::try_from(result.input_amount).unwrap(),
        output_amount: u64::try_from(result.output_amount).unwrap(),
        input_transfer_fee,
        output_transfer_fee,
        base_input: true,
        input_mint: ctx.accounts.input_token_mint.key(),
        output_mint: ctx.accounts.output_token_mint.key(),
        trade_fee: u64::try_from(result.trade_fee).unwrap(),
        creator_fee: u64::try_from(result.creator_fee).unwrap(),
        creator_fee_on_input: is_creator_fee_on_input,
    });

    msg!("K token fee payment: {} tokens", k_token_fee_amount);

    Ok(())
}
