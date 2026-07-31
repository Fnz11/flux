use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod pyth_price;
pub mod state;

declare_id!("FBYT1111111111111111111111111111111111111");

#[program]
pub mod fbyt_clone_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<instructions::initialize_vault::InitializeVaultAccountConstraints>,
        min_raise_amount: u64,
        performance_fee_bps: u16,
        management_fee_bps: u16,
        lockup_period: i64,
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, min_raise_amount, performance_fee_bps, management_fee_bps, lockup_period)
    }

    pub fn deposit(
        ctx: Context<instructions::deposit::DepositAccountConstraints>,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(
        ctx: Context<instructions::withdraw::WithdrawAccountConstraints>,
        shares_to_burn: u64,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, shares_to_burn)
    }

    pub fn execute_trade_pyth(
        ctx: Context<instructions::execute_trade_pyth::ExecuteTradePythAccountConstraints>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        instructions::execute_trade_pyth::handler(ctx, amount_in, min_amount_out)
    }
}
