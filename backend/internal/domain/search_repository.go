package domain

import (
	"context"

	"github.com/shopspring/decimal"
)

type SearchVaultMatch struct {
	ID          string
	Address     string
	DisplayName string
	TVL         decimal.Decimal
}

type SearchRepository interface {
	SearchVaults(ctx context.Context, q string, limit int) ([]SearchVaultMatch, error)
}