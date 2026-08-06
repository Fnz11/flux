package services

import (
	"context"
	"time"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const portfolioCacheTTL = 30 * time.Second

const portfolioSummaryQuery = `
	SELECT vault_id, vault_address, vault_name,
	       COALESCE(shares_owned, 0) AS shares_owned,
	       COALESCE(total_invested, 0) AS total_invested_value,
	       COALESCE(average_entry_price, 0) AS average_entry_price,
	       COALESCE(current_value, 0) AS current_value,
	       COALESCE(total_pnl, 0) AS pnl,
	       COALESCE(pnl_percent, 0) AS pnl_percent
	FROM user_pnl_summary
	WHERE user_id = ?`

type PortfolioService struct {
	DB    *gorm.DB
	PnL   *PnLService
	Cache cache.Cache
	Repo  domain.PortfolioRepository
}

func NewPortfolioService(db *gorm.DB, c cache.Cache) *PortfolioService {
	return &PortfolioService{
		DB:    db,
		PnL:   NewPnLService(db, c),
		Cache: c,
	}
}

func (s *PortfolioService) SetCache(c cache.Cache) {
	s.Cache = c
	s.PnL.Cache = c
}

func (s *PortfolioService) SetRepository(repo domain.PortfolioRepository) {
	s.Repo = repo
}

func portfolioCacheKey(userID uuid.UUID) string {
	return cache.UserPortfolioKey(userID.String())
}

func (s *PortfolioService) GetPortfolio(ctx context.Context, userID uuid.UUID) ([]domain.PortfolioDetail, error) {
	if s.Cache != nil {
		var details []domain.PortfolioDetail
		if err := s.Cache.Get(ctx, portfolioCacheKey(userID), &details); err == nil {
			return details, nil
		} else {
			logrus.WithError(err).WithField("user_id", userID).Warn("portfolio cache get failed")
		}
	}

	details, err := s.loadPortfolio(ctx, userID)
	if err != nil {
		return nil, err
	}

	if s.Cache != nil {
		if err := s.Cache.Set(ctx, portfolioCacheKey(userID), details, portfolioCacheTTL); err != nil {
			logrus.WithError(err).WithField("user_id", userID).Warn("portfolio cache set failed")
		}
	}
	return details, nil
}

func (s *PortfolioService) loadPortfolio(ctx context.Context, userID uuid.UUID) ([]domain.PortfolioDetail, error) {
	var details []domain.PortfolioDetail
	err := s.DB.WithContext(ctx).Raw(portfolioSummaryQuery, userID).Scan(&details).Error
	if err != nil {
		logrus.WithError(err).WithField("user_id", userID).Warn("portfolio_summary query failed, falling back")
	}
	if err == nil && len(details) > 0 {
		return details, nil
	}

	if s.Repo != nil {
		return s.loadPortfolioFromRepo(ctx, userID)
	}
	return s.loadPortfolioFromDB(ctx, userID)
}

func (s *PortfolioService) loadPortfolioFromRepo(ctx context.Context, userID uuid.UUID) ([]domain.PortfolioDetail, error) {
	details, err := s.Repo.GetByUser(ctx, userID.String())
	if err != nil {
		return nil, err
	}
	if len(details) == 0 {
		return details, nil
	}

	vaultIDs := make([]uuid.UUID, 0, len(details))
	for _, d := range details {
		if vid, err := uuid.Parse(d.VaultID); err == nil {
			vaultIDs = append(vaultIDs, vid)
		}
	}

	tvlByVault, err := s.tvlByVault(ctx, vaultIDs)
	if err != nil {
		return nil, err
	}
	totalByVault, err := totalSharesByVault(ctx, s.DB, vaultIDs)
	if err != nil {
		return nil, err
	}

	computePnL(details, totalByVault, tvlByVault)
	return details, nil
}

func (s *PortfolioService) loadPortfolioFromDB(ctx context.Context, userID uuid.UUID) ([]domain.PortfolioDetail, error) {
	var portfolios []models.Portfolio
	if err := s.DB.WithContext(ctx).Preload("Vault").Where("user_id = ?", userID).Find(&portfolios).Error; err != nil {
		return nil, err
	}

	details := make([]domain.PortfolioDetail, 0, len(portfolios))
	vaultIDs := make([]uuid.UUID, 0, len(portfolios))
	tvlByVault := make(map[uuid.UUID]decimal.Decimal, len(portfolios))
	for _, p := range portfolios {
		details = append(details, domain.PortfolioDetail{
			VaultID:            p.VaultID.String(),
			VaultAddress:       p.Vault.Address,
			VaultName:          p.Vault.Address,
			SharesOwned:        p.SharesOwned,
			TotalInvestedValue: p.TotalInvestedValue,
			AverageEntryPrice:  p.AverageEntryPrice,
		})
		vaultIDs = append(vaultIDs, p.VaultID)
		tvlByVault[p.VaultID] = p.Vault.TVL
	}
	if len(details) == 0 {
		return details, nil
	}

	totalByVault, err := totalSharesByVault(ctx, s.DB, vaultIDs)
	if err != nil {
		return nil, err
	}

	computePnL(details, totalByVault, tvlByVault)
	return details, nil
}

func (s *PortfolioService) tvlByVault(ctx context.Context, vaultIDs []uuid.UUID) (map[uuid.UUID]decimal.Decimal, error) {
	var vaults []struct {
		ID  uuid.UUID
		TVL decimal.Decimal
	}
	if err := s.DB.WithContext(ctx).Model(&models.Vault{}).
		Select("id, tvl").Where("id IN ?", vaultIDs).Scan(&vaults).Error; err != nil {
		return nil, err
	}

	tvl := make(map[uuid.UUID]decimal.Decimal, len(vaults))
	for _, v := range vaults {
		tvl[v.ID] = v.TVL
	}
	return tvl, nil
}

func totalSharesByVault(ctx context.Context, db *gorm.DB, vaultIDs []uuid.UUID) (map[uuid.UUID]decimal.Decimal, error) {
	var sums []struct {
		VaultID uuid.UUID
		Total   decimal.Decimal
	}
	if err := db.WithContext(ctx).Model(&models.Portfolio{}).
		Select("vault_id, COALESCE(SUM(shares_owned), 0) AS total").
		Where("vault_id IN ?", vaultIDs).
		Group("vault_id").
		Scan(&sums).Error; err != nil {
		return nil, err
	}

	total := make(map[uuid.UUID]decimal.Decimal, len(sums))
	for _, s := range sums {
		total[s.VaultID] = s.Total
	}
	return total, nil
}

func computePnL(details []domain.PortfolioDetail, totalByVault, tvlByVault map[uuid.UUID]decimal.Decimal) {
	for i := range details {
		vid, err := uuid.Parse(details[i].VaultID)
		if err != nil {
			continue
		}

		var currentValue decimal.Decimal
		if total := totalByVault[vid]; total.IsPositive() {
			currentValue = details[i].SharesOwned.Div(total).Mul(tvlByVault[vid])
		}

		details[i].CurrentValue = currentValue
		details[i].PnL = currentValue.Sub(details[i].TotalInvestedValue)
		if details[i].TotalInvestedValue.IsPositive() {
			details[i].PnLPercent = details[i].PnL.Div(details[i].TotalInvestedValue).Mul(decimal.NewFromInt(100))
		}
	}
}

func (s *PortfolioService) invalidateUser(userID uuid.UUID) {
	if s.Cache == nil {
		return
	}
	for _, key := range []string{portfolioCacheKey(userID), pnlCacheKey(userID)} {
		if err := s.Cache.Delete(context.Background(), key); err != nil {
			logrus.WithError(err).WithField("user_id", userID).Warn("cache delete failed")
		}
	}
}

func (s *PortfolioService) UpdateAfterDeposit(portfolioID uuid.UUID, additionalInvested decimal.Decimal, additionalShares decimal.Decimal) error {
	var portfolio models.Portfolio
	if err := s.DB.First(&portfolio, "id = ?", portfolioID).Error; err != nil {
		return err
	}

	newTotalInvested := portfolio.TotalInvestedValue.Add(additionalInvested)
	newShares := portfolio.SharesOwned.Add(additionalShares)

	var avgPrice decimal.Decimal
	if newShares.IsPositive() {
		avgPrice = newTotalInvested.Div(newShares)
	}

	if err := s.DB.Model(&portfolio).Updates(map[string]interface{}{
		"shares_owned":         newShares,
		"total_invested_value": newTotalInvested,
		"average_entry_price":  avgPrice,
	}).Error; err != nil {
		return err
	}

	s.invalidateUser(portfolio.UserID)
	return nil
}

func (s *PortfolioService) UpdateAfterWithdraw(portfolioID uuid.UUID, withdrawnValue decimal.Decimal, withdrawnShares decimal.Decimal) error {
	var portfolio models.Portfolio
	if err := s.DB.First(&portfolio, "id = ?", portfolioID).Error; err != nil {
		return err
	}

	newShares := portfolio.SharesOwned.Sub(withdrawnShares)
	if newShares.IsNegative() {
		newShares = decimal.Zero
	}
	newInvested := portfolio.TotalInvestedValue.Sub(withdrawnValue)
	if newInvested.IsNegative() {
		newInvested = decimal.Zero
	}

	if err := s.DB.Model(&portfolio).Updates(map[string]interface{}{
		"shares_owned":         newShares,
		"total_invested_value": newInvested,
	}).Error; err != nil {
		return err
	}

	s.invalidateUser(portfolio.UserID)
	return nil
}

func (s *PortfolioService) TriggerPnLUpdate(portfolioID uuid.UUID) {
	go func() {
		_, err := s.PnL.RecalculatePosition(portfolioID)
		if err != nil {
			logrus.WithError(err).WithField("portfolio_id", portfolioID).Error("trigger PnL update error")
			return
		}

		var portfolio models.Portfolio
		if err := s.DB.First(&portfolio, "id = ?", portfolioID).Error; err != nil {
			logrus.WithError(err).WithField("portfolio_id", portfolioID).Error("trigger PnL update portfolio lookup error")
			return
		}
		s.invalidateUser(portfolio.UserID)
	}()
}

func (s *PortfolioService) TriggerBatchPnLUpdate(userID uuid.UUID) {
	go s.PnL.BatchRecalculate(userID)
}
