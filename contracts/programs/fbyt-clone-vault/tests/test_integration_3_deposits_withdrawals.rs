mod common;

use common::*;
use fbyt_clone_vault::state::VaultStatusCode;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
// NOTE on skipped vs handled cases:
// The original plan claimed deposits are rejected while Fundraising. Real
// behavior (deposit.rs) only gates on `status != Dormant` and `!is_paused`, so
// deposits ARE allowed in both Fundraising and Active. There is no
// deactivate_vault() helper, so driving the vault into `Dormant` is not
// feasible via the public flows. Consequently
// "deposit_when_fundraising_rejected" / "deposit_when_dormant_rejected" do not
// apply; instead meaningful rejected-deposit tests are implemented (paused,
// zero amount, wrong deposit mint, wrong share mint). The suite still covers the
// spirit with 15 deposit + 15 withdraw tests.

fn share_ata(owner: &Pubkey, share_token_mint: &Pubkey) -> Pubkey {
    common::ata(owner, share_token_mint)
}

fn new_depositor(svm: &mut litesvm::LiteSVM, payer: &Keypair, deposit_mint: &Pubkey) -> (Keypair, Pubkey) {
    let d = Keypair::new();
    svm.airdrop(&d.pubkey(), 10_000_000_000).unwrap();
    let ata = create_ata(svm, payer, deposit_mint, &d.pubkey());
    mint_tokens(svm, payer, deposit_mint, &ata, 10_000_000_000);
    (d, ata)
}

fn new_depositor_rich(
    svm: &mut litesvm::LiteSVM,
    payer: &Keypair,
    deposit_mint: &Pubkey,
    token_amount: u64,
) -> (Keypair, Pubkey) {
    let d = Keypair::new();
    svm.airdrop(&d.pubkey(), 10_000_000_000_000).unwrap();
    let ata = create_ata(svm, payer, deposit_mint, &d.pubkey());
    mint_tokens(svm, payer, deposit_mint, &ata, token_amount);
    (d, ata)
}

fn spl_balance(svm: &litesvm::LiteSVM, ata: &Pubkey) -> u64 {
    common::token_balance(svm, ata)
}

//============================================================================
// DEPOSITS (15)
//============================================================================

#[test]
fn test_deposit_when_paused_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();

    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        1_000_000_000,
    );
    assert!(res.is_err(), "Expected deposit to be rejected while paused");
}

#[test]
fn test_deposit_zero_amount_rejected() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);

    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        0,
    );
    assert!(res.is_err(), "Expected zero-amount deposit to be rejected");
}

#[test]
fn test_deposit_wrong_mint_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let wrong_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    let wrong_vault_ata = create_ata(&mut svm, &manager, &wrong_mint, &vault_authority_pda);
    let (depositor, wrong_depositor_ata) = new_depositor(&mut svm, &manager, &wrong_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);

    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        wrong_depositor_ata,
        wrong_vault_ata,
        wrong_mint,
        share_token_mint,
        investor_share_ata,
        1_000_000_000,
    );
    assert!(res.is_err(), "Expected deposit with wrong mint to be rejected");
}

#[test]
fn test_deposit_wrong_share_mint_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, _real_share) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let wrong_share_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let wrong_share_ata = create_ata(&mut svm, &depositor, &wrong_share_mint, &depositor.pubkey());

    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        wrong_share_mint,
        wrong_share_ata,
        1_000_000_000,
    );
    assert!(res.is_err(), "Expected deposit with wrong share mint to be rejected");
}

#[test]
fn test_deposit_sequential_5_users() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let per = 1_000_000_000u64;
    let depositors: Vec<(Keypair, Pubkey)> = (0..5)
        .map(|_| new_depositor(&mut svm, &manager, &deposit_mint))
        .collect();

    for (d, d_ata) in &depositors {
        deposit(
            &mut svm,
            d,
            vault_pda,
            vault_authority_pda,
            *d_ata,
            vault_deposit_ata,
            deposit_mint,
            share_token_mint,
            share_ata(&d.pubkey(), &share_token_mint),
            per,
        )
        .unwrap();
    }

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, 5 * per);
    assert_eq!(vault.total_shares_minted, 5 * per);

    for (d, _) in &depositors {
        let d_shares = common::token_balance(&svm, &share_ata(&d.pubkey(), &share_token_mint));
        assert_eq!(d_shares, per);
    }
}

#[test]
fn test_deposit_after_profit_reflects_nav() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let first = 1_000_000_000u64;
    let (d1, d1_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d1,
        vault_pda,
        vault_authority_pda,
        d1_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d1.pubkey(), &share_token_mint),
        first,
    )
    .unwrap();

    // Simulate 50% profit -> NAV 1.5
    set_vault_total_assets(&mut svm, &vault_pda, first + first / 2);

    // Same deposit size now mints FEWER shares because NAV > 1.
    let (d2, d2_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d2,
        vault_pda,
        vault_authority_pda,
        d2_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d2.pubkey(), &share_token_mint),
        first,
    )
    .unwrap();

    let d2_shares = common::token_balance(&svm, &share_ata(&d2.pubkey(), &share_token_mint));
    assert!(d2_shares < first, "Higher NAV should mint fewer shares than deposit");
}

