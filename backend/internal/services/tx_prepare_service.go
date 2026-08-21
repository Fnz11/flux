package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	pkgSolana "github.com/flux-protocol/backend/pkg/solana"
	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type TxPrepareService struct {
	draftRepo         domain.TransactionDraftRepository
	vaultRepo         domain.VaultRepository
	client            *pkgSolana.Client
	programID         solana.PublicKey
	reconcileCallback func(draftID uuid.UUID)
}

func (s *TxPrepareService) SetReconcileCallback(fn func(draftID uuid.UUID)) {
	s.reconcileCallback = fn
}

func NewTxPrepareService(
	draftRepo domain.TransactionDraftRepository,
	vaultRepo domain.VaultRepository,
	client *pkgSolana.Client,
) *TxPrepareService {
	var pid solana.PublicKey
	if client != nil && client.ProgramID() != "" {
		if p, err := solana.PublicKeyFromBase58(client.ProgramID()); err == nil {
			pid = p
		}
	}
	if pid.IsZero() {
		pid = pkgSolana.DefaultProgramID
	}
	return &TxPrepareService{
		draftRepo: draftRepo,
		vaultRepo: vaultRepo,
		client:    client,
		programID: pid,
	}
}

type PrepareCreateVaultDTO struct {
	ManagerAddress    string          `json:"manager_address"`
	DisplayName       string          `json:"display_name"`
	Description       string          `json:"description"`
	CoverImageUrl     string          `json:"cover_image_url,omitempty"`
	FocusAssets       []string        `json:"focus_assets,omitempty"`
	Tags              []string        `json:"tags,omitempty"`
	MinRaiseAmount    uint64          `json:"min_raise_amount"` // in lamports
	PerformanceFeeBps uint16          `json:"performance_fee_bps"`
	ManagementFeeBps  uint16          `json:"management_fee_bps"`
	LockupPeriodSec   int64           `json:"lockup_period_sec"`
	VaultType         string          `json:"vault_type"`
	DepositMint       string          `json:"deposit_mint,omitempty"`
}

type PrepareTxResponse struct {
	DraftID              string `json:"draft_id"`
	Transaction          string `json:"transaction"`
	VaultAddress         string `json:"vault_address,omitempty"`
	ShareTokenMint       string `json:"share_token_mint,omitempty"`
	RecentBlockhash      string `json:"recent_blockhash"`
	LastValidBlockHeight uint64 `json:"last_valid_block_height"`
	ExpiresAt            string `json:"expires_at"`
}

