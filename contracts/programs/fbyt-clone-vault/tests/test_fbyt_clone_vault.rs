mod common;

use common::*;
use fbyt_clone_vault::state::VaultStatusCode;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_instruction::{AccountMeta, Instruction};
use anchor_lang::InstructionData;
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

#[test]
fn test_initialize_vault() {
    let (mut svm, payer, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault(&mut svm, &payer, &deposit_mint);

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.manager, payer.pubkey());
    assert_eq!(vault.deposit_mint, deposit_mint);
    assert_eq!(vault.performance_fee_bps, 1000);
    assert_eq!(vault.management_fee_bps, 500);
    assert_eq!(vault.total_shares_minted, 0);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.status, VaultStatusCode::Fundraising);
}

#[test]
fn test_deposit_and_withdraw() {
    let (mut svm, payer, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &payer, &deposit_mint);

    let _payer_deposit_ata = create_ata(&mut svm, &payer, &deposit_mint, &payer.pubkey());
    let vault_deposit_ata =
        create_ata(&mut svm, &payer, &deposit_mint, &vault_authority_pda);

    let deposit_amount: u64 = 1_000_000_000;

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata =
        create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(
        &mut svm,
        &payer,
        &deposit_mint,
        &depositor_deposit_ata,
        10_000_000_000,
    );

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    let dep_res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        deposit_amount,
    );
    assert!(dep_res.is_ok(), "Deposit failed: {:?}", dep_res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, deposit_amount);
    assert_eq!(vault.total_shares_minted, deposit_amount);

    let share_balance = common::token_balance(&svm, &investor_share_ata);
    assert_eq!(share_balance, deposit_amount);

    let withdraw_amount = deposit_amount / 2;
    let with_res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        withdraw_amount,
    );
    assert!(with_res.is_ok(), "Withdraw failed: {:?}", with_res.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(
        vault.total_assets_deposited,
        deposit_amount - withdraw_amount
    );
    assert_eq!(
        vault.total_shares_minted,
        deposit_amount - withdraw_amount
    );

    let share_balance = common::token_balance(&svm, &investor_share_ata);
    assert_eq!(share_balance, deposit_amount - withdraw_amount);
}

#[test]
fn test_activate_vault() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm,
        &manager,
        &deposit_mint,
        min_raise_amount,
        1000,
        500,
        0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    // Deposit partial amount (500_000_000 < min_raise_amount)
    let dep_res1 = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(dep_res1.is_ok());

    // Activation before meeting min raise must fail (MinRaiseNotMet)
    let act_res1 = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res1.is_err(), "Expected activation to fail when min raise is not met");

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.status, VaultStatusCode::Fundraising);

    // Deposit remaining amount to reach min_raise_amount
    let dep_res2 = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(dep_res2.is_ok());

    // Activation after meeting min raise must succeed
    let act_res2 = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res2.is_ok(), "Expected activation to succeed: {:?}", act_res2.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.status, VaultStatusCode::Active);
}

#[test]
fn test_lockup_enforcement_on_withdrawal() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup_period: i64 = 86400; // 1 day in seconds

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm,
        &manager,
        &deposit_mint,
        0,
        1000,
        500,
        lockup_period,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    let deposit_amount = 1_000_000_000;
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
        deposit_amount,
    ).unwrap();

    // Immediate withdrawal during lockup period must fail (LockupActive)
    let withdraw_res_before = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(withdraw_res_before.is_err(), "Expected withdrawal to fail during lockup period");

    // Advance clock past the lockup period
    let mut clock: anchor_lang::solana_program::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp += lockup_period + 10;
    svm.set_sysvar(&clock);

    // Withdrawal after lockup period must succeed
    let withdraw_res_after = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(withdraw_res_after.is_ok(), "Expected withdrawal to succeed after lockup period: {:?}", withdraw_res_after.err());
}

