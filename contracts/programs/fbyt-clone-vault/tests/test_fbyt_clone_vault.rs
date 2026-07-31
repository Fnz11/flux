use {
    anchor_lang::solana_program::sysvar::rent,
    anchor_lang::InstructionData,
    borsh::BorshDeserialize,
    litesvm::LiteSVM,
    solana_instruction::{AccountMeta, Instruction},
    solana_keypair::Keypair,
    solana_message::Message,
    solana_pubkey::{pubkey, Pubkey},
    solana_signer::Signer,
    solana_system_interface::instruction as system_ix,
    solana_system_interface::program::ID as SYSTEM_PROGRAM_ID,
    solana_transaction::Transaction,
    spl_associated_token_account::{
        get_associated_token_address_with_program_id, instruction::create_associated_token_account,
    },
    spl_token::instruction as token_ix,
    spl_token::state::Account as SplAccount,
};

const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const DECIMALS: u8 = 9;
const MINT_SIZE: u64 = 82;

#[derive(BorshDeserialize)]
struct VaultState {
    _discriminator: [u8; 8],
    manager: Pubkey,
    min_raise_amount: u64,
    performance_fee_bps: u16,
    management_fee_bps: u16,
    lockup_period: i64,
    total_shares_minted: u64,
    total_assets_deposited: u64,
    vault_bump: u8,
    vault_authority_bump: u8,
    status: u8,
    created_at: i64,
    last_trade_at: i64,
}

fn setup_svm() -> (LiteSVM, Keypair, Pubkey) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    let program_id = fbyt_clone_vault::ID;
    let program_bytes = include_bytes!("../../../target/deploy/fbyt_clone_vault.so");
    svm.add_program(&program_id, program_bytes).unwrap();
    (svm, payer, program_id)
}

fn send_tx(
    svm: &mut LiteSVM,
    signers: &[&dyn Signer],
    instructions: &[Instruction],
) -> Result<(), String> {
    let payer = signers[0].pubkey();
    let tx = Transaction::new(
        signers,
        Message::new(instructions, Some(&payer)),
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e))
}

fn create_mint(svm: &mut LiteSVM, payer: &Keypair, authority: &Pubkey) -> Pubkey {
    let mint = Keypair::new();
    let mint_pubkey = mint.pubkey();
    let rent = svm.get_rent();
    let lamports = rent.minimum_balance(MINT_SIZE as usize);

    let create_ix = system_ix::create_account(
        &payer.pubkey(),
        &mint_pubkey,
        lamports,
        MINT_SIZE,
        &TOKEN_PROGRAM_ID,
    );
    let init_ix = token_ix::initialize_mint2(
        &TOKEN_PROGRAM_ID,
        &mint_pubkey,
        authority,
        None,
        DECIMALS,
    )
    .unwrap();
    send_tx(svm, &[payer as &dyn Signer, &mint as &dyn Signer], &[create_ix, init_ix]).unwrap();
    mint_pubkey
}

fn create_ata(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, owner: &Pubkey) -> Pubkey {
    let ata = get_associated_token_address_with_program_id(owner, mint, &TOKEN_PROGRAM_ID);
    let ix = create_associated_token_account(&payer.pubkey(), owner, mint, &TOKEN_PROGRAM_ID);
    send_tx(svm, &[payer as &dyn Signer], &[ix]).unwrap();
    ata
}

fn mint_tokens(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, dest: &Pubkey, amount: u64) {
    let ix = token_ix::mint_to(
        &TOKEN_PROGRAM_ID, mint, dest, &payer.pubkey(), &[], amount,
    )
    .unwrap();
    send_tx(svm, &[payer as &dyn Signer], &[ix]).unwrap();
}

fn initialize_vault(
    svm: &mut LiteSVM,
    payer: &Keypair,
) -> (Pubkey, Pubkey, Pubkey) {
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
    };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new(share_token_mint.pubkey(), false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(rent::ID, false),
        ],
        data: data.data(),
    };
    send_tx(
        svm,
        &[payer as &dyn Signer, &share_token_mint as &dyn Signer],
        &[ix],
    )
    .unwrap();
    (vault_pda, vault_authority_pda, share_token_mint.pubkey())
}

#[test]
fn test_initialize_vault() {
    let (mut svm, payer, _program_id) = setup_svm();
    let (vault_pda, _vault_authority_pda, _share_token_mint) = initialize_vault(&mut svm, &payer);

    let account = svm.get_account(&vault_pda).unwrap();
    let vault = VaultState::try_from_slice(&account.data).unwrap();
    assert_eq!(vault.manager, payer.pubkey());
    assert_eq!(vault.performance_fee_bps, 1000);
    assert_eq!(vault.management_fee_bps, 500);
    assert_eq!(vault.total_shares_minted, 0);
    assert_eq!(vault.total_assets_deposited, 0);
    assert_eq!(vault.status, 0);
}

