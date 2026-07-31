package repository

import (
	"context"
	"encoding/json"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"gorm.io/gorm"
)

type vaultRepo struct {
	db *gorm.DB
}

func NewVaultRepository(db *gorm.DB) domain.VaultRepository {
	return &vaultRepo{db: db}
}

func (r *vaultRepo) GetByAddress(ctx context.Context, address string) (*domain.VaultDetail, error) {
	var v models.Vault
	err := r.db.WithContext(ctx).Preload("Manager").Where("address = ?", address).First(&v).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return vaultToDetail(&v), nil
}

func (r *vaultRepo) ExistsByAddress(ctx context.Context, address string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Vault{}).Where("address = ?", address).Count(&count).Error
	return count > 0, err
}

func (r *vaultRepo) Create(ctx context.Context, vault *domain.VaultDetail) error {
	return nil
}

func (r *vaultRepo) UpdateMetadata(ctx context.Context, address string, metadata interface{}) error {
	metaBytes, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&models.Vault{}).Where("address = ?", address).Update("metadata", metaBytes).Error
}

func (r *vaultRepo) List(ctx context.Context, status string, page, limit int) ([]domain.VaultDetail, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.Vault{}).Preload("Manager")
	countQuery := r.db.WithContext(ctx).Model(&models.Vault{})

	if status != "" {
		query = query.Where("status = ?", status)
		countQuery = countQuery.Where("status = ?", status)
	}

	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var vaults []models.Vault
	offset := (page - 1) * limit
	if err := query.Offset(offset).Limit(limit).Order("id ASC").Find(&vaults).Error; err != nil {
		return nil, 0, err
	}

	details := make([]domain.VaultDetail, len(vaults))
	for i, v := range vaults {
		details[i] = *vaultToDetail(&v)
	}
	return details, total, nil
}

func vaultToDetail(v *models.Vault) *domain.VaultDetail {
	managerAddress := ""
	if v.Manager.WalletAddress != "" {
		managerAddress = v.Manager.WalletAddress
	}
	return &domain.VaultDetail{
		ID:                v.ID.String(),
		Address:           v.Address,
		ManagerID:         v.ManagerID.String(),
		ManagerAddress:    managerAddress,
		Status:            v.Status,
		Metadata:          v.Metadata,
		PerformanceFeeBps: v.PerformanceFeeBps,
		ManagementFeeBps:  v.ManagementFeeBps,
		TVL:               v.TVL,
		CreatedAt:         v.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:         v.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
