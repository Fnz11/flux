package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var validMetrics = map[string]bool{
	"tvl":      true,
	"invested": true,
	"pnl":      true,
	"fees":     true,
	"volume":   true,
}

var validPeriods = map[string]int{
	"7d":  7,
	"14d": 14,
	"30d": 30,
}

type metricsRepo struct {
	db *gorm.DB

	hasVaultMetrics     bool
	hasPriceHistory     bool
	hasTradeHistory     bool
	hasVault            bool
	hasCAGGPriceOHLCV1h bool
}

func NewMetricsRepository(db *gorm.DB) domain.MetricsRepository {
	r := &metricsRepo{db: db}
	if db != nil {
		r.hasVaultMetrics = db.Migrator().HasTable(&models.VaultMetric{})
		r.hasPriceHistory = db.Migrator().HasTable(&models.PriceHistory{})
		r.hasTradeHistory = db.Migrator().HasTable(&models.TradeHistory{})
		r.hasVault = db.Migrator().HasTable(&models.Vault{})
		r.hasCAGGPriceOHLCV1h = db.Migrator().HasTable("cagg_price_ohlcv_1h")
	}
	return r
}

type bucketQueryResult struct {
	Bucket interface{}     `gorm:"column:bucket;type:text"`
	Value  decimal.Decimal `gorm:"column:val"`
}

func (r *metricsRepo) GetMetricSeries(ctx context.Context, vaultID string, metric string, period string) (*domain.MetricSeriesResponse, error) {
	if !validMetrics[metric] {
		return nil, fmt.Errorf("%w: unsupported metric %q", domain.ErrInvalidInput, metric)
	}

	days, ok := validPeriods[period]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported period %q", domain.ErrInvalidInput, period)
	}

	db := getDB(ctx, r.db)
	to := time.Now().UTC()
	from := to.AddDate(0, 0, -days)

	// 1. Try querying vault_metrics table
	points, err := r.queryVaultMetrics(db, vaultID, metric, from, to)
	if err != nil {
		return nil, err
	}

	// 2. Fallback to dynamic queries if no vault_metrics points found
	if len(points) == 0 {
		points, err = r.queryFallbackMetrics(db, vaultID, metric, from, to)
		if err != nil {
			return nil, err
		}
	}

	summary := CalculateSummary(points)

	if points == nil {
		points = []domain.MetricDataPoint{}
	}

	return &domain.MetricSeriesResponse{
		VaultID: vaultID,
		Metric:  metric,
		Period:  period,
		Summary: summary,
		Series:  points,
	}, nil
}



func (r *metricsRepo) queryVaultMetrics(db *gorm.DB, vaultID, metric string, from, to time.Time) ([]domain.MetricDataPoint, error) {
	if !r.hasVaultMetrics {
		return nil, nil
	}

	bucketSQL := getBucketSQL(db, "timestamp")
	query := db.Table("vault_metrics").
		Select(fmt.Sprintf("%s AS bucket, AVG(value) AS val", bucketSQL)).
		Where("metric = ? AND timestamp >= ? AND timestamp <= ?", metric, from, to)

	if vaultID != "" {
		vid, err := uuid.Parse(vaultID)
		if err == nil {
			query = query.Where("vault_id = ?", vid)
		} else {
			query = query.Where("vault_id = ?", vaultID)
		}
	}

	var results []bucketQueryResult
	err := query.Group("bucket").Order("bucket ASC").Scan(&results).Error
	if err != nil {
		return nil, err
	}

	return convertBucketResults(results)
}

