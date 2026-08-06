package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimitMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("RateLimit_AllowUnderLimit", func(t *testing.T) {
		r := gin.New()
		r.Use(RateLimitMiddleware(5, time.Minute))
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		for i := 1; i <= 5; i++ {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			req.RemoteAddr = "192.168.1.100:12345"
			r.ServeHTTP(w, req)
			if w.Code != http.StatusOK {
				t.Fatalf("request %d expected 200 OK, got %d", i, w.Code)
			}
		}
	})

	t.Run("RateLimit_Block6thRequest", func(t *testing.T) {
		r := gin.New()
		r.Use(RateLimitMiddleware(5, time.Minute))
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		for i := 1; i <= 5; i++ {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			req.RemoteAddr = "192.168.1.101:12345"
			r.ServeHTTP(w, req)
		}

		// 6th request
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "192.168.1.101:12345"
		r.ServeHTTP(w, req)

		if w.Code != http.StatusTooManyRequests {
			t.Fatalf("6th request expected 429 Too Many Requests, got %d", w.Code)
		}
		if retryAfter := w.Header().Get("Retry-After"); retryAfter != "60" {
			t.Errorf("Retry-After = %q, want %q", retryAfter, "60")
		}
	})

	t.Run("RateLimit_DifferentIPsIndependent", func(t *testing.T) {
		r := gin.New()
		r.Use(RateLimitMiddleware(1, time.Minute))
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		// IP 1: request 1 (OK)
		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req1.RemoteAddr = "10.0.0.1:12345"
		r.ServeHTTP(w1, req1)
		if w1.Code != http.StatusOK {
			t.Fatalf("IP1 req1 expected 200, got %d", w1.Code)
		}

		// IP 1: request 2 (Blocked)
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req2.RemoteAddr = "10.0.0.1:12345"
		r.ServeHTTP(w2, req2)
		if w2.Code != http.StatusTooManyRequests {
			t.Fatalf("IP1 req2 expected 429, got %d", w2.Code)
		}

		// IP 2: request 1 (OK - independent)
		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req3.RemoteAddr = "10.0.0.2:12345"
		r.ServeHTTP(w3, req3)
		if w3.Code != http.StatusOK {
			t.Fatalf("IP2 req1 expected 200, got %d", w3.Code)
		}
	})

	t.Run("RateLimit_ZeroRate", func(t *testing.T) {
		limiter := NewIPRateLimiter(0, time.Minute)
		if limiter.burst != 1 {
			t.Errorf("burst = %d, want 1 when r <= 0", limiter.burst)
		}

		l := limiter.GetLimiter("127.0.0.1")
		if !l.Allow() {
			t.Error("expected first request to be allowed after clamping zero rate to 1")
		}
	})

	t.Run("RateLimit_NegativePeriod", func(t *testing.T) {
		limiter := NewIPRateLimiter(5, -1*time.Second)
		l := limiter.GetLimiter("127.0.0.1")
		if !l.Allow() {
			t.Error("expected request to be allowed when negative period clamped to time.Second")
		}
	})

	t.Run("RateLimit_Recover", func(t *testing.T) {
		// Use a short interval rate limit: 1 request per 10ms
		limiter := NewIPRateLimiter(1, 10*time.Millisecond)
		l := limiter.GetLimiter("192.168.1.50")

		if !l.Allow() {
			t.Fatal("expected first request allowed")
		}
		if l.Allow() {
			t.Fatal("expected second immediate request blocked")
		}

		time.Sleep(15 * time.Millisecond)

		if !l.Allow() {
			t.Fatal("expected request after wait to be allowed (recovered)")
		}
	})

	t.Run("RateLimit_IPSpoofingXForwardedFor", func(t *testing.T) {
		r := gin.New()
		r.Use(RateLimitMiddleware(1, time.Minute))
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req1.RemoteAddr = "192.168.1.1:12345"
		req1.Header.Set("X-Forwarded-For", "203.0.113.195")
		r.ServeHTTP(w1, req1)

		if w1.Code != http.StatusOK {
			t.Fatalf("first request expected 200, got %d", w1.Code)
		}
	})

	t.Run("RateLimit_IPv6", func(t *testing.T) {
		r := gin.New()
		r.Use(RateLimitMiddleware(2, time.Minute))
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		ipv6Addr := "[2001:db8:85a3:8d3:1319:8a2e:370:7348]:12345"

		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req1.RemoteAddr = ipv6Addr
		r.ServeHTTP(w1, req1)
		if w1.Code != http.StatusOK {
			t.Fatalf("IPv6 req1 expected 200, got %d", w1.Code)
		}

		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req2.RemoteAddr = ipv6Addr
		r.ServeHTTP(w2, req2)
		if w2.Code != http.StatusOK {
			t.Fatalf("IPv6 req2 expected 200, got %d", w2.Code)
		}

		w3 := httptest.NewRecorder()
		req3, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req3.RemoteAddr = ipv6Addr
		r.ServeHTTP(w3, req3)
		if w3.Code != http.StatusTooManyRequests {
			t.Fatalf("IPv6 req3 expected 429, got %d", w3.Code)
		}
	})

	t.Run("RateLimit_MemoryGrowth", func(t *testing.T) {
		limiter := NewIPRateLimiter(10, time.Minute)
		// Simulate multiple unique IPs
		numIPs := 1000
		for i := 0; i < numIPs; i++ {
			ip := fmt.Sprintf("10.1.%d.%d", i/256, i%256)
			l := limiter.GetLimiter(ip)
			if !l.Allow() {
				t.Fatalf("expected initial allow for IP %s", ip)
			}
		}

		limiter.mu.RLock()
		mapSize := len(limiter.limiters)
		limiter.mu.RUnlock()

		if mapSize != numIPs {
			t.Errorf("limiter map size = %d, want %d", mapSize, numIPs)
		}
	})
}