#[test]
fn test_fee_cap_enforcement_on_initialization() {
    let (mut svm, manager, program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    // Fee > 10000 bps (performance 6000 + management 5000 = 11000) must fail (FeeTooHigh)
    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
        &program_id,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );
    let share_token_mint = Keypair::new();

    let data_invalid = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 6000,
        management_fee_bps: 5000,
        lockup_period: 0,
        allowed_output_mints: [Pubkey::default(); 4],
    };
    let ix_invalid = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data_invalid.data(),
    };
    let res_invalid = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix_invalid],
    );
    assert!(res_invalid.is_err(), "Expected initialization to fail when combined fees exceed 10000 bps");

    // Fee == 10000 bps (performance 5000 + management 5000) must succeed
    let share_token_mint_valid = Keypair::new();
    let data_valid = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 5000,
        management_fee_bps: 5000,
        lockup_period: 0,
        allowed_output_mints: [Pubkey::default(); 4],
    };
    let ix_valid = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint_valid.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data_valid.data(),
    };
    let res_valid = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint_valid as &dyn Signer],
        &[ix_valid],
    );
    assert!(res_valid.is_ok(), "Expected initialization to succeed with fee cap of 10000 bps: {:?}", res_valid.err());
}

#[test]
fn test_zero_amount_edge_cases() {
    let (mut svm, payer, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &payer, &deposit_mint);

    let payer_deposit_ata = create_ata(&mut svm, &payer, &deposit_mint, &payer.pubkey());
    let vault_deposit_ata =
        create_ata(&mut svm, &payer, &deposit_mint, &vault_authority_pda);
    mint_tokens(&mut svm, &payer, &deposit_mint, &payer_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&payer.pubkey(), &share_token_mint);

    // 1. Zero amount deposit should fail
    let zero_dep_res = deposit(
        &mut svm,
        &payer,
        vault_pda,
        vault_authority_pda,
        payer_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        0,
    );
    assert!(zero_dep_res.is_err(), "Expected zero deposit to fail");

    // Perform valid deposit to mint shares
    let valid_dep_res = deposit(
        &mut svm,
        &payer,
        vault_pda,
        vault_authority_pda,
        payer_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        investor_share_ata,
        1_000_000_000,
    );
    assert!(valid_dep_res.is_ok());

    // 2. Zero amount withdrawal should fail
    let zero_with_res = withdraw(
        &mut svm,
        &payer,
        vault_pda,
        vault_authority_pda,
        payer_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        0,
    );
    assert!(zero_with_res.is_err(), "Expected zero withdrawal to fail");
}

#[test]
fn test_rejects_double_init() {
    let (mut svm, payer, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    initialize_vault(&mut svm, &payer, &deposit_mint);

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", payer.pubkey().as_ref()],
        &fbyt_clone_vault::ID,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &fbyt_clone_vault::ID,
    );
    let share_token_mint = Keypair::new();

    let data = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 1000,
        management_fee_bps: 500,
        lockup_period: 0,
        allowed_output_mints: [Pubkey::default(); 4],
    };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    let result = send_tx(
        &mut svm,
        &[&payer as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix],
    );
    assert!(result.is_err(), "Expected double init to fail");
}

