package middleware

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// TimeoutMiddleware bounds every request to the given duration by attaching a
// deadline context to c.Request. It is non-blocking: handlers own their context
// use, so the deadline only fires for handlers that honor the context. When the
// deadline is exceeded and nothing has been written yet, the request is aborted
// with a 504.
func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)

		c.Next()

		if errors.Is(ctx.Err(), context.DeadlineExceeded) && !c.Writer.Written() {
			c.AbortWithStatusJSON(http.StatusGatewayTimeout, gin.H{
				"success": false,
				"error":   "request timeout",
			})
		}
	}
}
