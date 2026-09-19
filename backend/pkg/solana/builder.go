package solana

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"fmt"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
)

// buildCreateIdempotentATAIx creates an ATA if not already created (instruction 1)
func buildCreateIdempotentATAIx(payer, owner, mint, ata solana.PublicKey) solana.Instruction {
	return solana.NewInstruction(
		AssociatedTokenProgram,
		solana.AccountMetaSlice{
			solana.NewAccountMeta(payer, true, true),
			solana.NewAccountMeta(ata, true, false),
			solana.NewAccountMeta(owner, false, false),
			solana.NewAccountMeta(mint, false, false),
			solana.NewAccountMeta(solana.SystemProgramID, false, false),
			solana.NewAccountMeta(SplTokenProgram, false, false),
		},
		[]byte{1}, // CreateIdempotent
	)
}

// buildSyncNativeIx syncs lamports balance to WSOL token account (instruction 17)
func buildSyncNativeIx(tokenAccount solana.PublicKey) solana.Instruction {
	return solana.NewInstruction(
		SplTokenProgram,
		solana.AccountMetaSlice{
			solana.NewAccountMeta(tokenAccount, true, false),
		},
		[]byte{17}, // SyncNative
	)
}

var (
	DefaultProgramID = solana.MustPublicKeyFromBase58("FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais")
	NativeMint       = solana.MustPublicKeyFromBase58("So11111111111111111111111111111111111111112")
	SplTokenProgram  = solana.TokenProgramID
	AssociatedTokenProgram = solana.SPLAssociatedTokenAccountProgramID
	SysVarRent       = solana.SysVarRentPubkey
)

// FindVaultPDA finds the PDA for the vault state
// seeds: [b"vault", manager.key().as_ref(), share_token_mint.key().as_ref()]
func FindVaultPDA(programID, manager, shareTokenMint solana.PublicKey) (solana.PublicKey, uint8, error) {
	seeds := [][]byte{
		[]byte("vault"),
		manager.Bytes(),
		shareTokenMint.Bytes(),
	}
	return solana.FindProgramAddress(seeds, programID)
}

// FindVaultAuthorityPDA finds the PDA for vault authority
// seeds: [b"vault_authority", vault.key().as_ref()]
func FindVaultAuthorityPDA(programID, vault solana.PublicKey) (solana.PublicKey, uint8, error) {
	seeds := [][]byte{
		[]byte("vault_authority"),
		vault.Bytes(),
	}
	return solana.FindProgramAddress(seeds, programID)
}

// FindAssociatedTokenAddress derives standard ATA for wallet and mint
func FindAssociatedTokenAddress(wallet, mint solana.PublicKey) (solana.PublicKey, error) {
	addr, _, err := solana.FindAssociatedTokenAddress(wallet, mint)
	return addr, err
}

type CreateVaultParams struct {
	Manager               solana.PublicKey
	ShareTokenMintKeypair solana.PrivateKey
	DepositMint           solana.PublicKey
	MinRaiseAmount        uint64
	PerformanceFeeBps     uint16
	ManagementFeeBps      uint16
	LockupPeriodSec       int64
	AllowedOutputMints    []solana.PublicKey
	RecentBlockhash       solana.Hash
	ComputeUnitPrice      uint64 // micro-lamports per CU
	ComputeUnitLimit      uint32 // default 200000
}

type PreparedTransaction struct {
	TransactionBase64 string           `json:"transaction"`
	VaultAddress      solana.PublicKey `json:"vault_address"`
	ShareTokenMint    solana.PublicKey `json:"share_token_mint,omitempty"`
}

