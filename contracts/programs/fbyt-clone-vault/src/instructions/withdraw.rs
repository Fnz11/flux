use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    transfer_checked, TransferChecked,
    burn, Burn,
};
use crate::constants::*;
use crate::events::Withdrawn;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref()],
        bump = vault.vault_bump,
        constraint = !vault.is_paused @ crate::errors::VaultError::VaultLocked,
    )]
    pub vault: Box<Account<'info, VaultState>>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA authority for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub investor_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint of the token being withdrawn
    #[account(
        constraint = withdraw_mint.key() == investor_token_account.mint,
        constraint = withdraw_mint.key() == vault.deposit_mint @ crate::errors::VaultError::InvalidMint,
    )]
    pub withdraw_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key(),
        constraint = vault_token_account.mint == withdraw_mint.key(),
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        mint::authority = vault_authority,
        constraint = share_token_mint.key() == vault.share_token_mint @ crate::errors::VaultError::ShareMintMismatch,
    )]
    pub share_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = investor_share_account.owner == investor.key(),
        constraint = investor_share_account.mint == share_token_mint.key(),
    )]
    pub investor_share_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, crate::errors::VaultError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    if vault.lockup_period > 0 {
        let unlock_time = vault
            .created_at
            .checked_add(vault.lockup_period)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
        require!(
            clock.unix_timestamp >= unlock_time,
            crate::errors::VaultError::LockupActive
        );
    }

    let amount_out = (shares_to_burn as u128)
        .checked_mul(vault.total_assets_deposited as u128)
        .ok_or(crate::errors::VaultError::MathOverflow)?
        .checked_div(vault.total_shares_minted as u128)
        .ok_or(crate::errors::VaultError::MathOverflow)? as u64;

    require!(
        amount_out <= vault.total_assets_deposited,
        crate::errors::VaultError::InsufficientVaultBalance
    );
    require!(
        ctx.accounts.vault_token_account.amount >= amount_out,
        crate::errors::VaultError::InsufficientVaultBalance
    );

    let vault_key = vault.key();
    let seeds = crate::utils::get_vault_authority_seeds(&vault_key, &vault.vault_authority_bump);
    let signer_seeds = &[&seeds[..]];

    let burn_accounts = Burn {
        mint: ctx.accounts.share_token_mint.to_account_info(),
        from: ctx.accounts.investor_share_account.to_account_info(),
        authority: ctx.accounts.investor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), burn_accounts);
    burn(cpi_ctx, shares_to_burn)?;

    let decimals = ctx.accounts.withdraw_mint.decimals;

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.withdraw_mint.to_account_info(),
        to: ctx.accounts.investor_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        transfer_accounts,
        signer_seeds,
    );
    transfer_checked(cpi_ctx, amount_out, decimals)?;

    vault.total_shares_minted = vault
        .total_shares_minted
        .checked_sub(shares_to_burn)
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    vault.total_assets_deposited = vault
        .total_assets_deposited
        .checked_sub(amount_out)
        .ok_or(crate::errors::VaultError::MathOverflow)?;

    let nav_per_share = if vault.total_shares_minted == 0 {
        0
    } else {
        ((vault.total_assets_deposited as u128)
            .checked_mul(1_000_000_000)
            .ok_or(crate::errors::VaultError::MathOverflow)?
            .checked_div(vault.total_shares_minted as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)?) as u64
    };

    emit!(Withdrawn {
        vault: vault.key(),
        investor: ctx.accounts.investor.key(),
        shares_burned: shares_to_burn,
        amount_out,
        token_mint: ctx.accounts.withdraw_mint.key(),
        nav_per_share,
        total_assets_after: vault.total_assets_deposited,
        total_shares_after: vault.total_shares_minted,
    });

    Ok(())
}
