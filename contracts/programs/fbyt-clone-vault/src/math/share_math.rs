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
}

