use {
    anchor_lang::{AccountDeserialize, AccountSerialize},
    litesvm::LiteSVM,
    solana_instruction::{AccountMeta, Instruction},
    solana_keypair::Keypair,
    solana_message::Message,
    solana_pubkey::{pubkey, Pubkey},
    solana_signer::Signer,
    solana_system_interface::instruction as system_ix,
    solana_system_interface::program::ID as SYSTEM_PROGRAM_ID,
    solana_transaction::Transaction,
    spl_associated_token_account::get_associated_token_address_with_program_id,
};
use anchor_lang::InstructionData;
use flux_vault::state::{VaultState, VaultStatusCode};

pub const TOKEN_PROGRAM_ID: Pubkey =
    pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey =
    pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
pub const RENT_ID: Pubkey = pubkey!("SysvarRent111111111111111111111111111111111");
pub const DECIMALS: u8 = 9;
pub const MINT_SIZE: u64 = 82;

// ---------------------------------------------------------------------
// Version-adapter helpers.
// `spl-token`/`spl-ata`/`anchor-lang` operate on the solana-program
// v2 `Pubkey`/`Instruction` types, while the litesvm transaction layer
// (solana-message/transaction/instruction v3/v4) needs the solana-pubkey
// v3 `Pubkey` and `solana_instruction::Instruction`. These two helpers
// bridge the two worlds.
// ---------------------------------------------------------------------

fn p2(p3: &Pubkey) -> spl_token::solana_program::pubkey::Pubkey {
    spl_token::solana_program::pubkey::Pubkey::new_from_array(
        p3.as_ref().try_into().expect("32-byte pubkey"),
    )
}

fn to_3(ix: spl_token::solana_program::instruction::Instruction) -> Instruction {
    Instruction {
        program_id: Pubkey::new_from_array(ix.program_id.to_bytes()),
        accounts: ix
            .accounts
            .into_iter()
            .map(|a| AccountMeta {
                pubkey: Pubkey::new_from_array(a.pubkey.to_bytes()),
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            })
            .collect(),
        data: ix.data,
    }
}

/// Convert any 32-byte pubkey-like (from the v2 ecosystem) to the 3.x Pubkey.
fn p3(bytes: [u8; 32]) -> Pubkey {
    Pubkey::new_from_array(bytes)
}

pub fn setup_svm() -> (LiteSVM, Keypair, Pubkey) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000_000).unwrap();

    let program_id = flux_vault::ID;
    let program_bytes = include_bytes!("../../target/deploy/flux_vault.so");
    svm.add_program(&program_id, program_bytes).unwrap();

    (svm, payer, program_id)
}

pub fn send_tx(
    svm: &mut LiteSVM,
    signers: &[&dyn Signer],
    instructions: &[Instruction],
) -> Result<(), String> {
    svm.expire_blockhash();
    let payer = signers[0].pubkey();
    let tx = Transaction::new(
        signers,
        Message::new(instructions, Some(&payer)),
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e))
}

pub fn create_mint(svm: &mut LiteSVM, payer: &Keypair, authority: &Pubkey) -> Pubkey {
    let mint = Keypair::new();
    let mint_pubkey = mint.pubkey();
    let rent = anchor_lang::solana_program::rent::Rent::default();
    let lamports = rent.minimum_balance(MINT_SIZE as usize);

    let create_ix = system_ix::create_account(
        &payer.pubkey(),
        &mint_pubkey,
        lamports,
        MINT_SIZE,
        &TOKEN_PROGRAM_ID,
    );
    let init_ix = to_3(
        spl_token::instruction::initialize_mint2(
            &p2(&TOKEN_PROGRAM_ID),
            &p2(&mint_pubkey),
            &p2(authority),
            None,
            DECIMALS,
        )
        .unwrap(),
    );
    send_tx(
        svm,
        &[payer as &dyn Signer, &mint as &dyn Signer],
        &[create_ix, init_ix],
    )
    .unwrap();
    mint_pubkey
}

