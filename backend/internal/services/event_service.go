package services

import (
	"encoding/json"
	"time"

	"github.com/fbyt-clone/backend/internal/ws"
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
	msg, _ := json.Marshal(map[string]interface{}{
		"type": "trade_confirmed",
		"data": map[string]interface{}{
			"vault_id":  vaultID,
			"signature": signature,
			"status":    status,
		},
		"timestamp": time.Now().Unix(),
	})
	s.hub.BroadcastToChannel("vault:"+vaultID, msg)
}

func (s *EventService) DispatchVaultUpdate(vaultID string) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type": "vault_update",
		"data": map[string]string{"vault_id": vaultID},
		"timestamp": time.Now().Unix(),
	})
	s.hub.BroadcastToChannel("vault:"+vaultID, msg)
}

func (s *EventService) DispatchPortfolioUpdate(walletAddress string, vaultID string, pnl decimal.Decimal) {
	msg, _ := json.Marshal(map[string]interface{}{
		"type": "portfolio_update",
		"data": map[string]interface{}{
			"wallet_address": walletAddress,
			"vault_id":       vaultID,
			"pnl":            pnl,
		},
		"timestamp": time.Now().Unix(),
	})
	s.hub.BroadcastToChannel("portfolio:"+walletAddress, msg)
}
