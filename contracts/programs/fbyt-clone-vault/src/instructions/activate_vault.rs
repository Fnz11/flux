use anchor_lang::prelude::*;
use crate::constants::*;
use crate::events::VaultActivated;
use crate::state::{VaultState, VaultStatusCode};

#[derive(Accounts)]
pub struct ActivateVault<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref(), vault.share_token_mint.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status == VaultStatusCode::Fundraising @ crate::errors::VaultError::VaultLocked,
        constraint = vault.manager == manager.key() @ crate::errors::VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<ActivateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(
        vault.total_assets_deposited >= vault.min_raise_amount,
        crate::errors::VaultError::MinRaiseNotMet
    );
    vault.status = VaultStatusCode::Active;
    let clock = Clock::get()?;

    emit!(VaultActivated {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