#[test]
fn test_deposit_rejects_wrong_share_mint() {
    let (mut svm, payer, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let (vault_pda, vault_authority_pda, _real_share_mint) =
        initialize_vault(&mut svm, &payer, &deposit_mint);

    let vault_deposit_ata = create_ata(&mut svm, &payer, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &payer, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    // Create a fake/wrong share mint
    let wrong_share_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let investor_wrong_share_ata = create_ata(&mut svm, &depositor, &wrong_share_mint, &depositor.pubkey());

    let dep_res = deposit(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        vault_deposit_ata,
        deposit_mint,
        wrong_share_mint,
        investor_wrong_share_ata,
        1_000_000_000,
    );
    assert!(dep_res.is_err(), "Expected deposit to reject wrong share mint");
}

#[test]
fn test_trade_rejects_non_manager() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, vault_authority_pda, _share_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    activate_vault(&mut svm, &manager, &vault_pda).unwrap();

    let vault_input_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let vault_output_ata = create_ata(&mut svm, &manager, &output_mint, &vault_authority_pda);
    let dummy_price_update = Pubkey::new_unique();

    let non_manager = Keypair::new();
    svm.airdrop(&non_manager.pubkey(), 10_000_000_000).unwrap();

    let trade_res = execute_trade_pyth(
        &mut svm,
        &non_manager,
        vault_pda,
        vault_authority_pda,
        vault_input_ata,
        deposit_mint,
        vault_output_ata,
        output_mint,
        dummy_price_update,
        1_000_000,
        900_000,
    );
    assert!(trade_res.is_err(), "Expected trade to be rejected for non-manager");
}

#[test]
fn test_second_deposit_share_ratio_correct() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    // Depositor 1 deposits 1,000,000 tokens
    let depositor1 = Keypair::new();
    svm.airdrop(&depositor1.pubkey(), 10_000_000_000).unwrap();
    let dep1_ata = create_ata(&mut svm, &depositor1, &deposit_mint, &depositor1.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &dep1_ata, 10_000_000_000);

    let dep1_share_ata = common::ata(&depositor1.pubkey(), &share_token_mint);
    let first_deposit_amount = 1_000_000_000;
    deposit(
        &mut svm,
        &depositor1,
        vault_pda,
        vault_authority_pda,
        dep1_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        dep1_share_ata,
        first_deposit_amount,
    ).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_assets_deposited, first_deposit_amount);
    assert_eq!(vault.total_shares_minted, first_deposit_amount);

    // Simulate vault asset doubling (e.g. trading gains so NAV increases)
    let doubled_assets = first_deposit_amount * 2;
    set_vault_total_assets(&mut svm, &vault_pda, doubled_assets);

    // Depositor 2 deposits 1,000,000 tokens
    let depositor2 = Keypair::new();
    svm.airdrop(&depositor2.pubkey(), 10_000_000_000).unwrap();
    let dep2_ata = create_ata(&mut svm, &depositor2, &deposit_mint, &depositor2.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &dep2_ata, 10_000_000_000);

    let dep2_share_ata = common::ata(&depositor2.pubkey(), &share_token_mint);
    let second_deposit_amount = 1_000_000_000;
    deposit(
        &mut svm,
        &depositor2,
        vault_pda,
        vault_authority_pda,
        dep2_ata,
        vault_deposit_ata,
        deposit_mint,
        share_token_mint,
        dep2_share_ata,
        second_deposit_amount,
    ).unwrap();

    // Expected shares for Depositor 2 = (1_000_000_000 * 1_000_000_000) / 2_000_000_000 = 500_000_000
    let expected_dep2_shares = 500_000_000;
    let dep2_share_balance = common::token_balance(&svm, &dep2_share_ata);
    assert_eq!(dep2_share_balance, expected_dep2_shares);

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.total_shares_minted, first_deposit_amount + expected_dep2_shares);
    assert_eq!(vault.total_assets_deposited, doubled_assets + second_deposit_amount);
}

