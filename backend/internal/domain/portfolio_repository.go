package domain

import "context"

type PortfolioRepository interface {
	UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice float64) error
	ReducePosition(ctx context.Context, userID, vaultID string, sharesSold float64) error
	GetByUser(ctx context.Context, userID string) ([]PortfolioDetail, error)
	GetTotalSharesByVault(ctx context.Context, vaultID string) (float64, error)
	GetPortfolioSummary(ctx context.Context, userID string) (*PortfolioSummary, error)
	GetUserPnLSummary(ctx context.Context, userID string) (*UserPnLSummary, error)
}

type PortfolioDetail struct {
	VaultID            string
	VaultAddress       string
	VaultName          string
	SharesOwned        float64
	TotalInvestedValue float64
	AverageEntryPrice  float64
	CurrentValue       float64
	PnL                float64
	PnLPercent         float64
}

type PortfolioSummary struct {
	UserID        string  `gorm:"column:user_id"`
	VaultCount    int64   `gorm:"column:vault_count"`
	TotalInvested float64 `gorm:"column:total_invested"`
	CurrentValue  float64 `gorm:"column:current_value"`
	UnrealizedPnL float64 `gorm:"column:unrealized_pnl"`
	ReturnPct     float64 `gorm:"column:return_pct"`
	UpdatedAt     string  `gorm:"column:updated_at"`
}

type UserPnLSummary struct {
	UserID        string  `gorm:"column:user_id"`
	TotalInvested float64 `gorm:"column:total_invested"`
	RealizedPnL   float64 `gorm:"column:realized_pnl"`
	UnrealizedPnL float64 `gorm:"column:unrealized_pnl"`
	TotalPnL      float64 `gorm:"column:total_pnl"`
	ReturnPct     float64 `gorm:"column:return_pct"`
	UpdatedAt     string  `gorm:"column:updated_at"`
}
