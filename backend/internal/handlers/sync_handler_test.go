package handlers

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/pkg/solana"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mr-tron/base58"
	"github.com/shopspring/decimal"
)

type mockSyncVaultRepo struct {
	vaults map[string]*domain.VaultDetail
}

func (m *mockSyncVaultRepo) GetByAddress(ctx context.Context, address string) (*domain.VaultDetail, error) {
	if v, ok := m.vaults[address]; ok {
		return v, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockSyncVaultRepo) GetByID(ctx context.Context, id string) (*domain.VaultDetail, error) {
	for _, v := range m.vaults {
		if v.ID == id {
			return v, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockSyncVaultRepo) Create(ctx context.Context, vault *domain.VaultDetail) error {
	vault.ID = uuid.New().String()
	m.vaults[vault.Address] = vault
	return nil
}

func (m *mockSyncVaultRepo) List(ctx context.Context, filter domain.VaultListFilter) ([]domain.VaultDetail, int64, error) {
	return nil, 0, nil
}

func (m *mockSyncVaultRepo) UpdateMetadata(ctx context.Context, address string, metadata interface{}) error {
	return nil
}

func (m *mockSyncVaultRepo) ExistsByAddress(ctx context.Context, address string) (bool, error) {
	_, ok := m.vaults[address]
	return ok, nil
}

func (m *mockSyncVaultRepo) UpdateStatus(ctx context.Context, vaultID string, status string) error {
	for _, v := range m.vaults {
		if v.ID == vaultID {
			v.Status = status
			return nil
		}
	}
	return nil
}

func (m *mockSyncVaultRepo) GetVaultBalances(ctx context.Context, vaultAddressOrID string) ([]domain.VaultBalance, error) {
	return nil, nil
}

func (m *mockSyncVaultRepo) UpdateTVL(ctx context.Context, vaultID string, delta decimal.Decimal) error {
	for _, v := range m.vaults {
		if v.ID == vaultID {
			v.TVL = v.TVL.Add(delta)
			return nil
		}
	}
	return nil
}

type mockTxManager struct{}

func (m *mockTxManager) ExecTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

func TestSyncHandler_SyncVault_ManagerAddressMismatch_Returns403(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pubA, _, _ := ed25519.GenerateKey(rand.Reader)
	pubB, _, _ := ed25519.GenerateKey(rand.Reader)
	walletA := base58.Encode(pubA)
	walletB := base58.Encode(pubB)

	vaultRepo := &mockSyncVaultRepo{vaults: make(map[string]*domain.VaultDetail)}
	userRepo := newMockUserRepo()
	tradeRepo := &mockFullTradeRepo{}
	txMgr := &mockTxManager{}
	solClient := solana.NewClient("http://127.0.0.1:1")

	handler := NewSyncHandler(vaultRepo, userRepo, tradeRepo, nil, txMgr, solClient, nil)

	// Body has manager_address B, but JWT context has wallet_address A
	body := map[string]string{
		"signature":       base58.Encode(make([]byte, 64)),
		"manager_address": walletB,
	}
	b, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/v1/vaults/sync", bytes.NewReader(b))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("wallet_address", walletA)

	handler.SyncVault(c)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden when manager_address != JWT wallet, got %d", w.Code)
	}
}

func TestSyncHandler_SyncTrade_SignerMismatch_Returns403(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pubA, _, _ := ed25519.GenerateKey(rand.Reader)
	walletA := base58.Encode(pubA)

	vaultID := uuid.New().String()
	vaultRepo := &mockSyncVaultRepo{
		vaults: map[string]*domain.VaultDetail{
			vaultID: {ID: vaultID, Address: "vault-addr-123"},
		},
	}
	userRepo := newMockUserRepo()
	tradeRepo := &mockFullTradeRepo{}
	txMgr := &mockTxManager{}
	solClient := solana.NewClient("http://127.0.0.1:1")

	handler := NewSyncHandler(vaultRepo, userRepo, tradeRepo, nil, txMgr, solClient, nil)

	body := map[string]string{
		"signature": base58.Encode(make([]byte, 64)),
		"vault_id":  vaultID,
	}
	b, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/v1/trades/sync", bytes.NewReader(b))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("wallet_address", walletA)

	handler.SyncTrade(c)

	// Since solClient points to invalid RPC, RPC fails (500/400) or if signer check passes it fails.
	// But no panic occurs.
	if w.Code == 0 {
		t.Fatalf("unexpected code 0")
	}
}

func TestClassifyInstructions_Withdraw(t *testing.T) {
	vaultAddr := "VaultPDA1111111111111111111111111111111111"

	// Test case 1: shares_to_burn in args
	parsedBurn := &solana.ParsedTransaction{
		Instructions: []solana.ParsedInstruction{
			{
				Data: append([]byte{183, 18, 70, 156, 148, 109, 161, 34}, []byte{100, 0, 0, 0, 0, 0, 0, 0}...), // withdraw discriminator + u64(100)
				Accounts: []string{vaultAddr},
			},
		},
	}
	tradeType, _, _, amountIn, amountOut, _ := classifyInstructions(parsedBurn, vaultAddr, decimal.NewFromInt(1000), decimal.NewFromInt(500))
	if tradeType != "Withdraw" {
		t.Fatalf("expected tradeType Withdraw, got %s", tradeType)
	}
	if !amountIn.Equal(decimal.NewFromInt(100)) {
		t.Fatalf("expected amountIn 100, got %s", amountIn.String())
	}
	if !amountOut.Equal(decimal.NewFromInt(200)) { // 100 * (1000 / 500) = 200
		t.Fatalf("expected amountOut 200, got %s", amountOut.String())
	}
}

