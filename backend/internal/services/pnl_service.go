package services

import (
	"context"
	"errors"
	"time"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type PnLCalcResult struct {
	UnrealizedPnL float64
	TotalPnL      float64
	ReturnPct     float64
}

func CalculatePnL(sharesOwned, currentPrice, avgEntryPrice, totalInvested float64) PnLCalcResult {
	costBasis := sharesOwned * avgEntryPrice
	currentValue := sharesOwned * currentPrice
	unrealizedPnL := currentValue - costBasis

	var returnPct float64
	if totalInvested > 0 {
		returnPct = (unrealizedPnL / totalInvested) * 100
	}

	return PnLCalcResult{
		UnrealizedPnL: unrealizedPnL,
		TotalPnL:      unrealizedPnL,
		ReturnPct:     returnPct,
	}
}

func UpsertPosition(db *gorm.DB, userID uuid.UUID, vaultID uuid.UUID, shares float64, invested float64, entryPrice float64) error {
	var portfolio models.Portfolio
	result := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&portfolio)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		portfolio = models.Portfolio{
			ID:                 uuid.New(),
			UserID:             userID,
			VaultID:            vaultID,
			SharesOwned:        shares,
			TotalInvestedValue: invested,
			AverageEntryPrice:  entryPrice,
		}
		return db.Create(&portfolio).Error
	}

	if result.Error != nil {
		return result.Error
	}

	totalShares := portfolio.SharesOwned + shares
	totalInvested := portfolio.TotalInvestedValue + invested
	var newAvgPrice float64
	if totalShares > 0 {
		newAvgPrice = totalInvested / totalShares
	}

	portfolio.SharesOwned = totalShares
	portfolio.TotalInvestedValue = totalInvested
	portfolio.AverageEntryPrice = newAvgPrice

	return db.Save(&portfolio).Error
}

func ReducePosition(db *gorm.DB, userID uuid.UUID, vaultID uuid.UUID, sharesSold float64) error {
	var portfolio models.Portfolio
	if err := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&portfolio).Error; err != nil {
		return err
	}

	if sharesSold > portfolio.SharesOwned {
		return errors.New("insufficient shares")
	}

	costBasisSold := (sharesSold / portfolio.SharesOwned) * portfolio.TotalInvestedValue
	portfolio.SharesOwned -= sharesSold
	portfolio.TotalInvestedValue -= costBasisSold

	return db.Save(&portfolio).Error
}

type PnLService struct {
	DB    *gorm.DB
	Cache cache.Cache
}

