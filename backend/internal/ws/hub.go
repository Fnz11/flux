package ws

import (
	"sync"
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	subscriptions  map[*Client]map[string]bool
	channelClients map[string]map[*Client]bool
	stop       chan struct{}
}

func NewHub() *Hub {
	return &Hub{
		clients:        make(map[*Client]bool),
		broadcast:      make(chan []byte, 256),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		subscriptions:  make(map[*Client]map[string]bool),
		channelClients: make(map[string]map[*Client]bool),
		stop:           make(chan struct{}),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.subscriptions[client] = make(map[string]bool)
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				for channel := range h.subscriptions[client] {
					if clients, ok := h.channelClients[channel]; ok {
						delete(clients, client)
						if len(clients) == 0 {
							delete(h.channelClients, channel)
						}
					}
				}
				delete(h.subscriptions, client)
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
					if subs, ok := h.subscriptions[client]; ok {
						for channel := range subs {
							if clients, ok := h.channelClients[channel]; ok {
								delete(clients, client)
								if len(clients) == 0 {
									delete(h.channelClients, channel)
								}
							}
						}
						delete(h.subscriptions, client)
					}
				}
			}
			h.mu.Unlock()

		case <-h.stop:
			return
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Subscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; !ok {
		return
	}
	if h.subscriptions[client] == nil {
		h.subscriptions[client] = make(map[string]bool)
	}
	h.subscriptions[client][channel] = true

	if h.channelClients[channel] == nil {
		h.channelClients[channel] = make(map[*Client]bool)
	}
	h.channelClients[channel][client] = true
}

func (h *Hub) Unsubscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.subscriptions[client]; ok {
		delete(h.subscriptions[client], channel)
	}
	if clients, ok := h.channelClients[channel]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.channelClients, channel)
		}
	}
}

func (h *Hub) BroadcastToChannel(channel string, message []byte) {
	h.mu.RLock()
	clients, ok := h.channelClients[channel]
	if !ok {
		h.mu.RUnlock()
		return
	}

	targets := make([]*Client, 0, len(clients))
	for client := range clients {
		targets = append(targets, client)
	}
	h.mu.RUnlock()

	for _, client := range targets {
		select {
		case client.send <- message:
		default:
			go h.unregisterClient(client)
		}
	}
}

func (h *Hub) BroadcastToChannels(channels []string, message []byte) {
	for _, channel := range channels {
		h.BroadcastToChannel(channel, message)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.unregister <- client
}

func (h *Hub) Stop() {
	close(h.stop)
	h.mu.Lock()
	defer h.mu.Unlock()
	for client := range h.clients {
		close(client.send)
		client.conn.Close()
	}
	h.clients = make(map[*Client]bool)
	h.subscriptions = make(map[*Client]map[string]bool)
	h.channelClients = make(map[string]map[*Client]bool)
}
