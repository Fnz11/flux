package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupPortfolioTestDB(t *testing.T) *gorm.DB {
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

	_ = db.Exec(`CREATE TABLE users (
		id TEXT PRIMARY KEY,
		wallet_address TEXT NOT NULL,
		nonce TEXT,
		created_at DATETIME,
		updated_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE vaults (
		id TEXT PRIMARY KEY,
		address TEXT NOT NULL,
		manager_id TEXT NOT NULL,
		status TEXT DEFAULT 'Active',
		metadata TEXT DEFAULT '{}',
		performance_fee_bps INTEGER DEFAULT 0,
		management_fee_bps INTEGER DEFAULT 0,
		min_raise_amount NUMERIC DEFAULT 0,
		lockup_period INTEGER DEFAULT 0,
		vault_type TEXT DEFAULT 'open',
		tvl NUMERIC DEFAULT 0,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE portfolios (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		vault_id TEXT NOT NULL,
		shares_owned NUMERIC DEFAULT 0,
		total_invested_value NUMERIC DEFAULT 0,
		average_entry_price NUMERIC DEFAULT 0,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE user_pnl_summary (
		user_id TEXT,
		vault_id TEXT,
		total_invested NUMERIC DEFAULT 0,
		current_value NUMERIC DEFAULT 0,
		realized_pnl NUMERIC DEFAULT 0,
		unrealized_pnl NUMERIC DEFAULT 0,
		total_pnl NUMERIC DEFAULT 0,
		as_of DATETIME
	)`)

	return db
}

func TestUpsertPosition_CreateAndUpdate(t *testing.T) {
	db := setupPortfolioTestDB(t)
	repo := NewPortfolioRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	vaultID := uuid.New()

	t.Run("UpsertPosition_Create", func(t *testing.T) {
		shares := decimal.NewFromFloat(100.0)
		invested := decimal.NewFromFloat(1000.0)
		entryPrice := decimal.NewFromFloat(10.0)

		err := repo.UpsertPosition(ctx, userID.String(), vaultID.String(), shares, invested, entryPrice)
		if err != nil {
			t.Fatalf("unexpected error creating position: %v", err)
		}

		var p models.Portfolio
		if err := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&p).Error; err != nil {
			t.Fatalf("failed to find created portfolio: %v", err)
		}
		if !p.SharesOwned.Equal(shares) {
			t.Errorf("expected shares %s, got %s", shares, p.SharesOwned)
		}
		if !p.TotalInvestedValue.Equal(invested) {
			t.Errorf("expected invested %s, got %s", invested, p.TotalInvestedValue)
		}
		if !p.AverageEntryPrice.Equal(entryPrice) {
			t.Errorf("expected entry price %s, got %s", entryPrice, p.AverageEntryPrice)
		}
	})

	t.Run("UpsertPosition_Update_WeightedAvgEntryPrice", func(t *testing.T) {
		// Add another 100 shares at $20 = $2000 invested
		// Total shares = 200, Total invested = 3000, Avg price = 3000/200 = 15
		addShares := decimal.NewFromFloat(100.0)
		addInvested := decimal.NewFromFloat(2000.0)
		addEntryPrice := decimal.NewFromFloat(20.0)

		err := repo.UpsertPosition(ctx, userID.String(), vaultID.String(), addShares, addInvested, addEntryPrice)
		if err != nil {
			t.Fatalf("unexpected error updating position: %v", err)
		}

		var p models.Portfolio
		if err := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&p).Error; err != nil {
			t.Fatalf("failed to find updated portfolio: %v", err)
		}

		expectedShares := decimal.NewFromFloat(200.0)
		expectedInvested := decimal.NewFromFloat(3000.0)
		expectedAvgPrice := decimal.NewFromFloat(15.0)

		if !p.SharesOwned.Equal(expectedShares) {
			t.Errorf("expected shares %s, got %s", expectedShares, p.SharesOwned)
		}
		if !p.TotalInvestedValue.Equal(expectedInvested) {
			t.Errorf("expected invested %s, got %s", expectedInvested, p.TotalInvestedValue)
		}
		if !p.AverageEntryPrice.Equal(expectedAvgPrice) {
			t.Errorf("expected weighted avg entry price %s, got %s", expectedAvgPrice, p.AverageEntryPrice)
		}
	})

	t.Run("UpsertPosition_InvalidUUID", func(t *testing.T) {
		err := repo.UpsertPosition(ctx, "invalid-user", vaultID.String(), decimal.NewFromInt(10), decimal.NewFromInt(10), decimal.NewFromInt(1))
		if err == nil {
			t.Errorf("expected error for invalid user UUID")
		}

		err = repo.UpsertPosition(ctx, userID.String(), "invalid-vault", decimal.NewFromInt(10), decimal.NewFromInt(10), decimal.NewFromInt(1))
		if err == nil {
			t.Errorf("expected error for invalid vault UUID")
		}
	})
}

