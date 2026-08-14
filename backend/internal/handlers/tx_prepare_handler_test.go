package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"context"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gagliardetto/solana-go"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDraftRepo struct {
	drafts map[uuid.UUID]*models.TransactionDraft
}

func (m *mockDraftRepo) Create(ctx context.Context, draft *models.TransactionDraft) error {
	m.drafts[draft.ID] = draft
	return nil
}
func (m *mockDraftRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.TransactionDraft, error) {
	return m.drafts[id], nil
}
func (m *mockDraftRepo) GetBySignature(ctx context.Context, sig string) (*models.TransactionDraft, error) {
	return nil, nil
}
func (m *mockDraftRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.TransactionDraftStatus, sig *string) error {
	return nil
}
func (m *mockDraftRepo) ListPendingByUser(ctx context.Context, userPubkey string) ([]models.TransactionDraft, error) {
	return nil, nil
}

func TestTxPrepareHandler_PrepareCreateVault(t *testing.T) {
	gin.SetMode(gin.TestMode)

	draftRepo := &mockDraftRepo{drafts: make(map[uuid.UUID]*models.TransactionDraft)}
	svc := services.NewTxPrepareService(draftRepo, nil, nil)
	h := NewTxPrepareHandler(svc)

	r := gin.New()
	r.POST("/api/v1/tx/prepare/create-vault", h.PrepareCreateVault)

	manager := solana.NewWallet().PublicKey().String()
	body, _ := json.Marshal(PrepareCreateVaultRequest{
		ManagerAddress:    manager,
		DisplayName:       "Alpha Alpha Vault",
		Description:       "Test description",
		MinRaiseAmount:    1000000000,
		PerformanceFeeBps: 1000,
		ManagementFeeBps:  200,
		LockupPeriodSec:   86400,
		VaultType:         "open",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/tx/prepare/create-vault", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool                       `json:"success"`
		Data    services.PrepareTxResponse `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.NotEmpty(t, resp.Data.DraftID)
	assert.NotEmpty(t, resp.Data.Transaction)
}
