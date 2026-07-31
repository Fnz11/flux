package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
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
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume float64
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
	err := r.db.WithContext(ctx).Raw(ohlcvQuery, bucket, bucket, bucket, vaultID, from, to).Scan(&rows).Error
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
