package solana

import (
	"time"

	"github.com/shopspring/decimal"
)

type VaultCreationData struct {
	VaultAddress string
}

type TradeExecutionData struct {
	TradeType        string
	ActorAddress     string
	InputToken       string
	OutputToken      string
	AmountIn         decimal.Decimal
	AmountOut        decimal.Decimal
	PriceAtExecution decimal.Decimal
	ExecutedAt       time.Time
}
