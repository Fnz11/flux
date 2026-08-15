use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct SetPendingManager<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref(), vault.share_token_mint.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.manager == manager.key() @ crate::errors::VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<SetPendingManager>, pending_manager: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.pending_manager = Some(pending_manager);
    Ok(())
}
