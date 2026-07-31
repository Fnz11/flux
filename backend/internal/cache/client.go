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
