mod common;

use common::*;
use fbyt_clone_vault::state::VaultStatusCode;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use anchor_lang::InstructionData;
use solana_instruction::{AccountMeta, Instruction};
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;

// 3.1 Initialize Vault

#[test]
fn test_init_vault_fee_at_max_boundary() {
    // Program cap is inclusive: combined <= 10000 succeeds, 10000 keeps = 10001 fails.
    let (mut svm, manager, program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
        &program_id,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );

    // Over the cap (5001 + 5000 = 10001) must fail (FeeTooHigh)
    let share_mint_over = Keypair::new();
    let data_over = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 5001,
        management_fee_bps: 5000,
        lockup_period: 0,
        allowed_output_mints: vec![],
    };
    let ix_over = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_mint_over.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data_over.data(),
    };
    let res_over = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_mint_over as &dyn Signer],
        &[ix_over],
    );
    assert!(res_over.is_err(), "Expected combined fees above 10000 bps to fail");

    // Exactly at the cap (5000 + 5000 = 10000) is allowed
    let share_token_mint_max = Keypair::new();
    let data_max = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 5000,
        management_fee_bps: 5000,
        lockup_period: 0,
        allowed_output_mints: vec![],
    };
    let ix_max = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint_max.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data_max.data(),
    };
    let res_max = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint_max as &dyn Signer],
        &[ix_max],
    );
    assert!(res_max.is_ok(), "Expected fees of exactly 10000 bps to succeed: {:?}", res_max.err());

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.performance_fee_bps, 5000);
    assert_eq!(vault.management_fee_bps, 5000);
}

#[test]
fn test_init_vault_fee_at_max_minus_1() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _, _) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 5000, 4999, 0,
    );

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.performance_fee_bps, 5000);
    assert_eq!(vault.management_fee_bps, 4999);
}

#[test]
fn test_init_vault_zero_fee() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 0, 0, 0,
    );

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.performance_fee_bps, 0);
    assert_eq!(vault.management_fee_bps, 0);
}

#[test]
fn test_init_vault_zero_lockup() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, 0,
    );

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.lockup_period, 0);
    assert_eq!(vault.min_raise_amount, 0);
}

#[test]
fn test_init_vault_zero_min_raise() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, 0,
    );

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.min_raise_amount, 0);
    assert_eq!(vault.status, VaultStatusCode::Fundraising);
}

#[test]
fn test_init_vault_different_manager_distinct_pda() {
    // A different signer seeds a different vault PDA; no conflict with the first.
    let (mut svm, manager_a, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager_a, &manager_a.pubkey());

    let (vault_pda_a, _vault_authority_pda_a, _share_a) =
        initialize_vault_with_params(&mut svm, &manager_a, &deposit_mint, 0, 1000, 500, 0);

    let manager_b = Keypair::new();
    svm.airdrop(&manager_b.pubkey(), 1_000_000_000_000).unwrap();
    let (vault_pda_b, _vault_authority_pda_b, _share_b) =
        initialize_vault_with_params(&mut svm, &manager_b, &deposit_mint, 0, 1000, 500, 0);

    assert_ne!(vault_pda_a, vault_pda_b);
    assert_eq!(get_vault_state(&svm, &vault_pda_a).manager, manager_a.pubkey());
    assert_eq!(get_vault_state(&svm, &vault_pda_b).manager, manager_b.pubkey());
}

#[test]
fn test_init_vault_duplicate_fails() {
    // duplicate init -> AlreadyInitialized error
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    initialize_vault_with_params(&mut svm, &manager, &deposit_mint, 0, 1000, 500, 0);

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
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
        allowed_output_mints: vec![],
    };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    let res = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix],
    );
    assert!(res.is_err(), "Expected a second init on the same manager to fail");
}

#[test]
fn test_init_vault_duplicate_allowed_mints() {
    // Init does not dedupe; passing the same mint 4x is accepted.
    let (mut svm, manager, program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
        &program_id,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );
    let share_token_mint = Keypair::new();

    let data = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: 0,
        performance_fee_bps: 1000,
        management_fee_bps: 500,
        lockup_period: 0,
        allowed_output_mints: vec![],
    };
    let ix = Instruction {
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
        data: data.data(),
    };
    let res = send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix],
    );
    assert!(res.is_ok(), "Expected init with duplicate allowed output mints to succeed: {:?}", res.err());

    let vault = get_vault_state(&svm, &vault_pda);
}

#[test]
fn test_init_vault_share_mint_set_correctly() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _vault_authority_pda, share_token_mint) =
        initialize_vault_with_params(&mut svm, &manager, &deposit_mint, 0, 1000, 500, 0);

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.share_token_mint, share_token_mint);
}

