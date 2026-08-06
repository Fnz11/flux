use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use crate::constants::*;
use crate::events::VaultInitialized;
use crate::state::{VaultState, VaultStatusCode};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        init,
        payer = manager,
        space = VaultState::DISCRIMINATOR.len() + VaultState::INIT_SPACE,
        seeds = [VAULT_SEED, manager.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultState>,

    /// The mint of the accepted deposit token (e.g. USDC)
    pub deposit_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = manager,
        mint::decimals = SHARE_TOKEN_DECIMALS,
        mint::authority = vault_authority,
    )]
    pub share_token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump
    )]
    /// CHECK: PDA authority, never written to directly
    pub vault_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    min_raise_amount: u64,
    performance_fee_bps: u16,
    management_fee_bps: u16,
    lockup_period: i64,
    allowed_output_mints: [Pubkey; 4],
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        (performance_fee_bps as u32) + (management_fee_bps as u32) <= 10000,
        crate::errors::VaultError::FeeTooHigh
    );

    vault.manager = ctx.accounts.manager.key();
    vault.pending_manager = None;
    vault.deposit_mint = ctx.accounts.deposit_mint.key();
    vault.allowed_output_mints = allowed_output_mints;
    vault.min_raise_amount = min_raise_amount;
    vault.performance_fee_bps = performance_fee_bps;
    vault.management_fee_bps = management_fee_bps;
    vault.accrued_performance_fee = 0;
    vault.accrued_management_fee = 0;
    vault.lockup_period = lockup_period;
    vault.total_shares_minted = 0;
    vault.total_assets_deposited = 0;
    vault.vault_bump = ctx.bumps.vault;
    vault.vault_authority_bump = ctx.bumps.vault_authority;
    vault.status = VaultStatusCode::Fundraising;
    vault.is_paused = false;
    vault.created_at = clock.unix_timestamp;
    vault.last_trade_at = clock.unix_timestamp;

    emit!(VaultInitialized {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        deposit_mint: ctx.accounts.deposit_mint.key(),
        min_raise_amount,
        performance_fee_bps,
        management_fee_bps,
        lockup_period,
        share_token_mint: ctx.accounts.share_token_mint.key(),
    });

    Ok(())
}
