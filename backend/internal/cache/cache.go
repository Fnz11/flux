package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
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

// RedisCache implements Cache on top of a go-redis client.
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache wraps a redis.Client (see NewRedisClient) into a Cache.
func NewRedisCache(client *redis.Client) Cache {
	return &RedisCache{client: client}
}

func (c *RedisCache) Get(ctx context.Context, key string, dest any) error {
	raw, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return unmarshal(raw, dest)
}

func (c *RedisCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return c.SetWithTTL(ctx, key, value, ttl)
}

func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

func (c *RedisCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, raw, ttl).Err()
}

func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}
