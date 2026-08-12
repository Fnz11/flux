package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type mockMarketRepository struct {
	data *domain.MarketData
	err  error
}

func (m *mockMarketRepository) GetMarketData(ctx context.Context) (*domain.MarketData, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.data, nil
}

func fullMarketData() *domain.MarketData {
	return &domain.MarketData{
		MarketCap:            "1860000000000",
		MarketCapChangePct:   "10.4",
		CirculatingSupply:    "",
		CirculatingChangePct: "",
		Volume24h:            "63780000000",
		Volume24hChangePct:   "-6.7",
		ATH:                  "96091340",
		ATHChangePct:         "4.5",
		Rate:                 "150.25",
		RateChangePct:        "8.32",
		UpdatedAt:            time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
	}
}

func TestMarketHandler_GetMarket(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		repo           *mockMarketRepository
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "happy path",
			repo:           &mockMarketRepository{data: fullMarketData()},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "empty data",
			repo:           &mockMarketRepository{data: &domain.MarketData{}},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "repository error",
			repo:           &mockMarketRepository{err: errors.New("db down")},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  "failed to fetch market data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewMarketHandler(tt.repo)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/metrics/market", nil)

			h.GetMarket(c)

			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedError != "" {
				var resp APIResponse
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to unmarshal response: %v", err)
				}
				if resp.Success {
					t.Fatalf("expected success to be false")
				}
				if resp.Error != tt.expectedError {
					t.Fatalf("expected error message %q, got %q", tt.expectedError, resp.Error)
				}
				return
			}

			var resp struct {
				Success bool              `json:"success"`
				Data    domain.MarketData `json:"data"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to unmarshal response: %v", err)
			}
			if !resp.Success {
				t.Fatalf("expected success to be true")
			}
		})
	}
}

func TestMarketHandler_GetMarket_HappyPathFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	want := fullMarketData()
	h := NewMarketHandler(&mockMarketRepository{data: want})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/market", nil)

	h.GetMarket(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		Success bool              `json:"success"`
		Data    domain.MarketData `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Data.MarketCap != want.MarketCap {
		t.Errorf("market_cap = %q, want %q", resp.Data.MarketCap, want.MarketCap)
	}
	if resp.Data.MarketCapChangePct != want.MarketCapChangePct {
		t.Errorf("market_cap_change_pct = %q, want %q", resp.Data.MarketCapChangePct, want.MarketCapChangePct)
	}
	if resp.Data.CirculatingSupply != "" {
		t.Errorf("circulating_supply = %q, want empty", resp.Data.CirculatingSupply)
	}
	if resp.Data.Volume24h != want.Volume24h {
		t.Errorf("volume_24h = %q, want %q", resp.Data.Volume24h, want.Volume24h)
	}
	if resp.Data.Volume24hChangePct != want.Volume24hChangePct {
		t.Errorf("volume_24h_change_pct = %q, want %q", resp.Data.Volume24hChangePct, want.Volume24hChangePct)
	}
	if resp.Data.ATH != want.ATH {
		t.Errorf("ath = %q, want %q", resp.Data.ATH, want.ATH)
	}
	if resp.Data.ATHChangePct != want.ATHChangePct {
		t.Errorf("ath_change_pct = %q, want %q", resp.Data.ATHChangePct, want.ATHChangePct)
	}
	if resp.Data.Rate != want.Rate {
		t.Errorf("rate = %q, want %q", resp.Data.Rate, want.Rate)
	}
	if resp.Data.RateChangePct != want.RateChangePct {
		t.Errorf("rate_change_pct = %q, want %q", resp.Data.RateChangePct, want.RateChangePct)
	}
	if !resp.Data.UpdatedAt.Equal(want.UpdatedAt) {
		t.Errorf("updated_at = %v, want %v", resp.Data.UpdatedAt, want.UpdatedAt)
	}
}

func TestMarketHandler_GetMarket_ContractShape(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewMarketHandler(&mockMarketRepository{data: fullMarketData()})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/market", nil)

	h.GetMarket(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %T", resp["data"])
	}

	expectedKeys := []string{
		"market_cap",
		"market_cap_change_pct",
		"circulating_supply",
		"circulating_change_pct",
		"volume_24h",
		"volume_24h_change_pct",
		"ath",
		"ath_change_pct",
		"rate",
		"rate_change_pct",
		"updated_at",
	}
	for _, key := range expectedKeys {
		if _, exists := data[key]; !exists {
			t.Errorf("missing contract key %q in data", key)
		}
		if _, isString := data[key].(string); !isString {
			t.Errorf("contract key %q is not a string, got %T", key, data[key])
		}
	}
}

func TestMarketHandler_GetMarket_NilRepoSafeguard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewMarketHandler(nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/market", nil)

	h.GetMarket(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 for nil repo, got %d", w.Code)
	}
}