#[test]
fn test_pause_and_unpause_vault() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    // Pause vault
    let pause_res = pause_vault(&mut svm, &manager, &vault_pda, true);
    assert!(pause_res.is_ok());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(vault.is_paused);

    // Deposit while paused must fail
    let dep_res = deposit(
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
    assert!(dep_res.is_err(), "Expected deposit to fail when vault is paused");

    // Unauthorized pause attempt must fail
    let pause_unauth = pause_vault(&mut svm, &depositor, &vault_pda, false);
    assert!(pause_unauth.is_err(), "Expected unauthorized pause to fail");

    // Unpause vault by manager
    let unpause_res = pause_vault(&mut svm, &manager, &vault_pda, false);
    assert!(unpause_res.is_ok());

    let vault = get_vault_state(&svm, &vault_pda);
    assert!(!vault.is_paused);

    // Deposit after unpausing must succeed
    let dep_res_after = deposit(
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
    assert!(dep_res_after.is_ok(), "Expected deposit to succeed after unpausing: {:?}", dep_res_after.err());
}

#[test]
fn test_manager_rotation_two_step() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let (vault_pda, _vault_authority_pda, _share_token_mint) =
        initialize_vault(&mut svm, &manager_a, &deposit_mint);

    let manager_b = Keypair::new();
    svm.airdrop(&manager_b.pubkey(), 10_000_000_000).unwrap();

    let random_user = Keypair::new();
    svm.airdrop(&random_user.pubkey(), 10_000_000_000).unwrap();

    // Step 1: Manager A sets pending manager to Manager B
    let set_pending_res = set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey());
    assert!(set_pending_res.is_ok());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.pending_manager, Some(manager_b.pubkey()));

    // Random user tries to accept manager -> must fail
    let unauth_accept = accept_manager(&mut svm, &random_user, &vault_pda);
    assert!(unauth_accept.is_err(), "Expected accept_manager to fail for unauthorized user");

    // Step 2: Manager B accepts manager role
    let accept_res = accept_manager(&mut svm, &manager_b, &vault_pda);
    assert!(accept_res.is_ok());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.manager, manager_b.pubkey());
    assert_eq!(vault.pending_manager, None);

    // Manager A can no longer manage vault
    let old_mgr_pause = pause_vault(&mut svm, &manager_a, &vault_pda, true);
    assert!(old_mgr_pause.is_err(), "Expected old manager to be unauthorized");

    // Manager B can now manage vault
    let new_mgr_pause = pause_vault(&mut svm, &manager_b, &vault_pda, true);
    assert!(new_mgr_pause.is_ok(), "Expected new manager to pause vault successfully");
}

#[test]
fn test_collect_fees_accrual() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, _share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let manager_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &manager.pubkey());

    // Mint tokens directly to vault deposit ATA to simulate vault funds
    mint_tokens(&mut svm, &manager, &deposit_mint, &vault_deposit_ata, 10_000_000_000);

    let performance_fee = 100_000_000;
    let management_fee = 50_000_000;
    let total_fees = performance_fee + management_fee;

    // Accrue fees into vault state
    set_vault_accrued_fees(&mut svm, &vault_pda, performance_fee, management_fee);

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.accrued_performance_fee, performance_fee);
    assert_eq!(vault.accrued_management_fee, management_fee);

    // Non-manager fee collection must fail
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();
    let attacker_ata = create_ata(&mut svm, &attacker, &deposit_mint, &attacker.pubkey());

    let unauth_collect = collect_fees(
        &mut svm,
        &attacker,
        vault_pda,
        vault_authority_pda,
        vault_deposit_ata,
        attacker_ata,
        deposit_mint,
    );
    assert!(unauth_collect.is_err(), "Expected non-manager fee collection to fail");

    // Manager collects fees
    let collect_res = collect_fees(
        &mut svm,
        &manager,
        vault_pda,
        vault_authority_pda,
        vault_deposit_ata,
        manager_deposit_ata,
        deposit_mint,
    );
    assert!(collect_res.is_ok(), "Expected fee collection to succeed: {:?}", collect_res.err());

    let manager_balance = common::token_balance(&svm, &manager_deposit_ata);
    assert_eq!(manager_balance, total_fees);

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.accrued_performance_fee, 0);
    assert_eq!(vault.accrued_management_fee, 0);

    // Collecting fees again when 0 fees accrued must fail
    let zero_collect = collect_fees(
        &mut svm,
        &manager,
        vault_pda,
        vault_authority_pda,
        vault_deposit_ata,
        manager_deposit_ata,
        deposit_mint,
    );
    assert!(zero_collect.is_err(), "Expected collection with zero fees to fail");
}

