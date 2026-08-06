package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type mockPortfolioRepoForHandler struct {
	positions map[string][]domain.PortfolioDetail
}

func (m *mockPortfolioRepoForHandler) UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice decimal.Decimal) error {
	return nil
}

func (m *mockPortfolioRepoForHandler) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error {
	return nil
}

func (m *mockPortfolioRepoForHandler) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	return m.positions[userID], nil
}

func (m *mockPortfolioRepoForHandler) GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error) {
	return decimal.Zero, nil
}

func (m *mockPortfolioRepoForHandler) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	return &domain.PortfolioSummary{}, nil
}

func (m *mockPortfolioRepoForHandler) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	return &domain.UserPnLSummary{}, nil
}

func (m *mockPortfolioRepoForHandler) GetHolderUserIDs(ctx context.Context, vaultID string) ([]string, error) {
	return nil, nil
}

func TestPortfolioHandler_GetPortfolio(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pub58, _ := generateTestKeyPair()
	userUUID := uuid.New().String()

	t.Run("GetPortfolio_HappyPath", func(t *testing.T) {
		userRepo := newMockUserRepo()
		userRepo.users[pub58] = &domain.UserDetail{
			ID:            userUUID,
			WalletAddress: pub58,
		}

		portfolioRepo := &mockPortfolioRepoForHandler{
			positions: make(map[string][]domain.PortfolioDetail),
		}
		vaultUUID := uuid.New()
		portfolioRepo.positions[userUUID] = []domain.PortfolioDetail{
			{
				VaultID:            vaultUUID.String(),
				VaultAddress:       "vault-addr-1",
				VaultName:          "Test Vault",
				SharesOwned:        decimal.NewFromInt(100),
				TotalInvestedValue: decimal.NewFromInt(1000),
				AverageEntryPrice:  decimal.NewFromInt(10),
				CurrentValue:       decimal.NewFromInt(1200),
				PnL:                decimal.NewFromInt(200),
				PnLPercent:         decimal.NewFromInt(20),
			},
		}

		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: pub58}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+pub58, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
		}

		var resp APIResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if !resp.Success {
			t.Fatalf("expected success true")
		}

		dataMap, ok := resp.Data.(map[string]interface{})
		if !ok {
			t.Fatalf("expected data map, got %T", resp.Data)
		}
		if dataMap["wallet"] != pub58 {
			t.Fatalf("expected wallet %s, got %v", pub58, dataMap["wallet"])
		}
	})

	t.Run("GetPortfolio_EmptyPortfolio", func(t *testing.T) {
		userRepo := newMockUserRepo()
		userRepo.users[pub58] = &domain.UserDetail{
			ID:            userUUID,
			WalletAddress: pub58,
		}

		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: pub58}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+pub58, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})

	t.Run("GetPortfolio_WalletNotFound", func(t *testing.T) {
		userRepo := newMockUserRepo()
		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: "non_existent_wallet"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/non_existent_wallet", nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected status 404, got %d", w.Code)
		}
	})

	t.Run("GetPortfolio_IDOR_PublicEndpoint", func(t *testing.T) {
		userRepo := newMockUserRepo()
		userRepo.users[pub58] = &domain.UserDetail{
			ID:            userUUID,
			WalletAddress: pub58,
		}
		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: pub58}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+pub58, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})

	t.Run("GetPortfolio_SQLInjection", func(t *testing.T) {
		userRepo := newMockUserRepo()
		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		h := NewPortfolioHandler(userRepo, portfolioRepo)

		sqlInjection := "';%20DROP%20TABLE%20users;--"

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: sqlInjection}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+sqlInjection, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusNotFound && w.Code != http.StatusOK {
			t.Fatalf("expected status 404 or 200, got %d", w.Code)
		}
	})

	t.Run("GetPortfolio_UUIDInvalidUserID", func(t *testing.T) {
		userRepo := newMockUserRepo()
		userRepo.users[pub58] = &domain.UserDetail{
			ID:            "invalid-uuid-string",
			WalletAddress: pub58,
		}
		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: pub58}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+pub58, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("expected status 500 for invalid user UUID, got %d", w.Code)
		}
	})

	t.Run("GetPortfolio_PnLCalculation", func(t *testing.T) {
		userRepo := newMockUserRepo()
		userRepo.users[pub58] = &domain.UserDetail{
			ID:            userUUID,
			WalletAddress: pub58,
		}

		portfolioRepo := &mockPortfolioRepoForHandler{positions: make(map[string][]domain.PortfolioDetail)}
		vaultUUID := uuid.New()
		invested := decimal.NewFromInt(500)
		current := decimal.NewFromInt(750)
		pnl := current.Sub(invested)
		pnlPct := pnl.Div(invested).Mul(decimal.NewFromInt(100))

		portfolioRepo.positions[userUUID] = []domain.PortfolioDetail{
			{
				VaultID:            vaultUUID.String(),
				VaultAddress:       "vault-addr-2",
				VaultName:          "Vault 2",
				SharesOwned:        decimal.NewFromInt(50),
				TotalInvestedValue: invested,
				AverageEntryPrice:  decimal.NewFromInt(10),
				CurrentValue:       current,
				PnL:                pnl,
				PnLPercent:         pnlPct,
			},
		}

		h := NewPortfolioHandler(userRepo, portfolioRepo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "wallet", Value: pub58}}
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/"+pub58, nil)

		h.GetPortfolio(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})
}
