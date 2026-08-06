package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type TradeHistory struct {
	ID                   uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	VaultID              uuid.UUID       `gorm:"type:uuid;not null;index"`
	ActorID              uuid.UUID       `gorm:"type:uuid;not null;index"`
	TransactionSignature string          `gorm:"type:varchar(100);uniqueIndex;not null"`
	TradeType            string          `gorm:"type:varchar(20);not null;index"`
	InputToken           string          `gorm:"type:varchar(32)"`
	OutputToken          string          `gorm:"type:varchar(32)"`
	AmountIn             decimal.Decimal `gorm:"type:numeric(36,18)"`
	AmountOut            decimal.Decimal `gorm:"type:numeric(36,18)"`
	PriceAtExecution     decimal.Decimal `gorm:"type:numeric(36,18)"`
	ExecutedAt           time.Time `gorm:"index;default:CURRENT_TIMESTAMP"`
	Vault                Vault     `gorm:"foreignKey:VaultID"`
	Actor                User      `gorm:"foreignKey:ActorID"`
}
