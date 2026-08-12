package ws

import (
	"sync"
	"testing"
	"time"
)

const testWallet = "0xwallet1"
const otherWallet = "0xwallet2"

func registerTestClient(t *testing.T, h *Hub, wallet string) *Client {
	t.Helper()
	c := NewClient(h, nil, wallet)
	h.Register(c)
	time.Sleep(10 * time.Millisecond)
	t.Cleanup(func() {
		h.Unregister(c)
	})
	return c
}

func readSend(t *testing.T, c *Client) []byte {
	t.Helper()
	select {
	case msg := <-c.send:
		return msg
	case <-time.After(time.Second):
		t.Fatalf("client %s did not receive message", c.walletAddress)
		return nil
	}
}

func assertNoMessage(t *testing.T, c *Client) {
	t.Helper()
	select {
	case msg := <-c.send:
		t.Fatalf("client %s received unexpected message: %s", c.walletAddress, msg)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestHub_BroadcastToUserDeliversNotification(t *testing.T) {
	h := NewHub()
	go h.Run()

	client := registerTestClient(t, h, testWallet)
	h.Subscribe(client, "user:"+testWallet)

	payload := []byte(`{"type":"notification","data":{"message":"trade executed"},"timestamp":123}`)
	h.BroadcastToUser(testWallet, payload)

	got := readSend(t, client)
	if string(got) != string(payload) {
		t.Fatalf("expected message %s, got %s", payload, got)
	}
}

func TestHub_BroadcastToChannelDeliversToSubscribedWallet(t *testing.T) {
	h := NewHub()
	go h.Run()

	client := registerTestClient(t, h, testWallet)
	h.Subscribe(client, "user:"+testWallet)

	payload := []byte(`{"type":"notification","data":{"message":"vault updated"},"timestamp":456}`)
	h.BroadcastToChannel("user:"+testWallet, payload)

	got := readSend(t, client)
	if string(got) != string(payload) {
		t.Fatalf("expected message %s, got %s", payload, got)
	}
}

func TestHub_BroadcastToUserDoesNotDeliverToOtherWallet(t *testing.T) {
	h := NewHub()
	go h.Run()

	subscribed := registerTestClient(t, h, testWallet)
	h.Subscribe(subscribed, "user:"+testWallet)

	other := registerTestClient(t, h, otherWallet)
	h.Subscribe(other, "user:"+otherWallet)

	h.BroadcastToUser(testWallet, []byte(`{"type":"notification","data":{},"timestamp":1}`))

	readSend(t, subscribed)
	assertNoMessage(t, other)
}

func TestHub_BroadcastToChannelNotDeliveredToWrongWallet(t *testing.T) {
	h := NewHub()
	go h.Run()

	wallet1 := registerTestClient(t, h, testWallet)
	wallet2 := registerTestClient(t, h, otherWallet)

	h.Subscribe(wallet2, "user:"+otherWallet)
	h.Subscribe(wallet1, "user:"+testWallet)

	h.BroadcastToChannel("user:"+testWallet, []byte(`{"type":"notification","data":{},"timestamp":2}`))

	readSend(t, wallet1)
	assertNoMessage(t, wallet2)
}

func TestHub_BroadcastToUserUnregisteredClientDoesNotPanic(t *testing.T) {
	h := NewHub()
	go h.Run()

	client := registerTestClient(t, h, testWallet)
	h.Subscribe(client, "user:"+testWallet)
	h.Unregister(client)

	h.BroadcastToUser(testWallet, []byte(`{"type":"notification","data":{},"timestamp":3}`))
}

func TestHub_ConcurrentClientsBroadcastNoPanic(t *testing.T) {
	h := NewHub()
	go h.Run()

	const n = 20
	clients := make([]*Client, n)
	for i := 0; i < n; i++ {
		wallet := testWallet
		if i%2 == 1 {
			wallet = otherWallet
		}
		clients[i] = registerTestClient(t, h, wallet)
		h.Subscribe(clients[i], "user:"+wallet)
	}

	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			wallet := testWallet
			if i%2 == 1 {
				wallet = otherWallet
			}
			h.BroadcastToUser(wallet, []byte(`{"type":"notification","data":{},"timestamp":4}`))
		}(i)
	}
	wg.Wait()

	delivered := 0
	for _, c := range clients {
		select {
		case <-c.send:
			delivered++
		case <-time.After(100 * time.Millisecond):
		}
	}
	if delivered < n/2 {
		t.Fatalf("expected at least half of clients to receive a message, got %d", delivered)
	}
}

