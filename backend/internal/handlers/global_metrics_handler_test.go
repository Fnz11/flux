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

type mockGlobalMetricsRepository struct {
	data *domain.GlobalMetrics
	err  error
}

func (m *mockGlobalMetricsRepository) GetGlobalMetrics(ctx context.Context) (*domain.GlobalMetrics, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.data, nil
}

func fullGlobalMetrics() *domain.GlobalMetrics {
	return &domain.GlobalMetrics{
		MarketData: domain.MarketData{
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
		},
		PlatformTVL:          "500000000",
		PlatformTVLChangePct: "3.1",
		PlatformATH:          "96091340",
		PlatformATHChangePct: "-2.3",
	}
}

func TestGlobalMetricsHandler_GetGlobalMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		repo           *mockGlobalMetricsRepository
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "happy path",
			repo:           &mockGlobalMetricsRepository{data: fullGlobalMetrics()},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "empty data",
			repo:           &mockGlobalMetricsRepository{data: &domain.GlobalMetrics{}},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "repository error",
			repo:           &mockGlobalMetricsRepository{err: errors.New("db down")},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  "failed to fetch global metrics",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewGlobalMetricsHandler(tt.repo)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/metrics/global", nil)

			h.GetGlobalMetrics(c)

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
				Success bool                    `json:"success"`
				Data    domain.GlobalMetrics    `json:"data"`
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

func TestGlobalMetricsHandler_GetGlobalMetrics_HappyPathFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	want := fullGlobalMetrics()
	h := NewGlobalMetricsHandler(&mockGlobalMetricsRepository{data: want})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/global", nil)

	h.GetGlobalMetrics(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		Success bool                   `json:"success"`
		Data    domain.GlobalMetrics   `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Data.MarketCap != want.MarketCap {
		t.Errorf("market_cap = %q, want %q", resp.Data.MarketCap, want.MarketCap)
	}
	if resp.Data.Volume24h != want.Volume24h {
		t.Errorf("volume_24h = %q, want %q", resp.Data.Volume24h, want.Volume24h)
	}
	if resp.Data.Rate != want.Rate {
		t.Errorf("rate = %q, want %q", resp.Data.Rate, want.Rate)
	}
	if !resp.Data.UpdatedAt.Equal(want.UpdatedAt) {
		t.Errorf("updated_at = %v, want %v", resp.Data.UpdatedAt, want.UpdatedAt)
	}
	if resp.Data.PlatformTVL != want.PlatformTVL {
		t.Errorf("platform_tvl = %q, want %q", resp.Data.PlatformTVL, want.PlatformTVL)
	}
	if resp.Data.PlatformTVLChangePct != want.PlatformTVLChangePct {
		t.Errorf("platform_tvl_change_pct = %q, want %q", resp.Data.PlatformTVLChangePct, want.PlatformTVLChangePct)
	}
	if resp.Data.PlatformATH != want.PlatformATH {
		t.Errorf("platform_ath = %q, want %q", resp.Data.PlatformATH, want.PlatformATH)
	}
	if resp.Data.PlatformATHChangePct != want.PlatformATHChangePct {
		t.Errorf("platform_ath_change_pct = %q, want %q", resp.Data.PlatformATHChangePct, want.PlatformATHChangePct)
	}
}

func TestGlobalMetricsHandler_GetGlobalMetrics_ContractShape(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewGlobalMetricsHandler(&mockGlobalMetricsRepository{data: fullGlobalMetrics()})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/global", nil)

	h.GetGlobalMetrics(c)

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

	// Every MarketStats key (frontend PerformanceChart) must be present.
	expectedMarketKeys := []string{
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
	for _, key := range expectedMarketKeys {
		if _, exists := data[key]; !exists {
			t.Errorf("missing contract key %q in data", key)
		}
		if _, isString := data[key].(string); !isString {
			t.Errorf("contract key %q is not a string, got %T", key, data[key])
		}
	}

	// Platform extensions ride on top (superset contract).
	expectedPlatformKeys := []string{
		"platform_tvl",
		"platform_tvl_change_pct",
		"platform_ath",
		"platform_ath_change_pct",
	}
	for _, key := range expectedPlatformKeys {
		if _, exists := data[key]; !exists {
			t.Errorf("missing contract key %q in data", key)
		}
		if _, isString := data[key].(string); !isString {
			t.Errorf("contract key %q is not a string, got %T", key, data[key])
		}
	}
}

func TestGlobalMetricsHandler_GetGlobalMetrics_NilRepoSafeguard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewGlobalMetricsHandler(nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/global", nil)

	h.GetGlobalMetrics(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 for nil repo, got %d", w.Code)
	}
}