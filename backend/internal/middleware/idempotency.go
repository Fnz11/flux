package middleware

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type idemPayload struct {
	Status      int    `json:"status"`
	Body        string `json:"body"`
	ContentType string `json:"content_type,omitempty"`
}

// idempotencyResponseWriter wraps the gin writer and records the response
// status and body bytes so they can be replayed for a repeated Idempotency-Key.
type idempotencyResponseWriter struct {
	gin.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *idempotencyResponseWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *idempotencyResponseWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *idempotencyResponseWriter) WriteString(s string) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// IdempotencyMiddleware provides Idempotency-Key support for mutation endpoints
// (non-GET). If a request carries an Idempotency-Key whose response is already
// stored at app:idem:{key}, the stored status+body is replayed. Otherwise the
// response is captured after the handler runs and stored with the given TTL.
// On Redis errors it fails open (calls c.Next()) so Redis outages never break
// writes.
func IdempotencyMiddleware(rdb *redis.Client, ttl time.Duration) gin.HandlerFunc {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return func(c *gin.Context) {
		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		redisKey := "app:idem:" + key

		val, err := rdb.Get(ctx, redisKey).Bytes()
		if err == nil {
			var p idemPayload
			if json.Unmarshal(val, &p) == nil {
				body, derr := base64.StdEncoding.DecodeString(p.Body)
				if derr != nil {
					body = []byte(p.Body)
				}
				if p.ContentType != "" {
					c.Data(p.Status, p.ContentType, body)
				} else {
					c.Data(p.Status, "application/json; charset=utf-8", body)
				}
				c.Abort()
				return
			}
		} else if err != redis.Nil {
			c.Next()
			return
		}

		c.Set("idempotency_key", key)

		buf := &idempotencyResponseWriter{ResponseWriter: c.Writer}
		c.Writer = buf
		c.Next()

		if buf.status == 0 {
			buf.status = c.Writer.Status()
		}
		payload := idemPayload{
			Status:      buf.status,
			Body:        base64.StdEncoding.EncodeToString(buf.body.Bytes()),
			ContentType: c.Writer.Header().Get("Content-Type"),
		}
		raw, merr := json.Marshal(payload)
		if merr != nil {
			return
		}
		_ = rdb.Set(ctx, redisKey, raw, ttl).Err()
	}
}
