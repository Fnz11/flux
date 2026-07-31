package solana

import "time"

type VaultCreationData struct {
	VaultAddress string
}

type TradeExecutionData struct {
	TradeType        string
	ActorAddress     string
	InputToken       string
	OutputToken      string
	AmountIn         float64
	AmountOut        float64
	PriceAtExecution float64
	ExecutedAt       time.Time
}
