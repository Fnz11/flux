// FILE: withdraw-fresh.rs — metal-box story: "receipt in, cash out"

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    transfer_checked, TransferChecked,
    burn, Burn,
};
use crate::constants::*;
use crate::instructions::initialize_vault::{VaultState, VaultStatusCode, Withdrawn};

// --- ACCOUNTS STRUCT ---
#[derive(Accounts)]
pub struct WithdrawAccounts<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA that signs for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub investor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = withdraw_mint == investor_token_account.mint,     // <- withdraw_mint, to make sure that token that wanna withdrawl are exist on the vault
    )]
    pub withdraw_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key(),
        constraint = vault_token_account.mint == withdraw_mint.key(),
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub share_token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = investor_share_account.amount >= shares_to_burn,        // <- hint: token balance
        constraint = investor_share_account.owner == investor.key(), // <- fill me: who owns this jar? the investor, maybe mint?
    )]
    pub investor_share_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

// --- HANDLER ---
pub fn handler(ctx: Context<WithdrawAccounts>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, crate::errors::VaultError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;

    // 1. Lockup check — stop withdrawal if too early
    let clock = Clock::get()?;
    let unlock_time = vault.created_at
        .checked_add(vault.lockup_period)                   // <- fill me: safe add: checked_add()
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    if vault.lockup_period > 0 {
        require!(clock.unix_timestamp >= unlock_time, crate::errors::VaultError::LockupActive);
    }

    // 2. How much money does Alice get?
    let amount_out = (shares_to_burn as u128)
        .checked_mul(vault.total_assets_deposited as u128)
        .ok_or(crate::errors::VaultError::MathOverflow)?
        .checked_div(vault.total_shares_minted as u128)              // <- fill me: divide by WHAT? total_shares_assets
        .ok_or(crate::errors::VaultError::MathOverflow)? as u64;

    // 3. Burn Alice's shares (she signs)
    let burn_accounts = Burn {
        mint: ctx.accounts.share_token_mint.to_account_info(),
        from: ctx.accounts.investor_share_account.to_account_info(),
        authority: ctx.accounts.investor.to_account_info(),  // <- fill me: WHO signs to burn their own shares? investor
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), burn_accounts);
    burn(cpi_ctx, shares_to_burn)?;

    // 4. Transfer money out of vault to Alice (SEAL signs)
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.withdraw_mint.to_account_info(),
        to: ctx.accounts.investor_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),  // sealed by PDA
    };
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault.key().as_ref(),
        &[vault.vault_authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(                  // <- fill me: new or new_with_signer? new with signer
        ctx.accounts.token_program.key(),
        transfer_accounts,
        signer_seeds,
    );
    let decimals = ctx.accounts.withdraw_mint.decimals;
    transfer_checked(cpi_ctx, amount_out, decimals)?;

    // 5. Update notebook (subtract, not add)
    vault.total_shares_minted = vault.total_shares_minted
        .checked_min(shares_to_burn)                     // <- fill me: opposite of checked_add, checked_min
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    vault.total_assets_deposited = vault.total_assets_deposited
        .checked_sub(amount_out)
        .ok_or(crate::errors::VaultError::MathOverflow)?;

    // 6. Log it
    emit!(Withdrawn {                                     // <- fill me: which event?, Withdraw
        vault: vault.key(),
        investor: ctx.accounts.investor.key(),
        shares_burned: shares_to_burn,
        amount_out,
        token_mint: ctx.accounts.withdraw_mint.key(),
    });

    Ok(())
}