package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	solTokenSymbol       = "SOL"
	solMintAddress       = "So11111111111111111111111111111111111111112"
	marketCapLookbackDays = 30
	rollingWindowHours    = 24
)

type marketRepo struct {
	db *gorm.DB

	priceTable      string
	hasVaultMetrics bool
	hasTradeHistory bool
	hasVault        bool
}

func NewMarketRepository(db *gorm.DB) domain.MarketRepository {
	r := &marketRepo{db: db}
	if db != nil {
		switch {
		case db.Migrator().HasTable("price_history"):
			r.priceTable = "price_history"
		case db.Migrator().HasTable("price_histories"):
			r.priceTable = "price_histories"
		}
		r.hasVaultMetrics = db.Migrator().HasTable(&models.VaultMetric{})
		r.hasTradeHistory = db.Migrator().HasTable(&models.TradeHistory{})
		r.hasVault = db.Migrator().HasTable(&models.Vault{})
	}
	return r
}

type solPricePoint struct {
	Price     decimal.Decimal
	FetchedAt time.Time
}

func (r *marketRepo) GetMarketData(ctx context.Context) (*domain.MarketData, error) {
	md := &domain.MarketData{
		CirculatingChangePct: "",
		UpdatedAt:            time.Now().UTC(),
	}

	db := getDB(ctx, r.db)
	if db == nil {
		return md, nil
	}

	now := time.Now().UTC()
	window := time.Duration(rollingWindowHours) * time.Hour

	md.MarketCap = decString(r.totalMarketCap(db))
	md.MarketCapChangePct = decString(r.marketCapChangePct(db, now))

	md.Volume24h = decString(r.volumeInWindow(db, now.Add(-window), now))
	md.Volume24hChangePct = decString(r.volumeChangePct(db, now, window))

	latest := r.latestSOLPrice(db)
	if !latest.Price.IsZero() {
		md.Rate = latest.Price.String()
		md.UpdatedAt = latest.FetchedAt
	}
	md.RateChangePct = decString(r.rateChangePct(db, now, window))

	md.ATH = decString(r.solATH(db))
	md.ATHChangePct = decString(r.athChangePct(db))

	return md, nil
}

// decString renders a decimal as its plain string form, or "" when the value
// is zero/unavailable so the frontend can render a dash instead.
func decString(d decimal.Decimal) string {
	if d.IsZero() {
		return ""
	}
	return d.String()
}

// totalMarketCap is a TVL proxy for market cap: the sum of all vaults' TVL
// (soft-deleted vaults excluded).
func (r *marketRepo) totalMarketCap(db *gorm.DB) decimal.Decimal {
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

// marketCapChangePct compares the aggregate TVL at the start vs the end of
// the lookback window, derived from the vault_metrics tvl series summed
// across all vaults.
func (r *marketRepo) marketCapChangePct(db *gorm.DB, now time.Time) decimal.Decimal {
	if !r.hasVaultMetrics {
		return decimal.Zero
	}
	from := now.AddDate(0, 0, -marketCapLookbackDays)
	type bucketVal struct {
		Val decimal.Decimal
	}
	var rows []bucketVal
	if err := db.Table("vault_metrics").
		Select(fmt.Sprintf("%s AS bucket, SUM(value) AS val", getBucketSQL(db, "timestamp"))).
		Where("metric = ? AND timestamp >= ?", "tvl", from).
		Group("bucket").
		Order("bucket ASC").
		Scan(&rows).Error; err != nil || len(rows) < 2 {
		return decimal.Zero
	}
	return percentChange(rows[0].Val, rows[len(rows)-1].Val)
}

func (r *marketRepo) volumeInWindow(db *gorm.DB, from, to time.Time) decimal.Decimal {
	if !r.hasTradeHistory {
		return decimal.Zero
	}
	var vol decimal.Decimal
	if err := db.Table("trade_histories").
		Select("COALESCE(SUM(amount_in), 0)").
		Where("executed_at >= ? AND executed_at < ?", from, to).
		Scan(&vol).Error; err != nil {
		return decimal.Zero
	}
	return vol
}

func (r *marketRepo) volumeChangePct(db *gorm.DB, now time.Time, window time.Duration) decimal.Decimal {
	currentStart := now.Add(-window)
	previousStart := currentStart.Add(-window)
	return percentChange(
		r.volumeInWindow(db, previousStart, currentStart),
		r.volumeInWindow(db, currentStart, now),
	)
}

func (r *marketRepo) latestSOLPrice(db *gorm.DB) solPricePoint {
	if r.priceTable == "" {
		return solPricePoint{}
	}
	var point solPricePoint
	if err := db.Table(r.priceTable).
		Select("price, fetched_at").
		Where("token IN ?", []string{solTokenSymbol, solMintAddress}).
		Order("fetched_at DESC").
		Limit(1).
		Scan(&point).Error; err != nil {
		return solPricePoint{}
	}
	return point
}

func (r *marketRepo) rateChangePct(db *gorm.DB, now time.Time, window time.Duration) decimal.Decimal {
	if r.priceTable == "" {
		return decimal.Zero
	}
	from := now.Add(-window)
	var open decimal.Decimal
	if err := db.Table(r.priceTable).
		Select("price").
		Where("token IN ? AND fetched_at >= ?", []string{solTokenSymbol, solMintAddress}, from).
		Order("fetched_at ASC").
		Limit(1).
		Scan(&open).Error; err != nil {
		return decimal.Zero
	}
	return percentChange(open, r.latestSOLPrice(db).Price)
}

func (r *marketRepo) solATH(db *gorm.DB) decimal.Decimal {
	if r.priceTable == "" {
		return decimal.Zero
	}
	var ath decimal.Decimal
	if err := db.Table(r.priceTable).
		Select("COALESCE(MAX(price), 0)").
		Where("token IN ?", []string{solTokenSymbol, solMintAddress}).
		Scan(&ath).Error; err != nil {
		return decimal.Zero
	}
	return ath
}

func (r *marketRepo) athChangePct(db *gorm.DB) decimal.Decimal {
	rate := r.latestSOLPrice(db).Price
	ath := r.solATH(db)
	if rate.IsZero() || ath.IsZero() {
		return decimal.Zero
	}
	return percentChange(ath, rate)
}