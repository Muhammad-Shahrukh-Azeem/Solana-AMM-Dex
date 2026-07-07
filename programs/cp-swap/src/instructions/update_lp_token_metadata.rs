use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        mpl_token_metadata::types::{Creator, DataV2},
        update_metadata_accounts_v2, Metadata, UpdateMetadataAccountsV2,
    },
    token_interface::Mint,
};

use crate::states::{AmmConfig, PoolState};

/// Protocol wallet allowed to maintain LP token metadata in addition to pool/config owners.
pub const LP_METADATA_ADMIN: Pubkey = pubkey!("68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot");

/// Update existing LP token metadata using the pool authority PDA as Metaplex update authority.
pub fn update_lp_token_metadata(
    ctx: Context<UpdateLpTokenMetadata>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    let pool_state = ctx.accounts.pool_state.load()?;
    let authority = ctx.accounts.authority.key();
    let pool_creator = pool_state.pool_creator;
    let protocol_owner = ctx.accounts.amm_config.protocol_owner;

    require!(
        authority == pool_creator || authority == protocol_owner || authority == LP_METADATA_ADMIN,
        crate::error::ErrorCode::InvalidAuthority
    );

    let seeds = &[crate::AUTH_SEED.as_bytes(), &[ctx.bumps.authority_pda]];
    let signer_seeds = &[&seeds[..]];

    update_metadata_accounts_v2(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            UpdateMetadataAccountsV2 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                update_authority: ctx.accounts.authority_pda.to_account_info(),
            },
            signer_seeds,
        ),
        None,
        Some(DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator {
                address: pool_creator,
                verified: false,
                share: 100,
            }]),
            collection: None,
            uses: None,
        }),
        None,
        Some(true),
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct UpdateLpTokenMetadata<'info> {
    /// Pool creator, AMM config protocol owner, or LP metadata admin.
    pub authority: Signer<'info>,

    /// Pool state for the LP mint.
    #[account(
        constraint = pool_state.load()?.lp_mint == lp_mint.key() @ crate::error::ErrorCode::IncorrectLpMint,
        constraint = pool_state.load()?.amm_config == amm_config.key() @ crate::error::ErrorCode::InvalidOwner,
    )]
    pub pool_state: AccountLoader<'info, PoolState>,

    /// AMM config linked by the pool state.
    pub amm_config: Box<Account<'info, AmmConfig>>,

    /// LP token mint.
    #[account(
        address = pool_state.load()?.lp_mint @ crate::error::ErrorCode::IncorrectLpMint
    )]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Existing Metaplex metadata account for the LP mint.
    /// CHECK: PDA is verified against the token metadata program and LP mint.
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

    /// CHECK: pool vault and LP mint authority PDA; also Metaplex update authority.
    #[account(
        seeds = [
            crate::AUTH_SEED.as_bytes(),
        ],
        bump,
    )]
    pub authority_pda: UncheckedAccount<'info>,

    /// Metaplex token metadata program.
    pub token_metadata_program: Program<'info, Metadata>,
}
