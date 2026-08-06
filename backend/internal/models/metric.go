package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type VaultMetric struct {
	ID        uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	VaultID   uuid.UUID       `gorm:"type:uuid;not null;index"`
	Metric    string          `gorm:"type:varchar(32);not null;index"` // tvl, invested, pnl, fees, volume
	Value     decimal.Decimal `gorm:"type:numeric(36,18);not null"`
	Timestamp time.Time       `gorm:"not null;index;default:CURRENT_TIMESTAMP"`
}