func TestClient_CanSubscribe(t *testing.T) {
	c := NewClient(nil, nil, testWallet)

	tests := []struct {
		name    string
		channel string
		want    bool
	}{
		{"own user channel", "user:" + testWallet, true},
		{"own user channel case-insensitive", "USER:" + testWallet, true},
		{"other user channel", "user:" + otherWallet, false},
		{"own portfolio channel", "portfolio:" + testWallet, true},
		{"other portfolio channel", "portfolio:" + otherWallet, false},
		{"own wallet channel", "wallet:" + testWallet, true},
		{"other wallet channel", "wallet:" + otherWallet, false},
		{"global channel", "vault:vault-1", true},
		{"empty wallet client global channel", "vault:vault-1", true},
		{"global activity channel", "global:activity", true},
		{"global leaderboard channel", "global:leaderboard", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := c.canSubscribe(tt.channel)
			if got != tt.want {
				t.Fatalf("canSubscribe(%q) = %v, want %v", tt.channel, got, tt.want)
			}
		})
	}
}

func TestClient_CanSubscribeEmptyWallet(t *testing.T) {
	c := NewClient(nil, nil)

	if c.canSubscribe("user:" + testWallet) {
		t.Fatalf("empty-wallet client must not subscribe to user channel")
	}
	if !c.canSubscribe("vault:vault-1") {
		t.Fatalf("empty-wallet client must subscribe to global channels")
	}
	if !c.canSubscribe("global:activity") {
		t.Fatalf("empty-wallet client must subscribe to global:activity channel")
	}
	if !c.canSubscribe("global:leaderboard") {
		t.Fatalf("empty-wallet client must subscribe to global:leaderboard channel")
	}
}

func TestHub_GlobalActivityBroadcastToChannel(t *testing.T) {
	h := NewHub()
	go h.Run()

	client := registerTestClient(t, h, "")
	h.Subscribe(client, "global:activity")

	payload := []byte(`{"type":"trade_confirmed","data":{"vault_id":"vault-1"},"timestamp":789}`)
	h.BroadcastToChannel("global:activity", payload)

	got := readSend(t, client)
	if string(got) != string(payload) {
		t.Fatalf("expected message %s, got %s", payload, got)
	}
}

func TestHub_GlobalChannelsBroadcastToChannels(t *testing.T) {
	h := NewHub()
	go h.Run()

	client := registerTestClient(t, h, "")
	h.Subscribe(client, "global:activity")
	h.Subscribe(client, "global:leaderboard")

	payload := []byte(`{"type":"leaderboard_update","data":{},"timestamp":0}`)
	h.BroadcastToChannels([]string{"global:activity", "global:leaderboard"}, payload)

	if got := readSend(t, client); string(got) != string(payload) {
		t.Fatalf("expected message %s on global:activity, got %s", payload, got)
	}
	if got := readSend(t, client); string(got) != string(payload) {
		t.Fatalf("expected message %s on global:leaderboard, got %s", payload, got)
	}
}

func TestClient_CanSubscribePrefixContainment(t *testing.T) {
	c := NewClient(nil, nil, testWallet)

	if c.canSubscribe("user:" + testWallet + ":subchannel") {
		t.Fatalf("channel with extra suffix must not be authorized")
	}
}
