use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3,
    CreateMetadataAccountsV3,
    mpl_token_metadata::types::{Creator, DataV2},
};

use crate::states::PoolState;

/// Set LP token metadata for better wallet display
///
/// # Arguments
///
/// * `ctx` - The context of accounts
/// * `name` - The name of the LP token
/// * `symbol` - The symbol of the LP token
/// * `uri` - The metadata URI for the LP token
///
pub fn set_lp_token_metadata(
    ctx: Context<SetLpTokenMetadata>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    // Get the pool state to verify ownership
    let pool_state = ctx.accounts.pool_state.load()?;

    // Verify that the LP mint matches the pool's LP mint
    require!(
        ctx.accounts.lp_mint.key() == pool_state.lp_mint,
        crate::error::ErrorCode::IncorrectLpMint
    );

    // Verify the authority is the pool creator or admin
    require!(
        ctx.accounts.authority.key() == pool_state.pool_creator,
        crate::error::ErrorCode::InvalidAuthority
    );

    // Create the metadata
    let seeds = &[
        crate::AUTH_SEED.as_bytes(),
        &[ctx.bumps.authority_pda],
    ];
    let signer_seeds = &[&seeds[..]];

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.lp_mint.to_account_info(),
                mint_authority: ctx.accounts.authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        ),
        DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator {
                address: pool_state.pool_creator,
                verified: true,
                share: 100,
            }]),
            collection: None,
            uses: None,
        },
        true, // is_mutable
        true, // update_authority_is_signer
        None, // collection_details
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct SetLpTokenMetadata<'info> {
    /// The authority that can set metadata (pool creator)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The account paying for the metadata creation
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The pool state
    #[account(
        mut,
        constraint = pool_state.load()?.lp_mint == lp_mint.key()
    )]
    pub pool_state: AccountLoader<'info, PoolState>,

    /// The LP token mint
    #[account(
        mut,
        address = pool_state.load()?.lp_mint @ crate::error::ErrorCode::IncorrectLpMint
    )]
    pub lp_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    /// The metadata account to be created
    /// CHECK: This is the metadata account derived from the mint
    #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            lp_mint.key().as_ref(),
        ],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK: pool vault and lp mint authority PDA
    #[account(
        seeds = [
            crate::AUTH_SEED.as_bytes(),
        ],
        bump,
    )]
    pub authority_pda: UncheckedAccount<'info>,

    /// The token metadata program
    pub token_metadata_program: Program<'info, anchor_spl::metadata::Metadata>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}
