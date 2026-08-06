package cache

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sony/gobreaker"
)

// Cache is the generic caching contract shared by the read path (cache-aside)
// and the write path (invalidation). Keys are built with the Keys helpers in
// keys.go so reads and invalidations always agree on names.
type Cache interface {
	// Get unmarshals the JSON value stored at key into dest. It returns
	// redis.Nil when the key is missing — callers use errors.Is(err, redis.Nil)
	// to detect a cache miss and fall back to the database.
	Get(ctx context.Context, key string, dest any) error
	// Set marshals value as JSON and stores it at key with the given TTL.
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	// Delete removes key. Deleting a missing key is not an error.
	Delete(ctx context.Context, key string) error
	// SetWithTTL is an alias of Set kept for callers that prefer the explicit name.
	SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error
	// Ping checks connectivity to the underlying store.
	Ping(ctx context.Context) error
}

// StaleGetter is an optional capability implemented by RedisCache. Callers that
// need graceful degradation (serve last-known data when the database is slow)
// can type-assert Cache to StaleGetter (audit 2.6).
type StaleGetter interface {
	// GetStale returns stale=true when a value exists at key, reading it without
	// refreshing its TTL. It returns redis.Nil when the key is missing.
	GetStale(ctx context.Context, key string, dest any) (stale bool, err error)
}

// RedisCache implements Cache on top of a go-redis client. Every operation is
// guarded by a circuit breaker (audit 1.6) so a degraded Redis degrades the
// cache path (fall through to DB) instead of piling up request timeouts.
type RedisCache struct {
	client  *redis.Client
	breaker *gobreaker.CircuitBreaker
}

// NewRedisCache wraps a redis.Client (see NewRedisClient) into a Cache.
// The breaker trips after 5 consecutive failures within a 10s window and
// allows a half-open probe after 30s.
func NewRedisCache(client *redis.Client) Cache {
	breaker := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "redis",
		MaxRequests: 1,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
	})
	return &RedisCache{client: client, breaker: breaker}
}

// BreakerState returns the current circuit breaker state as a string:
// "closed", "open" or "half-open". Exposed for the /health endpoint.
func (c *RedisCache) BreakerState() string {
	return c.breaker.State().String()
}

func (c *RedisCache) Get(ctx context.Context, key string, dest any) error {
	var (
		raw  []byte
		miss bool
	)
	if _, err := c.breaker.Execute(func() (any, error) {
		b, err := c.client.Get(ctx, key).Bytes()
		if errors.Is(err, redis.Nil) {
			// A cache miss is a normal outcome, not a failure: do not trip
			// the breaker or callers would fall through to the DB constantly.
			miss = true
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		raw = b
		return nil, nil
	}); err != nil {
		return err
	}
	if miss {
		return redis.Nil
	}
	return unmarshal(raw, dest)
}

func (c *RedisCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return c.SetWithTTL(ctx, key, value, ttl)
}

func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.DeleteMany(ctx, key)
}

// DeleteMany removes all keys in a single round trip (audit 1.3.2). It is not
// part of the Cache interface so handler test mocks stay small; callers opt in
// via the BatchDeleter assertion in the repository decorator.
func (c *RedisCache) DeleteMany(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	_, err := c.breaker.Execute(func() (any, error) {
		return nil, c.client.Del(ctx, keys...).Err()
	})
	return err
}

func (c *RedisCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := marshal(value)
	if err != nil {
		return err
	}
	_, err = c.breaker.Execute(func() (any, error) {
		return nil, c.client.Set(ctx, key, raw, ttl).Err()
	})
	return err
}

func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// GetStale implements StaleGetter. Reads leave the TTL untouched (plain GET,
// no GETEX/refresh) and report stale=true whenever a value exists, so a caller
// that cannot reach the database can still serve last-known data.
func (c *RedisCache) GetStale(ctx context.Context, key string, dest any) (bool, error) {
	if err := c.Get(ctx, key, dest); err != nil {
		if errors.Is(err, redis.Nil) {
			return false, redis.Nil
		}
		return false, err
	}
	return true, nil
}