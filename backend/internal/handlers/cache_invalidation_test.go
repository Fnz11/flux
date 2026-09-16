package handlers

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/repository"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var _ cache.Cache = (*stubCache)(nil)

type stubCache struct {
	mu         sync.Mutex
	deleted    []string
	failDelete bool
}

func (s *stubCache) Get(ctx context.Context, key string, dest any) error {
	return nil
}

func (s *stubCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return nil
}

func (s *stubCache) Delete(ctx context.Context, key string) error {
	if s.failDelete {
		return errors.New("redis unavailable")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deleted = append(s.deleted, key)
	return nil
}

func (s *stubCache) DeletePrefix(ctx context.Context, prefix string) error {
	if s.failDelete {
		return errors.New("redis unavailable")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deleted = append(s.deleted, prefix+"*")
	return nil
}

func (s *stubCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	return nil
}

func (s *stubCache) MGet(ctx context.Context, keys ...string) ([][]byte, error) { return nil, nil }
func (s *stubCache) ZAdd(ctx context.Context, key string, score float64, member string) error {
	return nil
}
func (s *stubCache) ZRevRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return nil, nil
}
func (s *stubCache) ZCard(ctx context.Context, key string) (int64, error) { return 0, nil }
func (s *stubCache) LPush(ctx context.Context, key string, values ...any) error { return nil }
func (s *stubCache) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return nil, nil
}
func (s *stubCache) LTrim(ctx context.Context, key string, start, stop int64) error { return nil }
func (s *stubCache) LLen(ctx context.Context, key string) (int64, error)              { return 0, nil }

func (s *stubCache) Ping(ctx context.Context) error {
	return nil
}

func (s *stubCache) deletedKeys() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string{}, s.deleted...)
}

func containsKey(keys []string, want string) bool {
	for _, k := range keys {
		if k == want {
			return true
		}
	}
	return false
}

func TestInvalidateUserCache(t *testing.T) {
	stub := &stubCache{}
	userID := uuid.New()

	invalidateUserCache(stub, context.Background(), userID)

	got := stub.deletedKeys()
	want := []string{
		"app:user:" + userID.String() + ":portfolio",
		"app:user:" + userID.String() + ":pnl",
	}
	if len(got) != len(want) {
		t.Errorf("deleted keys = %v, want %v", got, want)
		return
	}
	for i, key := range want {
		if got[i] != key {
			t.Errorf("deleted keys = %v, want %v", got, want)
		}
	}
}

func TestInvalidateLeaderboardCache(t *testing.T) {
	stub := &stubCache{}

	invalidateLeaderboardCache(stub, context.Background())

	got := stub.deletedKeys()
	if len(got) != 1 || got[0] != "app:global:leaderboard" {
		t.Errorf("deleted keys = %v, want [app:global:leaderboard]", got)
	}
}

func TestInvalidateVaultSummaryCache(t *testing.T) {
	stub := &stubCache{}
	vaultAddress := "VaultSummaryAddr11111111111111111111111"

	invalidateVaultSummaryCache(stub, context.Background(), vaultAddress)

	got := stub.deletedKeys()
	wantKey := cache.VaultSummaryKey(vaultAddress)
	if len(got) != 1 || got[0] != wantKey {
		t.Errorf("deleted keys = %v, want [%s]", got, wantKey)
	}
}

func TestInvalidateNilCache(t *testing.T) {
	invalidateUserCache(nil, context.Background(), uuid.New())
	invalidateLeaderboardCache(nil, context.Background())
	invalidateVaultSummaryCache(nil, context.Background(), "some_addr")
	invalidateVaultPortfolioCaches(nil, nil, context.Background(), uuid.New().String())

	// Also verify non-nil cache with nil repo does not panic
	stub := &stubCache{}
	invalidateVaultPortfolioCaches(stub, nil, context.Background(), uuid.New().String())
	if len(stub.deletedKeys()) != 0 {
		t.Errorf("expected no deleted keys when repo is nil")
	}
}

func TestInvalidateCacheError(t *testing.T) {
	stub := &stubCache{failDelete: true}

	invalidateUserCache(stub, context.Background(), uuid.New())
	invalidateLeaderboardCache(stub, context.Background())
	invalidateVaultSummaryCache(stub, context.Background(), "some_addr")

	if got := stub.deletedKeys(); len(got) != 0 {
		t.Errorf("deleted keys = %v, want none", got)
	}
}

func setupCacheTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.Exec(`CREATE TABLE portfolios (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		vault_id TEXT NOT NULL,
		shares_owned REAL DEFAULT 0,
		total_invested_value REAL DEFAULT 0,
		average_entry_price REAL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`).Error; err != nil {
		t.Fatalf("failed to create table: %v", err)
	}
	return db
}

func TestInvalidateVaultPortfolioCaches(t *testing.T) {
	db := setupCacheTestDB(t)
	stub := &stubCache{}
	repo := repository.NewPortfolioRepository(db)

	vaultID := uuid.New()
	otherVaultID := uuid.New()
	holderA := uuid.New()
	holderB := uuid.New()
	mixed := uuid.New()
	outsider := uuid.New()

	rows := []struct{ user, vault uuid.UUID }{
		{holderA, vaultID},
		{holderB, vaultID},
		{mixed, vaultID},
		{mixed, otherVaultID},
		{outsider, otherVaultID},
	}
	for _, r := range rows {
		if err := db.Exec(`INSERT INTO portfolios (id, user_id, vault_id) VALUES (?, ?, ?)`,
			uuid.New().String(), r.user.String(), r.vault.String()).Error; err != nil {
			t.Fatalf("failed to insert portfolio: %v", err)
		}
	}

	invalidateVaultPortfolioCaches(stub, repo, context.Background(), vaultID.String())

	got := stub.deletedKeys()
	want := []uuid.UUID{holderA, holderB, mixed}
	if len(got) != len(want)*2 {
		t.Fatalf("deleted %d keys, want %d: %v", len(got), len(want)*2, got)
	}
	for _, u := range want {
		if !containsKey(got, "app:user:"+u.String()+":portfolio") {
			t.Errorf("missing key for user %s, got %v", u.String(), got)
		}
		if !containsKey(got, "app:user:"+u.String()+":pnl") {
			t.Errorf("missing pnl key for user %s, got %v", u.String(), got)
		}
	}
	if containsKey(got, "app:user:"+outsider.String()+":portfolio") {
		t.Errorf("outsider key deleted: %v", got)
	}
}

func TestInvalidateVaultPortfolioCachesEmpty(t *testing.T) {
	db := setupCacheTestDB(t)
	stub := &stubCache{}
	repo := repository.NewPortfolioRepository(db)

	invalidateVaultPortfolioCaches(stub, repo, context.Background(), uuid.New().String())

	if got := stub.deletedKeys(); len(got) != 0 {
		t.Errorf("deleted keys = %v, want none", got)
	}
}

func TestInvalidateVaultPortfolioCachesDBError(t *testing.T) {
	stub := &stubCache{}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	repo := repository.NewPortfolioRepository(db)

	invalidateVaultPortfolioCaches(stub, repo, context.Background(), uuid.New().String())

	if got := stub.deletedKeys(); len(got) != 0 {
		t.Errorf("deleted keys = %v, want none", got)
	}
}

func TestCacheKeyUniqueness(t *testing.T) {
	k1 := cache.VaultSummaryKey("vault_a")
	k2 := cache.VaultSummaryKey("vault_b")
	if k1 == k2 {
		t.Errorf("expected different keys for different vault addresses, got %s", k1)
	}

	vlKey := cache.VaultListKey("Active", "", "", "tvl", "desc", 1, 6)
	if vlKey != "app:vaults:list:Active:::tvl:desc:1:6" {
		t.Errorf("unexpected vault list key: %s", vlKey)
	}

	feedKey := cache.GlobalFeedKey("wallet123", "deposit", 1, 8)
	if feedKey != "app:global:feed:wallet123:deposit:1:8" {
		t.Errorf("unexpected global feed key: %s", feedKey)
	}

	u1 := cache.UserPortfolioKey("user_1")
	u2 := cache.UserPortfolioKey("user_2")
	if u1 == u2 {
		t.Errorf("expected different portfolio keys for different user IDs, got %s", u1)
	}
}

func TestInvalidateVaultListAndGlobalFeedCaches(t *testing.T) {
	stub := &stubCache{}
	ctx := context.Background()

	invalidateVaultListCache(stub, ctx)
	invalidateGlobalFeedCache(stub, ctx)

	got := stub.deletedKeys()
	if !containsKey(got, cache.VaultListPrefix()+"*") {
		t.Errorf("missing vault list prefix invalidation, got %v", got)
	}
	if !containsKey(got, cache.GlobalFeedPrefix()+"*") {
		t.Errorf("missing global feed prefix invalidation, got %v", got)
	}
}
