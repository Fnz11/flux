package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type mockHistoryRepository struct {
	points []domain.HistoryPoint
	err    error
}

func (m *mockHistoryRepository) GetVaultSparkline(ctx context.Context, vaultID string, period string, resolution string) ([]domain.HistoryPoint, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.points, nil
}

func (m *mockHistoryRepository) GetPortfolioHistory(ctx context.Context, wallet string, period string) ([]domain.HistoryPoint, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.points, nil
}

const testWallet = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" // 44 chars

func TestHistoryHandler_GetVaultSparkline_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{points: []domain.HistoryPoint{}}
	h := NewHistoryHandler(repo)

	tests := []struct {
		name           string
		id             string
		path           string
		expectedStatus int
		expectedErrMsg string
	}{
		{
			name:           "missing vault id",
			id:             "",
			path:           "/api/v1/vaults//sparkline",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "vault id is required",
		},
		{
			name:           "invalid range",
			id:             "abc",
			path:           "/api/v1/vaults/abc/sparkline?range=1y",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid range parameter",
		},
		{
			name:           "invalid resolution",
			id:             "abc",
			path:           "/api/v1/vaults/abc/sparkline?resolution=week",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid resolution parameter",
		},
		{
			name:           "valid range and resolution",
			id:             "abc",
			path:           "/api/v1/vaults/abc/sparkline?range=7d&resolution=hour",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "defaults resolve",
			id:             "abc",
			path:           "/api/v1/vaults/abc/sparkline",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", tt.path, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.id}}

			h.GetVaultSparkline(c)

			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedErrMsg != "" {
				var resp APIResponse
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
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

func TestHistoryHandler_GetVaultSparkline_SuccessResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{
		points: []domain.HistoryPoint{
			{Date: "2026-07-20T00:00:00Z", Value: decimal.NewFromFloat(1000000.50)},
			{Date: "2026-07-21T00:00:00Z", Value: decimal.NewFromFloat(1001000.50)},
		},
	}
	h := NewHistoryHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/vaults/abc/sparkline?range=30d", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}

	h.GetVaultSparkline(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		Data domain.VaultSparklineResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Data.VaultID != "abc" || resp.Data.Range != "30d" {
		t.Fatalf("unexpected vault sparkline metadata: %+v", resp.Data)
	}
	if len(resp.Data.Points) != 2 {
		t.Fatalf("expected 2 points, got %d", len(resp.Data.Points))
	}
	if resp.Data.Points[0].Date != "2026-07-20T00:00:00Z" {
		t.Fatalf("unexpected date format %q", resp.Data.Points[0].Date)
	}
	if !resp.Data.Points[0].Value.Equal(decimal.NewFromFloat(1000000.50)) {
		t.Fatalf("unexpected value %v", resp.Data.Points[0].Value)
	}
}

func TestHistoryHandler_GetVaultSparkline_EmptyPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{points: nil}
	h := NewHistoryHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/vaults/abc/sparkline", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}

	h.GetVaultSparkline(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if body := w.Body.String(); !strings.Contains(body, `"points":[]`) {
		t.Fatalf("expected empty points array in response, got %s", body)
	}
}

func TestHistoryHandler_GetVaultSparkline_RepositoryError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{err: errors.New("db error")}
	h := NewHistoryHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/vaults/abc/sparkline", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}

	h.GetVaultSparkline(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestHistoryHandler_GetPortfolioHistory_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{points: []domain.HistoryPoint{}}
	h := NewHistoryHandler(repo)

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		expectedErrMsg string
	}{
		{
			name:           "missing wallet",
			path:           "/api/v1/portfolio/history",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "wallet parameter is required",
		},
		{
			name:           "invalid wallet",
			path:           "/api/v1/portfolio/history?wallet=abc",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid wallet address",
		},
		{
			name:           "invalid range",
			path:           "/api/v1/portfolio/history?wallet=" + testWallet + "&range=1y",
			expectedStatus: http.StatusBadRequest,
			expectedErrMsg: "invalid range parameter",
		},
		{
			name:           "valid request",
			path:           "/api/v1/portfolio/history?wallet=" + testWallet + "&range=30d",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "valid request defaults",
			path:           "/api/v1/portfolio/history?wallet=" + testWallet,
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", tt.path, nil)

			h.GetPortfolioHistory(c)

			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedErrMsg != "" {
				var resp APIResponse
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
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

func TestHistoryHandler_GetPortfolioHistory_SuccessResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{
		points: []domain.HistoryPoint{
			{Date: "2026-08-08", Value: decimal.NewFromFloat(2500000)},
		},
	}
	h := NewHistoryHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/history?wallet="+testWallet+"&range=30d", nil)

	h.GetPortfolioHistory(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		Data domain.PortfolioHistoryResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if resp.Data.Wallet != testWallet || resp.Data.Range != "30d" {
		t.Fatalf("unexpected portfolio history metadata: %+v", resp.Data)
	}
	if len(resp.Data.Points) != 1 {
		t.Fatalf("expected 1 point, got %d", len(resp.Data.Points))
	}
	if resp.Data.Points[0].Date != "2026-08-08" {
		t.Fatalf("unexpected date format %q", resp.Data.Points[0].Date)
	}
	if !resp.Data.Points[0].Value.Equal(decimal.NewFromFloat(2500000)) {
		t.Fatalf("unexpected value %v", resp.Data.Points[0].Value)
	}
}

func TestHistoryHandler_GetPortfolioHistory_RepositoryError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockHistoryRepository{err: errors.New("db error")}
	h := NewHistoryHandler(repo)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/history?wallet="+testWallet, nil)

	h.GetPortfolioHistory(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
}

func TestHistoryHandler_NilRepoSafeguard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHistoryHandler(nil)

	t.Run("sparkline", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/vaults/abc/sparkline", nil)
		c.Params = gin.Params{{Key: "id", Value: "abc"}}

		h.GetVaultSparkline(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("expected status 500 for nil repo, got %d", w.Code)
		}
	})

	t.Run("portfolio history", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/portfolio/history?wallet="+testWallet, nil)

		h.GetPortfolioHistory(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("expected status 500 for nil repo, got %d", w.Code)
		}
	})
}
