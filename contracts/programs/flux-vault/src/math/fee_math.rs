use anchor_lang::prelude::*;
use crate::errors::VaultError;

pub const SECONDS_PER_YEAR: u128 = 365 * 86400; // 31,536,000 seconds

/// Calculates performance fee based on profit and performance fee bps.
pub fn calculate_performance_fee(
    profit: u64,
    performance_fee_bps: u16,
) -> Result<u64> {
    let fee = (profit as u128)
        .checked_mul(performance_fee_bps as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(VaultError::MathOverflow)?;
    u64::try_from(fee).map_err(|_| VaultError::MathOverflow.into())
}

/// Calculates management fee based on total assets, management fee bps, and elapsed seconds.
pub fn calculate_management_fee(
    total_assets: u64,
    management_fee_bps: u16,
    elapsed_seconds: i64,
) -> Result<u64> {
    if elapsed_seconds <= 0 {
        return Ok(0);
    }
    let fee = (total_assets as u128)
        .checked_mul(management_fee_bps as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_mul(elapsed_seconds as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(10_000 * SECONDS_PER_YEAR)
        .ok_or(VaultError::MathOverflow)?;
    u64::try_from(fee).map_err(|_| VaultError::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- calculate_performance_fee ---

    #[test]
    fn performance_fee_zero_profit() {
        assert_eq!(calculate_performance_fee(0, 1000).unwrap(), 0);
    }

    #[test]
    fn performance_fee_zero_bps() {
        assert_eq!(calculate_performance_fee(1_000_000, 0).unwrap(), 0);
    }

    #[test]
    fn performance_fee_ten_percent() {
        assert_eq!(calculate_performance_fee(1_000_000, 1000).unwrap(), 100_000);
    }

    #[test]
    fn performance_fee_hundred_percent() {
        assert_eq!(calculate_performance_fee(1_000_000, 10000).unwrap(), 1_000_000);
    }

    #[test]
    fn performance_fee_fractional_truncates() {
        let result = calculate_performance_fee(1, 1).unwrap();
        assert_eq!(result, 0); // 1 * 1 / 10000 = 0
    }

    #[test]
    fn performance_fee_large_profit_does_not_panic() {
        let result = calculate_performance_fee(u64::MAX, 10000);
        let _ = result;
    }

    // --- calculate_management_fee ---

    #[test]
    fn management_fee_zero_elapsed_returns_zero() {
        assert_eq!(calculate_management_fee(1_000_000, 200, 0).unwrap(), 0);
    }

    #[test]
    fn management_fee_negative_elapsed_returns_zero() {
        assert_eq!(calculate_management_fee(1_000_000, 200, -100).unwrap(), 0);
    }

    #[test]
    fn management_fee_zero_bps() {
        assert_eq!(calculate_management_fee(1_000_000, 0, 31_536_000).unwrap(), 0);
    }

    #[test]
    fn management_fee_two_percent_annual() {
        let assets = 10_000_000u64;
        let bps = 200u16; // 2%
        let one_year = 365 * 86400i64;
        let fee = calculate_management_fee(assets, bps, one_year).unwrap();
        assert_eq!(fee, 200_000); // 2% of 10M
    }

    #[test]
    fn management_fee_half_year_is_half_annual() {
        let assets = 10_000_000u64;
        let bps = 200u16;
        let half_year = (365 * 86400 / 2) as i64;
        let fee = calculate_management_fee(assets, bps, half_year).unwrap();
        assert_eq!(fee, 100_000);
    }

    #[test]
    fn management_fee_large_assets_does_not_panic() {
        let result = calculate_management_fee(u64::MAX, 10000, 31_536_000);
        let _ = result;
    }

    // --- calculate_performance_fee (additional) ---

    #[test]
    fn five_percent_fee() {
        assert_eq!(calculate_performance_fee(1_000_000, 500).unwrap(), 50_000);
    }

    #[test]
    fn one_bp_fee() {
        assert_eq!(calculate_performance_fee(10_000, 1).unwrap(), 1);
    }

    #[test]
    fn max_fee_bps_9999() {
        assert_eq!(calculate_performance_fee(1_000_000, 9999).unwrap(), 999_900);
    }

    #[test]
    fn small_profit_large_bps_caps() {
        assert_eq!(calculate_performance_fee(99, 10000).unwrap(), 99);
    }

    #[test]
    fn profit_1_wei_rounds_down() {
        assert_eq!(calculate_performance_fee(1, 100).unwrap(), 0);
    }

    #[test]
    fn profit_2M_is_2x_1M() {
        assert_eq!(calculate_performance_fee(1_000_000, 1000).unwrap(), 100_000);
        assert_eq!(calculate_performance_fee(2_000_000, 1000).unwrap(), 200_000);
    }

    #[test]
    fn fee_returns_exact_round() {
        assert_eq!(calculate_performance_fee(10_000, 100).unwrap(), 100);
    }

    #[test]
    fn large_profit_no_panic() {
        let r = calculate_performance_fee(u64::MAX, 1);
        assert!(r.is_ok());
    }

    #[test]
    fn fee_25pct() {
        assert_eq!(calculate_performance_fee(1_000_000, 2500).unwrap(), 250_000);
    }

    // --- calculate_management_fee (additional) ---

    const Y: i64 = 365 * 86400;

    #[test]
    fn quarter_year_fee() {
        let fee = calculate_management_fee(10_000_000, 200, Y / 4).unwrap();
        assert_eq!(fee, 50_000);
    }

    #[test]
    fn one_day_fee() {
        let fee = calculate_management_fee(10_000_000, 200, 86400).unwrap();
        assert_eq!(fee, 547);
    }

    #[test]
    fn one_second_fee_rounds_to_zero() {
        assert_eq!(calculate_management_fee(10_000_000, 200, 1).unwrap(), 0);
    }

    #[test]
    fn max_assets_no_overflow() {
        let r = calculate_management_fee(u64::MAX / 1000, 200, 86400);
        assert!(r.is_ok());
    }

    #[test]
    fn two_years_double_annual() {
        let fee = calculate_management_fee(10_000_000, 200, 2 * Y).unwrap();
        assert_eq!(fee, 400_000);
    }

    #[test]
    fn fee_scales_with_assets() {
        assert_eq!(calculate_management_fee(10_000_000, 200, Y).unwrap(), 200_000);
        assert_eq!(calculate_management_fee(20_000_000, 200, Y).unwrap(), 400_000);
    }

    #[test]
    fn fee_scales_with_bps() {
        assert_eq!(calculate_management_fee(10_000_000, 200, Y).unwrap(), 200_000);
        assert_eq!(calculate_management_fee(10_000_000, 400, Y).unwrap(), 400_000);
    }

    #[test]
    fn fee_100bps_is_1pct() {
        let fee = calculate_management_fee(100_000_000, 100, Y).unwrap();
        assert_eq!(fee, 1_000_000);
    }

    #[test]
    fn very_large_elapsed() {
        let r = calculate_management_fee(10_000_000, 200, 100 * Y);
        assert!(r.is_ok());
        // 10M at 2% annual for 100 years = 200_000 * 100 = 20_000_000
        assert_eq!(r.unwrap(), 20_000_000);
    }
}

