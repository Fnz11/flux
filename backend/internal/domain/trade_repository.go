package domain

import (
	"context"
	"time"
)

type TradeRepository interface {
	FindBySignature(ctx context.Context, sig string) (*TradeDetail, error)
	Create(ctx context.Context, trade *TradeDetail) error
	ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]TradeDetail, int64, error)
}

type TradeDetail struct {
	ID                   string
	VaultID              string
	ActorID              string
	TransactionSignature string
	TradeType            string
	InputToken           string
	OutputToken          string
	AmountIn             float64
	AmountOut            float64
	PriceAtExecution     float64
	ExecutedAt           time.Time
}
