package repository

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupSearchTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	_ = db.Exec(`CREATE TABLE vaults (
		id TEXT PRIMARY KEY,
		address TEXT NOT NULL,
		metadata TEXT DEFAULT '{}',
		tvl NUMERIC DEFAULT 0,
		deleted_at DATETIME
	)`)
	return db
}

func seedSearchVault(t *testing.T, db *gorm.DB, id, address, metadata string, tvl decimal.Decimal) {
	t.Helper()
	if err := db.Exec(`INSERT INTO vaults (id, address, metadata, tvl) VALUES (?, ?, ?, ?)`,
		id, address, metadata, tvl.String()).Error; err != nil {
		t.Fatalf("failed to seed vault %s: %v", id, err)
	}
}

func TestSearchRepository_Vaults(t *testing.T) {
	db := setupSearchTestDB(t)
	repo := NewSearchRepository(db)
	ctx := context.Background()

	seedSearchTestData(t, db)

	t.Run("match_by_display_name", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "SoL", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 1 {
			t.Fatalf("expected 1 match, got %d", len(got))
		}
		if got[0].ID != "v1" || got[0].DisplayName != "Sol Capital" {
			t.Errorf("unexpected match: %+v", got[0])
		}
	})

	t.Run("match_by_symbol", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "BONK", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 1 {
			t.Fatalf("expected 1 match, got %d", len(got))
		}
		if got[0].DisplayName != "Bonk DAO" {
			t.Errorf("unexpected match: %+v", got[0])
		}
	})

	t.Run("match_by_address", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "addr", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// matches real address addrB / display_name subString addr2Meta
		if len(got) != 2 {
			t.Fatalf("expected 2 matches, got %d", len(got))
		}
	})

	t.Run("match_by_snake_displayName_metadata_key", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "meta", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 1 || got[0].ID != "v2" {
			t.Fatalf("expected v2 via display_name key, got %+v", got)
		}
	})

	t.Run("no_match", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "zzzz", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 0 {
			t.Errorf("expected 0 matches, got %d", len(got))
		}
	})

	t.Run("empty_query_returns_nil", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "   ", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("limit_capped", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "a", 1)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 1 {
			t.Errorf("expected len 1 with limit 1, got %d", len(got))
		}
	})
}

func seedSearchTestData(t *testing.T, db *gorm.DB) {
	t.Helper()
	seedSearchVault(t, db, "v1", "AAAA111", `{"displayName":"Sol Capital","symbol":"SOL"}`, decimal.NewFromFloat(100.0))
	seedSearchVault(t, db, "v2", "addrB", `{"display_name":"Meta Fund","symbol":"XYZ"}`, decimal.NewFromFloat(200.0))
	seedSearchVault(t, db, "v3", "addrC", `{"displayName":"Bonk DAO","symbol":"BONK"}`, decimal.NewFromFloat(50.0))
	seedSearchVault(t, db, "v4", "QQZZ999", `{"name":"zzz"}`, decimal.NewFromFloat(5.0))
}

func TestSearchRepository_LimitClamp(t *testing.T) {
	db := setupSearchTestDB(t)
	repo := NewSearchRepository(db)
	ctx := context.Background()
	seedSearchTestData(t, db)

	t.Run("limit_zero_clamped_to_one", func(t *testing.T) {
		got, err := repo.SearchVaults(ctx, "a", 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) > 1 {
			t.Errorf("expected max 1 with limit 0, got %d", len(got))
		}
		if len(got) == 0 {
			t.Errorf("expected at least 1 match, got 0")
		}
	})
}