package domain

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
)

type PriceHistoryRepository interface {
	GetOHLCV(ctx context.Context, vaultID, bucket string, from, to time.Time) ([]OHLCVPoint, error)
}

type OHLCVPoint struct {
	Bucket time.Time
	Open   decimal.Decimal
	High   decimal.Decimal
	Low    decimal.Decimal
	Close  decimal.Decimal
	Volume decimal.Decimal
}
