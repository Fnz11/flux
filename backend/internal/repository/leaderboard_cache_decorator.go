package repository

import (
	"context"
	"strings"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
)

// leaderboardMaxLimit is the largest limit the domain repo accepts. The cache
// always loads and stores this full bucket so a single key per (lbType, period)
// serves every requested limit; the read path slices down to the caller's
// limit. The DB work is near-identical regardless of limit (the expensive
// per-token aggregation runs for the whole window before the top-N is picked),
// so pre-fetching the max bucket costs the cache layer nothing extra.
const leaderboardMaxLimit = 50

var _ domain.LeaderboardRepository = (*cachedLeaderboardRepository)(nil)

type cachedLeaderboardRepository struct {
	inner domain.LeaderboardRepository
	cache Cache
}

// NewCachedLeaderboardRepository wraps a LeaderboardRepository with a
// cache-aside store (mirrors CachedPortfolioRepository / CachedTradeRepository
// in cache_decorator.go). A nil cache passes straight through to the inner
// repository; any cache error or miss degrades to a database read.
func NewCachedLeaderboardRepository(inner domain.LeaderboardRepository, cache Cache) domain.LeaderboardRepository {
	return &cachedLeaderboardRepository{inner: inner, cache: cache}
}

func (c *cachedLeaderboardRepository) GetLeaderboard(ctx context.Context, lbType string, limit int, period string) ([]domain.LeaderboardItem, error) {
	items, err := cacheGet(ctx, c.cache, leaderboardCacheKey(lbType, period), cache.LeaderboardTTL, func() ([]domain.LeaderboardItem, error) {
		return c.inner.GetLeaderboard(ctx, lbType, leaderboardMaxLimit, period)
	})
	if err != nil {
		return nil, err
	}
	if limit < 1 {
		limit = 1
	}
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

// leaderboardCacheKey returns the Redis key for a (lbType, period) query. The
// dashboard's default request (trending / 7d, which the handler serves when no
// query params are given) maps onto the legacy app:global:leaderboard key so the
// existing single-key invalidators delete it unchanged. Every other combination
// gets a type-scoped key.
func leaderboardCacheKey(lbType, period string) string {
	lb := strings.ToLower(strings.TrimSpace(lbType))
	p := strings.ToLower(strings.TrimSpace(period))
	if lb == "trending" && p == "7d" {
		return cache.LeaderboardKey()
	}
	return cache.LeaderboardTypeKey(lb, p)
}
