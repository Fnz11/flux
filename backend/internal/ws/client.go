package ws

import (
	"encoding/json"
	"time"

	gorillawebsocket "github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 512
)

type Client struct {
	hub  *Hub
	conn *gorillawebsocket.Conn
	send chan []byte
	user string
}

type inboundMessage struct {
	Type    string `json:"type"`
	Channel string `json:"channel,omitempty"`
}

type outboundMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

func NewClient(hub *Hub, conn *gorillawebsocket.Conn) *Client {
	return &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}
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
		case "subscribe":
			if msg.Channel != "" {
				c.hub.Subscribe(c, msg.Channel)
			}
		case "unsubscribe":
			if msg.Channel != "" {
				c.hub.Unsubscribe(c, msg.Channel)
			}
		case "ping":
			pong, _ := json.Marshal(outboundMessage{Type: "pong", Timestamp: time.Now().Unix()})
			select {
			case c.send <- pong:
			default:
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
