package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type mockPinger struct {
	pingErr error
}

func (m *mockPinger) Ping(ctx context.Context) error {
	return m.pingErr
}

type mockCache struct {
	pingErr error
}

func (m *mockCache) Get(ctx context.Context, key string, dest any) error { return nil }
func (m *mockCache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	return nil
}
func (m *mockCache) Delete(ctx context.Context, key string) error { return nil }
func (m *mockCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) error {
	return nil
}
func (m *mockCache) Ping(ctx context.Context) error { return m.pingErr }

func TestHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Health_AllUp", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: nil})
		h.SetCache(&mockCache{pingErr: nil})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

		h.HealthCheck(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("Health_DBDown", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: errors.New("db connection lost")})
		h.SetCache(&mockCache{pingErr: nil})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

		h.HealthCheck(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d", w.Code)
		}

		var resp map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["success"].(bool) {
			t.Fatalf("expected success=false")
		}
	})

	t.Run("Health_RedisDown", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: nil})
		h.SetCache(&mockCache{pingErr: errors.New("redis down")})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

		h.HealthCheck(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d", w.Code)
		}
	})

	t.Run("Health_BothDown", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: errors.New("db down")})
		h.SetCache(&mockCache{pingErr: errors.New("redis down")})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

		h.HealthCheck(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d", w.Code)
		}
	})

	t.Run("Liveness_AlwaysOK", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: errors.New("db down")})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health/liveness", nil)

		h.LivenessCheck(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	t.Run("Readiness_DelegatesToHealth", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: errors.New("db down")})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health/readiness", nil)

		h.ReadinessCheck(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d", w.Code)
		}
	})

	t.Run("Health_NoSensitiveInfo", func(t *testing.T) {
		h := NewHealthHandler(&mockPinger{pingErr: nil})
		h.SetCache(&mockCache{pingErr: nil})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/health", nil)

		h.HealthCheck(c)

		body := w.Body.String()
		if strings.Contains(body, "postgres://") || strings.Contains(body, "password") || strings.Contains(body, "secret") {
			t.Fatalf("health response exposes sensitive information: %s", body)
		}
	})
}
