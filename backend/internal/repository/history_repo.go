package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// historyRangeDays maps a compact range shorthand to a backward-looking day
// window. Values are validated by the handler; anything unknown here is an
// invalid-input error.
var historyRangeDays = map[string]int{
	"7d":  7,
	"30d": 30,
	"90d": 90,
}

type historyRepo struct {
	db *gorm.DB

	hasVaultMetrics bool
	priceTable      string
	hasTradeHistory bool
	hasUsers        bool
	hasPortfolios   bool
	hasPnLSummary   bool
}

func NewHistoryRepository(db *gorm.DB) domain.HistoryRepository {
	r := &historyRepo{db: db}
	if db != nil {
		r.hasVaultMetrics = db.Migrator().HasTable("vault_metrics")
		switch {
		case db.Migrator().HasTable("price_histories"):
			r.priceTable = "price_histories"
		case db.Migrator().HasTable("price_history"):
			r.priceTable = "price_history"
		}
		r.hasTradeHistory = db.Migrator().HasTable(&models.TradeHistory{})
		r.hasUsers = db.Migrator().HasTable(&models.User{})
		r.hasPortfolios = db.Migrator().HasTable(&models.Portfolio{})
		r.hasPnLSummary = db.Migrator().HasTable("user_pnl_summary")
	}
	return r
}

// GetVaultSparkline returns the vault NAV-over-time series. Real sources, in
// order: vault_metrics (metric='tvl'), then price_history. Empty when neither
// has rows for the vault.
func (r *historyRepo) GetVaultSparkline(ctx context.Context, vaultID, period, resolution string) ([]domain.HistoryPoint, error) {
	if _, ok := historyRangeDays[period]; !ok {
		return nil, fmt.Errorf("%w: unsupported range %q", domain.ErrInvalidInput, period)
	}
	if resolution != "day" && resolution != "hour" {
		return nil, fmt.Errorf("%w: unsupported resolution %q", domain.ErrInvalidInput, resolution)
	}

	db := getDB(ctx, r.db)
	if db == nil {
		return nil, errors.New("database not initialized")
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -historyRangeDays[period])

	// 1. Prefer the metrics sink when present: metric='tvl' is the NAV source.
	if r.hasVaultMetrics {
		points, err := r.queryVaultMetricsSeries(db, vaultID, from, to, resolution)
		if err != nil {
			return nil, err
		}
		if len(points) > 0 {
			return points, nil
		}
	}

	// 2. Fall back to raw price rows.
	if r.priceTable != "" {
		points, err := r.queryPriceHistorySeries(db, vaultID, from, to, resolution)
		if err != nil {
			return nil, err
		}
		return points, nil
	}

	return []domain.HistoryPoint{}, nil
}

// GetPortfolioHistory returns the wallet's portfolio total value over time.
// Real sources, in order: trade_histories (net deposits per day, running
// total), user_pnl_summary materialized view, then portfolios. Empty when the
// wallet has no rows anywhere.
func (r *historyRepo) GetPortfolioHistory(ctx context.Context, wallet, period string) ([]domain.HistoryPoint, error) {
	if _, ok := historyRangeDays[period]; !ok {
		return nil, fmt.Errorf("%w: unsupported range %q", domain.ErrInvalidInput, period)
	}

	db := getDB(ctx, r.db)
	if db == nil {
		return nil, errors.New("database not initialized")
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -historyRangeDays[period])

	if r.hasTradeHistory && r.hasUsers {
		if points, err := r.queryTradeHistorySeries(db, wallet, from, to); err != nil {
			return nil, err
		} else if len(points) > 0 {
			return points, nil
		}
	}

	if r.hasPnLSummary && r.hasUsers {
		if points, err := r.queryPnLSummarySeries(db, wallet, from, to); err != nil {
			return nil, err
		} else if len(points) > 0 {
			return points, nil
		}
	}

	if r.hasPortfolios && r.hasUsers {
		if points, err := r.queryPortfolioSeries(db, wallet, from, to); err != nil {
			return nil, err
		} else if len(points) > 0 {
			return points, nil
		}
	}

	return []domain.HistoryPoint{}, nil
}

