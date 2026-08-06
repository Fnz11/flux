use anchor_lang::prelude::*;
use crate::state::VaultState;
use crate::math::share_math;
use crate::math::fee_math;
use crate::errors::VaultError;

pub struct VaultManager;

impl VaultManager {
    /// Calculate NAV per share (assets per share scaled by 1e9).
    /// If total_shares_minted is 0, returns 1_000_000_000 (1.0).
    pub fn calculate_nav(vault: &VaultState) -> Result<u64> {
        if vault.total_shares_minted == 0 {
            Ok(1_000_000_000)
        } else {
            let nav = (vault.total_assets_deposited as u128)
                .checked_mul(1_000_000_000)
                .ok_or(VaultError::MathOverflow)?
                .checked_div(vault.total_shares_minted as u128)
                .ok_or(VaultError::MathOverflow)?;
            u64::try_from(nav).map_err(|_| VaultError::MathOverflow.into())
        }
    }

    /// Process deposit logic: computes shares to mint using share_math and updates vault state.
    pub fn process_deposit(vault: &mut VaultState, amount: u64) -> Result<u64> {
        let shares_to_mint = share_math::calculate_shares_to_mint(
            amount,
            vault.total_assets_deposited,
            vault.total_shares_minted,
        )?;

        vault.total_assets_deposited = vault
            .total_assets_deposited
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        vault.total_shares_minted = vault
            .total_shares_minted
            .checked_add(shares_to_mint)
            .ok_or(VaultError::MathOverflow)?;

        Ok(shares_to_mint)
    }

    /// Process withdraw logic: computes amount out using share_math and updates vault state.
    pub fn process_withdraw(vault: &mut VaultState, shares_to_burn: u64) -> Result<u64> {
        let amount_out = share_math::calculate_amount_out(
            shares_to_burn,
            vault.total_assets_deposited,
            vault.total_shares_minted,
        )?;

        require!(
            amount_out <= vault.total_assets_deposited,
            VaultError::InsufficientVaultBalance
        );

        vault.total_shares_minted = vault
            .total_shares_minted
            .checked_sub(shares_to_burn)
            .ok_or(VaultError::MathOverflow)?;
        vault.total_assets_deposited = vault
            .total_assets_deposited
            .checked_sub(amount_out)
            .ok_or(VaultError::MathOverflow)?;

        Ok(amount_out)
    }

    /// Calculate accrued management and performance fees for a given time period and profit.
    pub fn accrue_fees(
        vault: &VaultState,
        current_timestamp: i64,
        profit: u64,
    ) -> Result<(u64, u64)> {
        let elapsed = current_timestamp.saturating_sub(vault.last_trade_at);
        let management_fee = fee_math::calculate_management_fee(
            vault.total_assets_deposited,
            vault.management_fee_bps,
            elapsed,
        )?;
        let performance_fee = fee_math::calculate_performance_fee(
            profit,
            vault.performance_fee_bps,
        )?;

        Ok((management_fee, performance_fee))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{VaultState, VaultStatusCode};

    fn mock_vault(total_assets: u64, total_shares: u64) -> VaultState {
        VaultState {
            manager: Pubkey::default(),
            pending_manager: None,
            deposit_mint: Pubkey::default(),
            share_token_mint: Pubkey::default(),
            allowed_output_mints: [Pubkey::default(); 4],
            min_raise_amount: 0,
            performance_fee_bps: 1000, // 10%
            management_fee_bps: 200,   // 2%
            accrued_performance_fee: 0,
            accrued_management_fee: 0,
            lockup_period: 0,
            total_shares_minted: total_shares,
            total_assets_deposited: total_assets,
            vault_bump: 0,
            vault_authority_bump: 0,
            status: VaultStatusCode::Active,
            is_paused: false,
            created_at: 0,
            last_trade_at: 0,
            high_water_mark: 0,
            last_fee_accrual_at: 0,
            _reserved: [0u8; 64],
        }
    }

    // --- calculate_nav ---

    #[test]
    fn test_nav_is_one_when_no_shares() {
        let vault = mock_vault(0, 0);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 1_000_000_000);
    }

    #[test]
    fn test_nav_is_one_to_one_at_equal_assets_and_shares() {
        let vault = mock_vault(1_000_000_000, 1_000_000_000);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 1_000_000_000);
    }

    #[test]
    fn test_nav_doubles_when_assets_double() {
        let vault = mock_vault(2_000_000_000, 1_000_000_000);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 2_000_000_000);
    }

    // --- process_deposit ---

    #[test]
    fn test_deposit_bootstrap_one_to_one() {
        let mut vault = mock_vault(0, 0);
        let shares = VaultManager::process_deposit(&mut vault, 1_000_000).unwrap();
        assert_eq!(shares, 1_000_000);
        assert_eq!(vault.total_assets_deposited, 1_000_000);
        assert_eq!(vault.total_shares_minted, 1_000_000);
    }

    #[test]
    fn test_deposit_diluted_at_doubled_nav() {
        let mut vault = mock_vault(2_000_000, 1_000_000);
        let shares = VaultManager::process_deposit(&mut vault, 1_000_000).unwrap();
        assert_eq!(shares, 500_000); // NAV=2, so 1M deposit -> 500K shares
        assert_eq!(vault.total_assets_deposited, 3_000_000);
        assert_eq!(vault.total_shares_minted, 1_500_000);
    }

    #[test]
    fn test_deposit_zero_amount() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let shares = VaultManager::process_deposit(&mut vault, 0).unwrap();
        assert_eq!(shares, 0);
        assert_eq!(vault.total_assets_deposited, 1_000_000);
        assert_eq!(vault.total_shares_minted, 1_000_000);
    }

    // --- process_withdraw ---

    #[test]
    fn test_withdraw_all_shares() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let amount = VaultManager::process_withdraw(&mut vault, 1_000_000).unwrap();
        assert_eq!(amount, 1_000_000);
        assert_eq!(vault.total_shares_minted, 0);
        assert_eq!(vault.total_assets_deposited, 0);
    }

    #[test]
    fn test_withdraw_half_shares() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let amount = VaultManager::process_withdraw(&mut vault, 500_000).unwrap();
        assert_eq!(amount, 500_000);
        assert_eq!(vault.total_shares_minted, 500_000);
        assert_eq!(vault.total_assets_deposited, 500_000);
    }

    #[test]
    fn test_withdraw_zero_shares_error_when_no_shares() {
        let mut vault = mock_vault(0, 0);
        let result = VaultManager::process_withdraw(&mut vault, 1_000_000);
        assert!(result.is_err());
    }

    // --- accrue_fees ---

    #[test]
    fn test_accrue_fees() {
        let vault = mock_vault(10_000_000, 10_000_000);
        let one_year = 365 * 86400i64;
        let profit = 1_000_000u64;
        let (mgmt_fee, perf_fee) = VaultManager::accrue_fees(&vault, one_year, profit).unwrap();
        assert_eq!(mgmt_fee, 200_000); // 2% of 10M
        assert_eq!(perf_fee, 100_000); // 10% of 1M
    }
}
