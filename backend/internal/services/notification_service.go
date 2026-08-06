package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/flux-protocol/backend/internal/ws"
)

type NotificationService struct {
	repo domain.NotificationRepository
	hub  *ws.Hub
}

func NewNotificationService(repo domain.NotificationRepository, hub *ws.Hub) *NotificationService {
	return &NotificationService{repo: repo, hub: hub}
}

// notificationPush is the outbound WS payload pushed to channel user:<wallet>.
// It mirrors ws.outboundMessage: {"type":"notification","data":{...},"timestamp":<unix>}.
type notificationPush struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

func (s *NotificationService) Create(ctx context.Context, userID, wallet, typ, title, message string) error {
	n := &domain.Notification{
		UserID:  userID,
		Type:    typ,
		Title:   title,
		Message: message,
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return err
	}

	if s.hub != nil {
		msg, _ := json.Marshal(notificationPush{
			Type: "notification",
			Data: models.NotificationResponse{
				ID:      n.ID,
				Type:    n.Type,
				Title:   n.Title,
				Message: n.Message,
				Read:    n.ReadAt != nil,
			},
			Timestamp: time.Now().Unix(),
		})
		s.hub.BroadcastToChannels([]string{"user:" + wallet, "user:" + userID}, msg)
	}
	return nil
}

func (s *NotificationService) List(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]models.NotificationResponse, int64, int, error) {
	items, total, err := s.repo.List(ctx, userID, unreadOnly, page, limit)
	if err != nil {
		return nil, 0, 0, err
	}

	unread, err := s.repo.CountUnread(ctx, userID)
	if err != nil {
		return nil, 0, 0, err
	}

	resp := make([]models.NotificationResponse, len(items))
	for i, n := range items {
		resp[i] = models.NotificationResponse{
			ID:        n.ID,
			Type:      n.Type,
			Title:     n.Title,
			Message:   n.Message,
			Read:      n.ReadAt != nil,
			CreatedAt: n.CreatedAt,
			ReadAt:    n.ReadAt,
		}
	}
	return resp, total, int(unread), nil
}
