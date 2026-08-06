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
}

