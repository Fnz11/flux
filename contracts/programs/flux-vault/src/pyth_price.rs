use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, get_feed_id_from_hex};
use crate::constants::MAXIMUM_AGE;

pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

pub struct PythPriceResult {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
}

pub fn read_pyth_price(price_update: &Account<PriceUpdateV2>) -> Result<PythPriceResult> {
    let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
    let clock = Clock::get()?;
    let price = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &feed_id)?;

    let conf = price.conf;
    let price_val = price.price;
    require!(price_val > 0, crate::errors::VaultError::InvalidTradeParams);

    let conf_check = (conf as u128)
        .checked_mul(100)
        .ok_or(crate::errors::VaultError::MathOverflow)?;
    require!(
        conf_check <= (price_val.unsigned_abs() as u128),
        crate::errors::VaultError::PriceConfidenceTooWide
    );

    Ok(PythPriceResult {
        price: price_val,
        conf,
        expo: price.exponent,
    })
}

pub fn calculate_amount_out(
    amount_in: u64,
    price: i64,
    expo: i32,
    input_decimals: u8,
    output_decimals: u8,
    is_quote_to_base: bool,
) -> Result<u64> {
    require!(price > 0, crate::errors::VaultError::InvalidTradeParams);

    if !is_quote_to_base {
        // Base -> Quote: amount_out = amount_in * price
        let total_expo = expo + (output_decimals as i32) - (input_decimals as i32);
        if total_expo >= 0 {
            let multiplier = 10u64
                .checked_pow(total_expo as u32)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            let val = (amount_in as u128)
                .checked_mul(price as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?
                .checked_mul(multiplier as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            u64::try_from(val).map_err(|_| crate::errors::VaultError::MathOverflow.into())
        } else {
            let divisor = 10u64
                .checked_pow((-total_expo) as u32)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            let val = (amount_in as u128)
                .checked_mul(price as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?
                .checked_div(divisor as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            u64::try_from(val).map_err(|_| crate::errors::VaultError::MathOverflow.into())
        }
    } else {
        // Quote -> Base: amount_out = amount_in / price
        let total_expo = (output_decimals as i32) - (input_decimals as i32) - expo;
        if total_expo >= 0 {
            let multiplier = 10u64
                .checked_pow(total_expo as u32)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            let val = (amount_in as u128)
                .checked_mul(multiplier as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?
                .checked_div(price as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            u64::try_from(val).map_err(|_| crate::errors::VaultError::MathOverflow.into())
        } else {
            let divisor = 10u64
                .checked_pow((-total_expo) as u32)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            let scaled_price = (price as u128)
                .checked_mul(divisor as u128)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            let val = (amount_in as u128)
                .checked_div(scaled_price)
                .ok_or(crate::errors::VaultError::MathOverflow)?;
            u64::try_from(val).map_err(|_| crate::errors::VaultError::MathOverflow.into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_amount_out_negative_expo_sol_to_usdc() {
        // 1 SOL (1e9 lamports) at $150 with -8 expo, 9 input decimals, 6 output decimals
        // Base -> Quote (is_quote_to_base = false)
        // total_expo = -8 + 6 - 9 = -11 -> divide by 1e11
        // val = 1e9 * 15_000_000_000 / 1e11 = 150_000_000 (150 USDC in 6 decimals)
        let result = calculate_amount_out(1_000_000_000, 15_000_000_000, -8, 9, 6, false).unwrap();
        assert_eq!(result, 150_000_000);
    }

    #[test]
    fn test_calculate_amount_out_positive_expo() {
        let result = calculate_amount_out(100, 50, 2, 0, 0, false).unwrap();
        assert_eq!(result, 500_000); // 100 * 50 * 100
    }

    #[test]
    fn test_calculate_amount_out_zero_expo() {
        let result = calculate_amount_out(500, 3, 0, 0, 0, false).unwrap();
        assert_eq!(result, 1_500);
    }

    #[test]
    fn test_calculate_amount_out_zero_price() {
        let result = calculate_amount_out(1_000_000, 0, -8, 9, 6, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_amount_out_negative_price_rejection() {
        let result = calculate_amount_out(1_000_000, -1, -8, 9, 6, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_amount_out_same_decimals() {
        // 1e6 input, price 2, expo -6, 6 input, 6 output -> total_expo = -6+6-6 = -6
        let result = calculate_amount_out(1_000_000, 2, -6, 6, 6, false).unwrap();
        assert_eq!(result, 2);
    }

    #[test]
    fn test_calculate_amount_out_overflow_error() {
        let result = calculate_amount_out(u64::MAX, i64::MAX, 0, 0, 0, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_amount_out_sol_to_usdc_1_sol() {
        let result = calculate_amount_out(1_000_000_000, 15_000_000_000, -8, 9, 6, false).unwrap();
        assert_eq!(result, 150_000_000);
    }

    #[test]
    fn test_calculate_amount_out_sol_to_usdc_0_001_sol() {
        let result = calculate_amount_out(1_000_000, 15_000_000_000, -8, 9, 6, false).unwrap();
        assert_eq!(result, 150_000);
    }

    #[test]
    fn test_calculate_amount_out_btc_to_usdc() {
        let result = calculate_amount_out(100_000_000, 6_000_000_000_000, -8, 8, 6, false).unwrap();
        assert_eq!(result, 60_000_000_000);
    }

    #[test]
    fn test_calculate_amount_out_usdc_to_sol_neg_expo() {
        // Quote -> Base (is_quote_to_base = true)
        // 150 USDC (150_000_000 units, 6 decimals) at $150 SOL price (15_000_000_000, expo -8)
        // output_decimals = 9 (SOL), input_decimals = 6 (USDC)
        // total_expo = 9 - 6 - (-8) = 11 -> multiplier = 1e11
        // val = (150_000_000 * 1e11) / 15_000_000_000 = 1_000_000_000 (1 SOL in 9 decimals)
        let result = calculate_amount_out(150_000_000, 15_000_000_000, -8, 6, 9, true).unwrap();
        assert_eq!(result, 1_000_000_000);
    }

    #[test]
    fn test_calculate_amount_out_same_token_price_1() {
        let result = calculate_amount_out(1_000_000, 1, 0, 6, 6, false).unwrap();
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn test_calculate_amount_out_price_1_with_neg6_expo() {
        let result = calculate_amount_out(1_000_000, 1, -6, 6, 6, false).unwrap();
        assert_eq!(result, 1);
    }

    #[test]
    fn test_calculate_amount_out_high_price_large_amount() {
        let result = calculate_amount_out(1_000_000_000, 1_000_000_000, -9, 0, 0, false).unwrap();
        assert_eq!(result, 1_000_000_000);
    }

    #[test]
    fn test_calculate_amount_out_tiny_amount_rounds_zero() {
        let result = calculate_amount_out(1, 1, -10, 0, 0, false).unwrap();
        assert_eq!(result, 0);
    }

    #[test]
    fn test_calculate_amount_out_negative_expo_large_divisor_truncates() {
        let result = calculate_amount_out(1_000_000_000, 5_000_000_000_000_000, -18, 6, 6, false).unwrap();
        assert_eq!(result, 5_000_000);
    }

    #[test]
    fn test_calculate_amount_out_expo_negative_1() {
        let result = calculate_amount_out(1000, 7, -1, 0, 0, false).unwrap();
        assert_eq!(result, 700);
    }

    #[test]
    fn test_calculate_amount_out_expo_positive_1() {
        let result = calculate_amount_out(1000, 7, 1, 0, 0, false).unwrap();
        assert_eq!(result, 70_000);
    }

    #[test]
    fn test_calculate_amount_out_expo_0_no_scaling() {
        let result = calculate_amount_out(1000, 7, 0, 0, 0, false).unwrap();
        assert_eq!(result, 7_000);
    }

    #[test]
    fn test_calculate_amount_out_input_dec_gt_output_dec() {
        let result = calculate_amount_out(1_000_000, 1, 0, 9, 6, false).unwrap();
        assert_eq!(result, 1_000);
    }

    #[test]
    fn test_calculate_amount_out_output_dec_gt_input_dec() {
        let result = calculate_amount_out(1_000_000, 1, 0, 6, 9, false).unwrap();
        assert_eq!(result, 1_000_000_000);
    }

    #[test]
    fn test_calculate_amount_out_price_exactly_1() {
        let result = calculate_amount_out(1_000_000, 100, -2, 0, 0, false).unwrap();
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn test_calculate_amount_out_price_just_above_zero() {
        let result = calculate_amount_out(1_000_000_000, 1, -18, 0, 0, false).unwrap();
        assert_eq!(result, 0);
    }

    #[test]
    fn test_calculate_amount_out_decimal_0_input_0_output() {
        let result = calculate_amount_out(1_000_000, 3, 2, 0, 0, false).unwrap();
        assert_eq!(result, 300_000_000);
    }

    #[test]
    fn test_calculate_amount_out_max_decimals_18_18() {
        let result = calculate_amount_out(1_000_000, 1_000_000, 0, 18, 18, false).unwrap();
        assert_eq!(result, 1_000_000_000_000);
    }

    #[test]
    fn test_calculate_amount_out_regression_sol_usdc_150() {
        let result = calculate_amount_out(1_000_000_000, 15_000_000_000, -8, 9, 6, false).unwrap();
        assert_eq!(result, 150_000_000);
    }

    #[test]
    fn test_calculate_amount_out_regression_sol_usdc_cent() {
        let result = calculate_amount_out(1_000_000_000, 150, -2, 9, 6, false).unwrap();
        assert_eq!(result, 1_500_000);
    }

    #[test]
    fn test_calculate_amount_out_overflow_max_price() {
        let result = calculate_amount_out(u64::MAX, i64::MAX, 0, 0, 0, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_amount_out_zero_price_error() {
        let result = calculate_amount_out(1_000_000, 0, 0, 0, 0, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_amount_out_negative_price_error() {
        let result = calculate_amount_out(1_000_000, -1, 0, 0, 0, false);
        assert!(result.is_err());
    }
}
