package cache

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

const defaultRedisURL = "redis://localhost:6379/0"

// NewRedisClient builds a redis.Client from url. If url is empty it falls back
// to REDIS_URL, then to redis://localhost:6379/0 (local docker-compose redis).
// A failed init Ping is logged as a WARNING, not an error: callers must
// degrade gracefully to database reads when Redis is down.
func NewRedisClient(url string) (*redis.Client, error) {
	if url == "" {
		url = os.Getenv("REDIS_URL")
	}
	if url == "" {
		url = defaultRedisURL
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	opts.PoolSize = 20
	opts.MinIdleConns = 5
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		logrus.WithError(err).WithField("url", url).Warn("redis ping failed, cache will degrade to database reads")
	}
	return client, nil
}

// WarmCache pre-populates high-traffic cache keys on startup so a pod restart
// does not cause a database thundering herd (audit 1.3.5). It is non-blocking
// by design: callers should run it from a goroutine, e.g.
//
//	go WarmCache(ctx, rdb, map[string]func() (any, error){...})
func WarmCache(ctx context.Context, rdb *redis.Client, loaders map[string]func() (any, error)) {
	for key, load := range loaders {
		v, err := load()
		if err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache warm load failed")
			continue
		}
		raw, err := marshal(v)
		if err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache warm marshal failed")
			continue
		}
		if err := rdb.Set(ctx, key, raw, LeaderboardTTL).Err(); err != nil {
			logrus.WithError(err).WithField("key", key).Warn("cache warm set failed")
		}
	}
}
