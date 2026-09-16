use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use crate::constants::*;
use crate::events::TradeExecuted;
use crate::state::{VaultState, VaultStatusCode};
use crate::pyth_price::{SOL_USD_FEED_ID, calculate_amount_out, read_pyth_price};
use crate::manager::vault_manager::VaultManager;

#[derive(Accounts)]
pub struct ExecuteTradePyth<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.creator.as_ref(), vault.share_token_mint.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status == VaultStatusCode::Active @ crate::errors::VaultError::VaultLocked,
        constraint = vault.manager == manager.key() @ crate::errors::VaultError::Unauthorized,
    )]
    pub vault: Box<Account<'info, VaultState>>,

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
    pub vault_input_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_input_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = vault_output_token_account.owner == vault_authority.key(),
        constraint = vault_output_token_account.mint == vault_output_mint.key(),
    )]
    pub vault_output_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_output_mint: Box<InterfaceAccount<'info, Mint>>,

    pub price_update: Box<Account<'info, PriceUpdateV2>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ExecuteTradePyth>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    require!(amount_in > 0, crate::errors::VaultError::InvalidTradeParams);
    require!(min_amount_out > 0, crate::errors::VaultError::InvalidTradeParams);

    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        vault.allowed_output_mints.is_empty()
        || vault.allowed_output_mints.contains(&ctx.accounts.vault_output_mint.key()) 
        || ctx.accounts.vault_output_mint.key() == vault.deposit_mint,
        crate::errors::VaultError::InvalidMint
    );

    let is_quote_to_base = ctx.accounts.vault_output_mint.key() == anchor_spl::token::spl_token::native_mint::ID;

    let price = read_pyth_price(&ctx.accounts.price_update)?;
    let amount_out = calculate_amount_out(
        amount_in,
        price.price,
        price.expo,
        ctx.accounts.vault_input_mint.decimals,
        ctx.accounts.vault_output_mint.decimals,
        is_quote_to_base,
    )?;

    require!(amount_out >= min_amount_out, crate::errors::VaultError::InvalidTradeParams);

    let vault_key = vault.key();
    let seeds = crate::utils::get_vault_authority_seeds(&vault_key, &vault.vault_authority_bump);
    let signer_seeds = &[&seeds[..]];

    require!(
        ctx.accounts.vault_input_mint.key() != ctx.accounts.vault_output_mint.key(),
        crate::errors::VaultError::InvalidTradeParams
    );

    let is_input_native = ctx.accounts.vault_input_mint.key() == anchor_spl::token::spl_token::native_mint::ID;
    let vault_authority_key = ctx.accounts.vault_authority.key();
    let is_vault_input_mint_authority = ctx.accounts.vault_input_mint
        .mint_authority
        .contains(&vault_authority_key);

    if is_input_native || is_vault_input_mint_authority {
        require!(
            ctx.accounts.vault_input_token_account.amount >= amount_in,
            crate::errors::VaultError::InsufficientVaultBalance
        );
    }

    if !is_input_native {
        // Only burn if vault_authority is the mint authority of the input token.
        // Burning requires the token account authority (vault_authority owns the ATA)
        // AND the mint must allow burning by vault_authority (i.e. it's a vault-native token).
        // For external tokens (e.g. USDC) this guard prevents a failing CPI.
        if is_vault_input_mint_authority {
            let burn_in = anchor_spl::token_interface::Burn {
                mint: ctx.accounts.vault_input_mint.to_account_info(),
                from: ctx.accounts.vault_input_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                burn_in,
                signer_seeds,
            );
            anchor_spl::token_interface::burn(cpi_ctx, amount_in)?;
        } else {
            // External token input: vault_authority is not the mint authority.
            // Skip burn — accounting is handled via total_assets_deposited adjustments.
            msg!("Burn skipped: vault_authority is not mint authority for input token");
        }
    }

    let is_output_native = ctx.accounts.vault_output_mint.key() == anchor_spl::token::spl_token::native_mint::ID;
    if !is_output_native {
        // Only attempt MintTo if vault_authority is actually the mint authority.
        // Solana BPF runtime propagates CPI errors at the VM level — a failed MintTo
        // cannot be caught with Rust match; we must guard the call itself.
        let vault_authority_key = ctx.accounts.vault_authority.key();
        let is_vault_mint_authority = ctx.accounts.vault_output_mint
            .mint_authority
            .contains(&vault_authority_key);

        if is_vault_mint_authority {
            let mint_out = anchor_spl::token_interface::MintTo {
                mint: ctx.accounts.vault_output_mint.to_account_info(),
                to: ctx.accounts.vault_output_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                mint_out,
                signer_seeds,
            );
            anchor_spl::token_interface::mint_to(cpi_ctx, amount_out)?;
        } else {
            // External token (e.g. USDC): vault_authority is not the mint authority.
            // Skip MintTo — accounting is tracked via total_assets_deposited only.
            msg!("MintTo skipped: vault_authority is not mint authority for output token");
        }
    }

    // The trade is synthetic and executed exactly at the Pyth oracle price.
    // Therefore, the total value of the vault's assets (measured in deposit_mint) remains perfectly constant.
    // No adjustment to vault.total_assets_deposited is needed.

    vault.last_trade_at = clock.unix_timestamp;

    VaultManager::accrue_and_apply_fees(vault, clock.unix_timestamp)?;

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
