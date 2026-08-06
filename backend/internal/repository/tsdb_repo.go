package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var allowedBuckets = map[string]bool{
	"1 minute":   true,
	"5 minutes":  true,
	"15 minutes": true,
	"30 minutes": true,
	"1 hour":     true,
	"4 hours":    true,
	"1 day":      true,
	"1 week":     true,
}

// largeBuckets are buckets >= 1 hour. When available they are served from the
// cagg_price_ohlcv_1h continuous aggregate instead of scanning raw ticks.
var largeBuckets = map[string]bool{
	"1 hour":  true,
	"4 hours": true,
	"1 day":   true,
	"1 week":  true,
}

// caggOHLCVQuery reads OHLCV from the hourly continuous aggregate. The CAGG is
// already 1h-bucketed; for 4h/1d/1w time_bucket re-buckets and re-aggregates
// (min low, max high, first open, last close, sum volume). The WHERE clause is
// vault-first to match idx_cagg_ohlcv_vault_bucket (migration 040).
const caggOHLCVQuery = `
SELECT time_bucket(?, bucket) AS bucket, MIN(low) AS low, MAX(high) AS high,
       (ARRAY_AGG(open ORDER BY bucket ASC))[1] AS open,
       (ARRAY_AGG(close ORDER BY bucket DESC))[1] AS close,
       SUM(volume) AS volume
FROM cagg_price_ohlcv_1h
WHERE vault_id = ? AND bucket >= ? AND bucket < ?
GROUP BY 1 ORDER BY 1 ASC`

const ohlcvQuery = `
SELECT bucket,
       MIN(price) AS low,
       MAX(price) AS high,
       MIN(open)  AS open,
       MIN(close) AS close,
       SUM(volume) AS volume
FROM (
    SELECT time_bucket(?, fetched_at) AS bucket, price, volume,
           CASE WHEN rn_asc = 1 THEN price END AS open,
           CASE WHEN rn_desc = 1 THEN price END AS close
    FROM (
        SELECT fetched_at, price, volume,
               ROW_NUMBER() OVER (PARTITION BY time_bucket(?, fetched_at) ORDER BY fetched_at ASC)  AS rn_asc,
               ROW_NUMBER() OVER (PARTITION BY time_bucket(?, fetched_at) ORDER BY fetched_at DESC) AS rn_desc
        FROM price_history
        WHERE vault_id = ? AND fetched_at >= ? AND fetched_at < ?
    ) ranked
) bucketed
GROUP BY bucket
ORDER BY bucket ASC`

type priceHistoryRepo struct {
	db *gorm.DB
}

type ohlcvRow struct {
	Bucket string
	Open   decimal.Decimal
	High   decimal.Decimal
	Low    decimal.Decimal
	Close  decimal.Decimal
	Volume decimal.Decimal
}

func NewPriceHistoryRepository(db *gorm.DB) domain.PriceHistoryRepository {
	return &priceHistoryRepo{db: db}
}

func (r *priceHistoryRepo) GetOHLCV(ctx context.Context, vaultID, bucket string, from, to time.Time) ([]domain.OHLCVPoint, error) {
	if !allowedBuckets[bucket] {
		return nil, fmt.Errorf("%w: unsupported bucket %q", domain.ErrInvalidInput, bucket)
	}
	if !from.Before(to) {
		return nil, fmt.Errorf("%w: from must be before to", domain.ErrInvalidInput)
	}

	var rows []ohlcvRow
	var err error
	if largeBuckets[bucket] && r.db.Dialector.Name() == "postgres" && r.db.Migrator().HasTable("cagg_price_ohlcv_1h") {
		err = r.db.WithContext(ctx).Raw(caggOHLCVQuery, bucket, vaultID, from, to).Scan(&rows).Error
	} else {
		err = r.db.WithContext(ctx).Raw(ohlcvQuery, bucket, bucket, bucket, vaultID, from, to).Scan(&rows).Error
	}
	if err != nil {
		return nil, err
	}

	points := make([]domain.OHLCVPoint, len(rows))
	for i, row := range rows {
		bucketTime, err := time.Parse(time.RFC3339Nano, row.Bucket)
		if err != nil {
			return nil, fmt.Errorf("parse ohlcv bucket %q: %w", row.Bucket, err)
		}
		points[i] = domain.OHLCVPoint{
			Bucket: bucketTime,
			Open:   row.Open,
			High:   row.High,
			Low:    row.Low,
			Close:  row.Close,
			Volume: row.Volume,
		}
	}
	return points, nil
}
