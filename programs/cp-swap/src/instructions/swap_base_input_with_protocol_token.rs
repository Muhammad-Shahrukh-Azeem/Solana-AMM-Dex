use crate::curve::calculator::CurveCalculator;
use crate::error::ErrorCode;
use crate::states::*;
use crate::utils::token::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct SwapWithProtocolToken<'info> {
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

    /// The protocol token configuration
    #[account(
        seeds = [
            crate::states::PROTOCOL_TOKEN_CONFIG_SEED.as_bytes(),
        ],
        bump,
    )]
    pub protocol_token_config: Box<Account<'info, ProtocolTokenConfig>>,

    /// The program account of the pool in which the swap will be performed
    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>,

    /// The user token account for input token
    #[account(mut)]
    pub input_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The user token account for output token
    #[account(mut)]
    pub output_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The user's protocol token account (for paying fees)
    #[account(mut)]
    pub protocol_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The treasury account to receive protocol token fees
    #[account(
        mut,
        constraint = protocol_token_treasury.owner == protocol_token_config.treasury @ ErrorCode::InvalidOwner,
        constraint = protocol_token_treasury.mint == protocol_token_config.protocol_token_mint @ ErrorCode::InvalidInput
    )]
    pub protocol_token_treasury: Box<InterfaceAccount<'info, TokenAccount>>,

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

    /// SPL program for protocol token transfers
    pub protocol_token_program: Interface<'info, TokenInterface>,

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

    /// The mint of protocol token
    #[account(
        address = protocol_token_config.protocol_token_mint
    )]
    pub protocol_token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// The program account for the most recent oracle observation
    #[account(mut, address = pool_state.load()?.observation_key)]
    pub observation_state: AccountLoader<'info, ObservationState>,
    
    /// REQUIRED: Price oracle for input token (e.g., Pyth SOL/USD feed)
    /// This ensures accurate pricing for the swap token
    /// CHECK: Oracle account validated in price_oracle module
    pub input_token_oracle: AccountInfo<'info>,
    
    /// OPTIONAL: Price oracle for protocol token (e.g., Pyth KEDOLOG/USD feed)
    /// If not provided (SystemProgram), uses manual price from protocol_token_config
    /// This allows launching before KEDOLOG is listed on Pyth
    /// CHECK: Oracle account validated in price_oracle module  
    pub protocol_token_oracle: AccountInfo<'info>,
}

