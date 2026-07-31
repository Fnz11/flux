package domain

import "context"

type VaultRepository interface {
	GetByAddress(ctx context.Context, address string) (*VaultDetail, error)
	ExistsByAddress(ctx context.Context, address string) (bool, error)
	Create(ctx context.Context, vault *VaultDetail) error
	UpdateMetadata(ctx context.Context, address string, metadata interface{}) error
	List(ctx context.Context, status string, page, limit int) ([]VaultDetail, int64, error)
}

type VaultDetail struct {
	ID                string
	Address           string
	ManagerID         string
	ManagerAddress    string
	Status            string
	Metadata          interface{}
	PerformanceFeeBps int
	ManagementFeeBps  int
	TVL               float64
	TradeCount        int64
	PortfolioCount    int64
	CreatedAt         string
	UpdatedAt         string
}
