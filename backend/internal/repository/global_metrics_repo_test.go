package repository

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupGlobalMetricsTestDB mirrors metrics_repo_test's schema but adds a
// `token` column to price_history so the market repo's SOL-rate lookup works.
func setupGlobalMetricsTestDB(t *testing.T) *gorm.DB {
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

	// Active vault (tvl 5000) + soft-deleted vault (tvl 99999, excluded).
	_ = db.Exec(`INSERT INTO vaults (id, address, tvl) VALUES
		('00000000-0000-0000-0000-000000000001', 'ActiveVault', 5000)`)
	_ = db.Exec(`INSERT INTO vaults (id, address, tvl, deleted_at) VALUES
		('00000000-0000-0000-0000-000000000002', 'DeletedVault', 99999, ?)`,
		time.Now().UTC())

	now := time.Now().UTC()

	// vault_metrics tvl series: 4000 -> 5000 over the 30-day lookback. The
	// first row sits safely INSIDE the 30-day window (a few minutes after the
	// cutoff) so both buckets are always within the repo's `timestamp >= from`
	// bound regardless of sub-ms skew between the test's `now` and the repo's.
	_ = db.Exec(`INSERT INTO vault_metrics (id, vault_id, metric, value, timestamp) VALUES
		('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'tvl', 4000, ?)`,
		now.AddDate(0, 0, -30).Add(5*time.Minute))
	_ = db.Exec(`INSERT INTO vault_metrics (id, vault_id, metric, value, timestamp) VALUES
		('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'tvl', 5000, ?)`,
		now.Add(-5*time.Minute))

	// price_history (all SOL): today's rate 150, open 100, platform ATH 200.
	_ = db.Exec(`INSERT INTO price_history (id, vault_id, token, price, volume, fetched_at) VALUES
		('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'SOL', 200, 0, ?)`,
		now.Add(-30*time.Hour))
	_ = db.Exec(`INSERT INTO price_history (id, vault_id, token, price, volume, fetched_at) VALUES
		('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'SOL', 100, 0, ?)`,
		now.Add(-20*time.Hour))
	_ = db.Exec(`INSERT INTO price_history (id, vault_id, token, price, volume, fetched_at) VALUES
		('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'SOL', 150, 0, ?)`,
		now.Add(-11*time.Hour))

	// trade_histories: 300 within the last 24h, 5000 outside it.
	_ = db.Exec(`INSERT INTO trade_histories (id, vault_id, trade_type, amount_in, amount_out, executed_at) VALUES
		('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'Buy', 200, 200, ?)`,
		now.Add(-5*time.Hour))
	_ = db.Exec(`INSERT INTO trade_histories (id, vault_id, trade_type, amount_in, amount_out, executed_at) VALUES
		('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 'Buy', 100, 100, ?)`,
		now.Add(-5*time.Hour))
	_ = db.Exec(`INSERT INTO trade_histories (id, vault_id, trade_type, amount_in, amount_out, executed_at) VALUES
		('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', 'Buy', 5000, 5000, ?)`,
		now.Add(-30*time.Hour))

	return db
}

func TestGetGlobalMetrics_FallbackPath(t *testing.T) {
	db := setupGlobalMetricsTestDB(t)
	repo := NewGlobalMetricsRepository(db)

	gm, err := repo.GetGlobalMetrics(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gm == nil {
		t.Fatal("expected non-nil global metrics")
	}

	// Market superset (frontend PerformanceChart keys) via market_repo fallback.
	if got := gm.MarketCap; got != "5000" {
		t.Errorf("market_cap = %q, want 5000", got)
	}
	if got := gm.PlatformTVL; got != "5000" {
		t.Errorf("platform_tvl = %q, want 5000 (soft-deleted vault excluded)", got)
	}
	if got := gm.PlatformTVLChangePct; got != "25" {
		t.Errorf("platform_tvl_change_pct = %q, want 25", got)
	}
	if got := gm.MarketCapChangePct; got != "25" {
		t.Errorf("market_cap_change_pct = %q, want 25", got)
	}
	if got := gm.Volume24h; got != "300" {
		t.Errorf("volume_24h = %q, want 300 (rows outside 24h excluded)", got)
	}
	if got := gm.Rate; got != "150" {
		t.Errorf("rate = %q, want 150", got)
	}
	if got := gm.ATH; got != "200" {
		t.Errorf("ath = %q, want 200", got)
	}
	if got := gm.PlatformATH; got != "200" {
		t.Errorf("platform_ath = %q, want 200", got)
	}
	if got := gm.PlatformATHChangePct; got != "-25" {
		t.Errorf("platform_ath_change_pct = %q, want -25", got)
	}
	// Untouched fields stay empty (no fabrication when caggs are absent).
	if got := gm.CirculatingSupply; got != "" {
		t.Errorf("circulating_supply = %q, want empty", got)
	}
}

func TestGetGlobalMetrics_EmptyDB(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	repo := NewGlobalMetricsRepository(db)

	gm, err := repo.GetGlobalMetrics(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gm == nil {
		t.Fatal("expected non-nil global metrics")
	}
	if gm.PlatformTVL != "" || gm.PlatformATH != "" || gm.MarketCap != "" || gm.Volume24h != "" {
		t.Errorf("expected all-empty values on empty db, got %+v", gm)
	}
}