// BuildInitializeVaultTx constructs and partially signs (with share mint keypair) the initialize_vault transaction.
func BuildInitializeVaultTx(programID solana.PublicKey, p CreateVaultParams) (*PreparedTransaction, error) {
	if programID.IsZero() {
		programID = DefaultProgramID
	}

	shareTokenMint := p.ShareTokenMintKeypair.PublicKey()

	vaultPda, _, err := FindVaultPDA(programID, p.Manager, shareTokenMint)
	if err != nil {
		return nil, fmt.Errorf("derive vault pda: %w", err)
	}

	vaultAuthPda, _, err := FindVaultAuthorityPDA(programID, vaultPda)
	if err != nil {
		return nil, fmt.Errorf("derive vault auth pda: %w", err)
	}

	if p.DepositMint.IsZero() {
		p.DepositMint = NativeMint
	}

	// Build Instruction Data: discriminator + args
	buf := new(bytes.Buffer)
	buf.Write(discInitializeVault[:])

	// min_raise_amount: u64
	if err := binary.Write(buf, binary.LittleEndian, p.MinRaiseAmount); err != nil {
		return nil, err
	}
	// performance_fee_bps: u16
	if err := binary.Write(buf, binary.LittleEndian, p.PerformanceFeeBps); err != nil {
		return nil, err
	}
	// management_fee_bps: u16
	if err := binary.Write(buf, binary.LittleEndian, p.ManagementFeeBps); err != nil {
		return nil, err
	}
	// lockup_period: i64
	if err := binary.Write(buf, binary.LittleEndian, p.LockupPeriodSec); err != nil {
		return nil, err
	}
	// allowed_output_mints: Vec<Pubkey>
	if err := binary.Write(buf, binary.LittleEndian, uint32(len(p.AllowedOutputMints))); err != nil {
		return nil, err
	}
	for _, mint := range p.AllowedOutputMints {
		buf.Write(mint.Bytes())
	}

	// Accounts:
	// 0: manager [signer, writable]
	// 1: vault [writable]
	// 2: deposit_mint []
	// 3: share_token_mint [signer, writable]
	// 4: vault_authority []
	// 5: system_program []
	// 6: token_program []
	accounts := solana.AccountMetaSlice{
		solana.NewAccountMeta(p.Manager, true, true),
		solana.NewAccountMeta(vaultPda, true, false),
		solana.NewAccountMeta(p.DepositMint, false, false),
		solana.NewAccountMeta(shareTokenMint, true, true),
		solana.NewAccountMeta(vaultAuthPda, false, false),
		solana.NewAccountMeta(solana.SystemProgramID, false, false),
		solana.NewAccountMeta(SplTokenProgram, false, false),
	}

	ix := solana.NewInstruction(programID, accounts, buf.Bytes())

	var instructions []solana.Instruction

	// Compute Budget instructions
	if p.ComputeUnitLimit > 0 {
		instructions = append(instructions, buildComputeUnitLimitIx(p.ComputeUnitLimit))
	}
	if p.ComputeUnitPrice > 0 {
		instructions = append(instructions, buildComputeUnitPriceIx(p.ComputeUnitPrice))
	}

	instructions = append(instructions, ix)

	tx, err := solana.NewTransaction(
		instructions,
		p.RecentBlockhash,
		solana.TransactionPayer(p.Manager),
	)
	if err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}

	// Partially sign with the generated shareTokenMint keypair
	messageBytes, err := tx.Message.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal message: %w", err)
	}
	shareMintSig, err := p.ShareTokenMintKeypair.Sign(messageBytes)
	if err != nil {
		return nil, fmt.Errorf("sign share token mint: %w", err)
	}

	numSigners := int(tx.Message.Header.NumRequiredSignatures)
	tx.Signatures = make([]solana.Signature, numSigners)
	for i, key := range tx.Message.AccountKeys[:numSigners] {
		if key.Equals(shareTokenMint) {
			tx.Signatures[i] = shareMintSig
			break
		}
	}

	rawBytes, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal tx: %w", err)
	}

	return &PreparedTransaction{
		TransactionBase64: base64.StdEncoding.EncodeToString(rawBytes),
		VaultAddress:      vaultPda,
		ShareTokenMint:    shareTokenMint,
	}, nil
}

type DepositParams struct {
	Investor         solana.PublicKey
	Vault            solana.PublicKey
	DepositMint      solana.PublicKey
	ShareTokenMint   solana.PublicKey
	Amount           uint64
	RecentBlockhash  solana.Hash
	ComputeUnitPrice uint64
	ComputeUnitLimit uint32
}

