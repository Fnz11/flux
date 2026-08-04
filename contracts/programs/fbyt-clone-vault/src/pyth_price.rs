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
    Ok(PythPriceResult {
        price: price.price,
        conf: price.conf,
        expo: price.exponent,
    })
}

pub fn calculate_amount_out(amount_in: u64, price: i64, expo: i32) -> Result<u64> {
    if expo >= 0 {
        let multiplier = 10u64
            .checked_pow(expo as u32)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
        (amount_in as u128)
            .checked_mul(price as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)?
            .checked_mul(multiplier as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)
            .map(|v| v as u64)
    } else {
        let divisor = 10u64
            .checked_pow((-expo) as u32)
            .ok_or(crate::errors::VaultError::MathOverflow)?;
        (amount_in as u128)
            .checked_mul(price as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)?
            .checked_div(divisor as u128)
            .ok_or(crate::errors::VaultError::MathOverflow)
            .map(|v| v as u64)
    }
}
