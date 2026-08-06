package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSecurityHeadersMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(SecurityHeadersMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test", nil)
	r.ServeHTTP(w, req)

	t.Run("SecurityHeaders_AllPresent", func(t *testing.T) {
		if ct := w.Header().Get("X-Content-Type-Options"); ct == "" {
			t.Error("expected X-Content-Type-Options header to be present")
		}
		if fo := w.Header().Get("X-Frame-Options"); fo == "" {
			t.Error("expected X-Frame-Options header to be present")
		}
		if xp := w.Header().Get("X-XSS-Protection"); xp == "" {
			t.Error("expected X-XSS-Protection header to be present")
		}
	})

	t.Run("SecurityHeaders_ContentTypeOptions", func(t *testing.T) {
		if got := w.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("X-Content-Type-Options = %q, want %q", got, "nosniff")
		}
	})

	t.Run("SecurityHeaders_FrameOptions", func(t *testing.T) {
		if got := w.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("X-Frame-Options = %q, want %q", got, "DENY")
		}
	})

	t.Run("SecurityHeaders_XSSProtection", func(t *testing.T) {
		if got := w.Header().Get("X-XSS-Protection"); got != "0" {
			t.Errorf("X-XSS-Protection = %q, want %q", got, "0")
		}
	})

	t.Run("SecurityHeaders_MissingCSP", func(t *testing.T) {
		// Document gap: CSP header is not currently configured in SecurityHeadersMiddleware
		if got := w.Header().Get("Content-Security-Policy"); got != "" {
			t.Errorf("expected Content-Security-Policy to be empty (documented gap), got %q", got)
		}
	})

	t.Run("SecurityHeaders_MissingHSTS", func(t *testing.T) {
		// Document gap: Strict-Transport-Security header is not currently set
		if got := w.Header().Get("Strict-Transport-Security"); got != "" {
			t.Errorf("expected Strict-Transport-Security to be empty (documented gap), got %q", got)
		}
	})

	t.Run("SecurityHeaders_MissingPermissionsPolicy", func(t *testing.T) {
		// Document gap: Permissions-Policy header is not currently set
		if got := w.Header().Get("Permissions-Policy"); got != "" {
			t.Errorf("expected Permissions-Policy to be empty (documented gap), got %q", got)
		}
	})
}
