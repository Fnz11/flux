package cache

import (
	"context"
	"errors"
	"strings"
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
	// DeletePrefix scans and removes all keys matching prefix* using SCAN (non-blocking).
	DeletePrefix(ctx context.Context, prefix string) error
	// SetWithTTL is an alias of Set kept for callers that prefer the explicit name.
	SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error
	// MGet retrieves multiple keys in a single round-trip. Missing keys are omitted in results.
	MGet(ctx context.Context, keys ...string) ([][]byte, error)
	// ZAdd adds or updates a member in a sorted set with a score.
	ZAdd(ctx context.Context, key string, score float64, member string) error
	// ZRevRange returns members from high score to low score between start and stop (inclusive).
	ZRevRange(ctx context.Context, key string, start, stop int64) ([]string, error)
	// ZCard returns the cardinality (number of elements) of the sorted set.
	ZCard(ctx context.Context, key string) (int64, error)
	// LPush prepends one or multiple values to a list.
	LPush(ctx context.Context, key string, values ...any) error
	// LRange returns a slice of elements from a list between start and stop (inclusive).
	LRange(ctx context.Context, key string, start, stop int64) ([]string, error)
	// LTrim trims a list so that it will contain only the specified range of elements.
	LTrim(ctx context.Context, key string, start, stop int64) error
	// LLen returns the length of a list.
	LLen(ctx context.Context, key string) (int64, error)
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

func (c *RedisCache) DeletePrefix(ctx context.Context, prefix string) error {
	if prefix == "" {
		return nil
	}
	_, err := c.breaker.Execute(func() (any, error) {
		pattern := prefix
		if !strings.HasSuffix(pattern, "*") {
			pattern += "*"
		}
		var cursor uint64
		for {
			keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
			if err != nil {
				return nil, err
			}
			if len(keys) > 0 {
				if err := c.client.Del(ctx, keys...).Err(); err != nil {
					return nil, err
				}
			}
			cursor = nextCursor
			if cursor == 0 {
				break
			}
		}
		return nil, nil
	})
	return err
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

func (c *RedisCache) MGet(ctx context.Context, keys ...string) ([][]byte, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	res, err := c.breaker.Execute(func() (any, error) {
		vals, err := c.client.MGet(ctx, keys...).Result()
		if err != nil {
			return nil, err
		}
		out := make([][]byte, 0, len(vals))
		for _, v := range vals {
			if v == nil {
				continue
			}
			switch val := v.(type) {
			case string:
				out = append(out, []byte(val))
			case []byte:
				out = append(out, val)
			}
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	return res.([][]byte), nil
}

func (c *RedisCache) ZAdd(ctx context.Context, key string, score float64, member string) error {
	_, err := c.breaker.Execute(func() (any, error) {
		return nil, c.client.ZAdd(ctx, key, redis.Z{
			Score:  score,
			Member: member,
		}).Err()
	})
	return err
}

func (c *RedisCache) ZRevRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	res, err := c.breaker.Execute(func() (any, error) {
		return c.client.ZRevRange(ctx, key, start, stop).Result()
	})
	if err != nil {
		return nil, err
	}
	return res.([]string), nil
}

func (c *RedisCache) ZCard(ctx context.Context, key string) (int64, error) {
	res, err := c.breaker.Execute(func() (any, error) {
		return c.client.ZCard(ctx, key).Result()
	})
	if err != nil {
		return 0, err
	}
	return res.(int64), nil
}

func (c *RedisCache) LPush(ctx context.Context, key string, values ...any) error {
	if len(values) == 0 {
		return nil
	}
	_, err := c.breaker.Execute(func() (any, error) {
		rawVals := make([]any, len(values))
		for i, v := range values {
			if s, ok := v.(string); ok {
				rawVals[i] = s
			} else {
				raw, err := marshal(v)
				if err != nil {
					return nil, err
				}
				rawVals[i] = raw
			}
		}
		return nil, c.client.LPush(ctx, key, rawVals...).Err()
	})
	return err
}

func (c *RedisCache) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	res, err := c.breaker.Execute(func() (any, error) {
		return c.client.LRange(ctx, key, start, stop).Result()
	})
	if err != nil {
		return nil, err
	}
	return res.([]string), nil
}

func (c *RedisCache) LTrim(ctx context.Context, key string, start, stop int64) error {
	_, err := c.breaker.Execute(func() (any, error) {
		return nil, c.client.LTrim(ctx, key, start, stop).Err()
	})
	return err
}

func (c *RedisCache) LLen(ctx context.Context, key string) (int64, error) {
	res, err := c.breaker.Execute(func() (any, error) {
		return c.client.LLen(ctx, key).Result()
	})
	if err != nil {
		return 0, err
	}
	return res.(int64), nil
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