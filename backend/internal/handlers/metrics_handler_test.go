package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type mockMetricsRepository struct {
	response *domain.MetricSeriesResponse
	err      error
}

func (m *mockMetricsRepository) GetMetricSeries(ctx context.Context, vaultID string, metric string, period string) (*domain.MetricSeriesResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.response, nil
}

func TestMetricsHandler_GetMetricsSeries_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockMetricsRepository{
		response: &domain.MetricSeriesResponse{Series: []domain.MetricDataPoint{}},
	}
	h := NewMetricsHandler(repo)

	tests := []struct {
		name           string
		query          string
		expectedStatus int
		expectedErrMsg string
	}{
		{
			name:           "missing metric",
			query:          "?period=7d",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid metric parameter",
		},
		{
			name:           "invalid metric",
			query:          "?metric=invalid&period=7d",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid metric parameter",
		},
		{
			name:           "invalid period",
			query:          "?metric=tvl&period=1d",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid period parameter",
		},
		{
			name:           "missing period uses default 30d",
			query:          "?metric=tvl",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid tvl 7d",
			query:          "?metric=tvl&period=7d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid tvl 14d",
			query:          "?metric=tvl&period=14d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid invested 30d",
			query:          "?metric=invested&period=30d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid pnl 7d",
			query:          "?metric=pnl&period=7d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid fees 7d",
			query:          "?metric=fees&period=7d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid volume 7d",
			query:          "?metric=volume&period=7d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid vault ID filtering",
			query:          "?metric=invested&period=14d&vault_id=123",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "SQL injection in metric",
			query:          "?metric=tvl';%20DROP%20TABLE--",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid metric parameter",
		},
		{
			name:           "SQL injection in vault_id",
			query:          "?metric=tvl&vault_id=';%20DELETE%20FROM",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/api/v1/metrics/series"+tt.query, nil)

			h.GetMetricsSeries(c)

			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedErrMsg != "" {
				var resp APIResponse
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				if err != nil {
					t.Fatalf("failed to unmarshal response: %v", err)
				}
				if resp.Success {
					t.Fatalf("expected success to be false for error response")
				}
				if resp.Error != tt.expectedErrMsg {
					t.Fatalf("expected error message %q, got %q", tt.expectedErrMsg, resp.Error)
				}
			}
		})
	}
}

func TestMetricsHandler_GetMetricsSeries_SuccessResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testResp := &domain.MetricSeriesResponse{
		Metric: "tvl",
		Period: "7d",
		Summary: domain.MetricSummary{
			Total: decimal.NewFromFloat(1500.50),
		},
		Series: []domain.MetricDataPoint{
			{
				Date:  "2026-07-07",
				Value: decimal.NewFromFloat(1500.50),
			},
		},
	}
	repo := &mockMetricsRepository{response: testResp}
	h := NewMetricsHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/series?metric=tvl&period=7d", nil)

	h.GetMetricsSeries(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp domain.MetricSeriesResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	if err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Metric != "tvl" {
		t.Fatalf("expected metric 'tvl', got %q", resp.Metric)
	}
}

func TestMetricsHandler_GetMetricsSeries_RepositoryError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockMetricsRepository{err: errors.New("db error")}
	h := NewMetricsHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/series?metric=tvl&period=7d", nil)

	h.GetMetricsSeries(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestMetricsHandler_NilRepoSafeguard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewMetricsHandler(nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/metrics/series?metric=tvl", nil)

	h.GetMetricsSeries(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 for nil repo, got %d", w.Code)
	}
}
