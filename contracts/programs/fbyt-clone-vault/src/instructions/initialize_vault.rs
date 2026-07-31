use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum VaultStatusCode {
    Fundraising,
    Active,
    Dormant,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub manager: Pubkey,
    pub min_raise_amount: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub lockup_period: i64,
    pub total_shares_minted: u64,
    pub total_assets_deposited: u64,
    pub vault_bump: u8,
    pub vault_authority_bump: u8,
    pub status: VaultStatusCode,
    pub created_at: i64,
    pub last_trade_at: i64,
}

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub min_raise_amount: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub lockup_period: i64,
    pub share_token_mint: Pubkey,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub token_mint: Pubkey,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub shares_burned: u64,
    pub amount_out: u64,
    pub token_mint: Pubkey,
}

#[event]
pub struct TradeExecuted {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub price: i64,
    pub price_exponent: i32,
    pub feed_id: String,
}

#[derive(Accounts)]
pub struct InitializeVaultAccountConstraints<'info> {
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
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeVaultAccountConstraints>,
    min_raise_amount: u64,
    performance_fee_bps: u16,
    management_fee_bps: u16,
    lockup_period: i64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        (performance_fee_bps as u32) + (management_fee_bps as u32) <= 10000,
        crate::errors::VaultError::FeeTooHigh
    );

    vault.manager = ctx.accounts.manager.key();
    vault.min_raise_amount = min_raise_amount;
    vault.performance_fee_bps = performance_fee_bps;
    vault.management_fee_bps = management_fee_bps;
    vault.lockup_period = lockup_period;
    vault.total_shares_minted = 0;
    vault.total_assets_deposited = 0;
    vault.vault_bump = ctx.bumps.vault;
    vault.vault_authority_bump = ctx.bumps.vault_authority;
    vault.status = VaultStatusCode::Fundraising;
    vault.created_at = clock.unix_timestamp;
    vault.last_trade_at = clock.unix_timestamp;

    emit!(VaultInitialized {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        min_raise_amount,
        performance_fee_bps,
        management_fee_bps,
        lockup_period,
        share_token_mint: ctx.accounts.share_token_mint.key(),
    });

    Ok(())
}