#[test]
fn test_deposit_nav_at_2_half_shares_minted() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let d0 = 1_000_000_000u64;
    let (d1, d1_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d1,
        vault_pda,
        vault_authority_pda,
        d1_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d1.pubkey(), &share_token_mint),
        d0,
    )
    .unwrap();

    // NAV doubles to 2.
    set_vault_total_assets(&mut svm, &vault_pda, 2 * d0);

    let (d2, d2_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d2,
        vault_pda,
        vault_authority_pda,
        d2_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d2.pubkey(), &share_token_mint),
        d0,
    )
    .unwrap();

    // shares minted = d0 * shares / assets = d0 * d0 / (2*d0) = d0/2.
    let d2_shares = common::token_balance(&svm, &share_ata(&d2.pubkey(), &share_token_mint));
    assert_eq!(d2_shares, d0 / 2);
}

#[test]
fn test_deposit_nav_at_0_5_double_shares_minted() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let d0 = 1_000_000_000u64;
    let (d1, d1_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d1,
        vault_pda,
        vault_authority_pda,
        d1_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d1.pubkey(), &share_token_mint),
        d0,
    )
    .unwrap();

    // NAV halves to assets = d0/2.
    set_vault_total_assets(&mut svm, &vault_pda, d0 / 2);

    let (d2, d2_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &d2,
        vault_pda,
        vault_authority_pda,
        d2_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&d2.pubkey(), &share_token_mint),
        d0,
    )
    .unwrap();

    // shares = d0 * d0 / (d0/2) = 2*d0.
    let d2_shares = common::token_balance(&svm, &share_ata(&d2.pubkey(), &share_token_mint));
    assert_eq!(d2_shares, 2 * d0);
}

#[test]
fn test_deposit_mint_correct_share_token_amount() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 777_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();

    let investor_shares = common::token_balance(&svm, &investor_share_ata);
    assert_eq!(investor_shares, amt);
}

#[test]
fn test_deposit_then_withdraw_same_user() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();

    let before = spl_balance(&svm, &depositor_deposit_ata);
    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();
    let after = spl_balance(&svm, &depositor_deposit_ata);
    // Pro-rata 1:1: full deposit comes back.
    assert_eq!(after.saturating_sub(before), amt);
}

#[test]
fn test_deposit_updates_vault_state() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 500_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, amt);
    assert_eq!(vault.total_shares_minted, amt);
}

#[test]
fn test_deposit_large_amount_success() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let big = 1_000_000_000_000u64; // 1e12
    let (depositor, depositor_deposit_ata) = new_depositor_rich(&mut svm, &manager, &deposit_mint, big);

    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        big,
    );
    assert!(res.is_ok(), "Large deposit failed: {:?}", res.err());
    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, big);
    assert_eq!(vault.total_shares_minted, big);
}

#[test]
fn test_deposit_sequential_verify_nav_constant() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let per = 250_000_000u64;
    for _ in 0..5 {
        let (d, d_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
        deposit(
            &mut svm,
            &d,
            vault_pda,
            vault_authority_pda,
            d_ata,
            vault_deposit_ata,
            deposit_mint,
            share_token_mint,
            share_ata(&d.pubkey(), &share_token_mint),
            per,
        )
        .unwrap();
        let vault = get_vault_state(&svm, &vault_pda);
        // NAV stays ~1.0 -> assets == shares after every deposit.
        assert_eq!(vault.total_assets_deposited, vault.total_shares_minted);
    }
}

#[test]
fn test_deposit_bootstrap_first_deposit_mints_1to1() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 123_456_789u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();

    let investor_share = common::token_balance(&svm, &investor_share_ata);
    assert_eq!(investor_share, amt); // bootstrap is 1:1.
}

#[test]
fn test_deposit_when_active_succeeds() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    activate_vault(&mut svm, &manager, &vault_pda).unwrap();
    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.status, VaultStatusCode::Active);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    );
    assert!(res.is_ok(), "Deposit into active vault failed: {:?}", res.err());
}

//============================================================================
// WITHDRAWALS (15)
//============================================================================

#[test]
fn test_withdraw_all_shares() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let investor_share_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();

    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        amt,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.total_shares_minted, 0);
}

#[test]
fn test_withdraw_half_shares() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    )
    .unwrap();

    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt / 2,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, amt - amt / 2);
    assert_eq!(vault.total_shares_minted, amt - amt / 2);
}