func (r *historyRepo) queryVaultMetricsSeries(db *gorm.DB, vaultID string, from, to time.Time, resolution string) ([]domain.HistoryPoint, error) {
	var results []bucketQueryResult
	q := db.Table("vault_metrics").
		Select(fmt.Sprintf("%s AS bucket, AVG(value) AS val", historyBucketSQL(db, "timestamp", resolution))).
		Where("metric = ? AND timestamp >= ? AND timestamp <= ?", "tvl", from, to)
	if vaultID != "" {
		if vid, err := uuid.Parse(vaultID); err == nil {
			q = q.Where("vault_id = ?", vid)
		} else {
			q = q.Where("vault_id = ?", vaultID)
		}
	}
	if err := q.Group("bucket").Order("bucket ASC").Scan(&results).Error; err != nil {
		return nil, err
	}
	return historyPointsFromBuckets(results, time.RFC3339)
}

func (r *historyRepo) queryPriceHistorySeries(db *gorm.DB, vaultID string, from, to time.Time, resolution string) ([]domain.HistoryPoint, error) {
	var results []bucketQueryResult
	q := db.Table(r.priceTable).
		Select(fmt.Sprintf("%s AS bucket, AVG(price) AS val", historyBucketSQL(db, "fetched_at", resolution))).
		Where("fetched_at >= ? AND fetched_at <= ?", from, to)
	if vaultID != "" {
		if vid, err := uuid.Parse(vaultID); err == nil {
			q = q.Where("vault_id = ?", vid)
		} else {
			q = q.Where("vault_id = ?", vaultID)
		}
	}
	if err := q.Group("bucket").Order("bucket ASC").Scan(&results).Error; err != nil {
		return nil, err
	}
	return historyPointsFromBuckets(results, time.RFC3339)
}

func (r *historyRepo) queryTradeHistorySeries(db *gorm.DB, wallet string, from, to time.Time) ([]domain.HistoryPoint, error) {
	var deltas []bucketQueryResult
	q := db.Table("trade_histories").
		Joins("JOIN users ON users.id = trade_histories.actor_id").
		Select(fmt.Sprintf("%s AS bucket, SUM(amount_in - amount_out) AS val", historyBucketSQL(db, "executed_at", "day"))).
		Where("users.wallet_address = ? AND executed_at >= ? AND executed_at <= ?", wallet, from, to).
		Group("bucket").Order("bucket ASC")
	if err := q.Scan(&deltas).Error; err != nil {
		return nil, err
	}
	if len(deltas) == 0 {
		return []domain.HistoryPoint{}, nil
	}

	// Running total of net deposits models the portfolio value over time.
	running := decimal.Zero
	points := make([]domain.HistoryPoint, 0, len(deltas))
	for _, d := range deltas {
		ts, err := parseHistoryBucketTime(d.Bucket)
		if err != nil {
			return nil, err
		}
		running = running.Add(d.Value)
		points = append(points, domain.HistoryPoint{
			Date:  ts.UTC().Format("2006-01-02"),
			Value: running,
		})
	}
	return points, nil
}

func (r *historyRepo) queryPnLSummarySeries(db *gorm.DB, wallet string, from, to time.Time) ([]domain.HistoryPoint, error) {
	userID, found, err := r.userIDByWallet(db, wallet)
	if err != nil || !found {
		return []domain.HistoryPoint{}, err
	}
	var results []bucketQueryResult
	q := db.Table("user_pnl_summary").
		Select(fmt.Sprintf("%s AS bucket, SUM(current_value) AS val", historyBucketSQL(db, "as_of", "day"))).
		Where("user_id = ? AND as_of >= ? AND as_of <= ?", userID, from, to).
		Group("bucket").Order("bucket ASC")
	if err := q.Scan(&results).Error; err != nil {
		return nil, err
	}
	return historyPointsFromBuckets(results, "2006-01-02")
}

