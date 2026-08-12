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

type fakeLeaderboardRepository struct {
	items []domain.LeaderboardItem
	err   error
}

func (f *fakeLeaderboardRepository) GetLeaderboard(ctx context.Context, lbType string, limit int, period string) ([]domain.LeaderboardItem, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.items, nil
}

func doLeaderboardRequest(h *LeaderboardHandler, path string) (*httptest.ResponseRecorder, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", path, nil)
	h.GetLeaderboard(c)
	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w, body
}

func TestLeaderboardHandler_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &fakeLeaderboardRepository{items: []domain.LeaderboardItem{}}
	h := NewLeaderboardHandler(repo)

	tests := []struct {
		name           string
		query          string
		expectedStatus int
	}{
		{name: "invalid type", query: "?type=wat", expectedStatus: http.StatusBadRequest},
		{name: "valid trending", query: "?type=trending", expectedStatus: http.StatusOK},
		{name: "valid gainers", query: "?type=gainers", expectedStatus: http.StatusOK},
		{name: "valid new", query: "?type=new", expectedStatus: http.StatusOK},
		{name: "default type is trending", query: "", expectedStatus: http.StatusOK},
		{name: "default period is 7d", query: "?type=trending", expectedStatus: http.StatusOK},
		{name: "limit clamped high", query: "?limit=999", expectedStatus: http.StatusOK},
		{name: "limit clamped low", query: "?limit=0", expectedStatus: http.StatusOK},
		{name: "type case insensitive", query: "?type=TRENDING", expectedStatus: http.StatusOK},
		{name: "limit non-numeric uses default", query: "?limit=abc", expectedStatus: http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := doLeaderboardRequest(h, "/api/v1/metrics/leaderboard"+tt.query)
			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d, body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}
		})
	}
}

func TestLeaderboardHandler_DefaultTypeAndEmptyItems(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewLeaderboardHandler(&fakeLeaderboardRepository{items: nil})

	w, body := doLeaderboardRequest(h, "/api/v1/metrics/leaderboard")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	data, _ := body["data"].(map[string]interface{})
	if data["type"] != "trending" {
		t.Errorf("expected default type trending, got %v", data["type"])
	}
	items, _ := data["items"].([]interface{})
	if len(items) != 0 {
		t.Errorf("expected empty items for nil repo result, got %d", len(items))
	}
}

func TestLeaderboardHandler_SuccessResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &fakeLeaderboardRepository{items: []domain.LeaderboardItem{
		{
			Rank:   1,
			Name:   "Super Rare SOL",
			Symbol: "SOL",
			Tag:    "VAULT",
			Volume: decimal.NewFromFloat(1234567.89),
			Change: decimal.NewFromFloat(28.32),
			Icon:   "https://example.com/sol.png",
		},
	}}
	h := NewLeaderboardHandler(repo)

	w, body := doLeaderboardRequest(h, "/api/v1/metrics/leaderboard?type=trending&limit=1&period=24h")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if body["success"] != true {
		t.Errorf("expected success true, got %v", body["success"])
	}
	data, _ := body["data"].(map[string]interface{})
	if data["type"] != "trending" {
		t.Errorf("expected type trending, got %v", data["type"])
	}
	items, _ := data["items"].([]interface{})
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	item := items[0].(map[string]interface{})
	if item["symbol"] != "SOL" {
		t.Errorf("expected symbol SOL, got %v", item["symbol"])
	}
	if v, ok := item["volume"].(string); !ok || v != "1234567.89" {
		t.Errorf("expected volume 1234567.89, got %v", item["volume"])
	}
	if v, ok := item["change"].(string); !ok || v != "28.32" {
		t.Errorf("expected change 28.32, got %v", item["change"])
	}
	if item["icon"] != "https://example.com/sol.png" {
		t.Errorf("expected icon URL, got %v", item["icon"])
	}
}

func TestLeaderboardHandler_RepositoryError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewLeaderboardHandler(&fakeLeaderboardRepository{err: errors.New("db down")})

	w, body := doLeaderboardRequest(h, "/api/v1/metrics/leaderboard?type=trending")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
	if body["success"] != false {
		t.Errorf("expected success false, got %v", body["success"])
	}
}

func TestLeaderboardHandler_NilRepoSafeguard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewLeaderboardHandler(nil)

	w, _ := doLeaderboardRequest(h, "/api/v1/metrics/leaderboard")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for nil repo, got %d", w.Code)
	}
}
