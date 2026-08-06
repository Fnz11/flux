use anchor_lang::prelude::*;
use crate::constants::VAULT_SEED;
use crate::errors::VaultError;
use crate::events::VaultPaused;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct PauseVault<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.manager == manager.key() @ VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<PauseVault>, paused: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.is_paused = paused;

    emit!(VaultPaused {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        is_paused: paused,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