func (r *historyRepo) queryPortfolioSeries(db *gorm.DB, wallet string, from, to time.Time) ([]domain.HistoryPoint, error) {
	userID, found, err := r.userIDByWallet(db, wallet)
	if err != nil || !found {
		return []domain.HistoryPoint{}, err
	}
	var results []bucketQueryResult
	q := db.Table("portfolios").
		Select(fmt.Sprintf("%s AS bucket, SUM(total_invested_value) AS val", historyBucketSQL(db, "updated_at", "day"))).
		Where("user_id = ? AND updated_at >= ? AND updated_at <= ?", userID, from, to).
		Group("bucket").Order("bucket ASC")
	if err := q.Scan(&results).Error; err != nil {
		return nil, err
	}
	return historyPointsFromBuckets(results, "2006-01-02")
}

func (r *historyRepo) userIDByWallet(db *gorm.DB, wallet string) (string, bool, error) {
	var user models.User
	if err := db.Where("wallet_address = ?", wallet).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	return user.ID.String(), true, nil
}

// historyBucketSQL is the portable day/hour bucketing helper. Postgres uses
// DATE_TRUNC, SQLite uses DATE()/strftime — mirroring getBucketSQL in
// metrics_repo.go but extended with the "hour" resolution.
func historyBucketSQL(db *gorm.DB, col, resolution string) string {
	if db != nil && db.Dialector != nil && db.Dialector.Name() == "sqlite" {
		if resolution == "hour" {
			return "strftime('%Y-%m-%d %H:00:00', " + col + ")"
		}
		return "DATE(" + col + ")"
	}
	if resolution == "hour" {
		return "DATE_TRUNC('hour', " + col + ")"
	}
	return "DATE_TRUNC('day', " + col + ")"
}

// historyPointsFromBuckets converts raw bucketed rows into HistoryPoints,
// formatting the date with layout (RFC3339 for sparklines, "2006-01-02" for
// portfolio history).
func historyPointsFromBuckets(results []bucketQueryResult, layout string) ([]domain.HistoryPoint, error) {
	if len(results) == 0 {
		return []domain.HistoryPoint{}, nil
	}
	points := make([]domain.HistoryPoint, 0, len(results))
	for _, res := range results {
		ts, err := parseHistoryBucketTime(res.Bucket)
		if err != nil {
			return nil, err
		}
		points = append(points, domain.HistoryPoint{
			Date:  ts.UTC().Format(layout),
			Value: res.Value,
		})
	}
	return points, nil
}

// parseHistoryBucketTime is like parseBucketTime in metrics_repo.go but keeps
// the hour-of-day so "hour" resolution buckets survive the round-trip.
func parseHistoryBucketTime(v interface{}) (time.Time, error) {
	if v == nil {
		return time.Time{}, nil
	}
	for {
		if ptr, ok := v.(*interface{}); ok && ptr != nil {
			v = *ptr
		} else {
			break
		}
	}
	switch t := v.(type) {
	case time.Time:
		return t.UTC(), nil
	case *time.Time:
		if t == nil {
			return time.Time{}, nil
		}
		return t.UTC(), nil
	case string:
		layouts := []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02 15:04:05-07:00",
			"2006-01-02 15:04:05.999999999",
			"2006-01-02 15:04:05",
			"2006-01-02",
		}
		for _, l := range layouts {
			if parsed, err := time.Parse(l, t); err == nil {
				return parsed.UTC(), nil
			}
		}
		return time.Time{}, fmt.Errorf("cannot parse time string %q", t)
	case *string:
		if t == nil {
			return time.Time{}, nil
		}
		return parseHistoryBucketTime(*t)
	default:
		return time.Time{}, fmt.Errorf("unexpected time type %T", v)
	}
}
