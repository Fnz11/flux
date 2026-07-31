package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/ratelimit"
)

type IPRateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]ratelimit.Limiter
	rate     int
	per      time.Duration
}

func NewIPRateLimiter(rate int, per time.Duration) *IPRateLimiter {
	return &IPRateLimiter{
		limiters: make(map[string]ratelimit.Limiter),
		rate:     rate,
		per:      per,
	}
}

func (l *IPRateLimiter) GetLimiter(ip string) ratelimit.Limiter {
	l.mu.RLock()
	limiter, exists := l.limiters[ip]
	l.mu.RUnlock()
	if exists {
		return limiter
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if limiter, exists = l.limiters[ip]; exists {
		return limiter
	}
	ratePerSec := float64(l.rate) / l.per.Seconds()
	if ratePerSec < 1 {
		ratePerSec = 1
	}
	limiter = ratelimit.New(int(ratePerSec))
	l.limiters[ip] = limiter
	return limiter
}

func RateLimitMiddleware(rate int, per time.Duration) gin.HandlerFunc {
	limiter := NewIPRateLimiter(rate, per)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		l := limiter.GetLimiter(ip)
		l.Take()
		c.Next()
	}
}
