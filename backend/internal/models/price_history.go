package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type PriceHistory struct {
	ID        uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	VaultID   uuid.UUID       `gorm:"type:uuid;not null;index"`
	Token     string          `gorm:"type:varchar(32);not null;index"`
	Price     decimal.Decimal `gorm:"type:numeric(36,18);not null"`
	Volume    decimal.Decimal `gorm:"type:numeric(36,18);default:0.0"`
	FetchedAt time.Time `gorm:"not null;index;default:CURRENT_TIMESTAMP"`
	Vault     Vault     `gorm:"foreignKey:VaultID"`
}