/// Associated token address for `owner`/`mint` (returns the 3.x Pubkey type
/// used throughout the harness).
pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    p3(
        get_associated_token_address_with_program_id(&p2(owner), &p2(mint), &p2(&TOKEN_PROGRAM_ID))
            .to_bytes(),
    )
}

pub fn create_ata(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, owner: &Pubkey) -> Pubkey {
    let ata = ata(owner, mint);
    let ix = to_3(
        spl_associated_token_account::instruction::create_associated_token_account(
            &p2(&payer.pubkey()),
            &p2(owner),
            &p2(mint),
            &p2(&TOKEN_PROGRAM_ID),
        ),
    );
    send_tx(svm, &[payer as &dyn Signer], &[ix]).unwrap();
    ata
}

pub fn mint_tokens(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, dest: &Pubkey, amount: u64) {
    let ix = to_3(
        spl_token::instruction::mint_to(
            &p2(&TOKEN_PROGRAM_ID),
            &p2(mint),
            &p2(dest),
            &p2(&payer.pubkey()),
            &[],
            amount,
        )
        .unwrap(),
    );
    send_tx(svm, &[payer as &dyn Signer], &[ix]).unwrap();
}

/// Reads the balance of an SPL token account by parsing its fixed binary
/// layout (amount is the u64 at byte offset 64). This avoids the
/// `Pack`/`solana_program_pack` version conflicts between anchor/spl-token
/// and the standalone solana crates used here.
pub fn token_balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    let account = svm.get_account(ata).unwrap();
    u64::from_le_bytes(account.data[64..72].try_into().unwrap())
}

pub fn initialize_vault(
    svm: &mut LiteSVM,
    payer: &Keypair,
    deposit_mint: &Pubkey,
) -> (Pubkey, Pubkey, Pubkey) {
    initialize_vault_with_params(svm, payer, deposit_mint, 0, 1000, 500, 0)
}

pub fn initialize_vault_with_params(
    svm: &mut LiteSVM,
    payer: &Keypair,
    deposit_mint: &Pubkey,
    min_raise_amount: u64,
    performance_fee_bps: u16,
    management_fee_bps: u16,
    lockup_period: i64,
) -> (Pubkey, Pubkey, Pubkey) {
    let share_token_mint = Keypair::new();

    let (vault_pda, _) = Pubkey::find_program_address(
        &[b"vault", payer.pubkey().as_ref(), share_token_mint.pubkey().as_ref()],
        &flux_vault::ID,
    );
    let (vault_authority_pda, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_pda.as_ref()],
        &flux_vault::ID,
    );

    let data = flux_vault::instruction::InitializeVault {
        min_raise_amount,
        performance_fee_bps,
        management_fee_bps,
        lockup_period,
        allowed_output_mints: vec![],
    };
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(*deposit_mint, false),
            AccountMeta::new(share_token_mint.pubkey(), true),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
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

