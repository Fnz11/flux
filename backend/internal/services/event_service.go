package services

import (
	"encoding/json"
	"time"

	"github.com/flux-protocol/backend/internal/ws"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type EventService struct {
	hub *ws.Hub
	db  *gorm.DB
}

func NewEventService(hub *ws.Hub, db *gorm.DB) *EventService {
	return &EventService{hub: hub, db: db}
}

func (s *EventService) DispatchTradeConfirmed(vaultID string, signature string, status string) {
	broadcast := func(channel string) {
		msg, _ := json.Marshal(map[string]interface{}{
			"type":      "trade_confirmed",
			"channel":   channel,
			"data": map[string]interface{}{
				"vault_id":  vaultID,
				"signature": signature,
				"status":    status,
			},
			"timestamp": time.Now().Unix(),
		})
		s.hub.BroadcastToChannel(channel, msg)
	}

	broadcast("vault:" + vaultID + ":activity")
	broadcast("vault:" + vaultID)
	broadcast("global:activity")
}

func (s *EventService) DispatchGlobalLeaderboard() {
	msg, _ := json.Marshal(map[string]interface{}{
		"type":      "leaderboard_update",
		"channel":   "global:leaderboard",
		"data":      map[string]interface{}{},
		"timestamp": time.Now().Unix(),
	})
	s.hub.BroadcastToChannel("global:leaderboard", msg)
}

func (s *EventService) DispatchVaultUpdate(vaultID string) {
	broadcast := func(channel string) {
		msg, _ := json.Marshal(map[string]interface{}{
			"type":      "vault_portfolio_update",
			"channel":   channel,
			"data":      map[string]string{"vault_id": vaultID},
			"timestamp": time.Now().Unix(),
		})
		s.hub.BroadcastToChannel(channel, msg)
	}

	broadcast("vault:" + vaultID + ":portfolio")
	broadcast("vault:" + vaultID)
}

func (s *EventService) DispatchPortfolioUpdate(walletAddress string, vaultID string, pnl decimal.Decimal) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type":    "portfolio_update",
		"channel": "portfolio:" + walletAddress,
		"data": map[string]interface{}{
			"wallet_address": walletAddress,
			"vault_id":       vaultID,
			"pnl":            pnl,
		},
		"timestamp": time.Now().Unix(),
	})
	s.hub.BroadcastToChannel("portfolio:"+walletAddress, msg)
}
