use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    transfer_checked, TransferChecked,
    mint_to, MintTo,
};
use crate::constants::*;
use crate::events::Deposited;
use crate::state::{VaultState, VaultStatusCode};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status != VaultStatusCode::Dormant @ crate::errors::VaultError::VaultLocked,
        constraint = !vault.is_paused @ crate::errors::VaultError::VaultLocked,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA authority for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub investor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key(),
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The mint of the token being deposited (USDC, wSOL, etc.)
    #[account(
        constraint = deposit_mint.key() == investor_token_account.mint,
        constraint = deposit_mint.key() == vault_token_account.mint,
        constraint = deposit_mint.key() == vault.deposit_mint @ crate::errors::VaultError::InvalidMint,
    )]
    pub deposit_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        mint::authority = vault_authority,
    )]
    pub share_token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = share_token_mint,
        associated_token::authority = investor,
    )]
    pub investor_share_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, crate::errors::VaultError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;

    let shares_to_mint = if vault.total_shares_minted == 0 {
        amount
    } else {
        (amount as u128)
            .checked_mul(vault.total_shares_minted as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)?
            .checked_div(vault.total_assets_deposited as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)? as u64
    };

    let decimals = ctx.accounts.deposit_mint.decimals;

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.investor_token_account.to_account_info(),
        mint: ctx.accounts.deposit_mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.investor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), transfer_accounts);
    transfer_checked(cpi_ctx, amount, decimals)?;

    let mint_accounts = MintTo {
        mint: ctx.accounts.share_token_mint.to_account_info(),
        to: ctx.accounts.investor_share_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let vault_key = vault.key();
    let seeds = crate::utils::get_vault_authority_seeds(&vault_key, &vault.vault_authority_bump);
    let signer_seeds = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        mint_accounts,
        signer_seeds,
    );
    mint_to(cpi_ctx, shares_to_mint)?;

    vault.total_assets_deposited = vault
        .total_assets_deposited
        .checked_add(amount)
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    vault.total_shares_minted = vault
        .total_shares_minted
        .checked_add(shares_to_mint)
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

    emit!(Deposited {
        vault: vault.key(),
        investor: ctx.accounts.investor.key(),
        amount,
        shares_minted: shares_to_mint,
        token_mint: ctx.accounts.deposit_mint.key(),
        nav_per_share,
        total_assets_after: vault.total_assets_deposited,
        total_shares_after: vault.total_shares_minted,
    });

    Ok(())
}
