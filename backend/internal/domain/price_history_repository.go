package domain

import (
	"context"
	"time"
)

type PriceHistoryRepository interface {
	GetOHLCV(ctx context.Context, vaultID, bucket string, from, to time.Time) ([]OHLCVPoint, error)
}

type OHLCVPoint struct {
	Bucket time.Time
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume float64
}
