package domain

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
)

type VaultBalance struct {
	Mint     string          `json:"mint"`
	Symbol   string          `json:"symbol"`
	Amount   decimal.Decimal `json:"amount"`
	USDValue decimal.Decimal `json:"usdValue"`
}

type VaultListFilter struct {
	Status         string
	ManagerAddress string
	SortBy         string
	SortOrder      string
	Page           int
	Limit          int
}

type VaultRepository interface {
	GetByAddress(ctx context.Context, address string) (*VaultDetail, error)
	GetByID(ctx context.Context, id string) (*VaultDetail, error)
	ExistsByAddress(ctx context.Context, address string) (bool, error)
	Create(ctx context.Context, vault *VaultDetail) error
	UpdateMetadata(ctx context.Context, address string, metadata interface{}) error
	List(ctx context.Context, filter VaultListFilter) ([]VaultDetail, int64, error)
	GetVaultBalances(ctx context.Context, vaultIDOrAddress string) ([]VaultBalance, error)
}

type VaultDetail struct {
	ID                string
	Address           string
	ManagerID         string
	ManagerAddress    string
	Status            string
	Metadata          datatypes.JSON
	PerformanceFeeBps int
	ManagementFeeBps  int
	MinRaiseAmount    decimal.Decimal
	LockupPeriod      int64
	VaultType         string
	InvestorCount     int
	TVL               decimal.Decimal
	TradeCount        int64
	PortfolioCount    int64
	CreatedAt         time.Time
	UpdatedAt         time.Time
}
