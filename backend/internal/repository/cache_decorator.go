package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

const (
	portfolioTTL = 30 * time.Second
	summaryTTL   = 60 * time.Second
	tradeTTL     = 30 * time.Second
	tradeListTTL = 20 * time.Second
)

// cacheFlight dedupes concurrent cache misses per key so a burst of requests
// after a key expires performs a single DB read (singleflight stampede
// protection, audit 1.3.3).
var cacheFlight = cache.NewGroup()

// BatchDeleter is an optional cache capability: when the underlying cache can
// delete many keys in one round trip, invalidateKeys uses it instead of one
// Delete per key (audit 1.3.2).
type BatchDeleter interface {
	DeleteMany(ctx context.Context, keys ...string) error
}

// Short key helpers delegate to cache.Keys so reads and invalidations share the
// exact same key contract. They are kept as thin wrappers for callers/tests
// that still reference the short names.
func portfolioKey(userID string) string         { return cache.UserPortfolioKey(userID) }
func portfolioSummaryKey(userID string) string  { return cache.UserPortfolioSummaryKey(userID) }
func pnlSummaryKey(userID string) string        { return cache.UserPnlSummaryKey(userID) }
func vaultTotalSharesKey(vaultID string) string { return cache.VaultTotalSharesKey(vaultID) }
func tradeSigKey(sig string) string             { return cache.TradeSignatureKey(sig) }

func cacheGet[T any](ctx context.Context, cache Cache, key string, ttl time.Duration, load func() (T, error)) (T, error) {
	if cache == nil {
		return load()
	}

	var v T
	if err := cache.Get(ctx, key, &v); err == nil {
		return v, nil
	}

	got, err := cacheFlight.Do(key, func() (any, error) {
		v, err := load()
		if err != nil {
			return v, err
		}
		if err := cache.SetWithTTL(ctx, key, v, ttl); err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache set failed")
		}
		return v, nil
	})
	if err != nil {
		var zero T
		return zero, err
	}
	typed, ok := got.(T)
	if !ok {
		var zero T
		return zero, fmt.Errorf("cache: unexpected value type %T for key %q", got, key)
	}
	return typed, nil
}

// tradeListCache is the JSON envelope stored for paginated trade listings.
type tradeListCache struct {
	Items []domain.TradeDetail `json:"items"`
	Total int64                `json:"total"`
}

func cacheGetPaged(ctx context.Context, cache Cache, key string, ttl time.Duration, load func() ([]domain.TradeDetail, int64, error)) ([]domain.TradeDetail, int64, error) {
	if cache == nil {
		return load()
	}

	var cached tradeListCache
	if err := cache.Get(ctx, key, &cached); err == nil {
		return cached.Items, cached.Total, nil
	}

	got, err := cacheFlight.Do(key, func() (any, error) {
		items, total, err := load()
		if err != nil {
			return nil, err
		}
		result := tradeListCache{Items: items, Total: total}
		if err := cache.SetWithTTL(ctx, key, result, ttl); err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache set failed")
		}
		return result, nil
	})
	if err != nil {
		return nil, 0, err
	}
	result, ok := got.(tradeListCache)
	if !ok {
		return nil, 0, fmt.Errorf("cache: unexpected value type %T for key %q", got, key)
	}
	return result.Items, result.Total, nil
}

func invalidateKeys(ctx context.Context, cache Cache, keys ...string) {
	if cache == nil || len(keys) == 0 {
		return
	}
	if bd, ok := cache.(BatchDeleter); ok {
		if err := bd.DeleteMany(ctx, keys...); err != nil {
			logrus.WithError(err).WithField("keys", keys).Warn("cache batch delete failed")
		}
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
		cache.UserPortfolioKey(userID),
		cache.VaultTotalSharesKey(vaultID),
		cache.UserPortfolioSummaryKey(userID),
		cache.UserPnlSummaryKey(userID),
	)
	return nil
}

func (c *CachedPortfolioRepository) ReducePosition(ctx context.Context, userID, vaultID string, sharesSold decimal.Decimal) error {
	err := c.inner.ReducePosition(ctx, userID, vaultID, sharesSold)
	if err != nil {
		return err
	}
	invalidateKeys(ctx, c.cache,
		cache.UserPortfolioKey(userID),
		cache.VaultTotalSharesKey(vaultID),
		cache.UserPortfolioSummaryKey(userID),
		cache.UserPnlSummaryKey(userID),
	)
	return nil
}

func (c *CachedPortfolioRepository) GetByUser(ctx context.Context, userID string) ([]domain.PortfolioDetail, error) {
	return cacheGet(ctx, c.cache, cache.UserPortfolioKey(userID), portfolioTTL, func() ([]domain.PortfolioDetail, error) {
		return c.inner.GetByUser(ctx, userID)
	})
}

func (c *CachedPortfolioRepository) GetTotalSharesByVault(ctx context.Context, vaultID string) (decimal.Decimal, error) {
	return cacheGet(ctx, c.cache, cache.VaultTotalSharesKey(vaultID), portfolioTTL, func() (decimal.Decimal, error) {
		return c.inner.GetTotalSharesByVault(ctx, vaultID)
	})
}

func (c *CachedPortfolioRepository) GetPortfolioSummary(ctx context.Context, userID string) (*domain.PortfolioSummary, error) {
	return cacheGet(ctx, c.cache, cache.UserPortfolioSummaryKey(userID), summaryTTL, func() (*domain.PortfolioSummary, error) {
		return c.inner.GetPortfolioSummary(ctx, userID)
	})
}

func (c *CachedPortfolioRepository) GetUserPnLSummary(ctx context.Context, userID string) (*domain.UserPnLSummary, error) {
	return cacheGet(ctx, c.cache, cache.UserPnlSummaryKey(userID), summaryTTL, func() (*domain.UserPnLSummary, error) {
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
	return cacheGet(ctx, c.cache, cache.TradeSignatureKey(sig), tradeTTL, func() (*domain.TradeDetail, error) {
		return c.inner.FindBySignature(ctx, sig)
	})
}

func (c *CachedTradeRepository) Create(ctx context.Context, trade *domain.TradeDetail) error {
	err := c.inner.Create(ctx, trade)
	if err != nil {
		return err
	}
	invalidateKeys(ctx, c.cache, cache.TradeSignatureKey(trade.TransactionSignature))
	return nil
}

func (c *CachedTradeRepository) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	key := cache.TradeListKey(vaultID, tradeType, page, limit)
	return cacheGetPaged(ctx, c.cache, key, tradeListTTL, func() ([]domain.TradeDetail, int64, error) {
		return c.inner.ListByVault(ctx, vaultID, tradeType, page, limit)
	})
}

func (c *CachedTradeRepository) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	key := cache.TradeListByVaultIDsKey(vaultIDs, tradeType, page, limit)
	return cacheGetPaged(ctx, c.cache, key, tradeListTTL, func() ([]domain.TradeDetail, int64, error) {
		return c.inner.ListByVaultIDs(ctx, vaultIDs, tradeType, page, limit)
	})
}