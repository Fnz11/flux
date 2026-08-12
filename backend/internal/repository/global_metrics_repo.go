package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// globalMetricsRepo computes platform-wide (global) metrics as a superset of
// MarketData: on postgres with the 080 continuous aggregates present it reads
// the 1h caggs; everywhere else (sqlite tests, cagg missing) it falls back to
// the same raw-table scans market_repo uses, so the endpoint never breaks and
// never fabricates a value.
type globalMetricsRepo struct {
	db *gorm.DB

	market       domain.MarketRepository
	hasCAGGVol1h bool
	hasCAGGTVL1h bool
	hasCAGGAth1h bool
	hasVault     bool
	priceTable   string
}

func NewGlobalMetricsRepository(db *gorm.DB) domain.GlobalMetricsRepository {
	r := &globalMetricsRepo{
		db:     db,
		market: NewMarketRepository(db),
	}
	if db != nil {
		r.hasCAGGVol1h = db.Migrator().HasTable("cagg_global_volume_1h")
		r.hasCAGGTVL1h = db.Migrator().HasTable("cagg_global_tvl_1h")
		r.hasCAGGAth1h = db.Migrator().HasTable("cagg_global_ath_price_1h")
		r.hasVault = db.Migrator().HasTable("vaults")
		switch {
		case db.Migrator().HasTable("price_history"):
			r.priceTable = "price_history"
		case db.Migrator().HasTable("price_histories"):
			r.priceTable = "price_histories"
		}
	}
	return r
}

// GetGlobalMetrics returns the market superset plus the platform-wide fields.
// The market repo already fills every PerformanceChart key; only the platform
// additions (tvl, price ATH) and the cagg-assisted 24h volume are overridden
// here.
func (r *globalMetricsRepo) GetGlobalMetrics(ctx context.Context) (*domain.GlobalMetrics, error) {
	gm := &domain.GlobalMetrics{}

	db := getDB(ctx, r.db)
	if db == nil {
		return gm, nil
	}

	market, err := r.market.GetMarketData(ctx)
	if err != nil {
		market = &domain.MarketData{}
	}
	gm.MarketData = *market

	now := time.Now().UTC()

	// 24h global volume: prefer cagg_global_volume_1h when present, else keep
	// the raw value market already computed.
	if db.Dialector.Name() == "postgres" && r.hasCAGGVol1h {
		gm.Volume24h = decString(r.volume24hFromCagg(db, now))
		gm.Volume24hChangePct = decString(r.volume24hChangeFromCagg(db, now))
	}

	gm.PlatformTVL = decString(r.platformTVL(db))
	gm.PlatformTVLChangePct = decString(r.platformTVLChangePct(db, now))
	gm.PlatformATH = decString(r.platformATH(db))
	gm.PlatformATHChangePct = decString(r.platformATHChangePct(db, gm.Rate))

	return gm, nil
}

// platformTVL returns the current platform TVL: the latest cagg bucket when
// available, otherwise the raw SUM(vaults.tvl) (soft-deleted vaults excluded,
// mirroring market_repo.totalMarketCap).
func (r *globalMetricsRepo) platformTVL(db *gorm.DB) decimal.Decimal {
	if db.Dialector.Name() == "postgres" && r.hasCAGGTVL1h {
		var tvl decimal.Decimal
		if err := db.Table("cagg_global_tvl_1h").
			Select("tvl").Order("bucket DESC").Limit(1).
			Scan(&tvl).Error; err == nil {
			return tvl
		}
	}
	if !r.hasVault {
		return decimal.Zero
	}
	var total decimal.Decimal
	if err := db.Table("vaults").
		Select("COALESCE(SUM(tvl), 0)").
		Where("deleted_at IS NULL").
		Scan(&total).Error; err != nil {
		return decimal.Zero
	}
	return total
}