pub fn swap_base_input_with_protocol_token(
    ctx: Context<SwapWithProtocolToken>, 
    amount_in: u64, 
    minimum_amount_out: u64
) -> Result<()> {
    let block_timestamp = solana_program::clock::Clock::get()?.unix_timestamp as u64;
    let pool_id = ctx.accounts.pool_state.key();
    let pool_state = &mut ctx.accounts.pool_state.load_mut()?;
    
    if !pool_state.get_status_by_bit(PoolStatusBitIndex::Swap)
        || block_timestamp < pool_state.open_time
    {
        return err!(ErrorCode::NotApproved);
    }

    // Validate protocol token configuration
    require_gt!(ctx.accounts.protocol_token_config.discount_rate, 0);
    require_gt!(10000, ctx.accounts.protocol_token_config.discount_rate); // Max 100% discount

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
    
    // Calculate reduced trade fee rate when paying with protocol token
    // Only the FULL protocol fee portion is removed from swap
    // LPs still get their FULL share (0.20%)
    let trade_fee_rate = ctx.accounts.amm_config.trade_fee_rate;
    let protocol_fee_rate = ctx.accounts.amm_config.protocol_fee_rate;
    
    // Calculate what portion of trade fee is protocol fee
    // Example: trade_fee = 2500 (0.25%), protocol_fee_rate = 200000 (20% of trade fee)
    // protocol_portion = 2500 * 200000 / 1000000 = 500 (0.05%)
    let protocol_fee_portion = (trade_fee_rate as u128)
        .checked_mul(protocol_fee_rate as u128)
        .unwrap()
        .checked_div(1_000_000)
        .unwrap() as u64;
    
    // Calculate reduced trade fee (remove FULL protocol portion)
    // Example: 2500 - 500 = 2000 (0.20%)
    // LPs get their full 0.20%, protocol fee paid separately in KEDOLOG
    let reduced_trade_fee_rate = trade_fee_rate
        .checked_sub(protocol_fee_portion)
        .unwrap();
    
    // Calculate the swap result with REDUCED fee (only LP portion)
    // User pays 0.20% in swap, gets 99.80 SOL worth
    // Then pays 0.04% separately in KEDOLOG
    let result = CurveCalculator::swap_base_input(
        u128::from(actual_amount_in),
        u128::from(total_input_token_amount),
        u128::from(total_output_token_amount),
        reduced_trade_fee_rate,  // Only LP fee (0.20%)
        creator_fee_rate,
        0,  // Protocol fee is 0 in swap calculation (paid separately in KEDOLOG)
        ctx.accounts.amm_config.fund_fee_rate,
        is_creator_fee_on_input,
    )
    .ok_or(ErrorCode::ZeroTradingTokens)?;

    // Calculate the discounted protocol fee that will be paid in KEDOLOG
    // Apply 20% discount to the 0.05% protocol fee = 0.04%
    let original_protocol_fee_amount = (u128::from(actual_amount_in))
        .checked_mul(protocol_fee_portion as u128)
        .unwrap()
        .checked_div(1_000_000)
        .unwrap();
    
    let discounted_protocol_fee = (original_protocol_fee_amount
        .checked_mul((10000 - ctx.accounts.protocol_token_config.discount_rate) as u128)
        .unwrap()
        .checked_div(10000)
        .unwrap()) as u64;

    // Ensure discounted fee is greater than 0
    require_gt!(discounted_protocol_fee, 0, ErrorCode::InvalidInput);
    
    // Calculate equivalent protocol token amount using price ratio from config
    // This converts the discounted fee amount to protocol tokens
    // Now supports oracle pricing if oracle accounts are provided!
    let protocol_token_amount = calculate_protocol_token_equivalent(
        discounted_protocol_fee,
        &ctx.accounts.input_token_mint,
        &ctx.accounts.protocol_token_mint,
        &ctx.accounts.protocol_token_config,
        &ctx.accounts.input_token_oracle,
        &ctx.accounts.protocol_token_oracle,
    )?;

    // Verify user has enough protocol tokens
    require_gte!(
        ctx.accounts.protocol_token_account.amount,
        protocol_token_amount,
        ErrorCode::InsufficientVault
    );

    let constant_before = u128::from(total_input_token_amount)
        .checked_mul(u128::from(total_output_token_amount))
        .unwrap();

    let constant_after = u128::from(result.new_input_vault_amount)
        .checked_mul(u128::from(result.new_output_vault_amount))
        .unwrap();

    #[cfg(feature = "enable-log")]
    msg!(
        "Protocol token swap - input_amount:{}, output_amount:{}, original_protocol_fee:{}, discounted_protocol_fee:{}, protocol_token_amount:{}, discount_rate:{}",
        result.input_amount,
        result.output_amount,
        original_protocol_fee,
        discounted_protocol_fee,
        protocol_token_amount,
        ctx.accounts.protocol_token_config.discount_rate
    );

    require_eq!(
        u64::try_from(result.input_amount).unwrap(),
        actual_amount_in
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

    // Update fees with discounted protocol fee
    pool_state.update_fees(
        discounted_protocol_fee, // Use discounted protocol fee
        u64::try_from(result.fund_fee).unwrap(),
        u64::try_from(result.creator_fee).unwrap(),
        trade_direction,
    )?;

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

    require_gte!(constant_after, constant_before);

    // Transfer input tokens from user to pool vault
    transfer_from_user_to_pool_vault(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.input_token_account.to_account_info(),
        ctx.accounts.input_vault.to_account_info(),
        ctx.accounts.input_token_mint.to_account_info(),
        ctx.accounts.input_token_program.to_account_info(),
        input_transfer_amount,
        ctx.accounts.input_token_mint.decimals,
    )?;

    // Transfer output tokens from pool vault to user
    transfer_from_pool_vault_to_user(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.output_vault.to_account_info(),
        ctx.accounts.output_token_account.to_account_info(),
        ctx.accounts.output_token_mint.to_account_info(),
        ctx.accounts.output_token_program.to_account_info(),
        output_transfer_amount,
        ctx.accounts.output_token_mint.decimals,
        &[&[crate::AUTH_SEED.as_bytes(), &[pool_state.auth_bump]]],
    )?;

    // Transfer protocol tokens from user to treasury
    transfer_from_user_to_treasury(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.protocol_token_account.to_account_info(),
        ctx.accounts.protocol_token_treasury.to_account_info(),
        ctx.accounts.protocol_token_program.to_account_info(),
        protocol_token_amount,
    )?;

    // Update the previous price to the observation
    ctx.accounts.observation_state.load_mut()?.update(
        oracle::block_timestamp(),
        token_0_price_x64,
        token_1_price_x64,
    );
    pool_state.recent_epoch = Clock::get()?.epoch;

    Ok(())
}

/// Calculate the equivalent amount of protocol tokens needed to pay the fee
/// 
/// This function converts the fee amount (in the swap token) to the equivalent
/// amount in protocol tokens based on real-time oracle prices or manual config.
/// 
/// Example: If fee is 0.05 SOL, SOL = $100, KEDOLOG = $0.10:
/// - Fee value = 0.05 * $100 = $5
/// - Protocol tokens needed = $5 / $0.10 = 50 KEDOLOG
fn calculate_protocol_token_equivalent<'info>(
    fee_amount: u64,
    input_token_mint: &InterfaceAccount<Mint>,
    protocol_token_mint: &InterfaceAccount<Mint>,
    protocol_token_config: &ProtocolTokenConfig,
    input_token_oracle: &AccountInfo<'info>,
    protocol_token_oracle: &AccountInfo<'info>,
) -> Result<u64> {
    // Use the price oracle module for accurate pricing
    // 
    // HYBRID ORACLE APPROACH:
    // 1. input_token_oracle: REQUIRED - Gets real-time price from Pyth (SOL, BTC, etc.)
    // 2. protocol_token_oracle: OPTIONAL - If SystemProgram, uses manual price from config
    // 
    // This allows you to:
    // - Launch immediately with manual KEDOLOG pricing
    // - Get accurate pricing for input tokens via Pyth
    // - Add KEDOLOG oracle later when listed on Pyth/Switchboard
    
    let result = crate::price_oracle::calculate_protocol_token_amount_with_oracle(
        fee_amount,
        &input_token_mint.key(),
        input_token_mint.decimals,
        &protocol_token_mint.key(),
        protocol_token_mint.decimals,
        protocol_token_config,
        Some(input_token_oracle),
        Some(protocol_token_oracle),
    )?;
    
    Ok(result)
}

/// Transfer protocol tokens from user to treasury
fn transfer_from_user_to_treasury<'info>(
    payer: AccountInfo<'info>,
    user_token_account: AccountInfo<'info>,
    treasury_account: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    require_gt!(amount, 0);
    
    // Use anchor's token transfer CPI
    let cpi_accounts = anchor_spl::token_interface::Transfer {
        from: user_token_account,
        to: treasury_account,
        authority: payer,
    };
    
    let cpi_program = token_program;
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    // Transfer protocol tokens from user to treasury
    anchor_spl::token_interface::transfer(cpi_ctx, amount)?;
    
    Ok(())
}
