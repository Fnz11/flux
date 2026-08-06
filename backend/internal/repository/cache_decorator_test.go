package repository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/shopspring/decimal"
)

func dec(s string) decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return d
}

type stubCache struct {
	mu      sync.Mutex
	data    map[string]string
	ttls    map[string]time.Duration
	deletes []string
	getErr  error
}

func newStubCache() *stubCache {
	return &stubCache{data: map[string]string{}, ttls: map[string]time.Duration{}}
}

func (s *stubCache) Get(ctx context.Context, key string, dst any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.getErr != nil {
		return s.getErr
	}
	raw, ok := s.data[key]
	if !ok {
		return errors.New("cache miss")
	}
	return json.Unmarshal([]byte(raw), dst)
}

func (s *stubCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return s.SetWithTTL(ctx, key, value, ttl)
}

func (s *stubCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = string(raw)
	s.ttls[key] = ttl
	return nil
}

func (s *stubCache) Delete(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deletes = append(s.deletes, key)
	delete(s.data, key)
	return nil
}

func (s *stubCache) Ping(ctx context.Context) error { return nil }

func (s *stubCache) seedRaw(key, raw string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = raw
}

func (s *stubCache) get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.data[key]
	return v, ok
}

func (s *stubCache) ttl(key string) (time.Duration, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.ttls[key]
	return v, ok
}

type stubPortfolioRepo struct {
	getByUserCalls int
	upsertCalls    int
	reduceCalls    int
	upsertErr      error
	reduceErr      error
	details        []domain.PortfolioDetail
	summary        *domain.PortfolioSummary
	pnlSummary     *domain.UserPnLSummary
	totalShares    decimal.Decimal
	summaryErr     error
	pnlSummaryErr  error
}

func (s *stubPortfolioRepo) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	s.getByUserCalls++
	return s.details, nil
}

func (s *stubPortfolioRepo) UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice decimal.Decimal) error {
	s.upsertCalls++
	return s.upsertErr
}

func (s *stubPortfolioRepo) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error {
	s.reduceCalls++
	return s.reduceErr
}

func (s *stubPortfolioRepo) GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error) {
	return s.totalShares, nil
}

func (s *stubPortfolioRepo) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	return s.summary, s.summaryErr
}

func (s *stubPortfolioRepo) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	return s.pnlSummary, s.pnlSummaryErr
}

func (s *stubPortfolioRepo) GetHolderUserIDs(ctx context.Context, vaultID string) ([]string, error) {
	return nil, nil
}

type stubTradeRepo struct {
	findCalls int
	createErr error
	trade     *domain.TradeDetail
}

func (s *stubTradeRepo) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	s.findCalls++
	if s.trade == nil {
		return nil, domain.ErrNotFound
	}
	return s.trade, nil
}

func (s *stubTradeRepo) Create(ctx context.Context, trade *domain.TradeDetail) error {
	return s.createErr
}

func (s *stubTradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return nil, 0, nil
}

func (s *stubTradeRepo) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return nil, 0, nil
}

func TestCachedPortfolioRepository_GetByUser(t *testing.T) {
	details := []domain.PortfolioDetail{{VaultID: "v1", SharesOwned: dec("10"), PnL: dec("42.5")}}

	t.Run("cache_hit", func(t *testing.T) {
		cache := newStubCache()
		cache.Set(context.Background(), portfolioKey("u1"), details, 0)
		inner := &stubPortfolioRepo{details: details}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetByUser(context.Background(), "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.getByUserCalls != 0 {
			t.Errorf("inner called %d times on cache hit, want 0", inner.getByUserCalls)
		}
		if len(got) != 1 || got[0].VaultID != "v1" || !got[0].PnL.Equal(dec("42.5")) {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("cache_miss_stores", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{details: details}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetByUser(context.Background(), "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.getByUserCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.getByUserCalls)
		}
		if len(got) != 1 {
			t.Fatalf("unexpected result: %+v", got)
		}
		raw, ok := cache.get(portfolioKey("u1"))
		if !ok {
			t.Fatal("expected value stored in cache")
		}
		var stored []domain.PortfolioDetail
		if err := json.Unmarshal([]byte(raw), &stored); err != nil {
			t.Fatalf("stored value is not valid json: %v", err)
		}
		if len(stored) != 1 || stored[0].VaultID != "v1" {
			t.Errorf("stored value mismatch: %+v", stored)
		}
		if ttl, ok := cache.ttl(portfolioKey("u1")); !ok || ttl != portfolioTTL {
			t.Errorf("ttl = %v, want %v", ttl, portfolioTTL)
		}
	})

	t.Run("cache_error_degrades", func(t *testing.T) {
		cache := newStubCache()
		cache.getErr = errors.New("redis down")
		inner := &stubPortfolioRepo{details: details}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetByUser(context.Background(), "u1")
		if err != nil {
			t.Fatalf("cache failure must not fail the read: %v", err)
		}
		if inner.getByUserCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.getByUserCalls)
		}
		if len(got) != 1 {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("corrupt_cache_degrades", func(t *testing.T) {
		cache := newStubCache()
		cache.seedRaw(portfolioKey("u1"), "not-json")
		inner := &stubPortfolioRepo{details: details}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetByUser(context.Background(), "u1")
		if err != nil {
			t.Fatalf("corrupt cache must not fail the read: %v", err)
		}
		if inner.getByUserCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.getByUserCalls)
		}
		if len(got) != 1 {
			t.Errorf("unexpected result: %+v", got)
		}
		if _, ok := cache.get(portfolioKey("u1")); !ok {
			t.Error("expected corrupt value replaced in cache")
		}
	})

	t.Run("nil_cache_pass_through", func(t *testing.T) {
		inner := &stubPortfolioRepo{details: details}
		repo := NewCachedPortfolioRepository(inner, nil)

		got, err := repo.GetByUser(context.Background(), "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.getByUserCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.getByUserCalls)
		}
		if len(got) != 1 {
			t.Errorf("unexpected result: %+v", got)
		}
	})
}

func TestCachedPortfolioRepository_Summaries(t *testing.T) {
	summary := &domain.PortfolioSummary{UserID: "u1", VaultCount: 2, TotalInvested: dec("1000")}
	pnl := &domain.UserPnLSummary{UserID: "u1", TotalPnL: dec("500")}

	t.Run("summary_hit", func(t *testing.T) {
		cache := newStubCache()
		cache.Set(context.Background(), portfolioSummaryKey("u1"), summary, 0)
		inner := &stubPortfolioRepo{summary: summary}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetPortfolioSummary(context.Background(), "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.VaultCount != 2 {
			t.Errorf("VaultCount = %v, want 2", got.VaultCount)
		}
	})

	t.Run("pnl_miss_stores", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{pnlSummary: pnl}
		repo := NewCachedPortfolioRepository(inner, cache)

		got, err := repo.GetUserPnLSummary(context.Background(), "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !got.TotalPnL.Equal(dec("500")) {
			t.Errorf("TotalPnL = %v, want 500", got.TotalPnL)
		}
		if ttl, ok := cache.ttl(pnlSummaryKey("u1")); !ok || ttl != summaryTTL {
			t.Errorf("ttl = %v, want %v", ttl, summaryTTL)
		}
	})

	t.Run("summary_error_not_cached", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{summaryErr: domain.ErrNotFound}
		repo := NewCachedPortfolioRepository(inner, cache)

		_, err := repo.GetPortfolioSummary(context.Background(), "u1")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
		if _, ok := cache.get(portfolioSummaryKey("u1")); ok {
			t.Error("error results must not be cached")
		}
	})
}

