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
	"github.com/shopspring/decimal"
)

var errGlobalFeed = errors.New("feed error")

type mockGlobalFeedRepo struct {
	items []domain.GlobalFeedItem
	total int64
	err   error
}

func (m *mockGlobalFeedRepo) ListGlobalFeed(ctx context.Context, filter domain.FeedFilter) ([]domain.GlobalFeedItem, int64, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	return m.items, m.total, nil
}

func newGlobalFeedTestRouter(repo domain.GlobalFeedRepository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewGlobalFeedHandler(repo)
	r := gin.New()
	r.GET("/api/v1/transactions", h.List)
	return r
}

func TestGlobalFeedHandler_List(t *testing.T) {
	now := time.Now().Truncate(time.Second).UTC()

	repo := &mockGlobalFeedRepo{
		items: []domain.GlobalFeedItem{
			{
				ID:                   "11111111-1111-1111-1111-111111111111",
				ExecutedAt:           now,
				Action:               "deposit",
				VaultID:              "22222222-2222-2222-2222-222222222222",
				VaultName:            "Alpha Fund",
				Symbol:               "SOL",
				Amount:               decimal.NewFromFloat(1234.56),
				TransactionSignature: "sig1111111111111111111111111111111111111111",
				Wallet:               "wallet11111111111111111111111111111111",
			},
			{
				ID:                   "33333333-3333-3333-3333-333333333333",
				ExecutedAt:           now.Add(-time.Hour),
				Action:               "swap",
				VaultID:              "44444444-4444-4444-4444-444444444444",
				VaultName:            "BetaVault",
				Symbol:               "SOL",
				Amount:               decimal.NewFromFloat(50),
				TransactionSignature: "sig2222222222222222222222222222222222222222",
				Wallet:               "wallet22222222222222222222222222222222",
			},
		},
		total: 2,
	}

	t.Run("HappyPath", func(t *testing.T) {
		router := newGlobalFeedTestRouter(repo)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions?page=1&limit=20", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
		}

		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				Items []globalFeedItemResponse `json:"items"`
				Total int64                    `json:"total"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if len(resp.Data.Items) != 2 {
			t.Fatalf("expected 2 items, got %d", len(resp.Data.Items))
		}
		if resp.Data.Total != 2 {
			t.Errorf("expected total 2, got %d", resp.Data.Total)
		}
		first := resp.Data.Items[0]
		if first.Action != "deposit" || first.VaultName != "Alpha Fund" || first.Symbol != "SOL" {
			t.Errorf("unexpected first item: %+v", first)
		}
		if resp.Data.Items[1].Action != "swap" {
			t.Errorf("unexpected second action: %s", resp.Data.Items[1].Action)
		}
	})

	t.Run("ClampsLimit", func(t *testing.T) {
		router := newGlobalFeedTestRouter(repo)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions?page=-1&limit=999", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("FiltersPassed", func(t *testing.T) {
		var captured domain.FeedFilter
		filteringRepo := &mockGlobalFeedRepo{items: repo.items, total: 1}
		router := newGlobalFeedTestRouter(&capturingGlobalFeedRepo{filteringRepo, &captured})
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions?type=withdraw&wallet=wallet11111111111111111111111111111111", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		if captured.Wallet != "wallet11111111111111111111111111111111" || captured.Type != "withdraw" {
			t.Errorf("unexpected filter captured: %+v", captured)
		}
	})

	t.Run("EmptyItems", func(t *testing.T) {
		emptyRepo := &mockGlobalFeedRepo{items: []domain.GlobalFeedItem{}, total: 0}
		router := newGlobalFeedTestRouter(emptyRepo)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		if !json.Valid(w.Body.Bytes()) {
			t.Fatalf("invalid JSON body: %s", w.Body.String())
		}
		var resp struct {
			Data struct {
				Items []json.RawMessage `json:"items"`
				Total int64             `json:"total"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if resp.Data.Items == nil || len(resp.Data.Items) != 0 {
			t.Errorf("expected empty items array, got %v", resp.Data.Items)
		}
		if resp.Data.Total != 0 {
			t.Errorf("expected total 0, got %d", resp.Data.Total)
		}
	})

	t.Run("RepoError", func(t *testing.T) {
		failingRepo := &mockGlobalFeedRepo{err: errGlobalFeed}
		router := newGlobalFeedTestRouter(failingRepo)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
		router.ServeHTTP(w, req)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("expected 500, got %d", w.Code)
		}
	})
}

type capturingGlobalFeedRepo struct {
	domain.GlobalFeedRepository
	filter *domain.FeedFilter
}

func (m *capturingGlobalFeedRepo) ListGlobalFeed(ctx context.Context, filter domain.FeedFilter) ([]domain.GlobalFeedItem, int64, error) {
	*m.filter = filter
	return m.GlobalFeedRepository.(*mockGlobalFeedRepo).items, m.GlobalFeedRepository.(*mockGlobalFeedRepo).total, nil
}
