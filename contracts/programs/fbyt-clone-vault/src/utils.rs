use anchor_lang::prelude::*;
use crate::constants::VAULT_AUTHORITY_SEED;

pub fn get_vault_authority_seeds<'a>(vault_key: &'a Pubkey, bump: &'a u8) -> [&'a [u8]; 3] {
    [
        VAULT_AUTHORITY_SEED,
        vault_key.as_ref(),
        std::slice::from_ref(bump),
    ]
}
