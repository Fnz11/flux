// trade-fresh.rs — "Bob swaps box contents at Pyth's price"
//
// Already filled: accounts struct, imports, handler skeleton.
// Fill only the 12 blanks labeled BELOW.
// New concept: reading a price board (Pyth oracle).

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    burn, Burn,
    mint_to, MintTo,
};
use crate::constants::*;
use crate::instructions::initialize_vault::{VaultState, VaultStatusCode, TradeExecuted};
use crate::pyth_price::{read_pyth_price, calculate_amount_out, SOL_USD_FEED_ID};

#[derive(Accounts)]
pub struct TradeAccounts<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.manager.as_ref()],
        bump = vault.vault_bump,
        constraint = vault.status == VaultStatusCode::Active,
        constraint = vault.manager == manager.key(),
    )]
    pub vault: Account<'info, VaultState>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump = vault.vault_authority_bump,
    )]
    /// CHECK: PDA that signs for token operations
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_input_token_account.owner == vault_authority.key(),
    )]
    pub vault_input_token_account: InterfaceAccount<'info, TokenAccount>,

    pub vault_input_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault_output_token_account.owner == vault_authority.key(),
    )]
    pub vault_output_token_account: InterfaceAccount<'info, TokenAccount>,

    pub vault_output_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Account that holds the verified Pyth price data
    pub price_update: Account<'info, pyth_solana_receiver_sdk::price_update::PriceUpdateV2>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<TradeAccounts>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    // ----- start of handler blanks -----

    // Guard: no zero trades
    require!(amount_in > 0, crate::errors::VaultError::_____BLANK_1_____);
    require!(min_amount_out > 0, crate::errors::VaultError::_____BLANK_2_____);

    let vault = &mut ctx.accounts.vault;

    // 1. Read today's price from the wall
    let price = _____BLANK_3_____(&ctx.accounts.price_update)?;  // hint: which function reads the Pyth board?

    // 2. Do the math: how much output token do we get?
    let amount_out = _____BLANK_4_____(amount_in, price.price, price.expo)?;  // hint: which function does the exponent math?

    // 3. Slippage guard: Bob says "I'll accept at least this much"
    require!(
        amount_out _____BLANK_5_____ min_amount_out,     // hint: compare: >= or <= ?
        crate::errors::VaultError::InvalidTradeParams
    );

    // 4a. Set up PDA seeds (used by BOTH burn and mint below)
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault.key().as_ref(),
        &[vault.vault_authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // 4b. Burn the input token (vault is selling this — PDA signs)
    let burn_accounts = Burn {
        mint: ctx.accounts.vault_input_mint.to_account_info(),
        from: ctx.accounts.vault_input_token_account.to_account_info(),
        authority: ctx.accounts._____BLANK_6_____.to_account_info(),  // hint: who owns the vault's tokens?
    };
    let cpi_ctx = CpiContext::_____BLANK_7_____(           // hint: new or new_with_signer?
        ctx.accounts.token_program.key(),
        burn_accounts,
        signer_seeds,
    );
    burn(cpi_ctx, amount_in)?;

    // 4c. Mint the output token (vault is buying this — PDA signs)
    let mint_accounts = MintTo {
        mint: ctx.accounts.vault_output_mint.to_account_info(),
        to: ctx.accounts.vault_output_token_account.to_account_info(),
        authority: ctx.accounts._____BLANK_8_____.to_account_info(),  // hint: same as burn
    };
    let cpi_ctx = CpiContext::_____BLANK_9_____(           // hint: same as burn
        ctx.accounts.token_program.key(),
        mint_accounts,
        signer_seeds,
    );
    mint_to(cpi_ctx, amount_out)?;

    // 5. Update the trade timestamp
    let clock = Clock::get()?;
    vault._____BLANK_10_____ = clock.unix_timestamp;       // hint: which vault field tracks trades?

    // 6. Shout it to the world
    emit!(TradeExecuted {
        vault: vault.key(),
        manager: ctx.accounts.manager.key(),
        input_mint: ctx.accounts.vault_input_mint.key(),
        output_mint: ctx.accounts.vault_output_mint.key(),
        amount_in,
        amount_out,
        price: price.price,
        price_exponent: price._____BLANK_11_____,          // hint: PythPriceResult field for exponent
        feed_id: SOL_USD_FEED_ID.to_string(),
    });

    _____BLANK_12_____(())                                 // hint: how do you finish?
}

// ----- end of handler blanks -----
