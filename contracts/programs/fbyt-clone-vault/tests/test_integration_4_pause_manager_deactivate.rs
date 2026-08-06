mod common;

use anchor_lang::InstructionData;
use common::*;
use fbyt_clone_vault::state::VaultStatusCode;
use litesvm::LiteSVM;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

fn deactivate_vault(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: &Pubkey,
) -> Result<(), String> {
    let data = fbyt_clone_vault::instruction::DeactivateVault {};
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(*vault_pda, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

// Bundle of mint/atas/PDAs needed to deposit into a vault (min_raise = 0, lockup = 0).
struct DepositSetup {
    vault_pda: Pubkey,
    vault_authority_pda: Pubkey,
    vault_deposit_ata: Pubkey,
    deposit_mint: Pubkey,
    share_token_mint: Pubkey,
    depositor: Keypair,
    depositor_deposit_ata: Pubkey,
    investor_share_ata: Pubkey,
}

// Returns (DepositSetup, vault_pda, share_token_mint)
fn setup_deposit(svm: &mut LiteSVM, manager: &Keypair, deposit_mint: &Pubkey) -> DepositSetup {
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault_with_params(svm, manager, deposit_mint, 0, 1000, 500, 0);

    let vault_deposit_ata = create_ata(svm, manager, deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(svm, &depositor, deposit_mint, &depositor.pubkey());
    mint_tokens(svm, manager, deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    DepositSetup {
        vault_pda,
        vault_authority_pda,
        vault_deposit_ata,
        deposit_mint: *deposit_mint,
        share_token_mint,
        depositor,
        depositor_deposit_ata,
        investor_share_ata,
    }
}

fn do_deposit(svm: &mut LiteSVM, s: &DepositSetup, amount: u64) -> Result<(), String> {
    deposit(
        svm,
        &s.depositor,
        s.vault_pda,
        s.vault_authority_pda,
        s.depositor_deposit_ata,
        s.vault_deposit_ata,
        s.deposit_mint,
        s.share_token_mint,
        s.investor_share_ata,
        amount,
    )
}

fn do_withdraw(svm: &mut LiteSVM, s: &DepositSetup, shares: u64) -> Result<(), String> {
    withdraw(
        svm,
        &s.depositor,
        s.vault_pda,
        s.vault_authority_pda,
        s.depositor_deposit_ata,
        s.deposit_mint,
        s.vault_deposit_ata,
        s.share_token_mint,
        s.investor_share_ata,
        shares,
    )
}

fn new_random(svm: &mut LiteSVM) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    kp
}

// 3.5 Pause/Unpause
#[test]
fn test_pause_success() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _va, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    let res = pause_vault(&mut svm, &manager, &vault_pda, true);
    assert!(res.is_ok(), "Expected pause to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(vault.is_paused);
}

#[test]
fn test_unpause_success() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();

    let res = pause_vault(&mut svm, &manager, &vault_pda, false);
    assert!(res.is_ok(), "Expected unpause to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(!vault.is_paused);
}

#[test]
fn test_pause_already_paused_idempotent() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();

    let res = pause_vault(&mut svm, &manager, &vault_pda, true);
    assert!(res.is_ok(), "Expected pausing an already-paused vault to be idempotent: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(vault.is_paused);
}

#[test]
fn test_unpause_when_not_paused_idempotent() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    let res = pause_vault(&mut svm, &manager, &vault_pda, false);
    assert!(res.is_ok(), "Expected unpause of an unpaused vault to be idempotent: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(!vault.is_paused);
}

#[test]
fn test_pause_wrong_manager() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    let intruder = new_random(&mut svm);
    let res = pause_vault(&mut svm, &intruder, &vault_pda, true);
    assert!(res.is_err(), "Expected non-manager pause to be rejected");
}

#[test]
fn test_unpause_wrong_manager() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();

    let intruder = new_random(&mut svm);
    let res = pause_vault(&mut svm, &intruder, &vault_pda, false);
    assert!(res.is_err(), "Expected non-manager unpause to be rejected");
}

#[test]
fn test_deposit_blocked_when_paused() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    pause_vault(&mut svm, &manager, &s.vault_pda, true).unwrap();

    let res = do_deposit(&mut svm, &s, 1_000_000_000);
    assert!(res.is_err(), "Expected deposit to be blocked while paused");
}

#[test]
fn test_withdraw_blocked_when_paused() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    do_deposit(&mut svm, &s, 1_000_000_000).unwrap();

    pause_vault(&mut svm, &manager, &s.vault_pda, true).unwrap();

    let res = do_withdraw(&mut svm, &s, 500_000_000);
    assert!(res.is_err(), "Expected withdrawal to be blocked while paused");
}

