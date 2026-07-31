package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	origins := os.Getenv("CORS_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000,http://localhost:5173"
	}
	allowed := strings.Split(origins, ",")
	allowedMap := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		allowedMap[strings.TrimSpace(o)] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if allowedMap[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Pubkey, X-Timestamp, X-Signature")
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
