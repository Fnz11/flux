package domain

import "context"

// GlobalMetrics is the response for GET /metrics/global. It embeds MarketData
// so every field the frontend PerformanceChart reads from /metrics/market
// (marketStats) is promoted to the top-level JSON unchanged --- the chart can
// be pointed at /metrics/global as-is --- and adds platform-wide fields on
// top:
//
//   market_cap, market_cap_change_pct, circulating_supply,
//   circulating_change_pct, volume_24h, volume_24h_change_pct, ath,
//   ath_change_pct, rate, rate_change_pct, updated_at   (from MarketData)
//   platform_tvl, platform_tvl_change_pct, platform_ath,
//   platform_ath_change_pct                              (added here)
//
// Embedding (rather than nesting a MarketData object) is deliberate: JSON
// marshaling of an embedded struct keeps the shaped envelope flat and a
// strict superset of MarketStats. Numbers are strings, "" when unavailable.
type GlobalMetrics struct {
	MarketData
	PlatformTVL          string `json:"platform_tvl"`
	PlatformTVLChangePct string `json:"platform_tvl_change_pct"`
	PlatformATH          string `json:"platform_ath"`
	PlatformATHChangePct string `json:"platform_ath_change_pct"`
}

type GlobalMetricsRepository interface {
	GetGlobalMetrics(ctx context.Context) (*GlobalMetrics, error)
}