package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/ws"
	gorillawebsocket "github.com/gorilla/websocket"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var upgrader = gorillawebsocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		origins := os.Getenv("CORS_ORIGINS")
		if origins == "" {
			origins = "http://localhost:3000,http://localhost:5173"
		}
		for _, o := range strings.Split(origins, ",") {
			if strings.TrimSpace(o) == origin {
				return true
			}
		}
		return origin == ""
	},
}

type WSHandler struct {
	Hub       *ws.Hub
	JWTSecret string
}

func NewWSHandler(hub *ws.Hub, jwtSecret ...string) *WSHandler {
	secret := ""
	if len(jwtSecret) > 0 {
		secret = jwtSecret[0]
	}
	return &WSHandler{Hub: hub, JWTSecret: secret}
}

func (h *WSHandler) HandleWS(c *gin.Context) {
	tokenString := c.Query("token")
	if tokenString == "" {
		tokenString = c.Query("jwt")
	}
	if tokenString == "" {
		tokenString = c.Query("access_token")
	}
	if tokenString == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		} else {
			tokenString = authHeader
		}
	}
	if tokenString == "" {
		tokenString = c.Request.Header.Get("Sec-WebSocket-Protocol")
	}

	walletAddress := ""
	if tokenString != "" {
		claims, err := middleware.ValidateToken(tokenString, []byte(h.JWTSecret))
		if err == nil && claims != nil {
			walletAddress = claims.WalletAddress
		}
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Error("ws upgrade error")
		return
	}

	client := ws.NewClient(h.Hub, conn, walletAddress)
	h.Hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}