pub fn activate_vault(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: &Pubkey,
) -> Result<(), String> {
    let data = flux_vault::instruction::ActivateVault {};
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(*vault_pda, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

pub fn deposit(
    svm: &mut LiteSVM,
    depositor: &Keypair,
    vault_pda: Pubkey,
    vault_authority_pda: Pubkey,
    depositor_deposit_ata: Pubkey,
    vault_deposit_ata: Pubkey,
    deposit_mint: Pubkey,
    share_token_mint: Pubkey,
    investor_share_ata: Pubkey,
    amount: u64,
) -> Result<(), String> {
    let data = flux_vault::instruction::Deposit { amount };
    let ix = Instruction {
        program_id: flux_vault::ID,
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
            AccountMeta::new_readonly(ASSOCIATED_TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(RENT_ID, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[depositor as &dyn Signer], &[ix])
}

pub fn withdraw(
    svm: &mut LiteSVM,
    investor: &Keypair,
    vault_pda: Pubkey,
    vault_authority_pda: Pubkey,
    investor_deposit_ata: Pubkey,
    withdraw_mint: Pubkey,
    vault_deposit_ata: Pubkey,
    share_token_mint: Pubkey,
    investor_share_ata: Pubkey,
    shares_to_burn: u64,
) -> Result<(), String> {
    let data = flux_vault::instruction::Withdraw { shares_to_burn };
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(investor.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(investor_deposit_ata, false),
            AccountMeta::new_readonly(withdraw_mint, false),
            AccountMeta::new(vault_deposit_ata, false),
            AccountMeta::new(share_token_mint, false),
            AccountMeta::new(investor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[investor as &dyn Signer], &[ix])
}

pub fn pause_vault(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: &Pubkey,
    paused: bool,
) -> Result<(), String> {
    let data = flux_vault::instruction::PauseVault { paused };
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(*vault_pda, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

pub fn set_pending_manager(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: &Pubkey,
    pending_manager: Pubkey,
) -> Result<(), String> {
    let data = flux_vault::instruction::SetPendingManager { pending_manager };
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(*vault_pda, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

pub fn accept_manager(
    svm: &mut LiteSVM,
    pending_manager: &Keypair,
    vault_pda: &Pubkey,
) -> Result<(), String> {
    let data = flux_vault::instruction::AcceptManager {};
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(pending_manager.pubkey(), true),
            AccountMeta::new(*vault_pda, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[pending_manager as &dyn Signer], &[ix])
}

pub fn collect_fees(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: Pubkey,
    vault_authority_pda: Pubkey,
    vault_token_account: Pubkey,
    manager_token_account: Pubkey,
    token_mint: Pubkey,
) -> Result<(), String> {
    let data = flux_vault::instruction::CollectFees {};
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(vault_token_account, false),
            AccountMeta::new(manager_token_account, false),
            AccountMeta::new_readonly(token_mint, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

pub fn execute_trade_pyth(
    svm: &mut LiteSVM,
    manager: &Keypair,
    vault_pda: Pubkey,
    vault_authority_pda: Pubkey,
    vault_input_token_account: Pubkey,
    vault_input_mint: Pubkey,
    vault_output_token_account: Pubkey,
    vault_output_mint: Pubkey,
    price_update: Pubkey,
    amount_in: u64,
    min_amount_out: u64,
) -> Result<(), String> {
    let data = flux_vault::instruction::ExecuteTradePyth {
        amount_in,
        min_amount_out,
    };
    let ix = Instruction {
        program_id: flux_vault::ID,
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(vault_pda, false),
            AccountMeta::new_readonly(vault_authority_pda, false),
            AccountMeta::new(vault_input_token_account, false),
            AccountMeta::new(vault_input_mint, false),
            AccountMeta::new(vault_output_token_account, false),
            AccountMeta::new(vault_output_mint, false),
            AccountMeta::new_readonly(price_update, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data.data(),
    };
    send_tx(svm, &[manager as &dyn Signer], &[ix])
}

pub fn get_vault_state(svm: &LiteSVM, vault_pda: &Pubkey) -> VaultState {
    let account = svm.get_account(vault_pda).unwrap();
    VaultState::try_deserialize(&mut &account.data[..]).unwrap()
}

pub fn set_vault_accrued_fees(
    svm: &mut LiteSVM,
    vault_pda: &Pubkey,
    accrued_performance_fee: u64,
    accrued_management_fee: u64,
) {
    let mut account = svm.get_account(vault_pda).unwrap();
    let mut vault = VaultState::try_deserialize(&mut &account.data[..]).unwrap();
    vault.accrued_performance_fee = accrued_performance_fee;
    vault.accrued_management_fee = accrued_management_fee;
    let mut data_slice = &mut account.data[..];
    vault.try_serialize(&mut data_slice).unwrap();
    svm.set_account(*vault_pda, account).unwrap();
}

pub fn set_vault_total_assets(
    svm: &mut LiteSVM,
    vault_pda: &Pubkey,
    total_assets_deposited: u64,
) {
    let mut account = svm.get_account(vault_pda).unwrap();
    let mut vault = VaultState::try_deserialize(&mut &account.data[..]).unwrap();
    vault.total_assets_deposited = total_assets_deposited;
    let mut data_slice = &mut account.data[..];
    vault.try_serialize(&mut data_slice).unwrap();
    svm.set_account(*vault_pda, account).unwrap();
}