#[test]
fn test_decimal_normalization_in_trades() {
    use fbyt_clone_vault::pyth_price::calculate_amount_out;
    use fbyt_clone_vault::math::fee_math::{calculate_management_fee, calculate_performance_fee};

    // Test Pyth amount out calculation with negative exponent (e.g. Pyth price feed exponent -8)
    // SOL price = $150.00 -> 15_000_000_000 in Pyth (price: 15_000_000_000, expo: -8)
    // Input 1 SOL = 1_000_000_000 lamports
    // Expected output = (1_000_000_000 * 15_000_000_000) / 10^8 = 150_000_000_000 units
    let amount_in = 1_000_000_000u64;
    let price = 15_000_000_000i64;
    let expo = -8i32;
    let amount_out = calculate_amount_out(amount_in, price, expo, 9, 6, false).unwrap();
    assert_eq!(amount_out, 150_000_000);

    // Test with positive exponent
    let pos_out = calculate_amount_out(100, 50, 2, 0, 0, false).unwrap();
    assert_eq!(pos_out, 500_000);

    // Test with zero exponent
    let zero_out = calculate_amount_out(500, 3, 0, 0, 0, false).unwrap();
    assert_eq!(zero_out, 1_500);

    // Test performance fee math (10% fee on 1,000,000 profit = 100,000)
    let perf_fee = calculate_performance_fee(1_000_000, 1000).unwrap();
    assert_eq!(perf_fee, 100_000);

    // Test management fee math (2% annual fee on 10,000,000 total assets for 1 year = 200,000)
    let seconds_per_year = 365 * 86400;
    let mgmt_fee = calculate_management_fee(10_000_000, 200, seconds_per_year).unwrap();
    assert_eq!(mgmt_fee, 200_000);
}

#[test]
fn test_withdraw_at_exact_lockup_expiry() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup_period: i64 = 86400; // 1 day

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm,
        &manager,
        &deposit_mint,
        0,
        1000,
        500,
        lockup_period,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    let deposit_amount = 1_000_000_000;
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
        deposit_amount,
    ).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    let created_at = vault.created_at;

    // Advance clock to exact lockup expiry timestamp (created_at + lockup_period)
    let mut clock: anchor_lang::solana_program::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp = created_at + lockup_period;
    svm.set_sysvar(&clock);

    // Withdrawal at exact expiry must succeed (>= boundary)
    let withdraw_res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(withdraw_res.is_ok(), "Expected withdrawal to succeed at exact lockup expiry: {:?}", withdraw_res.err());
}

#[test]
fn test_withdraw_one_second_before_lockup_fails() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let lockup_period: i64 = 86400; // 1 day

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm,
        &manager,
        &deposit_mint,
        0,
        1000,
        500,
        lockup_period,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

    let deposit_amount = 1_000_000_000;
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
        deposit_amount,
    ).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    let created_at = vault.created_at;

    // Advance clock to 1 second before lockup expiry timestamp
    let mut clock: anchor_lang::solana_program::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp = created_at + lockup_period - 1;
    svm.set_sysvar(&clock);

    // Withdrawal 1 second before expiry must fail
    let withdraw_res = withdraw(
        &mut svm,
        &depositor,
        vault_pda,
        vault_authority_pda,
        depositor_deposit_ata,
        deposit_mint,
        vault_deposit_ata,
        share_token_mint,
        investor_share_ata,
        500_000_000,
    );
    assert!(withdraw_res.is_err(), "Expected withdrawal to fail 1 second before lockup expiry");
}

