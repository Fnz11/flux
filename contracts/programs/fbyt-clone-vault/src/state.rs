use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub enum VaultStatusCode {
    Fundraising,
    Active,
    Dormant,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub manager: Pubkey,
    pub pending_manager: Option<Pubkey>,
    pub deposit_mint: Pubkey,
    pub share_token_mint: Pubkey,
    pub allowed_output_mints: [Pubkey; 4],
    pub min_raise_amount: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub accrued_performance_fee: u64,
    pub accrued_management_fee: u64,
    pub lockup_period: i64,
    pub total_shares_minted: u64,
    pub total_assets_deposited: u64,
    pub vault_bump: u8,
    pub vault_authority_bump: u8,
    pub status: VaultStatusCode,
    pub is_paused: bool,
    pub created_at: i64,
    pub last_trade_at: i64,
    pub high_water_mark: u64,
    pub last_fee_accrual_at: i64,
    pub _reserved: [u8; 64],
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::{AccountSerialize, AccountDeserialize, Discriminator};

    #[test]
    fn vault_status_code_discriminator_values() {
        let fundraising = VaultStatusCode::Fundraising;
        let active = VaultStatusCode::Active;
        let dormant = VaultStatusCode::Dormant;

        assert_eq!(fundraising as u8, 0);
        assert_eq!(active as u8, 1);
        assert_eq!(dormant as u8, 2);
    }

    #[test]
    fn vault_state_serialization_round_trips() {
        let original = VaultState {
            manager: Pubkey::new_unique(),
            pending_manager: Some(Pubkey::new_unique()),
            deposit_mint: Pubkey::new_unique(),
            share_token_mint: Pubkey::new_unique(),
            allowed_output_mints: [
                Pubkey::new_unique(),
                Pubkey::new_unique(),
                Pubkey::new_unique(),
                Pubkey::new_unique(),
            ],
            min_raise_amount: 1_000_000,
            performance_fee_bps: 1000,
            management_fee_bps: 200,
            accrued_performance_fee: 50_000,
            accrued_management_fee: 10_000,
            lockup_period: 86400,
            total_shares_minted: 500_000,
            total_assets_deposited: 500_000,
            vault_bump: 255,
            vault_authority_bump: 254,
            status: VaultStatusCode::Active,
            is_paused: false,
            created_at: 1700000000,
            last_trade_at: 1700003600,
            high_water_mark: 0,
            last_fee_accrual_at: 1700000000,
            _reserved: [0u8; 64],
        };

        let mut bytes = Vec::new();
        original.try_serialize(&mut bytes).unwrap();
        let mut slice = &bytes[..];
        let decoded = VaultState::try_deserialize(&mut slice).unwrap();

        assert_eq!(original.manager, decoded.manager);
        assert_eq!(original.pending_manager, decoded.pending_manager);
        assert_eq!(original.deposit_mint, decoded.deposit_mint);
        assert_eq!(original.share_token_mint, decoded.share_token_mint);
        assert_eq!(original.allowed_output_mints, decoded.allowed_output_mints);
        assert_eq!(original.min_raise_amount, decoded.min_raise_amount);
        assert_eq!(original.performance_fee_bps, decoded.performance_fee_bps);
        assert_eq!(original.management_fee_bps, decoded.management_fee_bps);
        assert_eq!(original.accrued_performance_fee, decoded.accrued_performance_fee);
        assert_eq!(original.accrued_management_fee, decoded.accrued_management_fee);
        assert_eq!(original.lockup_period, decoded.lockup_period);
        assert_eq!(original.total_shares_minted, decoded.total_shares_minted);
        assert_eq!(original.total_assets_deposited, decoded.total_assets_deposited);
        assert_eq!(original.vault_bump, decoded.vault_bump);
        assert_eq!(original.vault_authority_bump, decoded.vault_authority_bump);
        assert_eq!(original.status, decoded.status);
        assert_eq!(original.is_paused, decoded.is_paused);
        assert_eq!(original.created_at, decoded.created_at);
        assert_eq!(original.last_trade_at, decoded.last_trade_at);
    }

    #[test]
    fn vault_state_discriminator_stable() {
        let discriminator = VaultState::DISCRIMINATOR;
        assert_eq!(discriminator.len(), 8);
        assert_ne!(discriminator, [0u8; 8]);
        assert_eq!(VaultState::DISCRIMINATOR, discriminator);
    }
}