func (s *TxPrepareService) PrepareCreateVault(ctx context.Context, dto PrepareCreateVaultDTO) (*PrepareTxResponse, error) {
	managerPk, err := solana.PublicKeyFromBase58(dto.ManagerAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid manager address: %w", err)
	}

	if (uint32(dto.PerformanceFeeBps) + uint32(dto.ManagementFeeBps)) > 10000 {
		return nil, errors.New("combined fees cannot exceed 100% (10000 bps)")
	}

	var depositMintPk solana.PublicKey
	if dto.DepositMint != "" {
		depositMintPk, err = solana.PublicKeyFromBase58(dto.DepositMint)
		if err != nil {
			return nil, fmt.Errorf("invalid deposit mint: %w", err)
		}
	} else {
		depositMintPk = pkgSolana.NativeMint
	}

	// Generate a fresh keypair for the share token mint
	shareMintWallet := solana.NewWallet()

	// Get latest blockhash
	var blockhash solana.Hash
	var lastValidHeight uint64
	if s.client != nil {
		details, err := s.client.GetLatestBlockhashDetails(ctx)
		if err == nil && details != nil {
			blockhash = details.Blockhash
			lastValidHeight = details.LastValidBlockHeight
		}
	}
	if blockhash.IsZero() {
		// Fallback for tests or offline mock
		blockhash = solana.HashFromBytes([]byte("11111111111111111111111111111111"))
	}

	// Prepare allowed_output_mints
	var allowedMints []solana.PublicKey

	if !depositMintPk.IsZero() {
		allowedMints = append(allowedMints, depositMintPk)
	}

	for _, asset := range dto.FocusAssets {
		if len(allowedMints) >= 100 {
			break
		}
		var pk solana.PublicKey
		switch strings.ToUpper(strings.TrimSpace(asset)) {
		case "SOL", "WSOL", pkgSolana.NativeMint.String():
			pk = pkgSolana.NativeMint
		case "USDC", "EPJFWDD5AUFQSSQEM2QN1XZYBAPC8G4WEGGKZWYTDT1V":
			pk = solana.MustPublicKeyFromBase58("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
		case "USDT", "ES9VMFRZACERMJFRF4H2FYD4KCONKY11MCCEE8BENWNYB":
			pk = solana.MustPublicKeyFromBase58("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
		case "JUP", "JUPYIWRYJFSKUPTIHA7HKE8RVUTAEFOSYBKEDZNSDVCN":
			pk = solana.MustPublicKeyFromBase58("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")
		case "PYTH", "HZ1JOV2PWBSHAI4EVWKGAEGG5QUPWVKIDGIEW6JH5W73":
			pk = solana.MustPublicKeyFromBase58("HZ1Jov2PwbShAi4evWKGAkgg5qUpWVKidGiEw6JH5W73")
		default:
			if parsed, pErr := solana.PublicKeyFromBase58(asset); pErr == nil {
				pk = parsed
			}
		}

		if !pk.IsZero() {
			alreadyPresent := false
			for _, m := range allowedMints {
				if m.Equals(pk) {
					alreadyPresent = true
					break
				}
			}
			if !alreadyPresent {
				allowedMints = append(allowedMints, pk)
			}
		}
	}

	prep, err := pkgSolana.BuildInitializeVaultTx(s.programID, pkgSolana.CreateVaultParams{
		Manager:               managerPk,
		ShareTokenMintKeypair: shareMintWallet.PrivateKey,
		DepositMint:           depositMintPk,
		MinRaiseAmount:        dto.MinRaiseAmount,
		PerformanceFeeBps:     dto.PerformanceFeeBps,
		ManagementFeeBps:      dto.ManagementFeeBps,
		LockupPeriodSec:       dto.LockupPeriodSec,
		AllowedOutputMints:    allowedMints,
		RecentBlockhash:       blockhash,
		ComputeUnitLimit:      200000,
		ComputeUnitPrice:      1000,
	})
	if err != nil {
		return nil, fmt.Errorf("build initialize vault tx: %w", err)
	}

	metadataMap := map[string]interface{}{
		"displayName":       dto.DisplayName,
		"description":       dto.Description,
		"coverImageUrl":     dto.CoverImageUrl,
		"focusAssets":       dto.FocusAssets,
		"tags":              dto.Tags,
		"vaultType":         dto.VaultType,
		"minRaiseAmount":    dto.MinRaiseAmount,
		"performanceFeeBps": dto.PerformanceFeeBps,
		"managementFeeBps":  dto.ManagementFeeBps,
		"lockupPeriod":      dto.LockupPeriodSec,
		"shareTokenMint":    prep.ShareTokenMint.String(),
		"vaultAddress":      prep.VaultAddress.String(),
		"depositMint":       depositMintPk.String(),
	}
	metaBytes, _ := json.Marshal(metadataMap)

	expiresAt := time.Now().UTC().Add(90 * time.Second)
	draft := &models.TransactionDraft{
		ID:                   uuid.New(),
		UserPubkey:           dto.ManagerAddress,
		TxType:               "CREATE_VAULT",
		Status:               models.TxDraftStatusPendingSignature,
		SerializedTx:         prep.TransactionBase64,
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		Metadata:             datatypes.JSON(metaBytes),
		ExpiresAt:            expiresAt,
	}

	if err := s.draftRepo.Create(ctx, draft); err != nil {
		return nil, fmt.Errorf("persist tx draft: %w", err)
	}

	return &PrepareTxResponse{
		DraftID:              draft.ID.String(),
		Transaction:          prep.TransactionBase64,
		VaultAddress:         prep.VaultAddress.String(),
		ShareTokenMint:       prep.ShareTokenMint.String(),
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		ExpiresAt:            expiresAt.Format(time.RFC3339),
	}, nil
}

type PrepareDepositDTO struct {
	InvestorAddress string `json:"investor_address"`
	VaultAddress    string `json:"vault_address"`
	AmountLamports  uint64 `json:"amount_lamports"`
	DepositMint     string `json:"deposit_mint,omitempty"`
}

func (s *TxPrepareService) PrepareDeposit(ctx context.Context, dto PrepareDepositDTO) (*PrepareTxResponse, error) {
	investorPk, err := solana.PublicKeyFromBase58(dto.InvestorAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid investor address: %w", err)
	}
	vaultPk, err := solana.PublicKeyFromBase58(dto.VaultAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid vault address: %w", err)
	}
	if dto.AmountLamports == 0 {
		return nil, errors.New("deposit amount must be greater than 0")
	}

	var depositMintPk solana.PublicKey
	if dto.DepositMint != "" {
		depositMintPk, err = solana.PublicKeyFromBase58(dto.DepositMint)
		if err != nil {
			return nil, fmt.Errorf("invalid deposit mint: %w", err)
		}
	} else {
		depositMintPk = pkgSolana.NativeMint
	}

	// Derive shareTokenMint PDA or lookup from on-chain vault state
	shareTokenMintPk, _, err := solana.FindProgramAddress([][]byte{
		[]byte("share_mint"),
		vaultPk.Bytes(),
	}, s.programID)
	if err != nil {
		return nil, fmt.Errorf("derive share mint: %w", err)
	}

	var blockhash solana.Hash
	var lastValidHeight uint64
	if s.client != nil {
		details, err := s.client.GetLatestBlockhashDetails(ctx)
		if err == nil && details != nil {
			blockhash = details.Blockhash
			lastValidHeight = details.LastValidBlockHeight
		}

		accInfo, err := s.client.GetAccountInfo(ctx, vaultPk)
		if err != nil {
			log.Printf("PrepareDeposit: GetAccountInfo error: %v", err)
		} else if accInfo == nil || accInfo.Value == nil {
			log.Printf("PrepareDeposit: GetAccountInfo returned nil or empty value for vault %s", vaultPk)
		} else if len(accInfo.Value.Data.GetBinary()) < 137 {
			log.Printf("PrepareDeposit: GetAccountInfo returned data too small (%d bytes) for vault %s", len(accInfo.Value.Data.GetBinary()), vaultPk)
		}

		if err == nil && accInfo != nil && accInfo.Value != nil && len(accInfo.Value.Data.GetBinary()) >= 137 {
			data := accInfo.Value.Data.GetBinary()
			// VaultState layout:
			// 8 disc + 32 manager + 32 creator = 72
			offset := 72
			if len(data) > offset {
				if data[offset] == 0 {
					offset += 1 // Option::None
				} else {
					offset += 33 // Option::Some
				}
				if len(data) >= offset+32 {
					onChainDepositMint := solana.PublicKeyFromBytes(data[offset : offset+32])
					if !onChainDepositMint.IsZero() {
						depositMintPk = onChainDepositMint
					}
				}
				offset += 32 // skip deposit_mint
				if len(data) >= offset+32 {
					onChainMint := solana.PublicKeyFromBytes(data[offset : offset+32])
					if !onChainMint.IsZero() {
						shareTokenMintPk = onChainMint
					}
				}
			}
			log.Printf("PrepareDeposit: Read on-chain VaultState. depositMint: %s, shareTokenMint: %s", depositMintPk, shareTokenMintPk)
		}
	}
	if blockhash.IsZero() {
		blockhash = solana.HashFromBytes([]byte("11111111111111111111111111111111"))
	}

	prep, err := pkgSolana.BuildDepositTx(s.programID, pkgSolana.DepositParams{
		Investor:         investorPk,
		Vault:            vaultPk,
		DepositMint:      depositMintPk,
		ShareTokenMint:   shareTokenMintPk,
		Amount:           dto.AmountLamports,
		RecentBlockhash:  blockhash,
		ComputeUnitLimit: 200000,
		ComputeUnitPrice: 1000,
	})
	if err != nil {
		return nil, fmt.Errorf("build deposit tx: %w", err)
	}

	expiresAt := time.Now().UTC().Add(90 * time.Second)
	metaMap := map[string]interface{}{
		"vaultAddress":   dto.VaultAddress,
		"amountLamports": dto.AmountLamports,
		"depositMint":    depositMintPk.String(),
	}
	metaBytes, _ := json.Marshal(metaMap)

	draft := &models.TransactionDraft{
		ID:                   uuid.New(),
		UserPubkey:           dto.InvestorAddress,
		TxType:               "DEPOSIT",
		Status:               models.TxDraftStatusPendingSignature,
		SerializedTx:         prep.TransactionBase64,
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		Metadata:             datatypes.JSON(metaBytes),
		ExpiresAt:            expiresAt,
	}

	if err := s.draftRepo.Create(ctx, draft); err != nil {
		return nil, fmt.Errorf("persist tx draft: %w", err)
	}

	return &PrepareTxResponse{
		DraftID:              draft.ID.String(),
		Transaction:          prep.TransactionBase64,
		VaultAddress:         dto.VaultAddress,
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		ExpiresAt:            expiresAt.Format(time.RFC3339),
	}, nil
}

type PrepareWithdrawDTO struct {
	InvestorAddress string `json:"investor_address"`
	VaultAddress    string `json:"vault_address"`
	SharesToBurn    uint64 `json:"shares_to_burn"`
	WithdrawMint    string `json:"withdraw_mint,omitempty"`
}

func (s *TxPrepareService) PrepareWithdraw(ctx context.Context, dto PrepareWithdrawDTO) (*PrepareTxResponse, error) {
	investorPk, err := solana.PublicKeyFromBase58(dto.InvestorAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid investor address: %w", err)
	}
	vaultPk, err := solana.PublicKeyFromBase58(dto.VaultAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid vault address: %w", err)
	}
	if dto.SharesToBurn == 0 {
		return nil, errors.New("shares to burn must be greater than 0")
	}

	var withdrawMintPk solana.PublicKey
	if dto.WithdrawMint != "" {
		withdrawMintPk, err = solana.PublicKeyFromBase58(dto.WithdrawMint)
		if err != nil {
			return nil, fmt.Errorf("invalid withdraw mint: %w", err)
		}
	} else {
		withdrawMintPk = pkgSolana.NativeMint
	}

	shareTokenMintPk, _, err := solana.FindProgramAddress([][]byte{
		[]byte("share_mint"),
		vaultPk.Bytes(),
	}, s.programID)
	if err != nil {
		return nil, fmt.Errorf("derive share mint: %w", err)
	}

	var blockhash solana.Hash
	var lastValidHeight uint64
	if s.client != nil {
		details, err := s.client.GetLatestBlockhashDetails(ctx)
		if err == nil && details != nil {
			blockhash = details.Blockhash
			lastValidHeight = details.LastValidBlockHeight
		}

		accInfo, err := s.client.GetAccountInfo(ctx, vaultPk)
		if err == nil && accInfo != nil && accInfo.Value != nil && len(accInfo.Value.Data.GetBinary()) >= 137 {
			data := accInfo.Value.Data.GetBinary()
			offset := 72
			if len(data) > offset {
				if data[offset] == 0 {
					offset += 1
				} else {
					offset += 33
				}
				offset += 32 // skip deposit_mint
				if len(data) >= offset+32 {
					onChainMint := solana.PublicKeyFromBytes(data[offset : offset+32])
					if !onChainMint.IsZero() {
						shareTokenMintPk = onChainMint
					}
				}
			}
		}
	}
	if blockhash.IsZero() {
		blockhash = solana.HashFromBytes([]byte("11111111111111111111111111111111"))
	}

	prep, err := pkgSolana.BuildWithdrawTx(s.programID, pkgSolana.WithdrawParams{
		Investor:         investorPk,
		Vault:            vaultPk,
		WithdrawMint:     withdrawMintPk,
		ShareTokenMint:   shareTokenMintPk,
		SharesToBurn:     dto.SharesToBurn,
		RecentBlockhash:  blockhash,
		ComputeUnitLimit: 200000,
		ComputeUnitPrice: 1000,
	})
	if err != nil {
		return nil, fmt.Errorf("build withdraw tx: %w", err)
	}

	expiresAt := time.Now().UTC().Add(90 * time.Second)
	metaMap := map[string]interface{}{
		"vaultAddress": dto.VaultAddress,
		"sharesToBurn": dto.SharesToBurn,
		"withdrawMint": withdrawMintPk.String(),
	}
	metaBytes, _ := json.Marshal(metaMap)

	draft := &models.TransactionDraft{
		ID:                   uuid.New(),
		UserPubkey:           dto.InvestorAddress,
		TxType:               "WITHDRAW",
		Status:               models.TxDraftStatusPendingSignature,
		SerializedTx:         prep.TransactionBase64,
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		Metadata:             datatypes.JSON(metaBytes),
		ExpiresAt:            expiresAt,
	}

	if err := s.draftRepo.Create(ctx, draft); err != nil {
		return nil, fmt.Errorf("persist tx draft: %w", err)
	}

	return &PrepareTxResponse{
		DraftID:              draft.ID.String(),
		Transaction:          prep.TransactionBase64,
		VaultAddress:         dto.VaultAddress,
		RecentBlockhash:      blockhash.String(),
		LastValidBlockHeight: lastValidHeight,
		ExpiresAt:            expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *TxPrepareService) RecordSubmission(ctx context.Context, draftID string, signature string) error {
	id, err := uuid.Parse(draftID)
	if err != nil {
		return fmt.Errorf("invalid draft id: %w", err)
	}
	if err := s.draftRepo.UpdateStatus(ctx, id, models.TxDraftStatusSubmitted, &signature); err != nil {
		return err
	}
	if s.reconcileCallback != nil {
		s.reconcileCallback(id)
	}
	return nil
}
