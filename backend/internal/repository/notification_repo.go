package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	notificationSelect = `
SELECT id, user_id, type, title, message, read_at, created_at, updated_at
FROM notifications `

	notificationCount = `
SELECT COUNT(*)
FROM notifications `

	notificationOrderPagination = `
ORDER BY created_at DESC LIMIT ? OFFSET ?`
)

type notificationRepo struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) domain.NotificationRepository {
	return &notificationRepo{db: db}
}

func (r *notificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	userID, err := uuid.Parse(n.UserID)
	if err != nil {
		return fmt.Errorf("invalid user id %q: %w", n.UserID, err)
	}

	m := models.Notification{
		UserID:    userID,
		Type:      n.Type,
		Title:     n.Title,
		Message:   n.Message,
		ReadAt:    n.ReadAt,
		CreatedAt: n.CreatedAt,
		UpdatedAt: n.UpdatedAt,
	}

	if err := getDB(ctx, r.db).Create(&m).Error; err != nil {
		return err
	}
	n.ID = m.ID.String()
	n.CreatedAt = m.CreatedAt
	n.UpdatedAt = m.UpdatedAt
	return nil
}

func (r *notificationRepo) List(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]domain.Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid user id %q: %w", userID, err)
	}

	where := "WHERE user_id = ?"
	args := []interface{}{uid}
	if unreadOnly {
		where += " AND read_at IS NULL"
	}

	db := getDB(ctx, r.db)

	var total int64
	if err := db.Raw(notificationCount+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	queryArgs := append(append([]interface{}{}, args...), limit, (page-1)*limit)
	var rows []models.Notification
	if err := db.Raw(notificationSelect+where+notificationOrderPagination, queryArgs...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	notifications := make([]domain.Notification, len(rows))
	for i, row := range rows {
		notifications[i] = notificationFromModel(&row)
	}
	return notifications, total, nil
}

func (r *notificationRepo) CountUnread(ctx context.Context, userID string) (int64, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user id %q: %w", userID, err)
	}

	var total int64
	err = getDB(ctx, r.db).Raw(
		`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL`,
		uid,
	).Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *notificationRepo) MarkAllRead(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id %q: %w", userID, err)
	}
	return getDB(ctx, r.db).Exec(
		`UPDATE notifications SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL`,
		uid,
	).Error
}

func notificationFromModel(m *models.Notification) domain.Notification {
	var readAt *time.Time
	if m.ReadAt != nil {
		t := *m.ReadAt
		readAt = &t
	}
	return domain.Notification{
		ID:        m.ID.String(),
		UserID:    m.UserID.String(),
		Type:      m.Type,
		Title:     m.Title,
		Message:   m.Message,
		ReadAt:    readAt,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}