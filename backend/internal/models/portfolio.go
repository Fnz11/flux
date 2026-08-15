package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type Portfolio struct {
	ID                 uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID             uuid.UUID       `gorm:"type:uuid;not null;uniqueIndex:idx_user_vault"`
	VaultID            uuid.UUID       `gorm:"type:uuid;not null;uniqueIndex:idx_user_vault"`
	SharesOwned        decimal.Decimal `gorm:"type:numeric(36,18);default:0.0"`
	TotalInvestedValue decimal.Decimal `gorm:"type:numeric(36,18);default:0.0"`
	AverageEntryPrice  decimal.Decimal `gorm:"type:numeric(36,18);default:0.0"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
	User               User  `gorm:"foreignKey:UserID"`
	Vault              Vault `gorm:"foreignKey:VaultID"`
}
