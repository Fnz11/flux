package models

import (
	"time"

	"github.com/google/uuid"
)

type Portfolio struct {
	ID                 uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID             uuid.UUID `gorm:"type:uuid;not null;index"`
	VaultID            uuid.UUID `gorm:"type:uuid;not null;index"`
	SharesOwned        float64   `gorm:"type:numeric(36,18);default:0.0"`
	TotalInvestedValue float64   `gorm:"type:numeric(36,18);default:0.0"`
	AverageEntryPrice  float64   `gorm:"type:numeric(36,18);default:0.0"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
	User               User  `gorm:"foreignKey:UserID"`
	Vault              Vault `gorm:"foreignKey:VaultID"`
}
