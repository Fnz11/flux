package cache

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

type memEntry struct {
	raw []byte
	ttl time.Duration
}

type memCache struct {
	mu   sync.Mutex
	data map[string]memEntry
}

func newMemCache() *memCache {
	return &memCache{data: make(map[string]memEntry)}
}

func (m *memCache) Get(ctx context.Context, key string, dest any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.data[key]
	if !ok {
		return redis.Nil
	}
	return unmarshal(e.raw, dest)
}

func (m *memCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return m.SetWithTTL(ctx, key, value, ttl)
}

func (m *memCache) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}

func (m *memCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := marshal(value)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = memEntry{raw: raw, ttl: ttl}
	return nil
}

func (m *memCache) Ping(ctx context.Context) error { return nil }

func (m *memCache) ttlOf(key string) (time.Duration, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.data[key]
	return e.ttl, ok
}

type portfolioSnapshot struct {
	UserID      string  `json:"user_id"`
	TotalValue  float64 `json:"total_value"`
	ProfitLoss  float64 `json:"profit_loss"`
	HoldingList []struct {
		VaultAddress string  `json:"vault_address"`
		Shares       float64 `json:"shares"`
	} `json:"holdings"`
}

func testPortfolio() portfolioSnapshot {
	return portfolioSnapshot{
		UserID:     "user-1",
		TotalValue: 1234.56,
		ProfitLoss: 99.99,
		HoldingList: []struct {
			VaultAddress string  `json:"vault_address"`
			Shares       float64 `json:"shares"`
		}{{VaultAddress: "vault-abc", Shares: 42.0}},
	}
}

func TestSetGetRoundTrip(t *testing.T) {
	m := newMemCache()
	ctx := context.Background()
	key := UserPortfolioKey("user-1")
	want := testPortfolio()

	if err := m.Set(ctx, key, want, PortfolioTTL); err != nil {
		t.Fatalf("Set: %v", err)
	}

	var got portfolioSnapshot
	if err := m.Get(ctx, key, &got); err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.UserID != want.UserID || got.TotalValue != want.TotalValue || got.ProfitLoss != want.ProfitLoss {
		t.Fatalf("round trip mismatch: got %+v, want %+v", got, want)
	}
	if len(got.HoldingList) != 1 || got.HoldingList[0].VaultAddress != "vault-abc" || got.HoldingList[0].Shares != 42.0 {
		t.Fatalf("holding list mismatch: got %+v", got.HoldingList)
	}
}

func TestSetWithTTLRoundTrip(t *testing.T) {
	m := newMemCache()
	ctx := context.Background()
	key := VaultSummaryKey("vault-abc")
	want := testPortfolio()

	if err := m.SetWithTTL(ctx, key, want, VaultSummaryTTL); err != nil {
		t.Fatalf("SetWithTTL: %v", err)
	}

	var got portfolioSnapshot
	if err := m.Get(ctx, key, &got); err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.UserID != want.UserID {
		t.Fatalf("round trip mismatch: got %+v, want %+v", got, want)
	}
}

func TestGetMissingReturnsRedisNil(t *testing.T) {
	m := newMemCache()
	err := m.Get(context.Background(), UserPortfolioKey("nobody"), &portfolioSnapshot{})
	if !errors.Is(err, redis.Nil) {
		t.Fatalf("want redis.Nil, got %v", err)
	}
}

func TestDelete(t *testing.T) {
	m := newMemCache()
	ctx := context.Background()
	key := LeaderboardKey()

	if err := m.Set(ctx, key, testPortfolio(), LeaderboardTTL); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if err := m.Delete(ctx, key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := m.Get(ctx, key, &portfolioSnapshot{}); !errors.Is(err, redis.Nil) {
		t.Fatalf("want redis.Nil after delete, got %v", err)
	}
	if err := m.Delete(ctx, key); err != nil {
		t.Fatalf("Delete missing key: %v", err)
	}
}

func TestTTLPassthrough(t *testing.T) {
	m := newMemCache()
	ctx := context.Background()
	key := LeaderboardKey()

	ttl := 45 * time.Second
	if err := m.Set(ctx, key, testPortfolio(), ttl); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, ok := m.ttlOf(key)
	if !ok {
		t.Fatal("key not stored")
	}
	if got != ttl {
		t.Fatalf("ttl mismatch: got %v, want %v", got, ttl)
	}
}

func TestVolatileTTLsWithinPlanRange(t *testing.T) {
	for name, ttl := range map[string]time.Duration{
		"PortfolioTTL":    PortfolioTTL,
		"VaultSummaryTTL": VaultSummaryTTL,
		"LeaderboardTTL":  LeaderboardTTL,
	} {
		if ttl < 30*time.Second || ttl > 60*time.Second {
			t.Errorf("%s = %v, want within 30s-60s per plan", name, ttl)
		}
	}
}

func TestKeyFormats(t *testing.T) {
	cases := []struct {
		name string
		got  string
		want string
	}{
		{"UserPortfolioKey", UserPortfolioKey("user-1"), "app:user:user-1:portfolio"},
		{"VaultSummaryKey", VaultSummaryKey("vault-abc"), "app:vault:vault-abc:summary"},
		{"LeaderboardKey", LeaderboardKey(), "app:global:leaderboard"},
		{"UserPortfolioPrefix", UserPortfolioPrefix(), "app:user:*:portfolio"},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s = %q, want %q", c.name, c.got, c.want)
		}
	}
}
