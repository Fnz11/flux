package domain

import (
	"context"

	"github.com/shopspring/decimal"
)

type PortfolioRepository interface {
	UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice decimal.Decimal) error
	ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error
	GetByUser(ctx context.Context, userID string) ([]PortfolioDetail, error)
	GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error)
	GetPortfolioSummary(ctx context.Context, userID string) (*PortfolioSummary, error)
	GetUserPnLSummary(ctx context.Context, userID string) (*UserPnLSummary, error)
	GetHolderUserIDs(ctx context.Context, vaultID string) ([]string, error)
}

type PortfolioDetail struct {
	VaultID            string
	VaultAddress       string
	VaultName          string
	SharesOwned        decimal.Decimal
	TotalInvestedValue decimal.Decimal
	AverageEntryPrice  decimal.Decimal
	CurrentValue       decimal.Decimal
	PnL                decimal.Decimal
	PnLPercent         decimal.Decimal
}

type PortfolioSummary struct {
	UserID        string          `gorm:"column:user_id"`
	VaultCount    int64           `gorm:"column:vault_count"`
	TotalInvested decimal.Decimal `gorm:"column:total_invested"`
	CurrentValue  decimal.Decimal `gorm:"column:current_value"`
	UnrealizedPnL decimal.Decimal `gorm:"column:unrealized_pnl"`
	ReturnPct     decimal.Decimal `gorm:"column:return_pct"`
	UpdatedAt     string          `gorm:"column:updated_at"`
}

type UserPnLSummary struct {
	UserID        string          `gorm:"column:user_id"`
	TotalInvested decimal.Decimal `gorm:"column:total_invested"`
	RealizedPnL   decimal.Decimal `gorm:"column:realized_pnl"`
	UnrealizedPnL decimal.Decimal `gorm:"column:unrealized_pnl"`
	TotalPnL      decimal.Decimal `gorm:"column:total_pnl"`
	ReturnPct     decimal.Decimal `gorm:"column:return_pct"`
	UpdatedAt     string          `gorm:"column:updated_at"`
}
