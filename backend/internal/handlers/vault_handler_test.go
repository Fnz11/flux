package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type mockVaultRepository struct {
	vault        *domain.VaultDetail
	vaults       []domain.VaultDetail
	total        int64
	balances     []domain.VaultBalance
	getByAddrErr error
	getBalancesErr error
	updateMetaErr  error
}

func (m *mockVaultRepository) GetByAddress(ctx context.Context, address string) (*domain.VaultDetail, error) {
	if m.getByAddrErr != nil {
		return nil, m.getByAddrErr
	}
	if m.vault != nil {
		return m.vault, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockVaultRepository) GetByID(ctx context.Context, id string) (*domain.VaultDetail, error) {
	if m.getByAddrErr != nil {
		return nil, m.getByAddrErr
	}
	if m.vault != nil {
		return m.vault, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockVaultRepository) ExistsByAddress(ctx context.Context, address string) (bool, error) {
	return true, nil
}

func (m *mockVaultRepository) Create(ctx context.Context, vault *domain.VaultDetail) error {
	return nil
}

func (m *mockVaultRepository) UpdateMetadata(ctx context.Context, address string, metadata interface{}) error {
	if m.updateMetaErr != nil {
		return m.updateMetaErr
	}
	return nil
}

func (m *mockVaultRepository) List(ctx context.Context, filter domain.VaultListFilter) ([]domain.VaultDetail, int64, error) {
	var filtered []domain.VaultDetail
	for _, v := range m.vaults {
		if filter.Status != "" && v.Status != filter.Status {
			continue
		}
		filtered = append(filtered, v)
	}
	return filtered, int64(len(filtered)), nil
}

func (m *mockVaultRepository) GetVaultBalances(ctx context.Context, vaultIDOrAddress string) ([]domain.VaultBalance, error) {
	if m.getBalancesErr != nil {
		return nil, m.getBalancesErr
	}
	return m.balances, nil
}

func TestVaultHandler_ListVaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("ListVaults_DefaultPagination", func(t *testing.T) {
		repo := &mockVaultRepository{
			vaults: []domain.VaultDetail{{ID: "v1", Address: "addr1"}, {ID: "v2", Address: "addr2"}},
			total:  2,
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults", nil)

		h.ListVaults(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("ListVaults_StatusFilter", func(t *testing.T) {
		repo := &mockVaultRepository{
			vaults: []domain.VaultDetail{
				{ID: "v1", Status: "Fundraising"},
				{ID: "v2", Status: "Active"},
			},
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults?status=Fundraising", nil)

		h.ListVaults(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("ListVaults_EmptyDB", func(t *testing.T) {
		repo := &mockVaultRepository{vaults: nil, total: 0}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults", nil)

		h.ListVaults(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("ListVaults_BoundaryPagination", func(t *testing.T) {
		repo := &mockVaultRepository{}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		tests := []string{
			"/api/v1/vaults?page=-5",
			"/api/v1/vaults?page=0",
			"/api/v1/vaults?page=99999",
			"/api/v1/vaults?limit=0",
			"/api/v1/vaults?limit=9999",
			"/api/v1/vaults?limit=-1",
			"/api/v1/vaults?page=abc",
		}
		for _, url := range tests {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", url, nil)
			h.ListVaults(c)
			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 for url %s, got %d", url, w.Code)
			}
		}
	})

	t.Run("ListVaults_SQLInjectionInStatus", func(t *testing.T) {
		repo := &mockVaultRepository{}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults?status=';%20DROP%20TABLE%20vaults;--", nil)

		h.ListVaults(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("ListVaults_LargeStatusParam", func(t *testing.T) {
		repo := &mockVaultRepository{}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		longStatus := strings.Repeat("A", 10000)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults?status="+longStatus, nil)

		h.ListVaults(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

func TestVaultHandler_GetVault(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("GetVault_HappyPath", func(t *testing.T) {
		repo := &mockVaultRepository{vault: &domain.VaultDetail{ID: "v1", Address: "vault-1"}}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/vault-1", nil)

		h.GetVault(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("GetVault_NotFound", func(t *testing.T) {
		repo := &mockVaultRepository{getByAddrErr: domain.ErrNotFound}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "unknown"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/unknown", nil)

		h.GetVault(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})
}

func TestVaultHandler_GetVaultBalances(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockBalances := []domain.VaultBalance{
			{
				Mint:     "So11111111111111111111111111111111111111112",
				Symbol:   "SOL",
				Amount:   decimal.NewFromFloat(4.6666666666666667),
				USDValue: decimal.NewFromFloat(700.0),
			},
			{
				Mint:     "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				Symbol:   "USDC",
				Amount:   decimal.NewFromFloat(300.0),
				USDValue: decimal.NewFromFloat(300.0),
			},
		}
		repo := &mockVaultRepository{
			balances: mockBalances,
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "vault-addr-123"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/vault-addr-123/balances", nil)

		h.GetVaultBalances(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &mockVaultRepository{
			getBalancesErr: domain.ErrNotFound,
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "unknown"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/unknown/balances", nil)

		h.GetVaultBalances(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected status 404, got %d", w.Code)
		}
	})
}

func TestVaultHandler_UpdateVaultMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	managerAddr := "manager_wallet_123"

	t.Run("UpdateMetadata_HappyPath", func(t *testing.T) {
		repo := &mockVaultRepository{
			vault: &domain.VaultDetail{ID: "v1", Address: "vault-1", ManagerAddress: managerAddr},
		}
		h := NewVaultHandler(repo, nil, nil, nil, []string{"SOL", "USDC"})

		name := "New Name"
		desc := "New Description"
		focus := []string{"SOL"}
		body := UpdateMetadataRequest{
			DisplayName: &name,
			Description: &desc,
			FocusAssets: &focus,
		}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", managerAddr)
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("PATCH", "/api/v1/vaults/vault-1", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.UpdateVaultMetadata(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("UpdateMetadata_NoAuth", func(t *testing.T) {
		repo := &mockVaultRepository{}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("PATCH", "/api/v1/vaults/vault-1", nil)

		h.UpdateVaultMetadata(c)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("UpdateMetadata_NonManagerToken_IDOR", func(t *testing.T) {
		repo := &mockVaultRepository{
			vault: &domain.VaultDetail{ID: "v1", Address: "vault-1", ManagerAddress: managerAddr},
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		name := "Hacked Name"
		body := UpdateMetadataRequest{DisplayName: &name}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", "attacker_wallet") // IDOR attempt
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("PATCH", "/api/v1/vaults/vault-1", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.UpdateVaultMetadata(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for IDOR, got %d", w.Code)
		}
	})

	t.Run("UpdateMetadata_NoFieldsProvided", func(t *testing.T) {
		repo := &mockVaultRepository{
			vault: &domain.VaultDetail{ID: "v1", Address: "vault-1", ManagerAddress: managerAddr},
		}
		h := NewVaultHandler(repo, nil, nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", managerAddr)
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("PATCH", "/api/v1/vaults/vault-1", bytes.NewReader([]byte("{}")))
		c.Request.Header.Set("Content-Type", "application/json")

		h.UpdateVaultMetadata(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("UpdateMetadata_InvalidFocusAsset", func(t *testing.T) {
		repo := &mockVaultRepository{
			vault: &domain.VaultDetail{ID: "v1", Address: "vault-1", ManagerAddress: managerAddr},
		}
		h := NewVaultHandler(repo, nil, nil, nil, []string{"SOL", "USDC"})

		focus := []string{"UNKNOWN_COIN"}
		body := UpdateMetadataRequest{FocusAssets: &focus}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", managerAddr)
		c.Params = gin.Params{{Key: "address", Value: "vault-1"}}
		c.Request = httptest.NewRequest("PATCH", "/api/v1/vaults/vault-1", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.UpdateVaultMetadata(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for non-whitelisted focus asset, got %d", w.Code)
		}
	})
}
