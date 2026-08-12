package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"testing"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/shopspring/decimal"
)

type stubLeaderboardRepo struct {
	calls int
	items []domain.LeaderboardItem
	err   error
}

func (s *stubLeaderboardRepo) GetLeaderboard(ctx context.Context, lbType string, limit int, period string) ([]domain.LeaderboardItem, error) {
	s.calls++
	return s.items, s.err
}

func lbItems(n int) []domain.LeaderboardItem {
	items := make([]domain.LeaderboardItem, 0, n)
	for i := 1; i <= n; i++ {
		sym := "TOKEN" + strconv.Itoa(i)
		items = append(items, domain.LeaderboardItem{
			Rank:   i,
			Name:   sym,
			Symbol: sym,
			Tag:    "VAULT",
			Volume: decimal.NewFromInt(int64(i)),
			Change: decimal.NewFromInt(int64(i)),
			Icon:   "",
		})
	}
	return items
}

func TestCachedLeaderboardRepository(t *testing.T) {
	items := lbItems(3)

	t.Run("cache_hit", func(t *testing.T) {
		by := newStubCache()
		by.Set(context.Background(), leaderboardCacheKey("trending", "7d"), items, 0)
		inner := &stubLeaderboardRepo{items: lbItems(50)}
		repo := NewCachedLeaderboardRepository(inner, by)

		got, err := repo.GetLeaderboard(context.Background(), "trending", 10, "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.calls != 0 {
			t.Errorf("inner called %d times on cache hit, want 0", inner.calls)
		}
		if len(got) != 3 || got[0].Symbol != "TOKEN1" {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("cache_miss_stores", func(t *testing.T) {
		by := newStubCache()
		inner := &stubLeaderboardRepo{items: lbItems(50)}
		repo := NewCachedLeaderboardRepository(inner, by)

		got, err := repo.GetLeaderboard(context.Background(), "gainers", 10, "30d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.calls != 1 {
			t.Errorf("inner called %d times, want 1", inner.calls)
		}
		if len(got) != 10 {
			t.Errorf("expected %d items, got %d", 10, len(got))
		}
		raw, ok := by.get(leaderboardCacheKey("gainers", "30d"))
		if !ok {
			t.Fatal("expected value stored in cache")
		}
		var stored []domain.LeaderboardItem
		if err := json.Unmarshal([]byte(raw), &stored); err != nil {
			t.Fatalf("stored value is not valid json: %v", err)
		}
		if len(stored) != 50 {
			t.Errorf("stored %d items, want max bucket of 50", len(stored))
		}
		if ttl, ok := by.ttl(leaderboardCacheKey("gainers", "30d")); !ok || ttl != cache.LeaderboardTTL {
			t.Errorf("ttl = %v, want %v", ttl, cache.LeaderboardTTL)
		}
	})

	t.Run("cache_error_degrades", func(t *testing.T) {
		by := newStubCache()
		by.getErr = errors.New("redis down")
		inner := &stubLeaderboardRepo{items: items}
		repo := NewCachedLeaderboardRepository(inner, by)

		got, err := repo.GetLeaderboard(context.Background(), "new", 10, "7d")
		if err != nil {
			t.Fatalf("cache failure must not fail the read: %v", err)
		}
		if inner.calls != 1 {
			t.Errorf("inner called %d times, want 1", inner.calls)
		}
		if len(got) != 3 {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("corrupt_cache_degrades", func(t *testing.T) {
		by := newStubCache()
		key := leaderboardCacheKey("gainers", "7d")
		by.seedRaw(key, "not-json")
		inner := &stubLeaderboardRepo{items: items}
		repo := NewCachedLeaderboardRepository(inner, by)

		got, err := repo.GetLeaderboard(context.Background(), "gainers", 10, "7d")
		if err != nil {
			t.Fatalf("corrupt cache must not fail the read: %v", err)
		}
		if inner.calls != 1 {
			t.Errorf("inner called %d times, want 1", inner.calls)
		}
		if len(got) != 3 {
			t.Errorf("unexpected result: %+v", got)
		}
		if raw, ok := by.get(key); !ok || raw == "not-json" {
			t.Error("expected corrupt value replaced in cache")
		}
	})

	t.Run("nil_cache_passes_through", func(t *testing.T) {
		inner := &stubLeaderboardRepo{items: items}
		repo := NewCachedLeaderboardRepository(inner, nil)

		got, err := repo.GetLeaderboard(context.Background(), "trending", 10, "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.calls != 1 {
			t.Errorf("inner called %d times, want 1", inner.calls)
		}
		if len(got) != 3 {
			t.Errorf("unexpected result: %+v", got)
		}
	})

	t.Run("inner_error_not_cached", func(t *testing.T) {
		by := newStubCache()
		inner := &stubLeaderboardRepo{err: domain.ErrInvalidInput}
		repo := NewCachedLeaderboardRepository(inner, by)

		_, err := repo.GetLeaderboard(context.Background(), "bogus", 10, "7d")
		if !errors.Is(err, domain.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
		if len(cacheKeys(by)) > 0 {
			t.Error("error results must not be cached")
		}
	})

	t.Run("limit_slices_from_shared_bucket", func(t *testing.T) {
		by := newStubCache()
		inner := &stubLeaderboardRepo{items: lbItems(50)}
		repo := NewCachedLeaderboardRepository(inner, by)

		gotSmall, err := repo.GetLeaderboard(context.Background(), "gainers", 10, "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		gotFull, err := repo.GetLeaderboard(context.Background(), "gainers", 50, "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inner.calls != 1 {
			t.Errorf("inner called %d times for two limits, want a single shared bucket", inner.calls)
		}
		if len(gotSmall) != 10 {
			t.Errorf("limit 10 returned %d items", len(gotSmall))
		}
		if len(gotFull) != 50 {
			t.Errorf("limit 50 returned %d items", len(gotFull))
		}
		if raw, ok := by.get(leaderboardCacheKey("gainers", "7d")); !ok || len(raw) == 0 {
			t.Error("expected shared bucket stored under unchanging key")
		}
	})
}

func cacheKeys(by *stubCache) []string {
	by.mu.Lock()
	defer by.mu.Unlock()
	keys := make([]string, 0, len(by.data))
	for k := range by.data {
		keys = append(keys, k)
	}
	return keys
}

func TestLeaderboardCacheKeys(t *testing.T) {
	t.Run("default_request_uses_legacy_key", func(t *testing.T) {
		if got := leaderboardCacheKey("trending", "7d"); got != cache.LeaderboardKey() {
			t.Errorf("leaderboardCacheKey(trending, 7d) = %q, want %q", got, cache.LeaderboardKey())
		}
		if got := leaderboardCacheKey("TRENDING", " 7D "); got != cache.LeaderboardKey() {
			t.Errorf("normalized default must map to legacy key, got %q", got)
		}
	})

	t.Run("scoped_keys_are_distinct", func(t *testing.T) {
		trending7d := cache.LeaderboardTypeKey("trending", "7d")
		gainers7d := cache.LeaderboardTypeKey("gainers", "7d")
		new7d := cache.LeaderboardTypeKey("new", "7d")
		trending30d := cache.LeaderboardTypeKey("trending", "30d")
		distinct := map[string]bool{}
		for _, k := range []string{trending7d, gainers7d, new7d, trending30d} {
			if distinct[k] {
				t.Errorf("key collision: %q reused", k)
			}
			distinct[k] = true
		}
	})

	t.Run("scoped_key_never_collides_with_legacy", func(t *testing.T) {
		if cache.LeaderboardTypeKey("trending", "7d") == cache.LeaderboardKey() {
			t.Errorf("type-scoped key must not equal the legacy base key")
		}
	})

	t.Run("prefix_covers_scoped_keys", func(t *testing.T) {
		prefix := cache.LeaderboardPrefix()
		for _, k := range []string{
			cache.LeaderboardTypeKey("trending", "7d"),
			cache.LeaderboardTypeKey("gainers", "24h"),
			cache.LeaderboardTypeKey("new", "30d"),
		} {
			if len(k) < len(prefix) || k[:len(prefix)] != prefix {
				t.Errorf("key %q does not start with leaderboard prefix %q", k, prefix)
			}
		}
		// The legacy single key (dashboard default) is deliberately a terminal
		// key, not a prefix child: it is invalidated by the existing single-key
		// invalidator, so it must not be expected under the prefix.
		if cache.LeaderboardKey() == prefix || len(cache.LeaderboardKey()) > len(prefix) && cache.LeaderboardKey()[:len(prefix)] == prefix {
			t.Errorf("legacy key %q must stay outside the scoped prefix %q", cache.LeaderboardKey(), prefix)
		}
	})
}