func TestCachedPortfolioRepository_WritesInvalidate(t *testing.T) {
	expectedKeys := []string{
		portfolioKey("u1"),
		vaultTotalSharesKey("v1"),
		portfolioSummaryKey("u1"),
		pnlSummaryKey("u1"),
	}

	assertDeleted := func(t *testing.T, cache *stubCache) {
		t.Helper()
		cache.mu.Lock()
		defer cache.mu.Unlock()
		for _, want := range expectedKeys {
			found := false
			for _, got := range cache.deletes {
				if got == want {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("expected cache key %q to be invalidated", want)
			}
		}
	}

	t.Run("upsert_invalidates", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{}
		repo := NewCachedPortfolioRepository(inner, cache)

		if err := repo.UpsertPosition(context.Background(), "u1", "v1", dec("10"), dec("100"), dec("10")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.upsertCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.upsertCalls)
		}
		assertDeleted(t, cache)
	})

	t.Run("reduce_invalidates", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{}
		repo := NewCachedPortfolioRepository(inner, cache)

		if err := repo.ReducePosition(context.Background(), "u1", "v1", dec("5")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.reduceCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.reduceCalls)
		}
		assertDeleted(t, cache)
	})

	t.Run("no_invalidation_on_error", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubPortfolioRepo{upsertErr: errors.New("db down")}
		repo := NewCachedPortfolioRepository(inner, cache)

		if err := repo.UpsertPosition(context.Background(), "u1", "v1", dec("10"), dec("100"), dec("10")); err == nil {
			t.Fatal("expected error")
		}
		cache.mu.Lock()
		defer cache.mu.Unlock()
		if len(cache.deletes) != 0 {
			t.Errorf("no invalidation expected on write error, got %v", cache.deletes)
		}
	})

	t.Run("nil_cache_writes_pass_through", func(t *testing.T) {
		inner := &stubPortfolioRepo{}
		repo := NewCachedPortfolioRepository(inner, nil)

		if err := repo.UpsertPosition(context.Background(), "u1", "v1", dec("10"), dec("100"), dec("10")); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.upsertCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.upsertCalls)
		}
	})
}

func TestCachedTradeRepository(t *testing.T) {
	trade := &domain.TradeDetail{ID: "t1", TransactionSignature: "sig-abc", AmountIn: dec("100")}

	t.Run("signature_hit", func(t *testing.T) {
		cache := newStubCache()
		cache.Set(context.Background(), tradeSigKey("sig-abc"), trade, 0)
		inner := &stubTradeRepo{trade: trade}
		repo := NewCachedTradeRepository(inner, cache)

		got, err := repo.FindBySignature(context.Background(), "sig-abc")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.findCalls != 0 {
			t.Errorf("inner called %d times on cache hit, want 0", inner.findCalls)
		}
		if got.TransactionSignature != "sig-abc" {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("create_invalidates_signature", func(t *testing.T) {
		cache := newStubCache()
		inner := &stubTradeRepo{}
		repo := NewCachedTradeRepository(inner, cache)

		if err := repo.Create(context.Background(), trade); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		cache.mu.Lock()
		defer cache.mu.Unlock()
		if len(cache.deletes) != 1 || cache.deletes[0] != tradeSigKey("sig-abc") {
			t.Errorf("expected invalidation of %q, got %v", tradeSigKey("sig-abc"), cache.deletes)
		}
	})

	t.Run("nil_cache_pass_through", func(t *testing.T) {
		inner := &stubTradeRepo{trade: trade}
		repo := NewCachedTradeRepository(inner, nil)

		got, err := repo.FindBySignature(context.Background(), "sig-abc")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.findCalls != 1 {
			t.Errorf("inner called %d times, want 1", inner.findCalls)
		}
		if got.TransactionSignature != "sig-abc" {
			t.Errorf("unexpected result: %+v", got)
		}
	})
}
