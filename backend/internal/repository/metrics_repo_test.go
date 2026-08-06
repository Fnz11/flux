package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupMetricsTestDB(t *testing.T) *gorm.DB {
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
		manager_id TEXT DEFAULT '00000000-0000-0000-0000-000000000000',
		status TEXT DEFAULT 'Active',
		metadata TEXT DEFAULT '{}',
		performance_fee_bps INTEGER DEFAULT 0,
		management_fee_bps INTEGER DEFAULT 0,
		min_raise_amount NUMERIC DEFAULT 0,
		lockup_period INTEGER DEFAULT 0,
		vault_type TEXT DEFAULT 'open',
		tvl REAL DEFAULT 0,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE vault_metrics (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		metric TEXT NOT NULL,
		value REAL NOT NULL,
		timestamp DATETIME NOT NULL
	)`)
	_ = db.Exec(`CREATE TABLE price_history (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		price REAL NOT NULL,
		volume REAL NOT NULL,
		fetched_at DATETIME NOT NULL
	)`)
	_ = db.Exec(`CREATE TABLE price_histories (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		token TEXT,
		price REAL NOT NULL,
		volume REAL NOT NULL,
		fetched_at DATETIME NOT NULL
	)`)
	_ = db.Exec(`CREATE TABLE trade_histories (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		actor_id TEXT DEFAULT '00000000-0000-0000-0000-000000000000',
		transaction_signature TEXT,
		trade_type TEXT NOT NULL,
		input_token TEXT DEFAULT '',
		output_token TEXT DEFAULT '',
		amount_in REAL NOT NULL,
		amount_out REAL NOT NULL,
		price_at_execution REAL,
		executed_at DATETIME NOT NULL
	)`)

	return db
}

func TestCalculateSummaryMath(t *testing.T) {
	t.Run("empty_points", func(t *testing.T) {
		s := CalculateSummary(nil)
		if !s.Total.IsZero() || !s.NetChange.IsZero() || !s.PctChange.IsZero() || !s.Peak.IsZero() || !s.Low.IsZero() || !s.Avg.IsZero() {
			t.Errorf("expected all zero summary for empty points, got %+v", s)
		}
	})

	t.Run("single_point", func(t *testing.T) {
		pts := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.NewFromInt(100)},
		}
		s := CalculateSummary(pts)
		if !s.Total.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Total = %v, want 100", s.Total)
		}
		if !s.NetChange.IsZero() {
			t.Errorf("NetChange = %v, want 0", s.NetChange)
		}
		if !s.PctChange.IsZero() {
			t.Errorf("PctChange = %v, want 0", s.PctChange)
		}
		if !s.Peak.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Peak = %v, want 100", s.Peak)
		}
		if !s.Low.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Low = %v, want 100", s.Low)
		}
		if !s.Avg.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Avg = %v, want 100", s.Avg)
		}
	})

	t.Run("increasing_series", func(t *testing.T) {
		pts := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.NewFromInt(100)},
			{Date: "2026-07-08", Value: decimal.NewFromInt(150)},
			{Date: "2026-07-09", Value: decimal.NewFromInt(200)},
		}
		s := CalculateSummary(pts)
		if !s.Total.Equal(decimal.NewFromInt(450)) {
			t.Errorf("Total = %v, want 450", s.Total)
		}
		if !s.NetChange.Equal(decimal.NewFromInt(100)) {
			t.Errorf("NetChange = %v, want 100", s.NetChange)
		}
		if !s.PctChange.Equal(decimal.NewFromInt(100)) {
			t.Errorf("PctChange = %v, want 100", s.PctChange)
		}
		if !s.Peak.Equal(decimal.NewFromInt(200)) {
			t.Errorf("Peak = %v, want 200", s.Peak)
		}
		if !s.Low.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Low = %v, want 100", s.Low)
		}
		if !s.Avg.Equal(decimal.NewFromInt(150)) {
			t.Errorf("Avg = %v, want 150", s.Avg)
		}
	})

	t.Run("decreasing_series", func(t *testing.T) {
		pts := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.NewFromInt(200)},
			{Date: "2026-07-08", Value: decimal.NewFromInt(100)},
		}
		s := CalculateSummary(pts)
		if !s.NetChange.Equal(decimal.NewFromInt(-100)) {
			t.Errorf("NetChange = %v, want -100", s.NetChange)
		}
		if !s.PctChange.Equal(decimal.NewFromInt(-50)) {
			t.Errorf("PctChange = %v, want -50", s.PctChange)
		}
		if !s.Peak.Equal(decimal.NewFromInt(200)) {
			t.Errorf("Peak = %v, want 200", s.Peak)
		}
		if !s.Low.Equal(decimal.NewFromInt(100)) {
			t.Errorf("Low = %v, want 100", s.Low)
		}
	})

	t.Run("zero_first_value_positive_and_negative_net_change", func(t *testing.T) {
		ptsPos := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.Zero},
			{Date: "2026-07-08", Value: decimal.NewFromInt(100)},
		}
		sPos := CalculateSummary(ptsPos)
		if !sPos.PctChange.Equal(decimal.NewFromInt(100)) {
			t.Errorf("expected PctChange 100 for 0 -> 100, got %v", sPos.PctChange)
		}

		ptsNeg := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.Zero},
			{Date: "2026-07-08", Value: decimal.NewFromInt(-50)},
		}
		sNeg := CalculateSummary(ptsNeg)
		if !sNeg.PctChange.Equal(decimal.NewFromInt(-100)) {
			t.Errorf("expected PctChange -100 for 0 -> -50, got %v", sNeg.PctChange)
		}

		ptsZero := []domain.MetricDataPoint{
			{Date: "2026-07-07", Value: decimal.Zero},
			{Date: "2026-07-08", Value: decimal.Zero},
		}
		sZero := CalculateSummary(ptsZero)
		if !sZero.PctChange.IsZero() {
			t.Errorf("expected PctChange 0 for 0 -> 0, got %v", sZero.PctChange)
		}
	})
}

func TestGetMetricSeries(t *testing.T) {
	db := setupMetricsTestDB(t)
	repo := NewMetricsRepository(db)
	vaultID := uuid.New()
	now := time.Now().UTC()

	// Seed vault_metrics table
	metricsToSeed := []models.VaultMetric{
		{
			VaultID:   vaultID,
			Metric:    "tvl",
			Value:     decimal.NewFromInt(1000),
			Timestamp: now.AddDate(0, 0, -3),
		},
		{
			VaultID:   vaultID,
			Metric:    "tvl",
			Value:     decimal.NewFromInt(1200),
			Timestamp: now.AddDate(0, 0, -1),
		},
		{
			VaultID:   vaultID,
			Metric:    "volume",
			Value:     decimal.NewFromInt(500),
			Timestamp: now.AddDate(0, 0, -2),
		},
	}

	for _, m := range metricsToSeed {
		if err := db.Create(&m).Error; err != nil {
			t.Fatalf("failed to seed metric: %v", err)
		}
	}

	t.Run("valid_7d_tvl_vault_metrics", func(t *testing.T) {
		res, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "tvl", "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Metric != "tvl" || res.Period != "7d" || res.VaultID != vaultID.String() {
			t.Errorf("unexpected response header: %+v", res)
		}
		if len(res.Series) != 2 {
			t.Fatalf("got %d series points, want 2", len(res.Series))
		}
		if !res.Summary.Total.Equal(decimal.NewFromInt(2200)) {
			t.Errorf("Total = %v, want 2200", res.Summary.Total)
		}
		if !res.Summary.NetChange.Equal(decimal.NewFromInt(200)) {
			t.Errorf("NetChange = %v, want 200", res.Summary.NetChange)
		}
		if !res.Summary.Peak.Equal(decimal.NewFromInt(1200)) {
			t.Errorf("Peak = %v, want 1200", res.Summary.Peak)
		}
		if !res.Summary.Low.Equal(decimal.NewFromInt(1000)) {
			t.Errorf("Low = %v, want 1000", res.Summary.Low)
		}
	})

	t.Run("periods_14d_30d", func(t *testing.T) {
		for _, p := range []string{"14d", "30d"} {
			res, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "tvl", p)
			if err != nil {
				t.Fatalf("period %s error: %v", p, err)
			}
			if res.Period != p {
				t.Errorf("Period = %s, want %s", res.Period, p)
			}
		}
	})

	t.Run("invalid_metric", func(t *testing.T) {
		_, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "invalid_metric", "7d")
		if !errors.Is(err, domain.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("invalid_period", func(t *testing.T) {
		_, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "tvl", "60d")
		if !errors.Is(err, domain.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("all_metrics_supported", func(t *testing.T) {
		metrics := []string{"tvl", "invested", "pnl", "fees", "volume"}
		for _, m := range metrics {
			res, err := repo.GetMetricSeries(context.Background(), vaultID.String(), m, "7d")
			if err != nil {
				t.Errorf("metric %s failed: %v", m, err)
			}
			if res.Metric != m {
				t.Errorf("Metric = %s, want %s", res.Metric, m)
			}
		}
	})
}

func TestGetMetricSeries_Fallbacks(t *testing.T) {
	db := setupMetricsTestDB(t)
	repo := NewMetricsRepository(db)
	vaultID := uuid.New()
	now := time.Now().UTC()

	// Seed price_history for vaultID
	ph := models.PriceHistory{
		ID:        uuid.New(),
		VaultID:   vaultID,
		Price:     decimal.NewFromFloat(150.0),
		Volume:    decimal.NewFromFloat(5000.0),
		FetchedAt: now.AddDate(0, 0, -2),
	}
	if err := db.Create(&ph).Error; err != nil {
		t.Fatalf("failed to seed price_history: %v", err)
	}

	// Seed trade_histories for vaultID
	thDeposit := models.TradeHistory{
		ID:               uuid.New(),
		VaultID:          vaultID,
		TradeType:        "Deposit",
		AmountIn:         decimal.NewFromFloat(100.0),
		AmountOut:        decimal.NewFromFloat(100.0),
		PriceAtExecution: decimal.NewFromFloat(150.0),
		ExecutedAt:       now.AddDate(0, 0, -2),
	}
	thWithdraw := models.TradeHistory{
		ID:               uuid.New(),
		VaultID:          vaultID,
		TradeType:        "Withdraw",
		AmountIn:         decimal.NewFromFloat(50.0),
		AmountOut:        decimal.NewFromFloat(70.0), // PnL = 70 - 50 = 20
		PriceAtExecution: decimal.NewFromFloat(150.0),
		ExecutedAt:       now.AddDate(0, 0, -1),
	}
	_ = db.Create(&thDeposit).Error
	_ = db.Create(&thWithdraw).Error

	t.Run("FallbackToPriceHistory_TVL_Volume", func(t *testing.T) {
		emptyVaultID := uuid.New()
		_ = db.Create(&models.PriceHistory{
			ID:        uuid.New(),
			VaultID:   emptyVaultID,
			Price:     decimal.NewFromFloat(200.0),
			Volume:    decimal.NewFromFloat(3000.0),
			FetchedAt: now.AddDate(0, 0, -1),
		}).Error

		resTVL, err := repo.GetMetricSeries(context.Background(), emptyVaultID.String(), "tvl", "7d")
		if err != nil {
			t.Fatalf("unexpected error TVL fallback: %v", err)
		}
		if len(resTVL.Series) != 1 {
			t.Fatalf("expected 1 series point, got %d", len(resTVL.Series))
		}
		if !resTVL.Series[0].Value.Equal(decimal.NewFromFloat(200.0)) {
			t.Errorf("expected price 200, got %s", resTVL.Series[0].Value)
		}

		resVol, err := repo.GetMetricSeries(context.Background(), emptyVaultID.String(), "volume", "7d")
		if err != nil {
			t.Fatalf("unexpected error Volume fallback: %v", err)
		}
		if len(resVol.Series) != 1 {
			t.Fatalf("expected 1 series point, got %d", len(resVol.Series))
		}
		if !resVol.Series[0].Value.Equal(decimal.NewFromFloat(3000.0)) {
			t.Errorf("expected volume 3000, got %s", resVol.Series[0].Value)
		}
	})

	t.Run("FallbackToSinglePoint_VaultTVL", func(t *testing.T) {
		singleVaultID := uuid.New()
		_ = db.Create(&models.Vault{ID: singleVaultID, Address: "SingleVault", TVL: decimal.NewFromFloat(999.0)}).Error

		res, err := repo.GetMetricSeries(context.Background(), singleVaultID.String(), "tvl", "7d")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(res.Series) != 1 {
			t.Fatalf("expected 1 point fallback from Vault.TVL, got %d", len(res.Series))
		}
		if !res.Series[0].Value.Equal(decimal.NewFromFloat(999.0)) {
			t.Errorf("expected TVL 999, got %s", res.Series[0].Value)
		}
	})

	t.Run("Fallback_Invested_PnL_Fees", func(t *testing.T) {
		resInv, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "invested", "7d")
		if err != nil || len(resInv.Series) == 0 {
			t.Fatalf("expected invested series from trade_histories, got err=%v series=%+v", err, resInv)
		}

		resPnL, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "pnl", "7d")
		if err != nil || len(resPnL.Series) == 0 {
			t.Fatalf("expected pnl series from trade_histories, got err=%v series=%+v", err, resPnL)
		}

		resFees, err := repo.GetMetricSeries(context.Background(), vaultID.String(), "fees", "7d")
		if err != nil || len(resFees.Series) == 0 {
			t.Fatalf("expected fees series from trade_histories, got err=%v series=%+v", err, resFees)
		}
	})
}

func TestParseBucketTime(t *testing.T) {
	now := time.Now().UTC()
	formattedDate := now.Format("2006-01-02")

	t.Run("nil_input", func(t *testing.T) {
		parsed, err := parseBucketTime(nil)
		if err != nil || !parsed.IsZero() {
			t.Errorf("expected zero time for nil, got %v, err %v", parsed, err)
		}
	})

	t.Run("time_Time_input", func(t *testing.T) {
		parsed, err := parseBucketTime(now)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if parsed.Format("2006-01-02") != formattedDate {
			t.Errorf("expected %s, got %s", formattedDate, parsed.Format("2006-01-02"))
		}

		parsedPtr, err := parseBucketTime(&now)
		if err != nil || parsedPtr.Format("2006-01-02") != formattedDate {
			t.Errorf("expected %s, got %s, err %v", formattedDate, parsedPtr.Format("2006-01-02"), err)
		}
	})

	t.Run("string_layouts", func(t *testing.T) {
		inputs := []string{
			"2026-08-06T12:00:00Z",
			"2026-08-06 12:00:00.000000+00:00",
			"2026-08-06 12:00:00",
			"2026-08-06",
		}
		for _, inp := range inputs {
			parsed, err := parseBucketTime(inp)
			if err != nil {
				t.Errorf("failed to parse string %q: %v", inp, err)
			} else if parsed.Format("2006-01-02") != "2026-08-06" {
				t.Errorf("expected date 2026-08-06 for %q, got %s", inp, parsed.Format("2006-01-02"))
			}

			inpStr := inp
			parsedPtr, err := parseBucketTime(&inpStr)
			if err != nil || parsedPtr.Format("2006-01-02") != "2026-08-06" {
				t.Errorf("failed to parse string pointer %q: %v", inp, err)
			}
		}
	})

	t.Run("unsupported_type", func(t *testing.T) {
		_, err := parseBucketTime(12345)
		if err == nil {
			t.Errorf("expected error for int input")
		}

		badStr := "invalid-date-string"
		_, err = parseBucketTime(badStr)
		if err == nil {
			t.Errorf("expected error for unparseable time string")
		}
	})
}
