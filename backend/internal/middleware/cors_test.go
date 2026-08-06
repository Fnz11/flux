package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("CORS_AllowedOrigin", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "http://localhost:3000" {
			t.Errorf("Access-Control-Allow-Origin = %q, want %q", acao, "http://localhost:3000")
		}
		if credentials := w.Header().Get("Access-Control-Allow-Credentials"); credentials != "true" {
			t.Errorf("Access-Control-Allow-Credentials = %q, want %q", credentials, "true")
		}
	})

	t.Run("CORS_PreflightOptions", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.OPTIONS("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")

		r.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("status = %d, want %d (204 No Content)", w.Code, http.StatusNoContent)
		}
		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "http://localhost:3000" {
			t.Errorf("Access-Control-Allow-Origin = %q, want %q", acao, "http://localhost:3000")
		}
	})

	t.Run("CORS_NonCORSRequest", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		// No Origin header set

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "" {
			t.Errorf("Access-Control-Allow-Origin should be empty for non-CORS request, got %q", acao)
		}
	})

	t.Run("CORS_UnknownOrigin", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "http://evil.com")

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "" {
			t.Errorf("Access-Control-Allow-Origin should be empty for disallowed origin, got %q", acao)
		}
	})

	t.Run("CORS_WildcardNotUsed", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		originsToTest := []string{"http://localhost:3000", "http://localhost:5173", "http://evil.com", ""}
		for _, o := range originsToTest {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			if o != "" {
				req.Header.Set("Origin", o)
			}
			r.ServeHTTP(w, req)

			if acao := w.Header().Get("Access-Control-Allow-Origin"); acao == "*" {
				t.Errorf("Access-Control-Allow-Origin must never return '*', got '*' for origin %q", o)
			}
		}
	})

	t.Run("CORS_NullOriginBypass", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "null")

		r.ServeHTTP(w, req)

		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "" {
			t.Errorf("Access-Control-Allow-Origin should be empty for 'null' origin, got %q", acao)
		}
	})

	t.Run("CORS_BothPortsAllowed", func(t *testing.T) {
		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		for _, portOrigin := range []string{"http://localhost:3000", "http://localhost:5173"} {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Origin", portOrigin)

			r.ServeHTTP(w, req)

			if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != portOrigin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", acao, portOrigin)
			}
		}
	})

	t.Run("CORS_CustomOriginsEnv", func(t *testing.T) {
		os.Setenv("CORS_ORIGINS", "https://app.example.com, https://admin.example.com")
		defer os.Unsetenv("CORS_ORIGINS")

		r := gin.New()
		r.Use(CORSMiddleware())
		r.GET("/test", func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", "https://app.example.com")

		r.ServeHTTP(w, req)

		if acao := w.Header().Get("Access-Control-Allow-Origin"); acao != "https://app.example.com" {
			t.Errorf("Access-Control-Allow-Origin = %q, want %q", acao, "https://app.example.com")
		}
	})
}
