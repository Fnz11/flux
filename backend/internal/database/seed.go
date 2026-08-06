package database

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SeedDemoData checks if vaults table is empty and populates sample vaults & 30-day metrics.
func SeedDemoData(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.Vault{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	// 1. Ensure a manager user exists
	var manager models.User
	if err := db.First(&manager).Error; err != nil {
		manager = models.User{
			ID:            uuid.New(),
			WalletAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
			CreatedAt:     time.Now().AddDate(0, -3, 0),
		}
		if err := db.Create(&manager).Error; err != nil {
			return fmt.Errorf("failed to seed manager user: %w", err)
		}
	}

	// 2. Sample Vault Definitions
	vaultDefs := []struct {
		Address           string
		Name              string
		Description       string
		FocusAssets       []string
		PerformanceFeeBps int
		ManagementFeeBps  int
		BaseTVL           float64
	}{
		{
			Address:           "8x21VaultSolanaAlphaYield111111111111111",
			Name:              "Solana Alpha Yield Vault",
			Description:       "Automated yield farming & LP rebalancing across Solana DEXes.",
			FocusAssets:       []string{"SOL", "JUP", "RAY"},
			PerformanceFeeBps: 1000,
			ManagementFeeBps:  200,
			BaseTVL:           125000.50,
		},
		{
			Address:           "7y92VaultDeFiMomentum2222222222222222",
			Name:              "DeFi Momentum Vault",
			Description:       "Trend-following portfolio targeting high-momentum ecosystem tokens.",
			FocusAssets:       []string{"SOL", "PYTH", "BONK"},
			PerformanceFeeBps: 1500,
			ManagementFeeBps:  150,
			BaseTVL:           85000.00,
		},
		{
			Address:           "5z14VaultDeltaNeutralSOL333333333333333",
			Name:              "Delta Neutral SOL Strategy",
			Description:       "Hedged yield extraction using perpetual short positions against spot staking.",
			FocusAssets:       []string{"SOL", "USDC"},
			PerformanceFeeBps: 2000,
			ManagementFeeBps:  200,
			BaseTVL:           310000.75,
		},
	}

	now := time.Now().UTC()

	for _, vd := range vaultDefs {
		metadataJSON := fmt.Sprintf(`{"displayName":%q,"description":%q,"focusAssets":["%s"]}`,
			vd.Name, vd.Description, vd.FocusAssets[0])

		v := models.Vault{
			ID:                uuid.New(),
			Address:           vd.Address,
			ManagerID:         manager.ID,
			Status:            "Active",
			Metadata:          datatypes.JSON(metadataJSON),
			PerformanceFeeBps: vd.PerformanceFeeBps,
			ManagementFeeBps:  vd.ManagementFeeBps,
			TVL:               decimal.NewFromFloat(vd.BaseTVL),
			CreatedAt:         now.AddDate(0, -1, 0),
		}

		if err := db.Create(&v).Error; err != nil {
			return fmt.Errorf("failed to seed vault %s: %w", vd.Name, err)
		}

		// Seed 30 days of time-series metric data for this vault
		r := rand.New(rand.NewSource(int64(v.ID[0])))
		baseTVL := vd.BaseTVL

		var metricRecords []models.VaultMetric
		var priceRecords []models.PriceHistory

		for day := 30; day >= 0; day-- {
			ts := now.AddDate(0, 0, -day).Truncate(24 * time.Hour)

			// Daily noise factors
			tvlFluctuation := 1.0 + (r.Float64()*0.06 - 0.025)
			tvlVal := decimal.NewFromFloat(baseTVL * tvlFluctuation)
			baseTVL = baseTVL * tvlFluctuation // drift slowly over time

			investedVal := tvlVal.Mul(decimal.NewFromFloat(0.85))
			pnlVal := tvlVal.Sub(investedVal)
			feesVal := decimal.NewFromFloat(15.0 + r.Float64()*120.0)
			volumeVal := decimal.NewFromFloat(5000.0 + r.Float64()*35000.0)

			metricRecords = append(metricRecords,
				models.VaultMetric{ID: uuid.New(), VaultID: v.ID, Metric: "tvl", Value: tvlVal, Timestamp: ts},
				models.VaultMetric{ID: uuid.New(), VaultID: v.ID, Metric: "invested", Value: investedVal, Timestamp: ts},
				models.VaultMetric{ID: uuid.New(), VaultID: v.ID, Metric: "pnl", Value: pnlVal, Timestamp: ts},
				models.VaultMetric{ID: uuid.New(), VaultID: v.ID, Metric: "fees", Value: feesVal, Timestamp: ts},
				models.VaultMetric{ID: uuid.New(), VaultID: v.ID, Metric: "volume", Value: volumeVal, Timestamp: ts},
			)

			priceRecords = append(priceRecords, models.PriceHistory{
				ID:        uuid.New(),
				VaultID:   v.ID,
				Price:     tvlVal,
				Volume:    volumeVal,
				FetchedAt: ts,
			})
		}

		if err := db.Create(&metricRecords).Error; err != nil {
			return fmt.Errorf("failed to seed metrics for vault %s: %w", v.Address, err)
		}
		if err := db.Create(&priceRecords).Error; err != nil {
			return fmt.Errorf("failed to seed price history for vault %s: %w", v.Address, err)
		}
	}

	return nil
}
