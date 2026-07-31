package repository

import (
	"context"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type portfolioRepo struct {
	db *gorm.DB
}

func NewPortfolioRepository(db *gorm.DB) domain.PortfolioRepository {
	return &portfolioRepo{db: db}
}

func (r *portfolioRepo) UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice float64) error {
	uid := uuid.MustParse(userID)
	vid := uuid.MustParse(vaultID)

	var existing models.Portfolio
	err := r.db.WithContext(ctx).Where("user_id = ? AND vault_id = ?", uid, vid).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		p := models.Portfolio{
			UserID:             uid,
			VaultID:            vid,
			SharesOwned:        shares,
			TotalInvestedValue: invested,
			AverageEntryPrice:  entryPrice,
		}
		return r.db.WithContext(ctx).Create(&p).Error
	}
	if err != nil {
		return err
	}

	newShares := existing.SharesOwned + shares
	newInvested := existing.TotalInvestedValue + invested
	var avgPrice float64
	if newShares > 0 {
		avgPrice = newInvested / newShares
	}

	return r.db.WithContext(ctx).Model(&existing).Updates(map[string]interface{}{
		"shares_owned":         newShares,
		"total_invested_value": newInvested,
		"average_entry_price":  avgPrice,
	}).Error
}

func (r *portfolioRepo) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold float64) error {
	uid := uuid.MustParse(userID)
	vid := uuid.MustParse(vaultID)

	var existing models.Portfolio
	err := r.db.WithContext(ctx).Where("user_id = ? AND vault_id = ?", uid, vid).First(&existing).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return domain.ErrNotFound
		}
		return err
	}

	newShares := existing.SharesOwned - sharesSold
	if newShares < 0 {
		newShares = 0
	}
	reductionRatio := sharesSold / existing.SharesOwned
	newInvested := existing.TotalInvestedValue - (existing.TotalInvestedValue * reductionRatio)

	return r.db.WithContext(ctx).Model(&existing).Updates(map[string]interface{}{
		"shares_owned":         newShares,
		"total_invested_value": newInvested,
	}).Error
}

func (r *portfolioRepo) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	uid := uuid.MustParse(userID)

	var portfolios []models.Portfolio
	err := r.db.WithContext(ctx).Preload("Vault").Where("user_id = ?", uid).Find(&portfolios).Error
	if err != nil {
		return nil, err
	}

	details := make([]domain.PortfolioDetail, len(portfolios))
	for i, p := range portfolios {
		details[i] = domain.PortfolioDetail{
			VaultID:            p.VaultID.String(),
			VaultAddress:       p.Vault.Address,
			VaultName:          p.Vault.Address,
			SharesOwned:        p.SharesOwned,
			TotalInvestedValue: p.TotalInvestedValue,
			AverageEntryPrice:  p.AverageEntryPrice,
		}
	}
	return details, nil
}

func (r *portfolioRepo) GetTotalSharesByVault(ctx context.Context, vaultID string) (float64, error) {
	vid := uuid.MustParse(vaultID)

	var result float64
	err := r.db.WithContext(ctx).Model(&models.Portfolio{}).
		Where("vault_id = ?", vid).
		Select("COALESCE(SUM(shares_owned), 0)").
		Scan(&result).Error
	return result, err
}

func (r *portfolioRepo) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	uid := uuid.MustParse(userID)

	var s domain.PortfolioSummary
	err := r.db.WithContext(ctx).Table("user_pnl_summary").
		Select("user_id, COUNT(vault_id) AS vault_count, "+
			"COALESCE(SUM(total_invested), 0) AS total_invested, "+
			"COALESCE(SUM(current_value), 0) AS current_value, "+
			"COALESCE(SUM(unrealized_pnl), 0) AS unrealized_pnl, "+
			"COALESCE(SUM(total_pnl), 0) / NULLIF(SUM(total_invested), 0) * 100 AS return_pct, "+
			"MAX(as_of) AS updated_at").
		Where("user_id = ?", uid).
		Group("user_id").
		Take(&s).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *portfolioRepo) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	uid := uuid.MustParse(userID)

	var s domain.UserPnLSummary
	err := r.db.WithContext(ctx).Table("user_pnl_summary").
		Select("user_id, COALESCE(SUM(total_invested), 0) AS total_invested, "+
			"COALESCE(SUM(realized_pnl), 0) AS realized_pnl, "+
			"COALESCE(SUM(unrealized_pnl), 0) AS unrealized_pnl, "+
			"COALESCE(SUM(total_pnl), 0) AS total_pnl, "+
			"COALESCE(SUM(total_pnl), 0) / NULLIF(SUM(total_invested), 0) * 100 AS return_pct, "+
			"MAX(as_of) AS updated_at").
		Where("user_id = ?", uid).
		Group("user_id").
		Take(&s).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}