// 3.6 Manager Rotation
#[test]
fn test_set_pending_manager_success() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    let res = set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey());
    assert!(res.is_ok(), "Expected set_pending_manager to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.pending_manager, Some(manager_b.pubkey()));
}

#[test]
fn test_accept_manager_success() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();

    let res = accept_manager(&mut svm, &manager_b, &vault_pda);
    assert!(res.is_ok(), "Expected accept_manager to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.manager, manager_b.pubkey());
}

#[test]
fn test_accept_manager_wrong_signer() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();

    let intruder = new_random(&mut svm);
    let res = accept_manager(&mut svm, &intruder, &vault_pda);
    assert!(res.is_err(), "Expected non-pending signer to be rejected");
}

#[test]
fn test_old_manager_rejected_after_rotation() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();
    accept_manager(&mut svm, &manager_b, &vault_pda).unwrap();

    let res = pause_vault(&mut svm, &manager_a, &vault_pda, true);
    assert!(res.is_err(), "Expected old manager to be rejected after rotation");
}

#[test]
fn test_pending_manager_cleared_after_accept() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();
    accept_manager(&mut svm, &manager_b, &vault_pda).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.pending_manager, None);
}

#[test]
fn test_set_pending_wrong_manager() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let intruder = new_random(&mut svm);
    let target = new_random(&mut svm);
    let res = set_pending_manager(&mut svm, &intruder, &vault_pda, target.pubkey());
    assert!(res.is_err(), "Expected non-manager set_pending to be rejected");
}

#[test]
fn test_double_rotation_overwrites_pending() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = new_random(&mut svm);
    let manager_a_2 = new_random(&mut svm);
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_a_2.pubkey()).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.pending_manager, Some(manager_a_2.pubkey()));
}

#[test]
fn test_cannot_accept_without_pending() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let fresh = new_random(&mut svm);
    let res = accept_manager(&mut svm, &fresh, &vault_pda);
    assert!(res.is_err(), "Expected accept_manager to fail with no pending manager");
}

// 3.7 Deactivate Vault
#[test]
fn test_deactivate_success() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    do_deposit(&mut svm, &s, 1_000_000_000).unwrap();
    activate_vault(&mut svm, &manager, &s.vault_pda).unwrap();
    assert_eq!(get_vault_state(&svm, &s.vault_pda).status, VaultStatusCode::Active);

    let res = deactivate_vault(&mut svm, &manager, &s.vault_pda);
    assert!(res.is_ok(), "Expected deactivate to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &s.vault_pda);
    assert_eq!(vault.status, VaultStatusCode::Dormant);
}

#[test]
fn test_deactivate_from_fundraising_rejected() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, _, _sm) = initialize_vault(&mut svm, &manager, &deposit_mint);

    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Fundraising);

    let res = deactivate_vault(&mut svm, &manager, &vault_pda);
    assert!(res.is_err(), "Expected deactivate of a fundraising vault to be rejected");
}

#[test]
fn test_deactivate_wrong_manager() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    do_deposit(&mut svm, &s, 1_000_000_000).unwrap();
    activate_vault(&mut svm, &manager, &s.vault_pda).unwrap();

    let intruder = new_random(&mut svm);
    let res = deactivate_vault(&mut svm, &intruder, &s.vault_pda);
    assert!(res.is_err(), "Expected non-manager deactivate to be rejected");
}

#[test]
fn test_deactivate_already_dormant() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    do_deposit(&mut svm, &s, 1_000_000_000).unwrap();
    activate_vault(&mut svm, &manager, &s.vault_pda).unwrap();
    deactivate_vault(&mut svm, &manager, &s.vault_pda).unwrap();
    assert_eq!(get_vault_state(&svm, &s.vault_pda).status, VaultStatusCode::Dormant);

    let res = deactivate_vault(&mut svm, &manager, &s.vault_pda);
    assert!(res.is_err(), "Expected re-deactivate of a dormant vault to be rejected");
}

#[test]
fn test_deposit_rejected_after_deactivate() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let s = setup_deposit(&mut svm, &manager, &deposit_mint);

    do_deposit(&mut svm, &s, 500_000_000).unwrap();
    activate_vault(&mut svm, &manager, &s.vault_pda).unwrap();
    deactivate_vault(&mut svm, &manager, &s.vault_pda).unwrap();

    let res = do_deposit(&mut svm, &s, 1_000_000_000);
    assert!(res.is_err(), "Expected deposit into a deactivated vault to be rejected");
}