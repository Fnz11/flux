package services

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/ws"
	gorillawebsocket "github.com/gorilla/websocket"
)

var testUpgrader = gorillawebsocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func dialTestClient(t *testing.T, h *ws.Hub) *gorillawebsocket.Conn {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := ws.NewClient(h, conn)
		h.Register(client)
		go client.WritePump()
		client.ReadPump()
	}))
	t.Cleanup(server.Close)

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	conn, _, err := gorillawebsocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("failed to dial ws server: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	time.Sleep(50 * time.Millisecond)
	return conn
}

func subscribeThroughWS(t *testing.T, conn *gorillawebsocket.Conn, channel string) {
	t.Helper()
	req, _ := json.Marshal(map[string]string{"type": "subscribe", "channel": channel})
	if err := conn.WriteMessage(gorillawebsocket.TextMessage, req); err != nil {
		t.Fatalf("failed to send subscribe: %v", err)
	}
	pong, _ := json.Marshal(map[string]string{"type": "ping"})
	if err := conn.WriteMessage(gorillawebsocket.TextMessage, pong); err != nil {
		t.Fatalf("failed to send ping: %v", err)
	}
	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read pong: %v", err)
	}
	var ack map[string]interface{}
	if err := json.Unmarshal(raw, &ack); err != nil || ack["type"] != "pong" {
		t.Fatalf("expected pong ack, got %v (err %v)", ack, err)
	}
}

func readWSMessage(t *testing.T, conn *gorillawebsocket.Conn) map[string]interface{} {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read message: %v", err)
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("failed to unmarshal message %s: %v", raw, err)
	}
	return parsed
}

type wsMsgReader struct {
	conn    *gorillawebsocket.Conn
	pending [][]byte
}

func (r *wsMsgReader) read(t *testing.T) map[string]interface{} {
	t.Helper()
	for len(r.pending) == 0 {
		r.conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, raw, err := r.conn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message: %v", err)
		}
		for _, part := range bytes.Split(raw, []byte("\n")) {
			if len(bytes.TrimSpace(part)) > 0 {
				r.pending = append(r.pending, part)
			}
		}
	}
	raw := r.pending[0]
	r.pending = r.pending[1:]
	var parsed map[string]interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("failed to unmarshal message %s: %v", raw, err)
	}
	return parsed
}

func TestDispatchTradeConfirmedBroadcastsVaultAndGlobalActivity(t *testing.T) {
	h := ws.NewHub()
	go h.Run()

	conn := dialTestClient(t, h)
	subscribeThroughWS(t, conn, "vault:vault-1")
	subscribeThroughWS(t, conn, "global:activity")

	svc := NewEventService(h, nil)
	svc.DispatchTradeConfirmed("vault-1", "sig-123", "Buy")

	reader := &wsMsgReader{conn: conn}
	first := reader.read(t)
	if first["type"] != "trade_confirmed" {
		t.Fatalf("expected type trade_confirmed, got %v", first["type"])
	}
	second := reader.read(t)
	if second["type"] != "trade_confirmed" {
		t.Fatalf("expected type trade_confirmed, got %v", second["type"])
	}
}

func TestDispatchGlobalLeaderboardBroadcastsToGlobalChannel(t *testing.T) {
	h := ws.NewHub()
	go h.Run()

	svc := NewEventService(h, nil)

	conn := dialTestClient(t, h)
	subscribeThroughWS(t, conn, "global:leaderboard")

	svc.DispatchGlobalLeaderboard()

	msg := readWSMessage(t, conn)
	if msg["type"] != "leaderboard_update" {
		t.Fatalf("expected type leaderboard_update, got %v", msg["type"])
	}
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %v", msg["data"])
	}
	if len(data) != 0 {
		t.Fatalf("expected empty data payload, got %v", data)
	}
}