// platformTVLChangePct compares the aggregated platform TVL at the start vs
// the end of the lookback window: first vs last hourly cagg bucket, else the
// raw vault_metrics daily buckets (same query shape as marketCapChangePct).
func (r *globalMetricsRepo) platformTVLChangePct(db *gorm.DB, now time.Time) decimal.Decimal {
	from := now.AddDate(0, 0, -marketCapLookbackDays)
	if db.Dialector.Name() == "postgres" && r.hasCAGGTVL1h {
		var rows []bucketQueryResult
		if err := db.Table("cagg_global_tvl_1h").
			Select("bucket, COALESCE(tvl, 0) AS val").
			Where("bucket >= ?", from).
			Order("bucket ASC").
			Scan(&rows).Error; err == nil && len(rows) >= 2 {
			return percentChange(rows[0].Value, rows[len(rows)-1].Value)
		}
		return decimal.Zero
	}

	var rows []bucketQueryResult
	if err := db.Table("vault_metrics").
		Select(fmt.Sprintf("%s AS bucket, SUM(value) AS val", getBucketSQL(db, "timestamp"))).
		Where("metric = ? AND timestamp >= ?", "tvl", from).
		Group("bucket").
		Order("bucket ASC").
		Scan(&rows).Error; err != nil || len(rows) < 2 {
		return decimal.Zero
	}
	return percentChange(rows[0].Value, rows[len(rows)-1].Value)
}

// volume24hFromCagg sums cagg_global_volume_1h over the last 24 hours. The
// realtime aggregation window means the newest (in-progress) hour is computed
// live at query time.
func (r *globalMetricsRepo) volume24hFromCagg(db *gorm.DB, now time.Time) decimal.Decimal {
	win := time.Duration(rollingWindowHours) * time.Hour
	return r.caggVolumeIn(db, now.Add(-win), now)
}

// volume24hChangeFromCagg compares the previous 24h against the current 24h
// using the same cagg.
func (r *globalMetricsRepo) volume24hChangeFromCagg(db *gorm.DB, now time.Time) decimal.Decimal {
	win := time.Duration(rollingWindowHours) * time.Hour
	currentStart := now.Add(-win)
	previousStart := currentStart.Add(-win)
	return percentChange(
		r.caggVolumeIn(db, previousStart, currentStart),
		r.caggVolumeIn(db, currentStart, now),
	)
}

func (r *globalMetricsRepo) caggVolumeIn(db *gorm.DB, from, to time.Time) decimal.Decimal {
	var vol decimal.Decimal
	if err := db.Table("cagg_global_volume_1h").
		Select("COALESCE(SUM(volume_in), 0)").
		Where("bucket >= ? AND bucket < ?", from, to).
		Scan(&vol).Error; err != nil {
		return decimal.Zero
	}
	return vol
}

// platformATH returns the max price ever observed: the max cagg bucket when
// available, else the raw MAX(price) over the whole price table (no token
// filter --- platform-wide, unlike market_repo's SOL-only ATH).
func (r *globalMetricsRepo) platformATH(db *gorm.DB) decimal.Decimal {
	if db.Dialector.Name() == "postgres" && r.hasCAGGAth1h {
		var ath decimal.Decimal
		if err := db.Table("cagg_global_ath_price_1h").
			Select("COALESCE(MAX(ath_price), 0)").
			Scan(&ath).Error; err == nil {
			return ath
		}
	}
	if r.priceTable == "" {
		return decimal.Zero
	}
	var ath decimal.Decimal
	if err := db.Table(r.priceTable).
		Select("COALESCE(MAX(price), 0)").
		Scan(&ath).Error; err != nil {
		return decimal.Zero
	}
	return ath
}

// platformATHChangePct reports how far the current rate sits below the
// platform ATH, mirroring market_repo.athChangePct.
func (r *globalMetricsRepo) platformATHChangePct(db *gorm.DB, rateStr string) decimal.Decimal {
	ath := r.platformATH(db)
	if ath.IsZero() || rateStr == "" {
		return decimal.Zero
	}
	rate, err := decimal.NewFromString(rateStr)
	if err != nil || rate.IsZero() {
		return decimal.Zero
	}
	return percentChange(ath, rate)
}