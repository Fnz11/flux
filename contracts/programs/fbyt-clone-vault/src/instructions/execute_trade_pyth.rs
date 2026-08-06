use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    burn, Burn,
    mint_to, MintTo,
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use crate::constants::*;
use crate::events::TradeExecuted;
use crate::state::{VaultState, VaultStatusCode};
use crate::pyth_price::{SOL_USD_FEED_ID, calculate_amount_out, read_pyth_price};

#[derive(Accounts)]
pub struct ExecuteTradePyth<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status == VaultStatusCode::Active @ crate::errors::VaultError::VaultLocked,
        constraint = vault.manager == manager.key() @ crate::errors::VaultError::Unauthorized,
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA authority for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_input_token_account.owner == vault_authority.key(),
        constraint = vault_input_token_account.mint == vault_input_mint.key(),
    )]
    pub vault_input_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = (vault_input_mint.key() == vault.deposit_mint || vault.allowed_output_mints.contains(&vault_input_mint.key())) @ crate::errors::VaultError::InvalidMint,
    )]
    pub vault_input_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault_output_token_account.owner == vault_authority.key(),
        constraint = vault_output_token_account.mint == vault_output_mint.key(),
    )]
    pub vault_output_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = (vault_output_mint.key() == vault.deposit_mint || vault.allowed_output_mints.contains(&vault_output_mint.key())) @ crate::errors::VaultError::InvalidMint,
    )]
    pub vault_output_mint: InterfaceAccount<'info, Mint>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ExecuteTradePyth>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    require!(amount_in > 0, crate::errors::VaultError::InvalidTradeParams);
    require!(min_amount_out > 0, crate::errors::VaultError::InvalidTradeParams);

    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    let price = read_pyth_price(&ctx.accounts.price_update)?;
    let amount_out = calculate_amount_out(
        amount_in,
        price.price,
        price.expo,
        ctx.accounts.vault_input_mint.decimals,
        ctx.accounts.vault_output_mint.decimals,
    )?;

    require!(amount_out >= min_amount_out, crate::errors::VaultError::InvalidTradeParams);

    let vault_key = vault.key();
    let seeds = crate::utils::get_vault_authority_seeds(&vault_key, &vault.vault_authority_bump);
    let signer_seeds = &[&seeds[..]];

    let burn_accounts = Burn {
        mint: ctx.accounts.vault_input_mint.to_account_info(),
        from: ctx.accounts.vault_input_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        burn_accounts,
        signer_seeds,
    );
    burn(cpi_ctx, amount_in)?;

    let mint_accounts = MintTo {
        mint: ctx.accounts.vault_output_mint.to_account_info(),
        to: ctx.accounts.vault_output_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        mint_accounts,
        signer_seeds,
    );
    mint_to(cpi_ctx, amount_out)?;

    if ctx.accounts.vault_input_mint.key() == vault.deposit_mint {
        vault.total_assets_deposited = vault
            .total_assets_deposited
            .checked_sub(amount_in)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
    }
    if ctx.accounts.vault_output_mint.key() == vault.deposit_mint {
        vault.total_assets_deposited = vault
            .total_assets_deposited
            .checked_add(amount_out)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
    }

    vault.last_trade_at = clock.unix_timestamp;

    emit!(TradeExecuted {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        input_mint: ctx.accounts.vault_input_mint.key(),
        output_mint: ctx.accounts.vault_output_mint.key(),
        amount_in,
        amount_out,
        price: price.price,
        price_exponent: price.expo,
        feed_id: SOL_USD_FEED_ID.to_string(),
    });

    Ok(())
}