func (r *metricsRepo) queryFallbackMetrics(db *gorm.DB, vaultID, metric string, from, to time.Time) ([]domain.MetricDataPoint, error) {
	var results []bucketQueryResult

	var vid uuid.UUID
	var parsedVid bool
	if vaultID != "" {
		if id, err := uuid.Parse(vaultID); err == nil {
			vid = id
			parsedVid = true
		}
	}

	switch metric {
	case "tvl":
		if r.hasPriceHistory {
			if db.Dialector.Name() == "postgres" && r.hasCAGGPriceOHLCV1h && parsedVid {
				q := db.Table("cagg_price_ohlcv_1h").
					Select("time_bucket('1 day', bucket) AS bucket, AVG(close) AS val").
					Where("vault_id = ? AND bucket >= ? AND bucket <= ?", vid, from, to)
				_ = q.Group("1").Order("bucket ASC").Scan(&results).Error
			} else {
				bucketSQL := getBucketSQL(db, "fetched_at")
				q := db.Model(&models.PriceHistory{}).
					Select(fmt.Sprintf("%s AS bucket, AVG(price) AS val", bucketSQL)).
					Where("fetched_at >= ? AND fetched_at <= ?", from, to)
				if parsedVid {
					q = q.Where("vault_id = ?", vid)
				}
				_ = q.Group("bucket").Order("bucket ASC").Scan(&results).Error
			}
		}
		if len(results) == 0 && parsedVid && r.hasVault {
			var v models.Vault
			if err := db.Where("id = ?", vid).First(&v).Error; err == nil {
				return []domain.MetricDataPoint{
					{Date: to.Format("2006-01-02"), Value: v.TVL},
				}, nil
			}
		}

	case "volume":
		if r.hasPriceHistory {
			if db.Dialector.Name() == "postgres" && r.hasCAGGPriceOHLCV1h && parsedVid {
				q := db.Table("cagg_price_ohlcv_1h").
					Select("time_bucket('1 day', bucket) AS bucket, SUM(volume) AS val").
					Where("vault_id = ? AND bucket >= ? AND bucket <= ?", vid, from, to)
				_ = q.Group("1").Order("bucket ASC").Scan(&results).Error
			} else {
				bucketSQL := getBucketSQL(db, "fetched_at")
				q := db.Model(&models.PriceHistory{}).
					Select(fmt.Sprintf("%s AS bucket, SUM(volume) AS val", bucketSQL)).
					Where("fetched_at >= ? AND fetched_at <= ?", from, to)
				if parsedVid {
					q = q.Where("vault_id = ?", vid)
				}
				_ = q.Group("bucket").Order("bucket ASC").Scan(&results).Error
			}
		}

	case "invested":
		if r.hasTradeHistory {
			bucketSQL := getBucketSQL(db, "executed_at")
			q := db.Table("trade_histories").
				Select(fmt.Sprintf("%s AS bucket, SUM(amount_in) AS val", bucketSQL)).
				Where("trade_type = 'Deposit' AND executed_at >= ? AND executed_at <= ?", from, to)
			if parsedVid {
				q = q.Where("vault_id = ?", vid)
			}
			_ = q.Group("bucket").Order("bucket ASC").Scan(&results).Error
		}

	case "fees":
		if r.hasTradeHistory {
			bucketSQL := getBucketSQL(db, "executed_at")
			q := db.Table("trade_histories").
				Select(fmt.Sprintf("%s AS bucket, SUM(amount_in * COALESCE(NULLIF(price_at_execution, 0), 1) * 0.001) AS val", bucketSQL)).
				Where("executed_at >= ? AND executed_at <= ?", from, to)
			if parsedVid {
				q = q.Where("vault_id = ?", vid)
			}
			_ = q.Group("bucket").Order("bucket ASC").Scan(&results).Error
		}

	case "pnl":
		if r.hasTradeHistory {
			bucketSQL := getBucketSQL(db, "executed_at")
			q := db.Table("trade_histories").
				Select(fmt.Sprintf("%s AS bucket, SUM(amount_out - amount_in) AS val", bucketSQL)).
				Where("trade_type = 'Withdraw' AND executed_at >= ? AND executed_at <= ?", from, to)
			if parsedVid {
				q = q.Where("vault_id = ?", vid)
			}
			_ = q.Group("bucket").Order("bucket ASC").Scan(&results).Error
		}
	}

	return convertBucketResults(results)
}

func convertBucketResults(results []bucketQueryResult) ([]domain.MetricDataPoint, error) {
	if len(results) == 0 {
		return nil, nil
	}

	points := make([]domain.MetricDataPoint, 0, len(results))
	for _, r := range results {
		ts, err := parseBucketTime(r.Bucket)
		if err != nil {
			return nil, err
		}
		points = append(points, domain.MetricDataPoint{
			Date:  ts.Format("2006-01-02"),
			Value: r.Value,
		})
	}
	return points, nil
}

func parseBucketTime(v interface{}) (time.Time, error) {
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
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
	case *time.Time:
		if t == nil {
			return time.Time{}, nil
		}
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
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
				return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, time.UTC), nil
			}
		}
		return time.Time{}, fmt.Errorf("cannot parse time string %q", t)
	case *string:
		if t == nil {
			return time.Time{}, nil
		}
		return parseBucketTime(*t)
	default:
		return time.Time{}, fmt.Errorf("unexpected time type %T", v)
	}
}

func getBucketSQL(db *gorm.DB, col string) string {
	if db.Dialector != nil && db.Dialector.Name() == "sqlite" {
		return "DATE(" + col + ")"
	}
	return "DATE_TRUNC('day', " + col + ")"
}

func CalculateSummary(points []domain.MetricDataPoint) domain.MetricSummary {
	if len(points) == 0 {
		return domain.MetricSummary{
			Total:     decimal.Zero,
			NetChange: decimal.Zero,
			PctChange: decimal.Zero,
			Peak:      decimal.Zero,
			Low:       decimal.Zero,
			Avg:       decimal.Zero,
		}
	}

	total := decimal.Zero
	peak := points[0].Value
	low := points[0].Value
	first := points[0].Value
	last := points[len(points)-1].Value

	for _, p := range points {
		total = total.Add(p.Value)
		if p.Value.GreaterThan(peak) {
			peak = p.Value
		}
		if p.Value.LessThan(low) {
			low = p.Value
		}
	}

	netChange := last.Sub(first)
	var pctChange decimal.Decimal
	if !first.IsZero() {
		pctChange = netChange.Div(first.Abs()).Mul(decimal.NewFromInt(100))
	} else if !netChange.IsZero() {
		if netChange.IsPositive() {
			pctChange = decimal.NewFromInt(100)
		} else {
			pctChange = decimal.NewFromInt(-100)
		}
	} else {
		pctChange = decimal.Zero
	}

	avg := total.Div(decimal.NewFromInt(int64(len(points))))

	return domain.MetricSummary{
		Total:     total,
		NetChange: netChange,
		PctChange: pctChange,
		Peak:      peak,
		Low:       low,
		Avg:       avg,
	}
}