func TestReducePosition(t *testing.T) {
	db := setupPortfolioTestDB(t)
	repo := NewPortfolioRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	vaultID := uuid.New()

	// Initial position: 200 shares, 3000 invested
	_ = repo.UpsertPosition(ctx, userID.String(), vaultID.String(), decimal.NewFromFloat(200.0), decimal.NewFromFloat(3000.0), decimal.NewFromFloat(15.0))

	t.Run("ReducePosition_InsufficientShares", func(t *testing.T) {
		err := repo.ReducePosition(ctx, userID.String(), vaultID.String(), decimal.NewFromFloat(300.0))
		if err == nil || err.Error() != "insufficient shares" {
			t.Fatalf("expected 'insufficient shares' error, got %v", err)
		}
	})

	t.Run("ReducePosition_NotFound", func(t *testing.T) {
		err := repo.ReducePosition(ctx, uuid.New().String(), vaultID.String(), decimal.NewFromFloat(10.0))
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("ReducePosition_PartialReduction", func(t *testing.T) {
		// Reduce 50 shares (25% of 200 shares)
		// Invested should reduce by 25% of 3000 = 750 -> remaining invested = 2250
		// Remaining shares = 150
		err := repo.ReducePosition(ctx, userID.String(), vaultID.String(), decimal.NewFromFloat(50.0))
		if err != nil {
			t.Fatalf("unexpected error reducing position: %v", err)
		}

		var p models.Portfolio
		if err := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&p).Error; err != nil {
			t.Fatalf("failed to find portfolio: %v", err)
		}

		expectedShares := decimal.NewFromFloat(150.0)
		expectedInvested := decimal.NewFromFloat(2250.0)

		if !p.SharesOwned.Equal(expectedShares) {
			t.Errorf("expected shares %s, got %s", expectedShares, p.SharesOwned)
		}
		if !p.TotalInvestedValue.Equal(expectedInvested) {
			t.Errorf("expected invested %s, got %s", expectedInvested, p.TotalInvestedValue)
		}
	})

	t.Run("ReducePosition_InvalidUUID", func(t *testing.T) {
		err := repo.ReducePosition(ctx, "bad-id", vaultID.String(), decimal.NewFromInt(10))
		if err == nil {
			t.Errorf("expected error for invalid user UUID")
		}
		err = repo.ReducePosition(ctx, userID.String(), "bad-id", decimal.NewFromInt(10))
		if err == nil {
			t.Errorf("expected error for invalid vault UUID")
		}
	})
}

func TestGetByUser_GetTotalShares_GetHolderUserIDs(t *testing.T) {
	db := setupPortfolioTestDB(t)
	repo := NewPortfolioRepository(db)
	ctx := context.Background()

	vault1 := uuid.New()
	vault2 := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	// Seed vault records so Preload("Vault") works
	_ = db.Create(&models.Vault{ID: vault1, Address: "VaultAddr1", ManagerID: user1}).Error
	_ = db.Create(&models.Vault{ID: vault2, Address: "VaultAddr2", ManagerID: user1}).Error

	// Seed positions
	_ = repo.UpsertPosition(ctx, user1.String(), vault1.String(), decimal.NewFromFloat(100.0), decimal.NewFromFloat(1000.0), decimal.NewFromFloat(10.0))
	_ = repo.UpsertPosition(ctx, user1.String(), vault2.String(), decimal.NewFromFloat(50.0), decimal.NewFromFloat(500.0), decimal.NewFromFloat(10.0))
	_ = repo.UpsertPosition(ctx, user2.String(), vault1.String(), decimal.NewFromFloat(200.0), decimal.NewFromFloat(2000.0), decimal.NewFromFloat(10.0))

	t.Run("GetByUser_Found", func(t *testing.T) {
		details, err := repo.GetByUser(ctx, user1.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(details) != 2 {
			t.Fatalf("expected 2 portfolio details for user1, got %d", len(details))
		}
	})

	t.Run("GetByUser_InvalidUUID", func(t *testing.T) {
		_, err := repo.GetByUser(ctx, "invalid-uuid")
		if err == nil {
			t.Errorf("expected error for invalid user UUID")
		}
	})

	t.Run("GetTotalSharesByVault", func(t *testing.T) {
		total, err := repo.GetTotalSharesByVault(ctx, vault1.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		expected := decimal.NewFromFloat(300.0) // 100 + 200
		if !total.Equal(expected) {
			t.Errorf("expected total shares %s, got %s", expected, total)
		}

		totalEmpty, err := repo.GetTotalSharesByVault(ctx, uuid.New().String())
		if err != nil {
			t.Fatalf("unexpected error for empty vault: %v", err)
		}
		if !totalEmpty.IsZero() {
			t.Errorf("expected zero total shares for empty vault, got %s", totalEmpty)
		}

		_, err = repo.GetTotalSharesByVault(ctx, "invalid-uuid")
		if err == nil {
			t.Errorf("expected error for invalid vault UUID")
		}
	})

	t.Run("GetHolderUserIDs_ReturnsDistinct", func(t *testing.T) {
		holders, err := repo.GetHolderUserIDs(ctx, vault1.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(holders) != 2 {
			t.Fatalf("expected 2 distinct holder user IDs for vault1, got %d", len(holders))
		}

		_, err = repo.GetHolderUserIDs(ctx, "invalid-uuid")
		if err == nil {
			t.Errorf("expected error for invalid vault UUID")
		}
	})
}

func TestPortfolioSummaryQueries(t *testing.T) {
	db := setupPortfolioTestDB(t)
	repo := NewPortfolioRepository(db)
	ctx := context.Background()

	userID := uuid.New()

	t.Run("GetPortfolioSummary_NotFound", func(t *testing.T) {
		_, err := repo.GetPortfolioSummary(ctx, userID.String())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("GetUserPnLSummary_NotFound", func(t *testing.T) {
		_, err := repo.GetUserPnLSummary(ctx, userID.String())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("GetPortfolioSummary_InvalidUUID", func(t *testing.T) {
		_, err := repo.GetPortfolioSummary(ctx, "invalid-uuid")
		if err == nil {
			t.Errorf("expected error for invalid user UUID")
		}
		_, err = repo.GetUserPnLSummary(ctx, "invalid-uuid")
		if err == nil {
			t.Errorf("expected error for invalid user UUID")
		}
	})
}
