use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    transfer_checked, TransferChecked,
    mint_to, MintTo,
};

#[derive(Accounts)]
pub struct DepositMyVault<'info> {
    // ---------- WHO ----------
    // Alice proves she is Alice (her wallet signed this tx)
    #[account(mut)]
    pub investor: Signer<'info>,

    // ---------- THE BOX ----------
    // The vault must be exactly this vault — seeds lock it to Bob's vault
    #[account(
        mut,                                                            // we'll write new totals
        seeds = [b"vault", vault.manager.as_ref()],                     // formula: "vault" + Bob
        bump,                                                           // serial number
    )]
    pub vault: Account<'info, crate::instructions::initialize_vault::VaultState>,

    // ---------- THE SEAL (who signs for vault money) ----------
    #[account(
        seeds = [b"vault_authority", vault.key().as_ref()],             // formula: "seal" + box_address
        bump,
    )]
    /// CHECK: PDA used as CPI signer — program proves seeds, runtime verifies
    pub vault_authority: UncheckedAccount<'info>,

    // ---------- MONEY JARS ----------
    // Alice's personal USDC jar
    #[account(mut)]
    pub investor_token_account: InterfaceAccount<'info, TokenAccount>,

    // The vault's USDC jar — must be owned by the seal
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key(), // "this jar is the vault's jar"
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    // The USDC factory (WHAT kind of money is this)
    #[account(
        constraint = deposit_mint.key() == investor_token_account.mint, // "jar contains USDC"
        constraint = deposit_mint.key() == vault_token_account.mint,    // "box jar also contains USDC"
    )]
    pub deposit_mint: InterfaceAccount<'info, Mint>,

    // ---------- RECEIPT FACTORY ----------
    // The share-printing machine — the seal is its owner
    #[account(
        mut,
        mint::authority = vault_authority,                              // "seal controls this printer"
    )]
    pub share_token_mint: InterfaceAccount<'info, Mint>,

    // Alice's share jar (created automatically if first time)
    #[account(
        init_if_needed,                                                 // "create if Alice has no share jar yet"
        payer = investor,                                               // Alice pays rent for her own jar
        associated_token::mint = share_token_mint,                      // "jar holds shares"
        associated_token::authority = investor,                         // "jar belongs to Alice"
    )]
    pub investor_share_account: InterfaceAccount<'info, TokenAccount>,

    // ---------- BUILT-IN PROGRAMS ----------
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositMyVault>, amount: u64) -> Result<()> {
    // ---------- CHECK ----------
    // You can't deposit zero — meaningless
    require!(amount > 0, crate::errors::VaultError::InvalidAmount);

    let vault = &mut ctx.accounts.vault;

    // ---------- THE MATH (same as metal box) ----------
    let shares_to_mint = if vault.total_shares_minted == 0 {
        // Nobody has invested yet — first deposit is 1:1
        amount
    } else {
        // Proportional: your share of the whole pie
        (amount as u128)
            .checked_mul(vault.total_shares_minted as u128)        // safe multiply — no silent overflow
            .and_then(|v| v.checked_div(vault.total_assets_deposited as u128))  // safe divide
            .ok_or(crate::errors::VaultError::MathOverflow)? as u64
    };

    // ---------- MOVEMENT 1: Alice's cash → box ----------
    // Authority = Alice (she already signed the tx)
    let transfer = TransferChecked {
        from: ctx.accounts.investor_token_account.to_account_info(),
        mint: ctx.accounts.deposit_mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.investor.to_account_info(),
    };
    anchor_spl::token_interface::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer),
        amount,
        ctx.accounts.deposit_mint.decimals,
    )?;                                                             // ← ? means: "if fails, stop everything"

    // ---------- MOVEMENT 2: seal prints receipt ----------
    // Authority = the vault's seal (PDA — no human can sign for it)
    // So instead of a signature, the program PROVES the seed formula:
    let seeds: &[&[u8]] = &[
        b"vault_authority",                           // "seal"
        vault.key().as_ref(),                         // "this box"
        &[vault.vault_authority_bump],                // "serial number"
    ];
    let signer_seeds = &[&seeds[..]];                 // wrapped for the runtime

    let mint = MintTo {
        mint: ctx.accounts.share_token_mint.to_account_info(),
        to: ctx.accounts.investor_share_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    anchor_spl::token_interface::mint_to(
        CpiContext::new_with_signer(                   // new_WITH_SIGNER — "I prove via seeds"
            ctx.accounts.token_program.to_account_info(),
            mint,
            signer_seeds,                              // the proof
        ),
        shares_to_mint,
    )?;

    // ---------- UPDATE LEDGER ----------
    vault.total_assets_deposited = vault.total_assets_deposited
        .checked_add(amount)
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    vault.total_shares_minted = vault.total_shares_minted
        .checked_add(shares_to_mint)
        .ok_or(crate::errors::VaultError::MathOverflow)?;

    Ok(())
}
