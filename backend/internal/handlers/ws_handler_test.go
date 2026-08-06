package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fbyt-clone/backend/internal/middleware"
	"github.com/fbyt-clone/backend/internal/ws"
	"github.com/gin-gonic/gin"
)

func TestWSHandler_JWTAuthAndOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	secret := "test-jwt-secret-key-32-bytes!!"
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Stop()

	handler := NewWSHandler(hub, secret)

	validToken, err := middleware.GenerateToken("0x1234567890abcdef", []byte(secret))
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	t.Run("WS_ConnectWithQueryToken", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws?token="+validToken, nil)
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusUnauthorized {
			t.Fatalf("expected connect allowed, got 401")
		}
	})

	t.Run("WS_ConnectWithJWTParam", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws?jwt="+validToken, nil)
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusUnauthorized {
			t.Fatalf("expected connect allowed, got 401")
		}
	})

	t.Run("WS_ConnectWithAccessToken", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws?access_token="+validToken, nil)
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusUnauthorized {
			t.Fatalf("expected connect allowed, got 401")
		}
	})

	t.Run("WS_ConnectWithBearerHeader", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws", nil)
		c.Request.Header.Set("Authorization", "Bearer "+validToken)
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusUnauthorized {
			t.Fatalf("expected connect allowed, got 401")
		}
	})

	t.Run("WS_DisallowedOrigin", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws?token="+validToken, nil)
		c.Request.Header.Set("Origin", "http://evil.com")
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusOK || w.Code == http.StatusSwitchingProtocols {
			t.Fatalf("expected disallowed origin to be rejected")
		}
	})

	t.Run("WS_AllowedOrigin", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)
		r.GET("/api/v1/ws", handler.HandleWS)

		c.Request = httptest.NewRequest("GET", "/api/v1/ws?token="+validToken, nil)
		c.Request.Header.Set("Origin", "http://localhost:3000")
		c.Request.Header.Set("Connection", "upgrade")
		c.Request.Header.Set("Upgrade", "websocket")

		r.ServeHTTP(w, c.Request)

		if w.Code == http.StatusForbidden {
			t.Fatalf("expected localhost:3000 origin to be allowed")
		}
	})
}
