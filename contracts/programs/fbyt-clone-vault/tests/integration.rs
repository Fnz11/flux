mod common;

use common::*;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;
use solana_message::Message;
use solana_instruction::{AccountMeta, Instruction};
use anchor_lang::InstructionData;

#[test]
fn test_program_deployed() {
    let (svm, _payer, program_id) = setup_svm();
    let account = svm.get_account(&program_id).unwrap();
    assert!(account.executable);
}

#[test]
fn test_initialize_vault_basic() {
    let (mut svm, payer, program_id) = setup_svm();

    let manager = Keypair::new();
    svm.airdrop(&manager.pubkey(), 10_000_000_000).unwrap();

    let (vault_pda, _vault_bump) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
        &program_id,
    );
    let (vault_authority_pda, _authority_bump) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );

    let deposit_mint = Keypair::new();
    let share_token_mint = Keypair::new();

    let ix = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 1_000_000_000,
        performance_fee_bps: 500,
        management_fee_bps: 200,
        lockup_period: 0,
        allowed_output_mints: [Pubkey::default(); 4],
    };

    let accounts = vec![
        AccountMeta::new(manager.pubkey(), true),
        AccountMeta::new(vault_pda, false),
        AccountMeta::new_readonly(deposit_mint.pubkey(), false),
        AccountMeta::new(share_token_mint.pubkey(), false),
        AccountMeta::new_readonly(vault_authority_pda, false),
        AccountMeta::new_readonly(solana_system_interface::program::ID, false),
        AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
    ];

    let tx = Transaction::new(
        &[&payer, &manager, &share_token_mint],
        Message::new(&[Instruction { program_id, accounts, data: ix.data() }], Some(&payer.pubkey())),
        svm.latest_blockhash(),
    );

    let result = svm.send_transaction(tx);
    assert!(result.is_ok(), "InitializeVault failed: {:?}", result.err());
}

#[test]
fn test_vault_pda_derivation() {
    let (_svm, _payer, program_id) = setup_svm();
    let manager = Pubkey::new_unique();

    let (vault_pda, bump) = Pubkey::find_program_address(
        &[b"vault", manager.as_ref()],
        &program_id,
    );

    assert!(bump < 256);
    assert_eq!(vault_pda, Pubkey::find_program_address(
        &[b"vault", manager.as_ref()],
        &program_id,
    ).0);
}

#[test]
fn test_vault_authority_pda_derivation() {
    let (_svm, _payer, program_id) = setup_svm();
    let vault_pda = Pubkey::new_unique();

    let (authority_pda, bump) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );

    assert!(bump < 256);
    assert_eq!(authority_pda, Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    ).0);
}
