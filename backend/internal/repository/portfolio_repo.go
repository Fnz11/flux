package repository

import (
	"context"
	"errors"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type portfolioRepo struct {
	db *gorm.DB
}

func NewPortfolioRepository(db *gorm.DB) domain.PortfolioRepository {
	return &portfolioRepo{db: db}
}

func (r *portfolioRepo) UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice decimal.Decimal) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	vid, err := uuid.Parse(vaultID)
	if err != nil {
		return err
	}

	p := models.Portfolio{
		ID:                 uuid.New(),
		UserID:             uid,
		VaultID:            vid,
		SharesOwned:        shares,
		TotalInvestedValue: invested,
		AverageEntryPrice:  entryPrice,
	}

	// Atomic upsert: INSERT ... ON CONFLICT (user_id, vault_id) DO UPDATE.
	// Relies on the unique index uq_portfolios_user_vault (migration 020) and
	// removes the select-then-insert race between concurrent SyncTrade calls.
	return getDB(ctx, r.db).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "vault_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"shares_owned":         gorm.Expr("portfolios.shares_owned + EXCLUDED.shares_owned"),
			"total_invested_value": gorm.Expr("portfolios.total_invested_value + EXCLUDED.total_invested_value"),
			"average_entry_price":  gorm.Expr("COALESCE((portfolios.total_invested_value + EXCLUDED.total_invested_value) / NULLIF(portfolios.shares_owned + EXCLUDED.shares_owned, 0), 0)"),
		}),
	}).Create(&p).Error
}

func (r *portfolioRepo) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	vid, err := uuid.Parse(vaultID)
	if err != nil {
		return err
	}

	db := getDB(ctx, r.db)
	var existing models.Portfolio
	err = db.Where("user_id = ? AND vault_id = ?", uid, vid).First(&existing).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ErrNotFound
		}
		return err
	}

	if sharesSold.GreaterThan(existing.SharesOwned) {
		return errors.New("insufficient shares")
	}

	newShares := existing.SharesOwned.Sub(sharesSold)
	if newShares.IsNegative() {
		newShares = decimal.Zero
	}
	var reductionRatio decimal.Decimal
	if existing.SharesOwned.IsPositive() {
		reductionRatio = sharesSold.Div(existing.SharesOwned)
	}
	newInvested := existing.TotalInvestedValue.Sub(existing.TotalInvestedValue.Mul(reductionRatio))

	return db.Model(&existing).Updates(map[string]interface{}{
		"shares_owned":         newShares,
		"total_invested_value": newInvested,
	}).Error
}

func (r *portfolioRepo) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	var portfolios []models.Portfolio
	err = getDB(ctx, r.db).Preload("Vault").Where("user_id = ?", uid).Find(&portfolios).Error
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

func (r *portfolioRepo) GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error) {
	vid, err := uuid.Parse(vaultID)
	if err != nil {
		return decimal.Zero, err
	}

	var result decimal.Decimal
	err = getDB(ctx, r.db).Model(&models.Portfolio{}).
		Where("vault_id = ?", vid).
		Select("COALESCE(SUM(shares_owned), 0)").
		Scan(&result).Error
	return result, err
}

func (r *portfolioRepo) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	var s domain.PortfolioSummary
	err = getDB(ctx, r.db).Table("user_pnl_summary").
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *portfolioRepo) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	var s domain.UserPnLSummary
	err = getDB(ctx, r.db).Table("user_pnl_summary").
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *portfolioRepo) GetHolderUserIDs(ctx context.Context, vaultID string) ([]string, error) {
	vid, err := uuid.Parse(vaultID)
	if err != nil {
		return nil, err
	}
	var userIDs []string
	err = getDB(ctx, r.db).Model(&models.Portfolio{}).
		Where("vault_id = ?", vid).Distinct().Pluck("user_id", &userIDs).Error
	return userIDs, err
}