#[test]
fn test_withdraw_zero_shares_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        0,
    );
    assert!(res.is_err(), "Expected zero-share withdrawal to be rejected");
}

#[test]
fn test_withdraw_more_than_balance_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        amt * 2,
    );
    assert!(res.is_err(), "Expected over-balance withdrawal to be rejected");
}

#[test]
fn test_withdraw_before_lockup_fails() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup: i64 = 86400;
    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, lockup,
    );
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    )
    .unwrap();

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt / 2,
    );
    assert!(res.is_err(), "Expected withdrawal to fail during lockup");
}

#[test]
fn test_withdraw_exactly_at_lockup_expiry() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup: i64 = 86400;
    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, lockup,
    );
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    let mut clock: anchor_lang::solana_program::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp = vault.created_at + lockup;
    svm.set_sysvar(&clock);

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt / 2,
    );
    assert!(res.is_ok(), "Withdraw at exact expiry failed: {:?}", res.err());
}

#[test]
fn test_withdraw_1_second_before_lockup_fails() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup: i64 = 86400;
    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, lockup,
    );
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    let mut clock: anchor_lang::solana_program::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp = vault.created_at + lockup - 1;
    svm.set_sysvar(&clock);

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        share_ata(&depositor.pubkey(), &share_token_mint),
        amt / 2,
    );
    assert!(res.is_err(), "Expected withdrawal 1s before expiry to fail");
}

#[test]
fn test_withdraw_when_paused_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        amt / 2,
    );
    assert!(res.is_err(), "Expected withdrawal to fail when paused");
}

#[test]
fn test_withdraw_wrong_share_mint_rejected() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, _real_share) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let wrong_share_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let wrong_share_ata = create_ata(&mut svm, &depositor, &wrong_share_mint, &depositor.pubkey());

    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        wrong_share_mint,
        wrong_share_ata,
        100_000_000,
    );
    assert!(res.is_err(), "Expected withdrawal with wrong share mint to be rejected");
}

#[test]
fn test_withdraw_pro_rata_after_profit() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    // NAV = 3x: bump the ledger total AND mint actual tokens into the vault ATA
    // so the CPI payout does not trip InsufficientVaultBalance.
    set_vault_total_assets(&mut svm, &vault_pda, 3 * amt);
    mint_tokens(&mut svm, &manager, &deposit_mint, &vault_deposit_ata, 2 * amt);

    let before = spl_balance(&svm, &depositor_deposit_ata);
    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();
    let after = spl_balance(&svm, &depositor_deposit_ata);
    // amount_out = shares * assets / shares = amt * 3.
    assert_eq!(after.saturating_sub(before), 3 * amt);
}

#[test]
fn test_withdraw_sequential_5_users() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let per = 1_000_000_000u64;
    let mut users: Vec<(Keypair, Pubkey, Pubkey)> = Vec::new();
    for _ in 0..5 {
        let (d, d_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
        let s_ata = share_ata(&d.pubkey(), &share_token_mint);
        deposit(
            &mut svm,
            &d,
            vault_pda,
            vault_authority_pda,
            d_ata,
            vault_deposit_ata,
            deposit_mint,
            share_token_mint,
            s_ata,
            per,
        )
        .unwrap();
        users.push((d, d_ata, s_ata));
    }

    for (d, d_ata, s_ata) in &users {
        withdraw(
            &mut svm,
            d,
            vault_pda,
            vault_authority_pda,
            *d_ata,
            deposit_mint,
            vault_deposit_ata,
            share_token_mint,
            *s_ata,
            per,
        )
        .unwrap();
    }

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.total_shares_minted, 0);
}

#[test]
fn test_withdraw_minimum_1_share() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    // Withdrawing exactly 1 share must not panic and must produce a payout.
    let res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        1,
    );
    assert!(res.is_ok(), "1-share withdrawal should succeed: {:?}", res.err());
}

#[test]
fn test_withdraw_updates_vault_state() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    let burn = amt / 4;
    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        burn,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_shares_minted, amt - burn);
    assert_eq!(vault.total_assets_deposited, amt - burn);
}

#[test]
fn test_withdraw_burns_share_tokens() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    let burn = amt / 2;
    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        burn,
    )
    .unwrap();

    let s_balance = common::token_balance(&svm, &s_ata);
    assert_eq!(s_balance, amt - burn);
}

#[test]
fn test_withdraw_drains_vault_fully() {
    let (mut svm, manager, _) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);
    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let amt = 1_000_000_000u64;
    let (depositor, depositor_deposit_ata) = new_depositor(&mut svm, &manager, &deposit_mint);
    let s_ata = share_ata(&depositor.pubkey(), &share_token_mint);
    deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        s_ata,
        amt,
    )
    .unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.total_shares_minted, 0);

    let s_balance = common::token_balance(&svm, &s_ata);
    assert_eq!(s_balance, 0);
}
