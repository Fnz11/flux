package repository

import (
	"context"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

const (
	portfolioTTL = 30 * time.Second
	summaryTTL   = 60 * time.Second
	tradeTTL     = 30 * time.Second
)

// Key strings follow the cache.Keys.* convention (opt.md 6.4). Integrator:
// swap these for cache.Keys helpers once internal/cache lands; keep the
// exact strings aligned with agent 8's invalidation keys.
func portfolioKey(userID string) string         { return "app:user:" + userID + ":portfolio" }
func portfolioSummaryKey(userID string) string  { return "app:user:" + userID + ":portfolio-summary" }
func pnlSummaryKey(userID string) string        { return "app:user:" + userID + ":pnl-summary" }
func vaultTotalSharesKey(vaultID string) string { return "app:vault:" + vaultID + ":total-shares" }
func tradeSigKey(sig string) string             { return "app:trade:signature:" + sig }

func cacheGet[T any](ctx context.Context, cache Cache, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	if cache == nil {
		return load()
	}

	var v T
	if err := cache.Get(ctx, key, &v); err == nil {
		return v, nil
	}

	v, err := load()
	if err != nil {
		return v, err
	}

	if err := cache.SetWithTTL(ctx, key, v, ttl); err != nil {
		logrus.WithError(err).WithField("key", key).Warn("cache set failed")
	}
	return v, nil
}

func invalidateKeys(ctx context.Context, cache Cache, keys ...string) {
	if cache == nil {
		return
	}
	for _, key := range keys {
		if err := cache.Delete(ctx, key); err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache delete failed")
		}
	}
}

type CachedPortfolioRepository struct {
	inner domain.PortfolioRepository
	cache Cache
}

func NewCachedPortfolioRepository(inner domain.PortfolioRepository, cache Cache) domain.PortfolioRepository {
	return &CachedPortfolioRepository{inner: inner, cache: cache}
}

func (c *CachedPortfolioRepository) UpsertPosition(ctx context.Context, userID, vaultID string, shares, invested, entryPrice decimal.Decimal) error {
	err := c.inner.UpsertPosition(ctx, userID, vaultID, shares, invested, entryPrice)
	if err != nil {
		return err
	}
	invalidateKeys(ctx, c.cache,
		portfolioKey(userID),
		vaultTotalSharesKey(vaultID),
		portfolioSummaryKey(userID),
		pnlSummaryKey(userID),
	)
	return nil
}

func (c *CachedPortfolioRepository) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error {
	err := c.inner.ReducePosition(ctx, userID, vaultID, sharesSold)
	if err != nil {
		return err
	}
	invalidateKeys(ctx, c.cache,
		portfolioKey(userID),
		vaultTotalSharesKey(vaultID),
		portfolioSummaryKey(userID),
		pnlSummaryKey(userID),
	)
	return nil
}

func (c *CachedPortfolioRepository) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	return cacheGet(ctx, c.cache, portfolioKey(userID), portfolioTTL, func() ([]domain.PortfolioDetail, error) {
		return c.inner.GetByUser(ctx, userID)
	})
}

func (c *CachedPortfolioRepository) GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error) {
	return cacheGet(ctx, c.cache, vaultTotalSharesKey(vaultID), portfolioTTL, func() (decimal.Decimal, error) {
		return c.inner.GetTotalSharesByVault(ctx, vaultID)
	})
}

func (c *CachedPortfolioRepository) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	return cacheGet(ctx, c.cache, portfolioSummaryKey(userID), summaryTTL, func() (*domain.PortfolioSummary, error) {
		return c.inner.GetPortfolioSummary(ctx, userID)
	})
}

func (c *CachedPortfolioRepository) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	return cacheGet(ctx, c.cache, pnlSummaryKey(userID), summaryTTL, func() (*domain.UserPnLSummary, error) {
		return c.inner.GetUserPnLSummary(ctx, userID)
	})
}

func (c *CachedPortfolioRepository) GetHolderUserIDs(ctx context.Context, vaultID string) ([]string, error) {
	return c.inner.GetHolderUserIDs(ctx, vaultID)
}

type CachedTradeRepository struct {
	inner domain.TradeRepository
	cache Cache
}

func NewCachedTradeRepository(inner domain.TradeRepository, cache Cache) domain.TradeRepository {
	return &CachedTradeRepository{inner: inner, cache: cache}
}

func (c *CachedTradeRepository) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	return cacheGet(ctx, c.cache, tradeSigKey(sig), tradeTTL, func() (*domain.TradeDetail, error) {
		return c.inner.FindBySignature(ctx, sig)
	})
}

func (c *CachedTradeRepository) Create(ctx context.Context, trade *domain.TradeDetail) error {
	err := c.inner.Create(ctx, trade)
	if err != nil {
		return err
	}
	invalidateKeys(ctx, c.cache, tradeSigKey(trade.TransactionSignature))
	return nil
}

func (c *CachedTradeRepository) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return c.inner.ListByVault(ctx, vaultID, tradeType, page, limit)
}

func (c *CachedTradeRepository) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return c.inner.ListByVaultIDs(ctx, vaultIDs, tradeType, page, limit)
}
