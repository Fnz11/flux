package services

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
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

func dec(v string) decimal.Decimal {
	d, _ := decimal.NewFromString(v)
	return d
}

func TestCalculatePnL(t *testing.T) {
	tests := []struct {
		name          string
		sharesOwned   decimal.Decimal
		currentPrice  decimal.Decimal
		avgEntryPrice decimal.Decimal
		totalInvested decimal.Decimal
		want          PnLCalcResult
	}{
		{
			name:          "profit",
			sharesOwned:   dec("100"),
			currentPrice:  dec("150"),
			avgEntryPrice: dec("100"),
			totalInvested: dec("10000"),
			want: PnLCalcResult{
				UnrealizedPnL: dec("5000"),
				TotalPnL:      dec("5000"),
				ReturnPct:     dec("50"),
			},
		},
		{
			name:          "loss",
			sharesOwned:   dec("100"),
			currentPrice:  dec("50"),
			avgEntryPrice: dec("100"),
			totalInvested: dec("10000"),
			want: PnLCalcResult{
				UnrealizedPnL: dec("-5000"),
				TotalPnL:      dec("-5000"),
				ReturnPct:     dec("-50"),
			},
		},
		{
			name:          "break_even",
			sharesOwned:   dec("100"),
			currentPrice:  dec("100"),
			avgEntryPrice: dec("100"),
			totalInvested: dec("10000"),
			want: PnLCalcResult{
				UnrealizedPnL: dec("0"),
				TotalPnL:      dec("0"),
				ReturnPct:     dec("0"),
			},
		},
		{
			name:          "zero_shares",
			sharesOwned:   dec("0"),
			currentPrice:  dec("100"),
			avgEntryPrice: dec("0"),
			totalInvested: dec("0"),
			want: PnLCalcResult{
				UnrealizedPnL: dec("0"),
				TotalPnL:      dec("0"),
				ReturnPct:     dec("0"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculatePnL(tt.sharesOwned, tt.currentPrice, tt.avgEntryPrice, tt.totalInvested)

			if !got.UnrealizedPnL.Equal(tt.want.UnrealizedPnL) {
				t.Errorf("UnrealizedPnL = %v, want %v", got.UnrealizedPnL, tt.want.UnrealizedPnL)
			}
			if !got.TotalPnL.Equal(tt.want.TotalPnL) {
				t.Errorf("TotalPnL = %v, want %v", got.TotalPnL, tt.want.TotalPnL)
			}
			if !got.ReturnPct.Equal(tt.want.ReturnPct) {
				t.Errorf("ReturnPct = %v, want %v", got.ReturnPct, tt.want.ReturnPct)
			}
		})
	}
}

func getPortfolio(t *testing.T, db *gorm.DB, userID, vaultID uuid.UUID) (shares, invested, avgPrice decimal.Decimal) {
	var row struct {
		SharesOwned        decimal.Decimal
		TotalInvestedValue decimal.Decimal
		AverageEntryPrice  decimal.Decimal
	}
	if err := db.Table("portfolios").
		Select("shares_owned, total_invested_value, average_entry_price").
		Where("user_id = ? AND vault_id = ?", userID.String(), vaultID.String()).
		Scan(&row).Error; err != nil {
		t.Fatalf("failed to query portfolio: %v", err)
	}
	return row.SharesOwned, row.TotalInvestedValue, row.AverageEntryPrice
}

func TestUpsertPosition(t *testing.T) {
	db := setupTestDB(t)

	userID := uuid.New()
	vaultID := uuid.New()

	t.Run("create_new_position", func(t *testing.T) {
		err := UpsertPosition(db, userID, vaultID, dec("100"), dec("10000"), dec("100"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, _, avg := getPortfolio(t, db, userID, vaultID)
		if !shares.Equal(dec("100")) {
			t.Errorf("SharesOwned = %v, want 100", shares)
		}
		if !avg.Equal(dec("100")) {
			t.Errorf("AverageEntryPrice = %v, want 100", avg)
		}
	})

	t.Run("update_existing_position", func(t *testing.T) {
		err := UpsertPosition(db, userID, vaultID, dec("50"), dec("6000"), dec("120"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, avg := getPortfolio(t, db, userID, vaultID)
		if !shares.Equal(dec("150")) {
			t.Errorf("SharesOwned = %v, want 150", shares)
		}
		if !invested.Equal(dec("16000")) {
			t.Errorf("TotalInvestedValue = %v, want 16000", invested)
		}
		expectedAvg := dec("16000").Div(dec("150"))
		if !avg.Equal(expectedAvg) && !avg.Round(8).Equal(expectedAvg.Round(8)) {
			t.Errorf("AverageEntryPrice = %v, want %v", avg, expectedAvg)
		}
	})
}

func TestReducePosition(t *testing.T) {
	db := setupTestDB(t)

	userID := uuid.New()
	vaultID := uuid.New()

	err := UpsertPosition(db, userID, vaultID, dec("100"), dec("10000"), dec("100"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("reduce_partial", func(t *testing.T) {
		err := ReducePosition(db, userID, vaultID, dec("40"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, _ := getPortfolio(t, db, userID, vaultID)
		if !shares.Equal(dec("60")) {
			t.Errorf("SharesOwned = %v, want 60", shares)
		}
		expectedInvested := dec("6000")
		if !invested.Equal(expectedInvested) {
			t.Errorf("TotalInvestedValue = %v, want %v", invested, expectedInvested)
		}
	})

	t.Run("reduce_insufficient_shares", func(t *testing.T) {
		err := ReducePosition(db, userID, vaultID, dec("100"))
		if err == nil {
			t.Fatal("expected error for insufficient shares")
		}
	})

	t.Run("reduce_remaining", func(t *testing.T) {
		db2 := setupTestDB(t)
		userID2 := uuid.New()
		vaultID2 := uuid.New()

		UpsertPosition(db2, userID2, vaultID2, dec("100"), dec("10000"), dec("100"))
		err := ReducePosition(db2, userID2, vaultID2, dec("100"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, _ := getPortfolio(t, db2, userID2, vaultID2)
		if !shares.IsZero() {
			t.Errorf("SharesOwned = %v, want 0", shares)
		}
		if !invested.IsZero() {
			t.Errorf("TotalInvestedValue = %v, want 0", invested)
		}
	})
}