type PnLPosition struct {
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

const pnlCacheTTL = 30 * time.Second

const userPnLSummaryQuery = `
	SELECT vault_id, vault_address, vault_name,
	       COALESCE(shares_owned, 0) AS shares_owned,
	       COALESCE(total_invested, 0) AS total_invested_value,
	       COALESCE(average_entry_price, 0) AS average_entry_price,
	       COALESCE(current_value, 0) AS current_value,
	       COALESCE(unrealized_pnl, 0) AS pnl,
	       COALESCE(pnl_percent, 0) AS pnl_percent
	FROM user_pnl_summary
	WHERE user_id = ?`

func NewPnLService(db *gorm.DB, c cache.Cache) *PnLService {
	return &PnLService{DB: db, Cache: c}
}

func (s *PnLService) SetCache(c cache.Cache) {
	s.Cache = c
}

func pnlCacheKey(userID uuid.UUID) string {
	return cache.UserPnLKey(userID.String())
}

func (s *PnLService) GetUserPnL(ctx context.Context, userID uuid.UUID) ([]PnLPosition, error) {
	if s.Cache != nil {
		var positions []PnLPosition
		if err := s.Cache.Get(ctx, pnlCacheKey(userID), &positions); err == nil {
			return positions, nil
		} else {
			logrus.WithError(err).WithField("user_id", userID).Warn("pnl cache get failed")
		}
	}

	positions, err := s.loadUserPnL(ctx, userID)
	if err != nil {
		return nil, err
	}

	if s.Cache != nil {
		if err := s.Cache.Set(ctx, pnlCacheKey(userID), positions, pnlCacheTTL); err != nil {
			logrus.WithError(err).WithField("user_id", userID).Warn("pnl cache set failed")
		}
	}
	return positions, nil
}

func (s *PnLService) loadUserPnL(ctx context.Context, userID uuid.UUID) ([]PnLPosition, error) {
	var positions []PnLPosition
	err := s.DB.WithContext(ctx).Raw(userPnLSummaryQuery, userID).Scan(&positions).Error
	if err != nil {
		logrus.WithError(err).WithField("user_id", userID).Warn("user_pnl_summary query failed, falling back")
	}
	if err == nil && len(positions) > 0 {
		return positions, nil
	}
	return s.calculateUserPnL(ctx, userID)
}

func (s *PnLService) calculateUserPnL(ctx context.Context, userID uuid.UUID) ([]PnLPosition, error) {
	var portfolios []models.Portfolio
	if err := s.DB.WithContext(ctx).Preload("Vault").Where("user_id = ?", userID).Find(&portfolios).Error; err != nil {
		return nil, err
	}

	positions := make([]PnLPosition, 0, len(portfolios))
	if len(portfolios) == 0 {
		return positions, nil
	}

	vaultIDs := make([]uuid.UUID, 0, len(portfolios))
	for _, p := range portfolios {
		vaultIDs = append(vaultIDs, p.VaultID)
	}

	totalByVault, err := totalSharesByVault(ctx, s.DB, vaultIDs)
	if err != nil {
		return nil, err
	}

	for _, p := range portfolios {
		var currentValue float64
		if total := totalByVault[p.VaultID]; total > 0 {
			currentValue = (p.SharesOwned / total) * p.Vault.TVL
		}

		var currentPrice float64
		if p.SharesOwned > 0 {
			currentPrice = currentValue / p.SharesOwned
		}
		res := CalculatePnL(p.SharesOwned, currentPrice, p.AverageEntryPrice, p.TotalInvestedValue)

		positions = append(positions, PnLPosition{
			VaultID:            p.VaultID.String(),
			VaultAddress:       p.Vault.Address,
			VaultName:          p.Vault.Address,
			SharesOwned:        p.SharesOwned,
			TotalInvestedValue: p.TotalInvestedValue,
			AverageEntryPrice:  p.AverageEntryPrice,
			CurrentValue:       currentValue,
			PnL:                res.TotalPnL,
			PnLPercent:         res.ReturnPct,
		})
	}
	return positions, nil
}

func (s *PnLService) InvalidateUser(ctx context.Context, userID uuid.UUID) {
	if s.Cache == nil {
		return
	}
	if err := s.Cache.Delete(ctx, pnlCacheKey(userID)); err != nil {
		logrus.WithError(err).WithField("user_id", userID).Warn("pnl cache delete failed")
	}
}

type PnLResult struct {
	CurrentValue       float64
	PnL                float64
	PnLPercent         float64
	TotalInvestedValue float64
	SharesOwned        float64
	AverageEntryPrice  float64
}

func (s *PnLService) RecalculatePosition(portfolioID uuid.UUID) (*PnLResult, error) {
	var portfolio models.Portfolio
	if err := s.DB.Preload("Vault").
		First(&portfolio, "id = ?", portfolioID).Error; err != nil {
		return nil, err
	}

	var totalShares float64
	if err := s.DB.Model(&models.Portfolio{}).
		Select("COALESCE(SUM(shares_owned), 0)").
		Where("vault_id = ?", portfolio.VaultID).
		Scan(&totalShares).Error; err != nil {
		return nil, err
	}

	var currentValue float64
	if totalShares > 0 {
		currentValue = (portfolio.SharesOwned / totalShares) * portfolio.Vault.TVL
	}

	pnl := currentValue - portfolio.TotalInvestedValue
	var pnlPercent float64
	if portfolio.TotalInvestedValue > 0 {
		pnlPercent = (pnl / portfolio.TotalInvestedValue) * 100
	}

	if err := s.DB.Model(&portfolio).Update("updated_at", gorm.Expr("NOW()")).Error; err != nil {
		return nil, err
	}

	return &PnLResult{
		CurrentValue:       currentValue,
		PnL:                pnl,
		PnLPercent:         pnlPercent,
		TotalInvestedValue: portfolio.TotalInvestedValue,
		SharesOwned:        portfolio.SharesOwned,
		AverageEntryPrice:  portfolio.AverageEntryPrice,
	}, nil
}

func (s *PnLService) BatchRecalculate(userID uuid.UUID) {
	var portfolios []models.Portfolio
	if err := s.DB.Where("user_id = ?", userID).Find(&portfolios).Error; err != nil {
		logrus.WithError(err).WithField("user_id", userID).Error("BatchRecalculate find portfolios error")
		return
	}

	for _, p := range portfolios {
		id := p.ID
		go func() {
			_, err := s.RecalculatePosition(id)
			if err != nil {
				logrus.WithError(err).WithField("portfolio_id", id).Error("batch recalculate error")
			}
		}()
	}

	s.InvalidateUser(context.Background(), userID)
}
