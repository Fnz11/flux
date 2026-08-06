package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupMVTestDB(t *testing.T) (*gorm.DB, string) {
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

	createSQL := []string{
		`CREATE TABLE user_pnl_summary (
			user_id TEXT NOT NULL,
			vault_id TEXT NOT NULL,
			vault_address TEXT NOT NULL,
			shares_owned REAL NOT NULL DEFAULT 0,
			total_invested REAL NOT NULL DEFAULT 0,
			average_entry_price REAL NOT NULL DEFAULT 0,
			vault_total_shares REAL NOT NULL DEFAULT 0,
			vault_tvl REAL NOT NULL DEFAULT 0,
			current_value REAL NOT NULL DEFAULT 0,
			realized_pnl REAL NOT NULL DEFAULT 0,
			unrealized_pnl REAL NOT NULL DEFAULT 0,
			pnl_percent REAL NOT NULL DEFAULT 0,
			total_pnl REAL NOT NULL DEFAULT 0,
			last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			as_of DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, sql := range createSQL {
		if err := db.Exec(sql).Error; err != nil {
			t.Fatalf("failed to create table: %v", err)
		}
	}

	userID := uuid.New().String()
	for _, v := range []string{"v1", "v2", "v3"} {
		if err := db.Exec(`INSERT INTO user_pnl_summary
			(user_id, vault_id, vault_address, shares_owned, total_invested, average_entry_price,
			 vault_total_shares, vault_tvl, current_value, realized_pnl, unrealized_pnl,
			 pnl_percent, total_pnl, last_activity_at, as_of)
			VALUES (?, ?, ?, 100, 5000, 50, 100, 7000, 7000, 1000, 1000, 20, 2000,
			        '2026-07-31 12:00:00', '2026-07-31 12:00:00')`,
			userID, v, "addr-"+v).Error; err != nil {
			t.Fatalf("failed to insert user_pnl_summary: %v", err)
		}
	}
	return db, userID
}

func TestGetPortfolioSummary(t *testing.T) {
	t.Run("returns_summary_from_mv", func(t *testing.T) {
		db, userID := setupMVTestDB(t)
		repo := NewPortfolioRepository(db)

		got, err := repo.GetPortfolioSummary(context.Background(), userID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.UserID != userID {
			t.Errorf("UserID = %q, want %q", got.UserID, userID)
		}
		if got.VaultCount != 3 || !got.TotalInvested.Equal(dec("15000")) || !got.CurrentValue.Equal(dec("21000")) ||
			!got.UnrealizedPnL.Equal(dec("3000")) || !got.ReturnPct.Equal(dec("40")) {
			t.Errorf("unexpected summary: %+v", got)
		}
		if got.UpdatedAt == "" {
			t.Error("expected UpdatedAt to be scanned")
		}
	})

	t.Run("missing_user_returns_not_found", func(t *testing.T) {
		db, _ := setupMVTestDB(t)
		repo := NewPortfolioRepository(db)

		_, err := repo.GetPortfolioSummary(context.Background(), uuid.New().String())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("missing_mv_degrades_with_error", func(t *testing.T) {
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			t.Fatalf("failed to open test db: %v", err)
		}
		sqlDB, err := db.DB()
		if err != nil {
			t.Fatalf("failed to get sql.DB: %v", err)
		}
		sqlDB.SetMaxOpenConns(1)

		repo := NewPortfolioRepository(db)
		_, err = repo.GetPortfolioSummary(context.Background(), uuid.New().String())
		if err == nil {
			t.Fatal("expected error when materialized view is missing")
		}
	})
}

func TestGetUserPnLSummary(t *testing.T) {
	t.Run("returns_summary_from_mv", func(t *testing.T) {
		db, userID := setupMVTestDB(t)
		repo := NewPortfolioRepository(db)

		got, err := repo.GetUserPnLSummary(context.Background(), userID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.UserID != userID {
			t.Errorf("UserID = %q, want %q", got.UserID, userID)
		}
		if !got.TotalInvested.Equal(dec("15000")) || !got.RealizedPnL.Equal(dec("3000")) ||
			!got.UnrealizedPnL.Equal(dec("3000")) || !got.TotalPnL.Equal(dec("6000")) || !got.ReturnPct.Equal(dec("40")) {
			t.Errorf("unexpected summary: %+v", got)
		}
		if got.UpdatedAt == "" {
			t.Error("expected UpdatedAt to be scanned")
		}
	})

	t.Run("missing_user_returns_not_found", func(t *testing.T) {
		db, _ := setupMVTestDB(t)
		repo := NewPortfolioRepository(db)

		_, err := repo.GetUserPnLSummary(context.Background(), uuid.New().String())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("missing_mv_degrades_with_error", func(t *testing.T) {
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			t.Fatalf("failed to open test db: %v", err)
		}
		sqlDB, err := db.DB()
		if err != nil {
			t.Fatalf("failed to get sql.DB: %v", err)
		}
		sqlDB.SetMaxOpenConns(1)

		repo := NewPortfolioRepository(db)
		_, err = repo.GetUserPnLSummary(context.Background(), uuid.New().String())
		if err == nil {
			t.Fatal("expected error when materialized view is missing")
		}
	})
}
