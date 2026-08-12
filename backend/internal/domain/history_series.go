package domain

import (
	"context"

	"github.com/shopspring/decimal"
)

// HistoryPoint is a single timestamped value in a historical series. The Date
// layout follows the endpoint contract: RFC3339 for vault sparklines and
// "2006-01-02" for portfolio history.
type HistoryPoint struct {
	Date  string          `json:"date"`
	Value decimal.Decimal `json:"value"`
}

// VaultSparklineResponse is the payload returned by GET /api/v1/vaults/:id/sparkline.
type VaultSparklineResponse struct {
	VaultID string         `json:"vault_id"`
	Range   string         `json:"range"`
	Points  []HistoryPoint `json:"points"`
}

// PortfolioHistoryResponse is the payload returned by GET /api/v1/portfolio/history.
type PortfolioHistoryResponse struct {
	Wallet string         `json:"wallet"`
	Range  string         `json:"range"`
	Points []HistoryPoint `json:"points"`
}

// HistoryRepository backs historical NAV and portfolio value series. It only
// ever returns rows persisted by real ingestion; no simulated values.
type HistoryRepository interface {
	// GetVaultSparkline returns the vault NAV-over-time series for the given
	// range ("7d", "30d", "90d") bucketed by resolution ("day" or "hour").
	GetVaultSparkline(ctx context.Context, vaultID, period, resolution string) ([]HistoryPoint, error)
	// GetPortfolioHistory returns the wallet's portfolio total value over time.
	GetPortfolioHistory(ctx context.Context, wallet, period string) ([]HistoryPoint, error)
}