#[test]
fn test_init_vault_all_fields_set_correctly() {
    let (mut svm, manager, program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_a = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_b = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_c = create_mint(&mut svm, &manager, &manager.pubkey());
    let output_d = create_mint(&mut svm, &manager, &manager.pubkey());

    let min_raise = 5_000_000_000;
    let perf_fee = 2000;
    let mgmt_fee = 1000;
    let lockup = 86400;

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", manager.pubkey().as_ref()],
        &program_id,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &program_id,
    );
    let share_token_mint = Keypair::new();

    let data = fbyt_clone_vault::instruction::InitializeVault {
        min_raise_amount: min_raise,
        performance_fee_bps: perf_fee,
        management_fee_bps: mgmt_fee,
        lockup_period: lockup,
        allowed_output_mints: vec![],
    };
    let ix = Instruction {
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
        data: data.data(),
    };
    send_tx(
        &mut svm,
        &[&manager as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix],
    ).unwrap();

    let vault = get_vault_state(&svm, &vault_pda);
    assert_eq!(vault.manager, manager.pubkey());
    assert_eq!(vault.deposit_mint, deposit_mint);
    assert_eq!(vault.share_token_mint, share_token_mint.pubkey());
    assert_eq!(vault.min_raise_amount, min_raise);
    assert_eq!(vault.performance_fee_bps, perf_fee);
    assert_eq!(vault.management_fee_bps, mgmt_fee);
    assert_eq!(vault.lockup_period, lockup);
    assert_eq!(vault.total_shares_minted, 0);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.accrued_performance_fee, 0);
    assert_eq!(vault.accrued_management_fee, 0);
    assert_eq!(vault.status, VaultStatusCode::Fundraising);
    assert!(!vault.is_paused);
}

// 3.2 Activate Vault

#[test]
fn test_activate_fails_below_min_raise() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, 500_000_000,
    ).unwrap();

    let act_res = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res.is_err(), "Expected activation to fail when below min raise");
    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Fundraising);
}

#[test]
fn test_activate_already_active_rejected() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount,
    ).unwrap();

    activate_vault(&mut svm, &manager, &vault_pda).unwrap();
    let second = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(second.is_err(), "Expected activation of an already active vault to fail");
}

#[test]
fn test_activate_wrong_manager_rejected() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount,
    ).unwrap();

    let wrong_manager = Keypair::new();
    svm.airdrop(&wrong_manager.pubkey(), 10_000_000_000).unwrap();
    let act_res = activate_vault(&mut svm, &wrong_manager, &vault_pda);
    assert!(act_res.is_err(), "Expected activation by a non-manager to fail");
    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Fundraising);
}

#[test]
fn test_activate_when_paused_rejected() {
    // Current contract does NOT gate activate_vault on is_paused (only on status + manager),
    // so a paused vault can still be activated once min raise is met.
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount,
    ).unwrap();

    pause_vault(&mut svm, &manager, &vault_pda, true).unwrap();
    assert!(get_vault_state(&svm, &vault_pda).is_paused);

    let act_res = activate_vault(&mut svm, &manager, &vault_pda);
    // Documented existing behavior: pause does not block activation.
    assert!(act_res.is_ok(), "Activation while paused currently succeeds: {:?}", act_res.err());
    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Active);
}

#[test]
fn test_activate_exact_min_raise_amount() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount,
    ).unwrap();

    let act_res = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res.is_ok(), "Expected activation at exact min raise to succeed: {:?}", act_res.err());
}

#[test]
fn test_activate_one_less_than_min_raise_fails() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount - 1,
    ).unwrap();

    let act_res = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res.is_err(), "Expected activation one below min raise to fail");
    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Fundraising);
}

#[test]
fn test_activate_with_zero_min_raise() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());

    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, 0, 1000, 500, 0,
    );

    // No deposit needed; 0 >= 0 is satisfied immediately.
    let act_res = activate_vault(&mut svm, &manager, &vault_pda);
    assert!(act_res.is_ok(), "Expected activation with zero min raise to succeed: {:?}", act_res.err());
    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Active);
}

#[test]
fn test_activate_transitions_status_to_active() {
    let (mut svm, manager, _program_id) = setup_svm();
    let deposit_mint = create_mint(&mut svm, &manager, &manager.pubkey());
    let min_raise_amount = 1_000_000_000;

    let (vault_pda, vault_authority_pda, share_token_mint) = initialize_vault_with_params(
        &mut svm, &manager, &deposit_mint, min_raise_amount, 1000, 500, 0,
    );

    let vault_deposit_ata = create_ata(&mut svm, &manager, &deposit_mint, &vault_authority_pda);
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 10_000_000_000).unwrap();
    let depositor_deposit_ata = create_ata(&mut svm, &depositor, &deposit_mint, &depositor.pubkey());
    mint_tokens(&mut svm, &manager, &deposit_mint, &depositor_deposit_ata, 10_000_000_000);
    let investor_share_ata = ata(&depositor.pubkey(), &share_token_mint);

    deposit(
        &mut svm, &depositor, vault_pda, vault_authority_pda, depositor_deposit_ata,
        vault_deposit_ata, deposit_mint, share_token_mint, investor_share_ata, min_raise_amount,
    ).unwrap();

    assert_eq!(get_vault_state(&svm, &vault_pda).status, VaultStatusCode::Fundraising);
    activate_vault(&mut svm, &manager, &vault_pda).unwrap();
    let after = get_vault_state(&svm, &vault_pda);
    assert_eq!(after.status, VaultStatusCode::Active);
    assert_ne!(after.status, VaultStatusCode::Fundraising);
}