use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub deposit_mint: Pubkey,
    pub min_raise_amount: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub lockup_period: i64,
    pub share_token_mint: Pubkey,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub token_mint: Pubkey,
    pub nav_per_share: u64,
    pub total_assets_after: u64,
    pub total_shares_after: u64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub investor: Pubkey,
    pub shares_burned: u64,
    pub amount_out: u64,
    pub token_mint: Pubkey,
    pub nav_per_share: u64,
    pub total_assets_after: u64,
    pub total_shares_after: u64,
}

#[event]
pub struct TradeExecuted {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub price: i64,
    pub price_exponent: i32,
    pub feed_id: String,
}

#[event]
pub struct VaultPaused {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub is_paused: bool,
    pub timestamp: i64,
}

#[event]
pub struct VaultActivated {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultDeactivated {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub timestamp: i64,
}


#[event]
pub struct FeesCollected {
    pub vault: Pubkey,
    pub manager: Pubkey,
    pub performance_fee: u64,
    pub management_fee: u64,
    pub total_collected: u64,
    pub timestamp: i64,
}

#[event]
pub struct ManagerChanged {
    pub vault: Pubkey,
    pub old_manager: Pubkey,
    pub new_manager: Pubkey,
    pub timestamp: i64,
}
