package models

import (
	"time"

	"github.com/google/uuid"
)

type TradeHistory struct {
	ID                   uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	VaultID              uuid.UUID `gorm:"type:uuid;not null;index"`
	ActorID              uuid.UUID `gorm:"type:uuid;not null;index"`
	TransactionSignature string    `gorm:"type:varchar(100);uniqueIndex;not null"`
	TradeType            string    `gorm:"type:varchar(20);not null;index"`
	InputToken           string    `gorm:"type:varchar(32)"`
	OutputToken          string    `gorm:"type:varchar(32)"`
	AmountIn             float64   `gorm:"type:numeric(36,18)"`
	AmountOut            float64   `gorm:"type:numeric(36,18)"`
	PriceAtExecution     float64   `gorm:"type:numeric(36,18)"`
	ExecutedAt           time.Time `gorm:"index;default:CURRENT_TIMESTAMP"`
	Vault                Vault     `gorm:"foreignKey:VaultID"`
	Actor                User      `gorm:"foreignKey:ActorID"`
}
