use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::VaultError;
use crate::events::VaultDeactivated;
use crate::state::{VaultState, VaultStatusCode};

#[derive(Accounts)]
pub struct DeactivateVault<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status == VaultStatusCode::Active @ VaultError::VaultLocked,
        constraint = vault.manager == manager.key() @ VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<DeactivateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.status = VaultStatusCode::Dormant;
    let clock = Clock::get()?;

    emit!(VaultDeactivated {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
