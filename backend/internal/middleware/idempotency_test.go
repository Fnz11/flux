package middleware

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func TestIdempotencyMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Un-connected redis client (simulates outage / fail-open behavior)
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:0"})

	t.Run("missing_idempotency_key_passes_through", func(t *testing.T) {
		r := gin.New()
		r.Use(IdempotencyMiddleware(rdb, 1*time.Hour))
		callCount := 0
		r.POST("/test", func(c *gin.Context) {
			callCount++
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		w1 := httptest.NewRecorder()
		req1, _ := http.NewRequest("POST", "/test", nil)
		r.ServeHTTP(w1, req1)

		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest("POST", "/test", nil)
		r.ServeHTTP(w2, req2)

		if callCount != 2 {
			t.Errorf("expected handler to execute 2 times without key, got %d", callCount)
		}
	})

	t.Run("redis_outage_fails_open_calling_handler", func(t *testing.T) {
		r := gin.New()
		r.Use(IdempotencyMiddleware(rdb, 1*time.Hour))
		callCount := 0
		r.POST("/fail-open", func(c *gin.Context) {
			callCount++
			c.JSON(http.StatusOK, gin.H{"status": "degraded"})
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/fail-open", nil)
		req.Header.Set("Idempotency-Key", "key-fail-open")
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200 fail-open status on Redis error, got %d", w.Code)
		}
		if callCount != 1 {
			t.Errorf("expected handler to run despite Redis outage, got %d", callCount)
		}
	})

	t.Run("response_writer_captures_status_and_body", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		buf := &idempotencyResponseWriter{ResponseWriter: c.Writer}

		buf.WriteHeader(http.StatusCreated)
		_, _ = buf.WriteString(`{"created":true}`)

		if buf.status != http.StatusCreated {
			t.Errorf("expected status 201, got %d", buf.status)
		}
		if buf.body.String() != `{"created":true}` {
			t.Errorf("expected captured body '{\"created\":true}', got %q", buf.body.String())
		}

		payload := idemPayload{
			Status:      buf.status,
			Body:        base64.StdEncoding.EncodeToString(buf.body.Bytes()),
			ContentType: "application/json",
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("failed to marshal payload: %v", err)
		}

		var decoded idemPayload
		if err := json.Unmarshal(raw, &decoded); err != nil {
			t.Fatalf("failed to unmarshal payload: %v", err)
		}
		if decoded.Status != http.StatusCreated {
			t.Errorf("expected decoded status 201, got %d", decoded.Status)
		}
	})
}
