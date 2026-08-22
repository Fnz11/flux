package ws

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/middleware"
	gorillawebsocket "github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 65536
)

type Client struct {
	hub           *Hub
	conn          *gorillawebsocket.Conn
	send          chan []byte
	user          string
	walletAddress string
	jwtSecret     string
}

type inboundMessage struct {
	Type     string      `json:"type"`
	Channel  string      `json:"channel,omitempty"`
	Channels []string    `json:"channels,omitempty"`
	Token    string      `json:"token,omitempty"`
	Wallet   string      `json:"wallet,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}

type outboundMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

func NewClient(hub *Hub, conn *gorillawebsocket.Conn, walletAddress ...string) *Client {
	addr := ""
	if len(walletAddress) > 0 {
		addr = walletAddress[0]
	}
	return &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		user:          addr,
		walletAddress: addr,
	}
}

func (c *Client) SetJWTSecret(secret string) {
	c.jwtSecret = secret
}

func (c *Client) WalletAddress() string {
	return c.walletAddress
}

func (c *Client) canSubscribe(channel string) bool {
	for _, prefix := range []string{"portfolio:", "user:", "wallet:"} {
		if strings.HasPrefix(channel, prefix) {
			target := strings.TrimPrefix(channel, prefix)
			return c.walletAddress != "" && strings.EqualFold(target, c.walletAddress)
		}
	}
	return true
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if gorillawebsocket.IsUnexpectedCloseError(err, gorillawebsocket.CloseGoingAway, gorillawebsocket.CloseNormalClosure) {
				logrus.WithError(err).Warn("ws read error")
			}
			break
		}

		var msg inboundMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "auth", "authenticate":
			if msg.Token != "" && c.jwtSecret != "" {
				claims, err := middleware.ValidateToken(msg.Token, []byte(c.jwtSecret))
				if err == nil && claims != nil {
					c.walletAddress = claims.WalletAddress
					c.user = claims.WalletAddress
				}
			} else if msg.Wallet != "" {
				c.walletAddress = msg.Wallet
				c.user = msg.Wallet
			}
			authResp, _ := json.Marshal(outboundMessage{
				Type:      "auth_ok",
				Data:      map[string]string{"wallet": c.walletAddress},
				Timestamp: time.Now().Unix(),
			})
			select {
			case c.send <- authResp:
			default:
			}
		case "subscribe":
			var targetChannels []string
			if len(msg.Channels) > 0 {
				targetChannels = append(targetChannels, msg.Channels...)
			}
			if msg.Channel != "" {
				for _, ch := range strings.Split(msg.Channel, ",") {
					ch = strings.TrimSpace(ch)
					if ch != "" {
						targetChannels = append(targetChannels, ch)
					}
				}
			}

			if len(targetChannels) > 0 {
				if msg.Token != "" && c.jwtSecret != "" {
					claims, err := middleware.ValidateToken(msg.Token, []byte(c.jwtSecret))
					if err == nil && claims != nil {
						c.walletAddress = claims.WalletAddress
						c.user = claims.WalletAddress
					}
				} else if msg.Wallet != "" && c.walletAddress == "" {
					c.walletAddress = msg.Wallet
					c.user = msg.Wallet
				}

				for _, ch := range targetChannels {
					if c.canSubscribe(ch) {
						c.hub.Subscribe(c, ch)
					} else {
						errResp, _ := json.Marshal(outboundMessage{
							Type:      "error",
							Data:      "unauthorized subscription channel: " + ch,
							Timestamp: time.Now().Unix(),
						})
						select {
						case c.send <- errResp:
						default:
						}
					}
				}
			}
		case "unsubscribe":
			var targetChannels []string
			if len(msg.Channels) > 0 {
				targetChannels = append(targetChannels, msg.Channels...)
			}
			if msg.Channel != "" {
				for _, ch := range strings.Split(msg.Channel, ",") {
					ch = strings.TrimSpace(ch)
					if ch != "" {
						targetChannels = append(targetChannels, ch)
					}
				}
			}
			for _, ch := range targetChannels {
				c.hub.Unsubscribe(c, ch)
			}
		case "ping":
			pong, _ := json.Marshal(outboundMessage{Type: "pong", Timestamp: time.Now().Unix()})
			select {
			case c.send <- pong:
			default:
			}
		case "publish", "broadcast":
			if msg.Channel != "" {
				outMsg, _ := json.Marshal(outboundMessage{
					Type:      msg.Type,
					Data:      msg.Data,
					Timestamp: time.Now().Unix(),
				})
				c.hub.BroadcastToChannel(msg.Channel, outMsg)
			}
		case "trade_confirmed", "portfolio_update", "portfolio_summary_update", "vault_update", "leaderboard_update":
			outMsg, _ := json.Marshal(outboundMessage{
				Type:      msg.Type,
				Data:      msg.Data,
				Timestamp: time.Now().Unix(),
			})
			if msg.Channel != "" {
				c.hub.BroadcastToChannel(msg.Channel, outMsg)
			} else {
				switch msg.Type {
				case "trade_confirmed":
					c.hub.BroadcastToChannel("global:activity", outMsg)
					if dataMap, ok := msg.Data.(map[string]interface{}); ok {
						if vaultID, ok := dataMap["vault_id"].(string); ok && vaultID != "" {
							c.hub.BroadcastToChannel("vault:"+vaultID, outMsg)
						}
						if wallet, ok := dataMap["wallet"].(string); ok && wallet != "" {
							c.hub.BroadcastToChannel("user:"+wallet, outMsg)
						}
					}
				case "portfolio_update", "portfolio_summary_update":
					if dataMap, ok := msg.Data.(map[string]interface{}); ok {
						wallet, _ := dataMap["wallet_address"].(string)
						if wallet == "" {
							wallet, _ = dataMap["wallet"].(string)
						}
						if wallet != "" {
							c.hub.BroadcastToChannel("portfolio:"+wallet, outMsg)
							c.hub.BroadcastToChannel("user:"+wallet, outMsg)
						}
					}
				case "leaderboard_update":
					c.hub.BroadcastToChannel("global:leaderboard", outMsg)
				case "vault_update":
					if dataMap, ok := msg.Data.(map[string]interface{}); ok {
						if vaultID, ok := dataMap["vault_id"].(string); ok && vaultID != "" {
							c.hub.BroadcastToChannel("vault:"+vaultID, outMsg)
						}
					}
				}
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(gorillawebsocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(gorillawebsocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(gorillawebsocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
