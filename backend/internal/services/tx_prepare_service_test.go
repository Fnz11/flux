package services

import (
	"context"
	"testing"

	"github.com/flux-protocol/backend/internal/models"
	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type MockDraftRepo struct {
	drafts map[uuid.UUID]*models.TransactionDraft
}

func NewMockDraftRepo() *MockDraftRepo {
	return &MockDraftRepo{drafts: make(map[uuid.UUID]*models.TransactionDraft)}
}

func (m *MockDraftRepo) Create(ctx context.Context, draft *models.TransactionDraft) error {
	m.drafts[draft.ID] = draft
	return nil
}

func (m *MockDraftRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.TransactionDraft, error) {
	d, ok := m.drafts[id]
	if !ok {
		return nil, assert.AnError
	}
	return d, nil
}

func (m *MockDraftRepo) GetBySignature(ctx context.Context, sig string) (*models.TransactionDraft, error) {
	for _, d := range m.drafts {
		if d.Signature != nil && *d.Signature == sig {
			return d, nil
		}
	}
	return nil, assert.AnError
}

func (m *MockDraftRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.TransactionDraftStatus, sig *string) error {
	d, ok := m.drafts[id]
	if !ok {
		return assert.AnError
	}
	d.Status = status
	if sig != nil {
		d.Signature = sig
	}
	return nil
}

func (m *MockDraftRepo) ListPendingByUser(ctx context.Context, userPubkey string) ([]models.TransactionDraft, error) {
	var res []models.TransactionDraft
	for _, d := range m.drafts {
		if d.UserPubkey == userPubkey {
			res = append(res, *d)
		}
	}
	return res, nil
}

func TestTxPrepareService_PrepareCreateVault(t *testing.T) {
	draftRepo := NewMockDraftRepo()
	svc := NewTxPrepareService(draftRepo, nil, nil)

	manager := solana.NewWallet().PublicKey().String()

	resp, err := svc.PrepareCreateVault(context.Background(), PrepareCreateVaultDTO{
		ManagerAddress:    manager,
		DisplayName:       "Alpha Alpha Vault",
		Description:       "Test vault",
		MinRaiseAmount:    1000000000,
		PerformanceFeeBps: 1000,
		ManagementFeeBps:  200,
		LockupPeriodSec:   86400,
		VaultType:         "open",
	})

	require.NoError(t, err)
	assert.NotEmpty(t, resp.DraftID)
	assert.NotEmpty(t, resp.Transaction)
	assert.NotEmpty(t, resp.VaultAddress)
	assert.NotEmpty(t, resp.ShareTokenMint)

	id, err := uuid.Parse(resp.DraftID)
	require.NoError(t, err)
	draft, ok := draftRepo.drafts[id]
	require.True(t, ok)
	assert.Equal(t, models.TxDraftStatusPendingSignature, draft.Status)
	assert.Equal(t, "CREATE_VAULT", draft.TxType)
}

func TestTxPrepareService_PrepareDeposit(t *testing.T) {
	draftRepo := NewMockDraftRepo()
	svc := NewTxPrepareService(draftRepo, nil, nil)

	investor := solana.NewWallet().PublicKey().String()
	vault := solana.NewWallet().PublicKey().String()

	resp, err := svc.PrepareDeposit(context.Background(), PrepareDepositDTO{
		InvestorAddress: investor,
		VaultAddress:    vault,
		AmountLamports:  500000000,
	})

	require.NoError(t, err)
	assert.NotEmpty(t, resp.DraftID)
	assert.NotEmpty(t, resp.Transaction)
}

func TestTxPrepareService_PrepareWithdraw(t *testing.T) {
	draftRepo := NewMockDraftRepo()
	svc := NewTxPrepareService(draftRepo, nil, nil)

	investor := solana.NewWallet().PublicKey().String()
	vault := solana.NewWallet().PublicKey().String()

	resp, err := svc.PrepareWithdraw(context.Background(), PrepareWithdrawDTO{
		InvestorAddress: investor,
		VaultAddress:    vault,
		SharesToBurn:    250000000,
	})

	require.NoError(t, err)
	assert.NotEmpty(t, resp.DraftID)
	assert.NotEmpty(t, resp.Transaction)
}
