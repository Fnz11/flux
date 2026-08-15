use anchor_lang::prelude::*;
use crate::constants::VAULT_SEED;
use crate::errors::VaultError;
use crate::events::ManagerChanged;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct AcceptManager<'info> {
    #[account(mut)]
    pub pending_manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref(), vault.share_token_mint.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.pending_manager == Some(pending_manager.key()) @ VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<AcceptManager>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let old_manager = vault.manager;
    let new_manager = ctx.accounts.pending_manager.key();
    let clock = Clock::get()?;

    vault.manager = new_manager;
    vault.pending_manager = None;

    emit!(ManagerChanged {
        vault: vault.key(),
        old_manager,
        new_manager,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
