pub mod transfer_memo;
pub use transfer_memo::*;

pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";
pub const MAXIMUM_AGE: u64 = 60;
pub const SHARE_TOKEN_DECIMALS: u8 = 9;
pub const SHARE_TOKEN_NAME: &str = "Flux Vault Share";
pub const SHARE_TOKEN_SYMBOL: &str = "FLUXS";
