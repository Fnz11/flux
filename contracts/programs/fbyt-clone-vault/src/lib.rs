use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub use instructions::*;
pub mod manager;
pub mod math;
pub mod pyth_price;
pub mod security;
pub mod state;
pub mod utils;

declare_id!("FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais");

#[program]
pub mod fbyt_clone_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        min_raise_amount: u64,
        performance_fee_bps: u16,
        management_fee_bps: u16,
        lockup_period: i64,
        allowed_output_mints: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::initialize_vault::handler(
            ctx,
            min_raise_amount,
            performance_fee_bps,
            management_fee_bps,
            lockup_period,
            allowed_output_mints,
        )
    }

    pub fn activate_vault(
        ctx: Context<ActivateVault>,
    ) -> Result<()> {
        instructions::activate_vault::handler(ctx)
    }

    pub fn deactivate_vault(
        ctx: Context<DeactivateVault>,
    ) -> Result<()> {
        instructions::deactivate_vault::handler(ctx)
    }


    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        shares_to_burn: u64,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, shares_to_burn)
    }

    pub fn execute_trade_pyth(
        ctx: Context<ExecuteTradePyth>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        instructions::execute_trade_pyth::handler(ctx, amount_in, min_amount_out)
    }

    pub fn collect_fees(
        ctx: Context<CollectFees>,
    ) -> Result<()> {
        instructions::collect_fees::handler(ctx)
    }

    pub fn pause_vault(
        ctx: Context<PauseVault>,
        paused: bool,
    ) -> Result<()> {
        instructions::pause_vault::handler(ctx, paused)
    }

    pub fn set_pending_manager(
        ctx: Context<SetPendingManager>,
        pending_manager: Pubkey,
    ) -> Result<()> {
        instructions::set_pending_manager::handler(ctx, pending_manager)
    }

    pub fn accept_manager(
        ctx: Context<AcceptManager>,
    ) -> Result<()> {
        instructions::accept_manager::handler(ctx)
    }
}
