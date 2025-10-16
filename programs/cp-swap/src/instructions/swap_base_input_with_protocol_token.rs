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
    
    // Calculate the original swap result
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

    // Calculate the protocol fee amount
    let original_protocol_fee = u64::try_from(result.protocol_fee).unwrap();
    
    // Apply discount when paying with protocol token
    let discounted_protocol_fee = original_protocol_fee
        .checked_mul(10000 - ctx.accounts.protocol_token_config.discount_rate)
        .unwrap()
        .checked_div(10000)
        .unwrap();

    // Calculate equivalent protocol token amount using price ratio from config
    // This converts the discounted fee amount to protocol tokens
    let protocol_token_amount = calculate_protocol_token_equivalent(
        discounted_protocol_fee,
        &ctx.accounts.input_token_mint,
        &ctx.accounts.protocol_token_mint,
        &ctx.accounts.protocol_token_config,
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
/// amount in protocol tokens based on a USD price ratio.
/// 
/// Example: If fee is 10 USDC and 1 USD = 10 KEDOLOG tokens:
/// - protocol_token_amount = 10 * 10 = 100 KEDOLOG tokens
///
/// For non-USD stablecoins, you'll need to implement price oracle integration
fn calculate_protocol_token_equivalent(
    fee_amount: u64,
    input_token_mint: &InterfaceAccount<Mint>,
    protocol_token_mint: &InterfaceAccount<Mint>,
    protocol_token_config: &ProtocolTokenConfig,
) -> Result<u64> {
    // Get the manual price ratio from config
    // protocol_token_per_usd is scaled by 10^6
    // Example: if 1 USD = 10 KEDOLOG, protocol_token_per_usd = 10_000_000
    
    let protocol_tokens_per_usd = protocol_token_config.protocol_token_per_usd;
    require_gt!(protocol_tokens_per_usd, 0);
    
    // Adjust for token decimals
    // fee_amount is in input token's decimals
    // We need to convert to protocol token's decimals
    
    let input_decimals = input_token_mint.decimals;
    let protocol_decimals = protocol_token_mint.decimals;
    
    // Calculate protocol token amount
    // Formula: fee_amount * (protocol_tokens_per_usd / 10^6) * (10^protocol_decimals / 10^input_decimals)
    
    // First, convert fee to base units
    let fee_in_base_units = fee_amount as u128;
    
    // Apply the price ratio (scaled by 10^6)
    let protocol_amount_scaled = fee_in_base_units
        .checked_mul(protocol_tokens_per_usd as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(1_000_000) // Remove the 10^6 scaling
        .ok_or(ErrorCode::MathOverflow)?;
    
    // Adjust for decimal differences
    let protocol_token_amount = if protocol_decimals >= input_decimals {
        // Protocol token has more or equal decimals - multiply
        let decimal_diff = protocol_decimals - input_decimals;
        protocol_amount_scaled
            .checked_mul(10u128.pow(decimal_diff as u32))
            .ok_or(ErrorCode::MathOverflow)?
    } else {
        // Protocol token has fewer decimals - divide
        let decimal_diff = input_decimals - protocol_decimals;
        protocol_amount_scaled
            .checked_div(10u128.pow(decimal_diff as u32))
            .ok_or(ErrorCode::MathOverflow)?
    };
    
    // Convert back to u64
    let result = u64::try_from(protocol_token_amount)
        .map_err(|_| ErrorCode::MathOverflow)?;
    
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
