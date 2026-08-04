use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    burn, Burn,
    mint_to, MintTo,
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use crate::constants::*;
use crate::instructions::initialize_vault::{VaultState, VaultStatusCode, TradeExecuted};
use crate::pyth_price::{SOL_USD_FEED_ID, calculate_amount_out, read_pyth_price};

#[derive(Accounts)]
pub struct ExecuteTradePythAccountConstraints<'info> {
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
    )]
    pub vault_input_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_input_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault_output_token_account.owner == vault_authority.key(),
    )]
    pub vault_output_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub vault_output_mint: InterfaceAccount<'info, Mint>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ExecuteTradePythAccountConstraints>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    require!(amount_in > 0, crate::errors::VaultError::InvalidTradeParams);
    require!(min_amount_out > 0, crate::errors::VaultError::InvalidTradeParams);

    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    let price = read_pyth_price(&ctx.accounts.price_update)?;
    let amount_out = calculate_amount_out(amount_in, price.price, price.expo)?;

    require!(amount_out >= min_amount_out, crate::errors::VaultError::InvalidTradeParams);

    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault.key().as_ref(),
        &[vault.vault_authority_bump],
    ];
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
