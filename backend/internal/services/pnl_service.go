package services

import (
	"context"
	"errors"
	"time"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type PnLCalcResult struct {
	UnrealizedPnL decimal.Decimal
	TotalPnL      decimal.Decimal
	ReturnPct     decimal.Decimal
}

func CalculatePnL(sharesOwned, currentPrice, avgEntryPrice, totalInvested decimal.Decimal) PnLCalcResult {
	costBasis := sharesOwned.Mul(avgEntryPrice)
	currentValue := sharesOwned.Mul(currentPrice)
	unrealizedPnL := currentValue.Sub(costBasis)

	var returnPct decimal.Decimal
	if totalInvested.IsPositive() {
		returnPct = unrealizedPnL.Div(totalInvested).Mul(decimal.NewFromInt(100))
	}

	return PnLCalcResult{
		UnrealizedPnL: unrealizedPnL,
		TotalPnL:      unrealizedPnL,
		ReturnPct:     returnPct,
	}
}

func UpsertPosition(db *gorm.DB, userID uuid.UUID, vaultID uuid.UUID, shares decimal.Decimal, invested decimal.Decimal, entryPrice decimal.Decimal) error {
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

	totalShares := portfolio.SharesOwned.Add(shares)
	totalInvested := portfolio.TotalInvestedValue.Add(invested)
	var newAvgPrice decimal.Decimal
	if totalShares.IsPositive() {
		newAvgPrice = totalInvested.Div(totalShares)
	}

	portfolio.SharesOwned = totalShares
	portfolio.TotalInvestedValue = totalInvested
	portfolio.AverageEntryPrice = newAvgPrice

	return db.Save(&portfolio).Error
}

func ReducePosition(db *gorm.DB, userID uuid.UUID, vaultID uuid.UUID, sharesSold decimal.Decimal) error {
	var portfolio models.Portfolio
	if err := db.Where("user_id = ? AND vault_id = ?", userID, vaultID).First(&portfolio).Error; err != nil {
		return err
	}

	if sharesSold.GreaterThan(portfolio.SharesOwned) {
		return errors.New("insufficient shares")
	}

	var costBasisSold decimal.Decimal
	if portfolio.SharesOwned.IsPositive() {
		costBasisSold = sharesSold.Div(portfolio.SharesOwned).Mul(portfolio.TotalInvestedValue)
	}
	portfolio.SharesOwned = portfolio.SharesOwned.Sub(sharesSold)
	portfolio.TotalInvestedValue = portfolio.TotalInvestedValue.Sub(costBasisSold)

	return db.Save(&portfolio).Error
}

type PnLService struct {
	DB    *gorm.DB
	Cache cache.Cache
}

type PnLPosition struct {
	VaultID            string          `json:"vault_id"`
	VaultAddress       string          `json:"vault_address"`
	VaultName          string          `json:"vault_name"`
	SharesOwned        decimal.Decimal `json:"shares_owned"`
	TotalInvestedValue decimal.Decimal `json:"total_invested_value"`
	AverageEntryPrice  decimal.Decimal `json:"average_entry_price"`
	CurrentValue       decimal.Decimal `json:"current_value"`
	PnL                decimal.Decimal `json:"pnl"`
	PnLPercent         decimal.Decimal `json:"pnl_percent"`
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
		var currentValue decimal.Decimal
		if total := totalByVault[p.VaultID]; total.IsPositive() {
			currentValue = p.SharesOwned.Div(total).Mul(p.Vault.TVL)
		}

		var currentPrice decimal.Decimal
		if p.SharesOwned.IsPositive() {
			currentPrice = currentValue.Div(p.SharesOwned)
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
	CurrentValue       decimal.Decimal
	PnL                decimal.Decimal
	PnLPercent         decimal.Decimal
	TotalInvestedValue decimal.Decimal
	SharesOwned        decimal.Decimal
	AverageEntryPrice  decimal.Decimal
}

func (s *PnLService) RecalculatePosition(portfolioID uuid.UUID) (*PnLResult, error) {
	var portfolio models.Portfolio
	if err := s.DB.Preload("Vault").
		First(&portfolio, "id = ?", portfolioID).Error; err != nil {
		return nil, err
	}

	var totalShares decimal.Decimal
	if err := s.DB.Model(&models.Portfolio{}).
		Select("COALESCE(SUM(shares_owned), 0)").
		Where("vault_id = ?", portfolio.VaultID).
		Scan(&totalShares).Error; err != nil {
		return nil, err
	}

	var currentValue decimal.Decimal
	if totalShares.IsPositive() {
		currentValue = portfolio.SharesOwned.Div(totalShares).Mul(portfolio.Vault.TVL)
	}

	pnl := currentValue.Sub(portfolio.TotalInvestedValue)
	var pnlPercent decimal.Decimal
	if portfolio.TotalInvestedValue.IsPositive() {
		pnlPercent = pnl.Div(portfolio.TotalInvestedValue).Mul(decimal.NewFromInt(100))
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
