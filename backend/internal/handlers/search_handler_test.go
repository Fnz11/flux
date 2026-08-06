package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type fakeSearchRepository struct {
	matches []domain.SearchVaultMatch
	err     error
}

func (f *fakeSearchRepository) SearchVaults(ctx context.Context, q string, limit int) ([]domain.SearchVaultMatch, error) {
	if f.err != nil {
		return nil, f.err
	}
	if len(f.matches) > limit {
		return f.matches[:limit], nil
	}
	return f.matches, nil
}

func newSearchTestHandler(repo domain.SearchRepository) *SearchHandler {
	return NewSearchHandler(services.NewSearchService(repo))
}

func doSearchRequest(h *SearchHandler, path string) (*httptest.ResponseRecorder, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", path, nil)
	h.Search(c)
	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w, body
}

func TestSearchHandler_PairsRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("manager_returns_pairs", func(t *testing.T) {
		h := newSearchTestHandler(&fakeSearchRepository{})
		w, body := doSearchRequest(h, "/api/v1/search?q=sol&role=manager")

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}
		data, _ := body["data"].(map[string]interface{})
		if data["kind"] != "pairs" {
			t.Errorf("expected kind pairs, got %v", data["kind"])
		}
		items, _ := data["items"].([]interface{})
		if len(items) != 2 {
			t.Errorf("expected 2 pairs for 'sol', got %d: %v", len(items), items)
		}
	})

	t.Run("manager_case_insensitive_base_or_quote", func(t *testing.T) {
		h := newSearchTestHandler(&fakeSearchRepository{})
		_, body := doSearchRequest(h, "/api/v1/search?q=btc&role=manager")

		data, _ := body["data"].(map[string]interface{})
		items, _ := data["items"].([]interface{})
		if len(items) != 1 {
			t.Fatalf("expected 1 pair for 'btc', got %d", len(items))
		}
		sym, _ := items[0].(map[string]interface{})["symbol"]
		if sym != "BTC/USDC" {
			t.Errorf("expected BTC/USDC, got %v", sym)
		}
	})

	t.Run("manager_symbol_slash_match", func(t *testing.T) {
		h := newSearchTestHandler(&fakeSearchRepository{})
		_, body := doSearchRequest(h, "/api/v1/search?q=SOL/USDC&role=manager")

		data, _ := body["data"].(map[string]interface{})
		items, _ := data["items"].([]interface{})
		if len(items) != 1 {
			t.Errorf("expected 1 pair for 'SOL/USDC', got %d", len(items))
		}
	})

	t.Run("manager_limit_cap_at_50", func(t *testing.T) {
		h := newSearchTestHandler(&fakeSearchRepository{})
		_, body := doSearchRequest(h, "/api/v1/search?q=/&role=manager&limit=999")

		data, _ := body["data"].(map[string]interface{})
		items, _ := data["items"].([]interface{})
		if len(items) != 7 {
			t.Errorf("expected all 7 pairs (limit capped), got %d", len(items))
		}
	})

	t.Run("manager_no_match", func(t *testing.T) {
		h := newSearchTestHandler(&fakeSearchRepository{})
		w, body := doSearchRequest(h, "/api/v1/search?q=zzz&role=manager")

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := body["data"].(map[string]interface{})
		items, _ := data["items"].([]interface{})
		if len(items) != 0 {
			t.Errorf("expected 0 items, got %d", len(items))
		}
	})
}

func TestSearchHandler_VaultsRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeSearchRepository{
		matches: []domain.SearchVaultMatch{
			{ID: "v1", Address: "addr1", DisplayName: "Sol Capital", TVL: decimal.NewFromFloat(100.0)},
			{ID: "v2", Address: "addr2", DisplayName: "Bonk DAO", TVL: decimal.NewFromFloat(200.0)},
		},
	}
	h := newSearchTestHandler(fake)

	t.Run("investor_returns_vaults", func(t *testing.T) {
		w, body := doSearchRequest(h, "/api/v1/search?q=sol&role=investor")

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}
		data, _ := body["data"].(map[string]interface{})
		if data["kind"] != "vaults" {
			t.Errorf("expected kind vaults, got %v", data["kind"])
		}
		items, _ := data["items"].([]interface{})
		if len(items) != 2 {
			t.Fatalf("expected 2 vaults, got %d", len(items))
		}
		first, _ := items[0].(map[string]interface{})
		if first["display_name"] != "Sol Capital" {
			t.Errorf("expected display_name Sol Capital, got %v", first["display_name"])
		}
		if first["tvl"] != "100" {
			t.Errorf("expected tvl 100, got %v", first["tvl"])
		}
	})

	t.Run("default_role_is_investor", func(t *testing.T) {
		_, body := doSearchRequest(h, "/api/v1/search?q=sol")

		data, _ := body["data"].(map[string]interface{})
		if data["kind"] != "vaults" {
			t.Errorf("expected default kind vaults, got %v", data["kind"])
		}
	})

	t.Run("investor_limit_applied", func(t *testing.T) {
		_, body := doSearchRequest(h, "/api/v1/search?q=sol&role=investor&limit=1")

		data, _ := body["data"].(map[string]interface{})
		items, _ := data["items"].([]interface{})
		if len(items) != 1 {
			t.Errorf("expected 1 vault with limit=1, got %d", len(items))
		}
	})
}

func TestSearchHandler_EmptyQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := newSearchTestHandler(&fakeSearchRepository{})

	t.Run("empty_q_returns_empty_items", func(t *testing.T) {
		w, body := doSearchRequest(h, "/api/v1/search?q=%20%20")

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := body["data"].(map[string]interface{})
		items, ok := data["items"].([]interface{})
		if !ok || len(items) != 0 {
			t.Errorf("expected empty items array, got %v", data["items"])
		}
	})
}

func TestSearchHandler_VaultsError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := newSearchTestHandler(&fakeSearchRepository{err: context.DeadlineExceeded})

	w, body := doSearchRequest(h, "/api/v1/search?q=sol&role=investor")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
	if body["success"] != false {
		t.Errorf("expected success false, got %v", body["success"])
	}
}