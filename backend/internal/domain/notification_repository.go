package domain

import (
	"context"
	"time"
)

type Notification struct {
	ID        string
	UserID    string
	Type      string
	Title     string
	Message   string
	ReadAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type NotificationRepository interface {
	Create(ctx context.Context, n *Notification) error
	List(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]Notification, int64, error)
	CountUnread(ctx context.Context, userID string) (int64, error)
	MarkAllRead(ctx context.Context, userID string) error
}
