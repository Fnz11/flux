
package models

import (
	"time"
	"[github.com/google/uuid](https://github.com/google/uuid)"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	WalletAddress string    `gorm:"type:varchar(64);uniqueIndex;not null"`
	Nonce         string    `gorm:"type:varchar(255)"`
	CreatedAt     time.Time
	UpdatedAt     time.Time

    // Relationships
	ManagedVaults []Vault`gorm:"foreignKey:ManagerID"`
	Portfolios    []Portfolio `gorm:"foreignKey:UserID"`
}

type Vault struct {
	ID                 uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Address            string         `gorm:"type:varchar(64);uniqueIndex;not null"`
	ManagerID          uuid.UUID      `gorm:"type:uuid;not null;index"`
	Status             string         `gorm:"type:varchar(20);default:'Active';not null"`
	Metadata           datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	PerformanceFeeBps  int            `gorm:"not null;default:0"`
	ManagementFeeBps   int            `gorm:"not null;default:0"`
	TVL                float64        `gorm:"type:numeric(36,18);default:0.0"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
	DeletedAt          gorm.DeletedAt `gorm:"index"`

    // Relationships
	Manager            User`gorm:"foreignKey:ManagerID"`
	Portfolios         []Portfolio    `gorm:"foreignKey:VaultID"`
	Trades             []TradeHistory `gorm:"foreignKey:VaultID"`
}

type Portfolio struct {
	ID                 uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID             uuid.UUID `gorm:"type:uuid;not null;index"`
	VaultID            uuid.UUID `gorm:"type:uuid;not null;index"`
	SharesOwned        float64   `gorm:"type:numeric(36,18);default:0.0"`
	TotalInvestedValue float64   `gorm:"type:numeric(36,18);default:0.0"`
	AverageEntryPrice  float64   `gorm:"type:numeric(36,18);default:0.0"`
	CreatedAt          time.Time
	UpdatedAt          time.Time

    // Relationships
	User               User`gorm:"foreignKey:UserID"`
	Vault              Vault `gorm:"foreignKey:VaultID"`
}

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

    // Relationships
	Vault                Vault`gorm:"foreignKey:VaultID"`
	Actor                User  `gorm:"foreignKey:ActorID"`
}
