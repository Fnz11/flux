use anchor_lang::prelude::*;
use crate::errors::VaultError;

/// Calculates the number of shares to mint for a deposit.
/// Rounds down to favor the vault.
pub fn calculate_shares_to_mint(
    deposit_amount: u64,
    total_assets_deposited: u64,
    total_shares_minted: u64,
) -> Result<u64> {
    if total_shares_minted == 0 || total_assets_deposited == 0 {
        Ok(deposit_amount)
    } else {
        let shares = (deposit_amount as u128)
            .checked_mul(total_shares_minted as u128)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(total_assets_deposited as u128)
            .ok_or(VaultError::MathOverflow)?;
        u64::try_from(shares).map_err(|_| VaultError::MathOverflow.into())
    }
}

/// Calculates the asset amount to return for a share withdrawal.
/// Rounds down to favor the vault.
pub fn calculate_amount_out(
    shares_to_burn: u64,
    total_assets_deposited: u64,
    total_shares_minted: u64,
) -> Result<u64> {
    require!(total_shares_minted > 0, VaultError::MathOverflow);
    let amount = (shares_to_burn as u128)
        .checked_mul(total_assets_deposited as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(total_shares_minted as u128)
        .ok_or(VaultError::MathOverflow)?;
    u64::try_from(amount).map_err(|_| VaultError::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- calculate_shares_to_mint ---

    #[test]
    fn shares_to_mint_first_deposit_is_one_to_one() {
        assert_eq!(calculate_shares_to_mint(1_000_000, 0, 0).unwrap(), 1_000_000);
    }

    #[test]
    fn shares_to_mint_zero_total_assets_bootstraps() {
        assert_eq!(calculate_shares_to_mint(500_000, 0, 500_000).unwrap(), 500_000);
    }

    #[test]
    fn shares_to_mint_pro_rata_at_equal_nav() {
        // 1M shares, 1M assets -> deposit 1M -> get 1M shares
        assert_eq!(calculate_shares_to_mint(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }

    #[test]
    fn shares_to_mint_pro_rata_at_doubled_nav() {
        // 1M shares, 2M assets (NAV=2) -> deposit 1M -> get 500K shares
        assert_eq!(calculate_shares_to_mint(1_000_000, 2_000_000, 1_000_000).unwrap(), 500_000);
    }

    #[test]
    fn shares_to_mint_truncates_down() {
        // 2 shares for 3 assets -> deposit 1 -> exact=0.666... -> truncates DOWN to 0
        assert_eq!(calculate_shares_to_mint(1, 3, 2).unwrap(), 0);
    }

    #[test]
    fn shares_to_mint_zero_deposit_returns_zero() {
        assert_eq!(calculate_shares_to_mint(0, 1_000_000, 1_000_000).unwrap(), 0);
    }

    #[test]
    fn shares_to_mint_large_values_overflow_returns_error() {
        let result = calculate_shares_to_mint(u64::MAX, 1, u64::MAX);
        assert!(result.is_err());
    }

    // --- calculate_amount_out ---

    #[test]
    fn amount_out_at_equal_nav_is_one_to_one() {
        assert_eq!(calculate_amount_out(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }

    #[test]
    fn amount_out_at_doubled_nav() {
        // 1M shares, 2M assets -> burn 1M shares -> get 2M assets
        assert_eq!(calculate_amount_out(1_000_000, 2_000_000, 1_000_000).unwrap(), 2_000_000);
    }

    #[test]
    fn amount_out_partial_withdrawal() {
        // Burn half shares: 1M shares, 1M assets -> burn 500K -> get 500K assets
        assert_eq!(calculate_amount_out(500_000, 1_000_000, 1_000_000).unwrap(), 500_000);
    }

    #[test]
    fn amount_out_truncates_down() {
        // 2 shares, 3 assets -> burn 1 share -> exact=1.5 -> truncates DOWN to 1
        assert_eq!(calculate_amount_out(1, 3, 2).unwrap(), 1);
    }

    #[test]
    fn amount_out_zero_shares_returns_zero() {
        assert_eq!(calculate_amount_out(0, 1_000_000, 1_000_000).unwrap(), 0);
    }

    #[test]
    fn amount_out_zero_total_shares_returns_error() {
        let result = calculate_amount_out(1_000_000, 1_000_000, 0);
        assert!(result.is_err());
    }

    #[test]
    fn amount_out_burns_all_shares() {
        // All shares burned -> should return total_assets exactly
        assert_eq!(calculate_amount_out(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }

    // --- calculate_shares_to_mint (extended coverage) ---

    #[test]
    fn nav_3x_one_third_shares() {
        // NAV=3, deposit 1M -> get 1/3 of shares = 333_333
        assert_eq!(calculate_shares_to_mint(1_000_000, 3_000_000, 1_000_000).unwrap(), 333_333);
    }

    #[test]
    fn nav_10x_one_tenth_shares() {
        // NAV=10, deposit 1M -> get 1/10 of shares = 100_000
        assert_eq!(calculate_shares_to_mint(1_000_000, 10_000_000, 1_000_000).unwrap(), 100_000);
    }

    #[test]
    fn min_deposit_1_wei_bootstrap() {
        assert_eq!(calculate_shares_to_mint(1, 0, 0).unwrap(), 1);
    }

    #[test]
    fn max_deposit_bootstrap() {
        assert_eq!(calculate_shares_to_mint(u64::MAX, 0, 0).unwrap(), u64::MAX);
    }

    #[test]
    fn deposit_equal_to_total_assets() {
        // deposit X, assets X, shares X -> get X shares
        assert_eq!(calculate_shares_to_mint(1_000_000, 2_000_000, 2_000_000).unwrap(), 1_000_000);
    }

    #[test]
    fn deposit_double_total_assets() {
        // deposit 2M vs 1M assets -> get 2x shares = 2M
        assert_eq!(calculate_shares_to_mint(2_000_000, 1_000_000, 1_000_000).unwrap(), 2_000_000);
    }

    #[test]
    fn deposit_half_total_assets() {
        // 2M shares over 1M assets (NAV 0.5) -> deposit 500K -> get 500K*2M/1M = 1M shares
        assert_eq!(calculate_shares_to_mint(500_000, 1_000_000, 2_000_000).unwrap(), 1_000_000);
    }

    #[test]
    fn large_nav_small_deposit_truncates() {
        // 1 deposit vs huge NAV -> truncates to 0 shares
        assert_eq!(calculate_shares_to_mint(1, u64::MAX / 2, 1).unwrap(), 0);
    }

    #[test]
    fn total_shares_gt_assets_dilution() {
        // 1M * 2M / 500K = 4M shares minted
        assert_eq!(calculate_shares_to_mint(1_000_000, 500_000, 2_000_000).unwrap(), 4_000_000);
    }

    #[test]
    fn share_mint_near_u64_max() {
        // (u64::MAX/2)*1/1 fits in u64 -> no error
        assert_eq!(calculate_shares_to_mint(u64::MAX / 2, 1, 1).unwrap(), u64::MAX / 2);
    }

    #[test]
    fn shares_exact_0_when_too_small() {
        // 1 * 2000 / 1000 = 2
        assert_eq!(calculate_shares_to_mint(1, 1000, 2000).unwrap(), 2);
    }

    #[test]
    fn nav_0_5_double_shares() {
        // 1M * 1M / 500K = 2M shares minted
        assert_eq!(calculate_shares_to_mint(1_000_000, 500_000, 1_000_000).unwrap(), 2_000_000);
    }

    #[test]
    fn rounding_down_invariant() {
        // exact=0.666... -> rounds DOWN to 0
        assert_eq!(calculate_shares_to_mint(1, 3, 2).unwrap(), 0);
    }

    // --- calculate_amount_out (extended coverage) ---

    #[test]
    fn nav_3x_triple_assets_returned() {
        // NAV=3, burn all shares -> get 3x assets
        assert_eq!(calculate_amount_out(1_000_000, 3_000_000, 1_000_000).unwrap(), 3_000_000);
    }

    #[test]
    fn burn_one_of_many_shares() {
        assert_eq!(calculate_amount_out(1, 1_000_000, 1_000_000).unwrap(), 1);
    }

    #[test]
    fn burn_all_at_high_nav() {
        // NAV=5, burn all X shares -> get 5*X assets
        assert_eq!(calculate_amount_out(1_000_000, 5_000_000, 1_000_000).unwrap(), 5_000_000);
    }

    #[test]
    fn tiny_shares_large_assets() {
        // u64::MAX / 2 rounds down to u64::MAX/2
        assert_eq!(calculate_amount_out(1, u64::MAX, 2).unwrap(), u64::MAX / 2);
    }

    #[test]
    fn multiple_burns_drain_correctly() {
        // Single pro-rata burn of 400K against 1M shares/1M assets
        assert_eq!(calculate_amount_out(400_000, 1_000_000, 1_000_000).unwrap(), 400_000);
    }

    #[test]
    fn single_wei_burn() {
        assert_eq!(calculate_amount_out(1, 1_000_000_000, 1_000_000_000).unwrap(), 1);
    }

    #[test]
    fn burn_at_nav_0_5() {
        // NAV=0.5, burn all shares -> get half the assets
        assert_eq!(calculate_amount_out(1_000_000, 500_000, 1_000_000).unwrap(), 500_000);
    }

    #[test]
    fn truncation_1_5_rounds_down() {
        // exact=1.5 -> truncates DOWN to 1
        assert_eq!(calculate_amount_out(1, 3, 2).unwrap(), 1);
    }

    #[test]
    fn u64_max_all_fields() {
        // (u64::MAX*u64::MAX)/(u64::MAX) = u64::MAX, fits
        assert_eq!(calculate_amount_out(u64::MAX, u64::MAX, u64::MAX).unwrap(), u64::MAX);
    }

    #[test]
    fn burn_quarter_shares() {
        // Burn 250K of 1M shares -> get 250K assets
        assert_eq!(calculate_amount_out(250_000, 1_000_000, 1_000_000).unwrap(), 250_000);
    }

    #[test]
    fn burn_three_quarter_shares() {
        // Burn 750K of 1M shares -> get 750K assets
        assert_eq!(calculate_amount_out(750_000, 1_000_000, 1_000_000).unwrap(), 750_000);
    }

    #[test]
    fn nav_100x_burn_1() {
        // 100M / 1M = 100 assets per share
        assert_eq!(calculate_amount_out(1, 100_000_000, 1_000_000).unwrap(), 100);
    }

    #[test]
    fn output_never_negative_reason_rounds_to_zero() {
        // 1*1/2 = 0.5 -> truncates DOWN to 0
        assert_eq!(calculate_amount_out(1, 1, 2).unwrap(), 0);
    }
}

