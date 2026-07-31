package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	WalletAddress string         `gorm:"type:varchar(64);uniqueIndex;not null"`
	Nonce         string         `gorm:"type:varchar(255)"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	ManagedVaults []Vault     `gorm:"foreignKey:ManagerID"`
	Portfolios    []Portfolio `gorm:"foreignKey:UserID"`
}
