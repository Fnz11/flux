package domain

import (
	"context"
	"time"
)

type MarketData struct {
	MarketCap            string    `json:"market_cap"`
	MarketCapChangePct   string    `json:"market_cap_change_pct"`
	CirculatingSupply    string    `json:"circulating_supply"`
	CirculatingChangePct string    `json:"circulating_change_pct"`
	Volume24h            string    `json:"volume_24h"`
	Volume24hChangePct   string    `json:"volume_24h_change_pct"`
	ATH                  string    `json:"ath"`
	ATHChangePct         string    `json:"ath_change_pct"`
	Rate                 string    `json:"rate"`
	RateChangePct        string    `json:"rate_change_pct"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type MarketRepository interface {
	GetMarketData(ctx context.Context) (*MarketData, error)
}