package middleware

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type IPRateLimiter struct {
	mu          sync.RWMutex
	limiters    map[string]*limiterEntry
	rate        rate.Limit
	burst       int
	ttl         time.Duration
	maxLimiters int
}

func NewIPRateLimiter(r int, per time.Duration) *IPRateLimiter {
	return NewIPRateLimiterWithTTL(r, per, 5*time.Minute, 10000)
}

func NewIPRateLimiterWithTTL(r int, per time.Duration, ttl time.Duration, maxLimiters int) *IPRateLimiter {
	if r <= 0 {
		r = 1
	}
	if per <= 0 {
		per = time.Second
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	if maxLimiters <= 0 {
		maxLimiters = 10000
	}
	limit := rate.Every(per / time.Duration(r))
	return &IPRateLimiter{
		limiters:    make(map[string]*limiterEntry),
		rate:        limit,
		burst:       r,
		ttl:         ttl,
		maxLimiters: maxLimiters,
	}
}

func (l *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	if entry, exists := l.limiters[ip]; exists {
		entry.lastSeen = now
		return entry.limiter
	}

	if len(l.limiters) >= l.maxLimiters {
		l.cleanupStaleLocked(now)
		if len(l.limiters) >= l.maxLimiters {
			l.evictOldestLocked()
		}
	}

	limiter := rate.NewLimiter(l.rate, l.burst)
	l.limiters[ip] = &limiterEntry{
		limiter:  limiter,
		lastSeen: now,
	}
	return limiter
}

func (l *IPRateLimiter) cleanupStaleLocked(now time.Time) {
	for ip, entry := range l.limiters {
		if now.Sub(entry.lastSeen) > l.ttl {
			delete(l.limiters, ip)
		}
	}
}

func (l *IPRateLimiter) evictOldestLocked() {
	var oldestIP string
	var oldestTime time.Time
	first := true

	for ip, entry := range l.limiters {
		if first || entry.lastSeen.Before(oldestTime) {
			oldestIP = ip
			oldestTime = entry.lastSeen
			first = false
		}
	}
	if !first {
		delete(l.limiters, oldestIP)
	}
}

func (l *IPRateLimiter) Cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.cleanupStaleLocked(time.Now())
}

func (l *IPRateLimiter) Len() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return len(l.limiters)
}

func RateLimitMiddleware(rateLimit int, per time.Duration) gin.HandlerFunc {
	limiter := NewIPRateLimiter(rateLimit, per)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		l := limiter.GetLimiter(ip)
		if !l.Allow() {
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}

const redisRateLimitScript = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if c > tonumber(ARGV[2]) then
    return 0
end
return 1
`

// RedisTokenBucketMiddleware is a distributed fixed-window rate limiter backed
// by Redis. It is keyed per client IP and is atomic across pods, unlike the
// in-process IPRateLimiter. On Redis errors it fails open (calls c.Next()) so a
// Redis outage never takes down the API.
func RedisTokenBucketMiddleware(rdb *redis.Client, rate int, per time.Duration) gin.HandlerFunc {
	script := redis.NewScript(redisRateLimitScript)
	window := int64(per / time.Second)
	if window < 1 {
		window = 1
	}
	if rate < 1 {
		rate = 1
	}
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := "app:ratelimit:" + ip

		res, err := script.Run(context.Background(), rdb, []string{key}, window, rate).Int()
		if err != nil {
			c.Next()
			return
		}
		if res == 0 {
			c.Header("Retry-After", strconv.FormatInt(window, 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}