#[test]
fn test_collect_fees_with_zero_accrued_fails() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let (vault_pda, vault_authority_pda, _share_token_mint) =
        initialize_vault(&mut svm, &manager, &deposit_mint);

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let manager_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &manager.pubkey());

    mint_tokens(&mut svm, &manager, &deposit_mint, &vault_deposit_ata, 10_000_000_000);

    // Explicitly set accrued fees to 0
    set_vault_accrued_fees(&mut svm, &vault_pda, 0, 0);

    let collect_res = collect_fees(
        &mut svm,
        &manager,
        vault_pda,
        vault_authority_pda,
        vault_deposit_ata,
        manager_deposit_ata,
        deposit_mint,
    );
    assert!(collect_res.is_err(), "Expected collect_fees with zero accrued fees to fail");
}

#[test]
fn test_activate_already_active_vault_fails() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm,
        &manager,
        &deposit_mint,
        min_raise_amount,
        1000,
        500,
        0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);

    let investor_share_ata = common::ata(&depositor.pubkey(), &share_token_mint);

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
        min_raise_amount,
    ).unwrap();

    // First activation should succeed
    let act_res1 = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res1.is_ok(), "Expected initial activation to succeed: {:?}", act_res1.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.status, VaultStatusCode::Active);

    // Second activation attempt on already active vault must fail
    let act_res2 = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res2.is_err(), "Expected second activation of an already active vault to fail");
}

#[test]
fn test_old_manager_cannot_trade_after_rotation() {
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());
    let output_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());

    let (vault_pda, vault_authority_pda, _share_mint) =
        initialize_vault(&mut svm, &manager_a, &deposit_mint);

    activate_vault(&mut svm, &manager_a, &vault_pda).unwrap();

    let manager_b = Keypair::new();
    svm.airdrop(&manager_b.pubkey(), 10_000_000_000).unwrap();

    // Step 1: Set pending manager
    set_pending_manager(&mut svm, &manager_a, &vault_pda, manager_b.pubkey()).unwrap();

    // Step 2: Accept manager role
    accept_manager(&mut svm, &manager_b, &vault_pda).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.manager, manager_b.pubkey());

    let vault_input_ata = create_ata(&mut svm, &manager_b, &deposit_mint, &vault_authority_pda);
    let vault_output_ata = create_ata(&mut svm, &manager_b, &output_mint, &vault_authority_pda);
    let dummy_price_update = Pubkey::new_unique();

    // Old manager A attempts to trade after rotation -> must fail
    let old_mgr_trade = execute_trade_pyth(
        &mut svm,
        &manager_a,
        vault_pda,
        vault_authority_pda,
        vault_input_ata,
        deposit_mint,
        vault_output_ata,
        output_mint,
        dummy_price_update,
        1_000_000,
        900_000,
    );
    assert!(old_mgr_trade.is_err(), "Expected old manager trade execution to fail after rotation");
}

#[test]
fn test_math_property_invariants() {
    use fbyt_clone_vault::math::share_math::{calculate_shares_to_mint, calculate_amount_out};

    // Property 1: Minting shares never yields more than pro-rata value (vault favorability)
    for deposit_amt in [1, 100, 999, 1_000_000, 1_000_000_000] {
        for assets in [1_000_000, 2_000_000, 5_000_000] {
            for shares in [1_000_000, 2_000_000, 5_000_000] {
                let minted = calculate_shares_to_mint(deposit_amt, assets, shares).unwrap();
                let lhs = (minted as u128) * (assets as u128);
                let rhs = (deposit_amt as u128) * (shares as u128);
                assert!(lhs <= rhs, "Vault gave more shares than pro-rata!");
            }
        }
    }

    // Property 2: Withdrawal output amount never yields more than pro-rata assets (vault favorability)
    for shares_to_burn in [1, 100, 999, 1_000_000, 1_000_000_000] {
        for assets in [1_000_000, 2_000_000, 5_000_000] {
            for shares in [1_000_000, 2_000_000, 5_000_000] {
                let out = calculate_amount_out(shares_to_burn, assets, shares).unwrap();
                let lhs = (out as u128) * (shares as u128);
                let rhs = (shares_to_burn as u128) * (assets as u128);
                assert!(lhs <= rhs, "Vault returned more assets than pro-rata!");
            }
        }
    }
}


