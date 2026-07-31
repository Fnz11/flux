package services

import (
	"math"
	"testing"

	"github.com/google/uuid"
	"github.com/glebarez/sqlite"
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

func TestCalculatePnL(t *testing.T) {
	tests := []struct {
		name          string
		sharesOwned   float64
		currentPrice  float64
		avgEntryPrice float64
		totalInvested float64
		want          PnLCalcResult
	}{
		{
			name:          "profit",
			sharesOwned:   100,
			currentPrice:  150,
			avgEntryPrice: 100,
			totalInvested: 10000,
			want: PnLCalcResult{
				UnrealizedPnL: 5000,
				TotalPnL:      5000,
				ReturnPct:     50,
			},
		},
		{
			name:          "loss",
			sharesOwned:   100,
			currentPrice:  50,
			avgEntryPrice: 100,
			totalInvested: 10000,
			want: PnLCalcResult{
				UnrealizedPnL: -5000,
				TotalPnL:      -5000,
				ReturnPct:     -50,
			},
		},
		{
			name:          "break_even",
			sharesOwned:   100,
			currentPrice:  100,
			avgEntryPrice: 100,
			totalInvested: 10000,
			want: PnLCalcResult{
				UnrealizedPnL: 0,
				TotalPnL:      0,
				ReturnPct:     0,
			},
		},
		{
			name:          "zero_shares",
			sharesOwned:   0,
			currentPrice:  100,
			avgEntryPrice: 0,
			totalInvested: 0,
			want: PnLCalcResult{
				UnrealizedPnL: 0,
				TotalPnL:      0,
				ReturnPct:     0,
			},
		},
		{
			name:          "high_precision",
			sharesOwned:   33.3333,
			currentPrice:  120.50,
			avgEntryPrice: 100.25,
			totalInvested: 3341.66,
			want: PnLCalcResult{
				UnrealizedPnL: 33.3333*120.50 - 33.3333*100.25,
				TotalPnL:      33.3333*120.50 - 33.3333*100.25,
				ReturnPct:     ((33.3333*120.50 - 33.3333*100.25) / 3341.66) * 100,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculatePnL(tt.sharesOwned, tt.currentPrice, tt.avgEntryPrice, tt.totalInvested)

			if math.Abs(got.UnrealizedPnL-tt.want.UnrealizedPnL) > 0.01 {
				t.Errorf("UnrealizedPnL = %v, want %v", got.UnrealizedPnL, tt.want.UnrealizedPnL)
			}
			if math.Abs(got.TotalPnL-tt.want.TotalPnL) > 0.01 {
				t.Errorf("TotalPnL = %v, want %v", got.TotalPnL, tt.want.TotalPnL)
			}
			if math.Abs(got.ReturnPct-tt.want.ReturnPct) > 0.01 {
				t.Errorf("ReturnPct = %v, want %v", got.ReturnPct, tt.want.ReturnPct)
			}
		})
	}
}

func getPortfolio(t *testing.T, db *gorm.DB, userID, vaultID uuid.UUID) (shares, invested, avgPrice float64) {
	var row struct {
		SharesOwned        float64
		TotalInvestedValue float64
		AverageEntryPrice  float64
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
		err := UpsertPosition(db, userID, vaultID, 100, 10000, 100)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, _, avg := getPortfolio(t, db, userID, vaultID)
		if shares != 100 {
			t.Errorf("SharesOwned = %v, want 100", shares)
		}
		if avg != 100 {
			t.Errorf("AverageEntryPrice = %v, want 100", avg)
		}
	})

	t.Run("update_existing_position", func(t *testing.T) {
		err := UpsertPosition(db, userID, vaultID, 50, 6000, 120)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, avg := getPortfolio(t, db, userID, vaultID)
		if shares != 150 {
			t.Errorf("SharesOwned = %v, want 150", shares)
		}
		if invested != 16000 {
			t.Errorf("TotalInvestedValue = %v, want 16000", invested)
		}
		expectedAvg := 16000.0 / 150.0
		if math.Abs(avg-expectedAvg) > 0.01 {
			t.Errorf("AverageEntryPrice = %v, want %v", avg, expectedAvg)
		}
	})
}



func TestReducePosition(t *testing.T) {
	db := setupTestDB(t)

	userID := uuid.New()
	vaultID := uuid.New()

	err := UpsertPosition(db, userID, vaultID, 100, 10000, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	t.Run("reduce_partial", func(t *testing.T) {
		err := ReducePosition(db, userID, vaultID, 40)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, _ := getPortfolio(t, db, userID, vaultID)
		if shares != 60 {
			t.Errorf("SharesOwned = %v, want 60", shares)
		}
		expectedInvested := 10000.0 - (40.0/100.0)*10000.0
		if math.Abs(invested-expectedInvested) > 0.01 {
			t.Errorf("TotalInvestedValue = %v, want %v", invested, expectedInvested)
		}
	})

	t.Run("reduce_insufficient_shares", func(t *testing.T) {
		err := ReducePosition(db, userID, vaultID, 100)
		if err == nil {
			t.Fatal("expected error for insufficient shares")
		}
	})

	t.Run("reduce_remaining", func(t *testing.T) {
		db2 := setupTestDB(t)
		userID2 := uuid.New()
		vaultID2 := uuid.New()

		UpsertPosition(db2, userID2, vaultID2, 100, 10000, 100)
		err := ReducePosition(db2, userID2, vaultID2, 100)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		shares, invested, _ := getPortfolio(t, db2, userID2, vaultID2)
		if shares != 0 {
			t.Errorf("SharesOwned = %v, want 0", shares)
		}
		if invested != 0 {
			t.Errorf("TotalInvestedValue = %v, want 0", invested)
		}
	})
}
