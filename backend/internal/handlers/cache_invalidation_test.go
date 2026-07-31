package handlers

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/fbyt-clone/backend/internal/cache"
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

func (s *stubCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	return nil
}

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

func TestInvalidateNilCache(t *testing.T) {
	invalidateUserCache(nil, context.Background(), uuid.New())
	invalidateLeaderboardCache(nil, context.Background())
	invalidateVaultPortfolioCaches(nil, nil, context.Background(), uuid.New())
}

func TestInvalidateCacheError(t *testing.T) {
	stub := &stubCache{failDelete: true}

	invalidateUserCache(stub, context.Background(), uuid.New())
	invalidateLeaderboardCache(stub, context.Background())

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

	invalidateVaultPortfolioCaches(stub, db, context.Background(), vaultID)

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

	invalidateVaultPortfolioCaches(stub, db, context.Background(), uuid.New())

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

	invalidateVaultPortfolioCaches(stub, db, context.Background(), uuid.New())

	if got := stub.deletedKeys(); len(got) != 0 {
		t.Errorf("deleted keys = %v, want none", got)
	}
}
