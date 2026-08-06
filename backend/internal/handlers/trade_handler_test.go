package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type mockFullTradeRepo struct {
	trades []domain.TradeDetail
}

func (m *mockFullTradeRepo) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	for _, t := range m.trades {
		if t.TransactionSignature == sig {
			return &t, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockFullTradeRepo) Create(ctx context.Context, trade *domain.TradeDetail) error {
	m.trades = append(m.trades, *trade)
	return nil
}

func (m *mockFullTradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	var filtered []domain.TradeDetail
	for _, t := range m.trades {
		if t.VaultID == vaultID {
			if tradeType == "" || t.TradeType == tradeType {
				filtered = append(filtered, t)
			}
		}
	}
	return filtered, int64(len(filtered)), nil
}

func (m *mockFullTradeRepo) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	var filtered []domain.TradeDetail
	idMap := make(map[string]bool)
	for _, id := range vaultIDs {
		idMap[id] = true
	}
	for _, t := range m.trades {
		if len(vaultIDs) == 0 || idMap[t.VaultID] {
			if tradeType == "" || t.TradeType == tradeType {
				filtered = append(filtered, t)
			}
		}
	}
	return filtered, int64(len(filtered)), nil
}

func TestTradeHandler_GetTrades(t *testing.T) {
	gin.SetMode(gin.TestMode)

	vaultID := "v-123"
	vaultAddress := "vault-addr-123"

	repo := &mockFullTradeRepo{
		trades: []domain.TradeDetail{
			{
				ID:                   "t1",
				VaultID:              vaultID,
				TransactionSignature: "sig1",
				TradeType:            "Deposit",
				AmountIn:             decimal.NewFromInt(100),
				ExecutedAt:           time.Now(),
			},
			{
				ID:                   "t2",
				VaultID:              vaultID,
				TransactionSignature: "sig2",
				TradeType:            "Withdraw",
				AmountIn:             decimal.NewFromInt(50),
				ExecutedAt:           time.Now(),
			},
		},
	}
	vaultRepo := &mockVaultRepository{vault: &domain.VaultDetail{ID: vaultID, Address: vaultAddress}}
	h := NewTradeHandler(repo, vaultRepo)

	t.Run("GetTrades_HappyPath", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: vaultAddress}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/"+vaultAddress+"/trades", nil)

		h.GetTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("GetTrades_FilterByType", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: vaultAddress}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/"+vaultAddress+"/trades?type=Deposit", nil)

		h.GetTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("GetTrades_VaultNotFound", func(t *testing.T) {
		vr := &mockVaultRepository{getByAddrErr: domain.ErrNotFound}
		hNotFound := NewTradeHandler(repo, vr)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: "unknown"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/unknown/trades", nil)

		hNotFound.GetTrades(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})

	t.Run("GetTrades_Pagination_Limits", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: vaultAddress}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/"+vaultAddress+"/trades?page=-1&limit=200", nil)

		h.GetTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("GetTrades_SQLInjectionInType", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "address", Value: vaultAddress}}
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/"+vaultAddress+"/trades?type=';%20DROP%20TABLE%20trades;--", nil)

		h.GetTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

func TestTradeHandler_GetBatchTrades(t *testing.T) {
	gin.SetMode(gin.TestMode)

	v1 := uuid.New().String()
	v2 := uuid.New().String()

	repo := &mockFullTradeRepo{
		trades: []domain.TradeDetail{
			{
				ID:                   uuid.New().String(),
				VaultID:              v1,
				TransactionSignature: "sig1",
				TradeType:            "buy",
				InputToken:           "SOL",
				OutputToken:          "USDC",
				AmountIn:             decimal.NewFromInt(10),
				AmountOut:            decimal.NewFromInt(100),
				PriceAtExecution:     decimal.NewFromInt(10),
				ExecutedAt:           time.Now(),
			},
			{
				ID:                   uuid.New().String(),
				VaultID:              v2,
				TransactionSignature: "sig2",
				TradeType:            "sell",
				InputToken:           "USDC",
				OutputToken:          "SOL",
				AmountIn:             decimal.NewFromInt(100),
				AmountOut:            decimal.NewFromInt(10),
				PriceAtExecution:     decimal.NewFromInt(10),
				ExecutedAt:           time.Now(),
			},
		},
	}

	handler := NewTradeHandler(repo, nil)

	t.Run("array query parameter format (vaultIds[]=v1&vaultIds[]=v2)", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("GET", "/api/v1/vaults/trades?vaultIds[]="+v1+"&vaultIds[]="+v2, nil)
		c.Request = req

		handler.GetBatchTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				Trades []batchTradeResponse `json:"trades"`
				Total  int64                `json:"total"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal response: %v", err)
		}

		if resp.Data.Total != 2 {
			t.Errorf("expected total 2, got %d", resp.Data.Total)
		}
	})

	t.Run("comma-separated query parameter format (vaultIds=v1,v2)", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("GET", "/api/v1/vaults/trades?vaultIds="+v1+","+v2, nil)
		c.Request = req

		handler.GetBatchTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})

	t.Run("over 50 vault IDs returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		url := "/api/v1/vaults/trades?"
		for i := 0; i < 51; i++ {
			if i > 0 {
				url += "&"
			}
			url += "vaultIds[]=id" + strconv.Itoa(i)
		}
		req, _ := http.NewRequest("GET", url, nil)
		c.Request = req

		handler.GetBatchTrades(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("duplicate vault IDs are deduplicated", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("GET", "/api/v1/vaults/trades?vaultIds[]="+v1+"&vaultIds[]="+v1, nil)
		c.Request = req

		handler.GetBatchTrades(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}
	})
}