#[test]
fn test_deposit_and_withdraw() {
    let (mut svm, payer, _program_id) = setup_svm();
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &payer);

    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let payer_deposit_ata = create_ata(&mut svm, &payer, &deposit_mint, &payer.pubkey());
    let vault_deposit_ata =
        create_ata(&mut svm, &payer, &deposit_mint, &vault_authority_pda);

    let deposit_amount: u64 = 1_000_000_000;
    mint_tokens(&mut svm, &payer, &deposit_mint, &payer_deposit_ata, 10_000_000_000);

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

    let data = fbyt_clone_vault::instruction::Deposit {
        amount: deposit_amount,
    };
    let investor_share_ata = get_associated_token_address_with_program_id(
        &depositor.pubkey(),
        &share_token_mint,
        &TOKEN_PROGRAM_ID,
    );
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(depositor.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(depositor_deposit_ata, false),
            AccountMeta::new(vault_deposit_ata, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint, false),
            AccountMeta::new(investor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(
                spl_associated_token_account::ID,
                false,
            ),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(rent::ID, false),
        ],
        data: data.data(),
    };
    send_tx(&mut svm, &[&depositor as &dyn Signer], &[ix]).unwrap();

    let account = svm.get_account(&vault_pda).unwrap();
    let vault = VaultState::try_from_slice(&account.data).unwrap();
    assert_eq!(vault.total_assets_deposited, deposit_amount);
    assert_eq!(vault.total_shares_minted, deposit_amount);

    let share_account = svm.get_account(&investor_share_ata).unwrap();
    let parsed = SplAccount::unpack(&share_account.data).unwrap();
    assert_eq!(parsed.amount, deposit_amount);

    let withdraw_amount = deposit_amount / 2;
    let data = fbyt_clone_vault::instruction::Withdraw {
        shares_to_burn: withdraw_amount,
    };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(depositor.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(depositor_deposit_ata, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(vault_deposit_ata, false),
            AccountMeta::new(share_token_mint, false),
            AccountMeta::new(investor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    send_tx(&mut svm, &[&depositor as &dyn Signer], &[ix]).unwrap();

    let account = svm.get_account(&vault_pda).unwrap();
    let vault = VaultState::try_from_slice(&account.data).unwrap();
    assert_eq!(
        vault.total_assets_deposited,
        deposit_amount - withdraw_amount
    );
    assert_eq!(
        vault.total_shares_minted,
        deposit_amount - withdraw_amount
    );

    let share_account = svm.get_account(&investor_share_ata).unwrap();
    let parsed = SplAccount::unpack(&share_account.data).unwrap();
    assert_eq!(parsed.amount, deposit_amount - withdraw_amount);
}

#[test]
fn test_rejects_zero_deposit() {
    let (mut svm, payer, _program_id) = setup_svm();
    let (vault_pda, vault_authority_pda, share_token_mint) =
        initialize_vault(&mut svm, &payer);

    let deposit_mint = create_mint(&mut svm, &payer, &payer.pubkey());
    let payer_deposit_ata = create_ata(&mut svm, &payer, &deposit_mint, &payer.pubkey());
    let vault_deposit_ata =
        create_ata(&mut svm, &payer, &deposit_mint, &vault_authority_pda);
    mint_tokens(&mut svm, &payer, &deposit_mint, &payer_deposit_ata, 10_000_000_000);

    let investor_share_ata = get_associated_token_address_with_program_id(
        &payer.pubkey(),
        &share_token_mint,
        &TOKEN_PROGRAM_ID,
    );

    let data = fbyt_clone_vault::instruction::Deposit { amount: 0 };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(payer_deposit_ata, false),
            AccountMeta::new(vault_deposit_ata, false),
            AccountMeta::new_readonly(deposit_mint, false),
            AccountMeta::new(share_token_mint, false),
            AccountMeta::new(investor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(
                spl_associated_token_account::ID,
                false,
            ),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(rent::ID, false),
        ],
        data: data.data(),
    };
    let result = send_tx(&mut svm, &[&payer as &dyn Signer], &[ix]);
    assert!(result.is_err(), "Expected error for zero deposit");
}

#[test]
fn test_rejects_double_init() {
    let (mut svm, payer, _program_id) = setup_svm();
    initialize_vault(&mut svm, &payer);

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
    };
    let ix = Instruction {
        program_id: fbyt_clone_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new(share_token_mint.pubkey(), false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(rent::ID, false),
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