// BuildDepositTx constructs the unsigned deposit transaction.
func BuildDepositTx(programID solana.PublicKey, p DepositParams) (*PreparedTransaction, error) {
	if programID.IsZero() {
		programID = DefaultProgramID
	}
	if p.DepositMint.IsZero() {
		p.DepositMint = NativeMint
	}

	vaultAuthPda, _, err := FindVaultAuthorityPDA(programID, p.Vault)
	if err != nil {
		return nil, fmt.Errorf("derive vault auth pda: %w", err)
	}

	investorTokenAta, err := FindAssociatedTokenAddress(p.Investor, p.DepositMint)
	if err != nil {
		return nil, fmt.Errorf("derive investor token ata: %w", err)
	}

	vaultTokenAta, err := FindAssociatedTokenAddress(vaultAuthPda, p.DepositMint)
	if err != nil {
		return nil, fmt.Errorf("derive vault token ata: %w", err)
	}

	investorShareAta, err := FindAssociatedTokenAddress(p.Investor, p.ShareTokenMint)
	if err != nil {
		return nil, fmt.Errorf("derive investor share ata: %w", err)
	}

	// Build instruction data: discriminator + amount(u64)
	buf := new(bytes.Buffer)
	buf.Write(discDeposit[:])
	if err := binary.Write(buf, binary.LittleEndian, p.Amount); err != nil {
		return nil, err
	}

	// Accounts:
	// 0: investor [signer, writable]
	// 1: vault [writable]
	// 2: vault_authority []
	// 3: investor_token_account [writable]
	// 4: vault_token_account [writable]
	// 5: deposit_mint []
	// 6: share_token_mint [writable]
	// 7: investor_share_token_account [writable]
	// 8: token_program []
	// 9: associated_token_program []
	// 10: system_program []
	accounts := solana.AccountMetaSlice{
		solana.NewAccountMeta(p.Investor, true, true),
		solana.NewAccountMeta(p.Vault, true, false),
		solana.NewAccountMeta(vaultAuthPda, false, false),
		solana.NewAccountMeta(investorTokenAta, true, false),
		solana.NewAccountMeta(vaultTokenAta, true, false),
		solana.NewAccountMeta(p.DepositMint, false, false),
		solana.NewAccountMeta(p.ShareTokenMint, true, false),
		solana.NewAccountMeta(investorShareAta, true, false),
		solana.NewAccountMeta(SplTokenProgram, false, false),
		solana.NewAccountMeta(AssociatedTokenProgram, false, false),
		solana.NewAccountMeta(solana.SystemProgramID, false, false),
	}

	var instructions []solana.Instruction

	if p.ComputeUnitLimit > 0 {
		instructions = append(instructions, buildComputeUnitLimitIx(p.ComputeUnitLimit))
	}
	if p.ComputeUnitPrice > 0 {
		instructions = append(instructions, buildComputeUnitPriceIx(p.ComputeUnitPrice))
	}

	// If native SOL, create WSOL ATA for investor, transfer SOL, and SyncNative
	if p.DepositMint.Equals(NativeMint) {
		instructions = append(instructions, buildCreateIdempotentATAIx(
			p.Investor,
			p.Investor,
			NativeMint,
			investorTokenAta,
		))

		instructions = append(instructions, system.NewTransferInstruction(
			p.Amount,
			p.Investor,
			investorTokenAta,
		).Build())

		instructions = append(instructions, buildSyncNativeIx(
			investorTokenAta,
		))
	} else {
		// Ensure investor deposit token account ATA is created if it doesn't exist
		instructions = append(instructions, buildCreateIdempotentATAIx(
			p.Investor,
			p.Investor,
			p.DepositMint,
			investorTokenAta,
		))
	}

	// Ensure vault token account (owned by vault authority) ATA is created
	instructions = append(instructions, buildCreateIdempotentATAIx(
		p.Investor,
		vaultAuthPda,
		p.DepositMint,
		vaultTokenAta,
	))

	// Ensure investor share token account ATA is created
	instructions = append(instructions, buildCreateIdempotentATAIx(
		p.Investor,
		p.Investor,
		p.ShareTokenMint,
		investorShareAta,
	))

	instructions = append(instructions, solana.NewInstruction(programID, accounts, buf.Bytes()))

	tx, err := solana.NewTransaction(
		instructions,
		p.RecentBlockhash,
		solana.TransactionPayer(p.Investor),
	)
	if err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}

	rawBytes, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal tx: %w", err)
	}

	return &PreparedTransaction{
		TransactionBase64: base64.StdEncoding.EncodeToString(rawBytes),
		VaultAddress:      p.Vault,
		ShareTokenMint:    p.ShareTokenMint,
	}, nil
}

type WithdrawParams struct {
	Investor         solana.PublicKey
	Vault            solana.PublicKey
	WithdrawMint     solana.PublicKey
	ShareTokenMint   solana.PublicKey
	SharesToBurn     uint64
	RecentBlockhash  solana.Hash
	ComputeUnitPrice uint64
	ComputeUnitLimit uint32
}

