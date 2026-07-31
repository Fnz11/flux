package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/fbyt-clone/backend/internal/ws"
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
	Hub *ws.Hub
}

func NewWSHandler(hub *ws.Hub) *WSHandler {
	return &WSHandler{Hub: hub}
}

func (h *WSHandler) HandleWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Error("ws upgrade error")
		return
	}

	client := ws.NewClient(h.Hub, conn)
	h.Hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
