use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    burn, Burn,
    mint_to, MintTo,
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
use crate::constants::*;
use crate::instructions::initialize_vault::{VaultState, VaultStatusCode, TradeExecuted};

const VAULT_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

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

    let price_update = &ctx.accounts.price_update;
    let feed_id_bytes = get_feed_id_from_hex(VAULT_FEED_ID)?;
    let price = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &feed_id_bytes)?;

    let (multiplier, divisor) = if price.exponent >= 0 {
        let mult = 10u128
            .checked_pow(price.exponent as u32)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
        (mult, 1u128)
    } else {
        let div = 10u128
            .checked_pow(price.exponent.unsigned_abs())
            .ok_or(crate::errors::VaultError::MathOverflow)?;
        (1u128, div)
    };

    let amount_out = (amount_in as u128)
        .checked_mul(price.price as u128)
        .ok_or(crate::errors::VaultError::MathOverflow)?
        .checked_mul(multiplier)
        .ok_or(crate::errors::VaultError::MathOverflow)?
        .checked_div(divisor)
        .ok_or(crate::errors::VaultError::MathOverflow)? as u64;

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
        price_exponent: price.exponent,
        feed_id: VAULT_FEED_ID.to_string(),
    });

    Ok(())
}
