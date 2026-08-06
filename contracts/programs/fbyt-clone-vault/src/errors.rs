use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Only the vault manager can perform this action")]
    Unauthorized,
    #[msg("Invalid Pyth price feed account")]
    InvalidPythFeed,
    #[msg("Math overflow or underflow detected")]
    MathOverflow,
    #[msg("Pyth price is too old")]
    StalePrice,
    #[msg("Vault is not active")]
    VaultLocked,
    #[msg("Minimum raise amount not met")]
    MinRaiseNotMet,
    #[msg("Withdrawal lockup period has not ended")]
    LockupActive,
    #[msg("Insufficient vault balance for withdrawal")]
    InsufficientVaultBalance,
    #[msg("Invalid trade parameters")]
    InvalidTradeParams,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Fee exceeds maximum allowed")]
    FeeTooHigh,
    #[msg("Invalid token mint for vault operation")]
    InvalidMint,
    #[msg("Subtraction underflow")]
    SubtractionUnderflow,
    #[msg("Multiplication overflow")]
    MultiplicationOverflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Type cast overflow")]
    CastOverflow,
    #[msg("Price confidence interval is too wide")]
    PriceConfidenceTooWide,
    #[msg("Invalid price feed for token mint")]
    InvalidPriceFeedForMint,
    #[msg("Vault is currently paused")]
    VaultPaused,
    #[msg("Share token mint mismatch")]
    ShareMintMismatch,
}