// BuildWithdrawTx constructs the unsigned withdraw transaction.
func BuildWithdrawTx(programID solana.PublicKey, p WithdrawParams) (*PreparedTransaction, error) {
	if programID.IsZero() {
		programID = DefaultProgramID
	}
	if p.WithdrawMint.IsZero() {
		p.WithdrawMint = NativeMint
	}

	vaultAuthPda, _, err := FindVaultAuthorityPDA(programID, p.Vault)
	if err != nil {
		return nil, fmt.Errorf("derive vault auth pda: %w", err)
	}

	investorTokenAta, err := FindAssociatedTokenAddress(p.Investor, p.WithdrawMint)
	if err != nil {
		return nil, fmt.Errorf("derive investor token ata: %w", err)
	}

	vaultTokenAta, err := FindAssociatedTokenAddress(vaultAuthPda, p.WithdrawMint)
	if err != nil {
		return nil, fmt.Errorf("derive vault token ata: %w", err)
	}

	investorShareAta, err := FindAssociatedTokenAddress(p.Investor, p.ShareTokenMint)
	if err != nil {
		return nil, fmt.Errorf("derive investor share ata: %w", err)
	}

	// Build instruction data: discriminator + shares_to_burn(u64)
	buf := new(bytes.Buffer)
	buf.Write(discWithdraw[:])
	if err := binary.Write(buf, binary.LittleEndian, p.SharesToBurn); err != nil {
		return nil, err
	}

	// Accounts:
	// 0: investor [signer, writable]
	// 1: vault [writable]
	// 2: vault_authority []
	// 3: investor_token_account [writable]
	// 4: withdraw_mint []
	// 5: vault_token_account [writable]
	// 6: share_token_mint [writable]
	// 7: investor_share_account [writable]
	// 8: token_program []
	// 9: system_program []
	accounts := solana.AccountMetaSlice{
		solana.NewAccountMeta(p.Investor, true, true),
		solana.NewAccountMeta(p.Vault, true, false),
		solana.NewAccountMeta(vaultAuthPda, false, false),
		solana.NewAccountMeta(investorTokenAta, true, false),
		solana.NewAccountMeta(p.WithdrawMint, false, false),
		solana.NewAccountMeta(vaultTokenAta, true, false),
		solana.NewAccountMeta(p.ShareTokenMint, true, false),
		solana.NewAccountMeta(investorShareAta, true, false),
		solana.NewAccountMeta(SplTokenProgram, false, false),
		solana.NewAccountMeta(solana.SystemProgramID, false, false),
	}

	var instructions []solana.Instruction

	if p.ComputeUnitLimit > 0 {
		instructions = append(instructions, buildComputeUnitLimitIx(p.ComputeUnitLimit))
	}
	if p.ComputeUnitPrice > 0 {
		instructions = append(instructions, buildComputeUnitPriceIx(p.ComputeUnitPrice))
	}

	// Ensure investor withdraw token account ATA is created
	instructions = append(instructions, buildCreateIdempotentATAIx(
		p.Investor,
		p.Investor,
		p.WithdrawMint,
		investorTokenAta,
	))

	instructions = append(instructions, solana.NewInstruction(programID, accounts, buf.Bytes()))

	tx, err := solana.NewTransaction(
		instructions,
		p.RecentBlockhash,
		solana.TransactionPayer(p.Investor),
	)
	if err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}

	rawBytes, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal tx: %w", err)
	}

	return &PreparedTransaction{
		TransactionBase64: base64.StdEncoding.EncodeToString(rawBytes),
		VaultAddress:      p.Vault,
		ShareTokenMint:    p.ShareTokenMint,
	}, nil
}

// Helpers for ComputeBudgetProgram
var ComputeBudgetProgram = solana.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111")

func buildComputeUnitLimitIx(units uint32) solana.Instruction {
	data := make([]byte, 5)
	data[0] = 0x02 // SetComputeUnitLimit
	binary.LittleEndian.PutUint32(data[1:], units)
	return solana.NewInstruction(ComputeBudgetProgram, solana.AccountMetaSlice{}, data)
}

func buildComputeUnitPriceIx(microLamports uint64) solana.Instruction {
	data := make([]byte, 9)
	data[0] = 0x03 // SetComputeUnitPrice
	binary.LittleEndian.PutUint64(data[1:], microLamports)
	return solana.NewInstruction(ComputeBudgetProgram, solana.AccountMetaSlice{}, data)
}
