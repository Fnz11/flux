use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    transfer_checked, TransferChecked,
};
use crate::constants::*;
use crate::events::FeesCollected;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.manager == manager.key() @ crate::errors::VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA authority for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key(),
        constraint = vault_token_account.mint == token_mint.key(),
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = manager_token_account.mint == token_mint.key(),
    )]
    pub manager_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = token_mint.key() == vault.deposit_mint @ crate::errors::VaultError::InvalidMint,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<CollectFees>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    let total_fees = vault
        .accrued_performance_fee
        .checked_add(vault.accrued_management_fee)
        .ok_or(crate::errors::VaultError::MathOverflow)?;

    require!(total_fees > 0, crate::errors::VaultError::InvalidAmount);
    require!(
        ctx.accounts.vault_token_account.amount >= total_fees,
        crate::errors::VaultError::InsufficientVaultBalance
    );

    let decimals = ctx.accounts.token_mint.decimals;
    let vault_key = vault.key();
    let seeds = crate::utils::get_vault_authority_seeds(&vault_key, &vault.vault_authority_bump);
    let signer_seeds = &[&seeds[..]];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.manager_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        transfer_accounts,
        signer_seeds,
    );
    transfer_checked(cpi_ctx, total_fees, decimals)?;

    let performance_fee = vault.accrued_performance_fee;
    let management_fee = vault.accrued_management_fee;

    vault.accrued_performance_fee = 0;
    vault.accrued_management_fee = 0;

    let clock = Clock::get()?;

    emit!(FeesCollected {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        performance_fee,
        management_fee,
        total_collected: total_fees,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
