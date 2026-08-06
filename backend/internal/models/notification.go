package models

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null"`
	Type      string    `gorm:"type:varchar(32);not null"`
	Title     string    `gorm:"type:varchar(255);not null"`
	Message   string    `gorm:"type:text;not null;default:''"`
	ReadAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type NotificationResponse struct {
	ID        string     `json:"id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Read      bool       `json:"read"`
	CreatedAt time.Time  `json:"created_at"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
}
