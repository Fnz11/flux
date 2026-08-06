package domain

import (
	"context"

	"github.com/shopspring/decimal"
)

type MetricDataPoint struct {
	Date  string          `json:"date"`
	Value decimal.Decimal `json:"value"`
}

type MetricSummary struct {
	Total     decimal.Decimal `json:"total"`
	NetChange decimal.Decimal `json:"net_change"`
	PctChange decimal.Decimal `json:"pct_change"`
	Peak      decimal.Decimal `json:"peak"`
	Low       decimal.Decimal `json:"low"`
	Avg       decimal.Decimal `json:"avg"`
}

type MetricSeriesResponse struct {
	VaultID string            `json:"vault_id,omitempty"`
	Metric  string            `json:"metric"`
	Period  string            `json:"period"`
	Summary MetricSummary     `json:"summary"`
	Series  []MetricDataPoint `json:"series"`
}

type MetricsRepository interface {
	GetMetricSeries(ctx context.Context, vaultID string, metric string, period string) (*MetricSeriesResponse, error)
}

