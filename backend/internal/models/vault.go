package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Vault struct {
	ID                uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Address           string         `gorm:"type:varchar(64);uniqueIndex;not null"`
	ManagerID         uuid.UUID      `gorm:"type:uuid;not null;index"`
	Status            string         `gorm:"type:varchar(20);default:'Active';not null"`
	Metadata          datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	PerformanceFeeBps int            `gorm:"not null;default:0"`
	ManagementFeeBps  int            `gorm:"not null;default:0"`
	TVL               float64        `gorm:"type:numeric(36,18);default:0.0"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
	DeletedAt         gorm.DeletedAt `gorm:"index"`
	Manager           User           `gorm:"foreignKey:ManagerID"`
	Portfolios        []Portfolio    `gorm:"foreignKey:VaultID"`
	Trades            []TradeHistory `gorm:"foreignKey:VaultID"`
}

type VaultResponse struct {
	ID                string          `json:"id"`
	Address           string          `json:"address"`
	ManagerID         string          `json:"manager_id"`
	ManagerAddress    string          `json:"manager_address"`
	Status            string          `json:"status"`
	Metadata          json.RawMessage `json:"metadata"`
	PerformanceFeeBps int             `json:"performance_fee_bps"`
	ManagementFeeBps  int             `json:"management_fee_bps"`
	TVL               float64         `json:"tvl"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

func ToVaultResponse(v *Vault) VaultResponse {
	var meta json.RawMessage
	if v.Metadata != nil {
		meta = json.RawMessage(v.Metadata)
	}
	managerAddress := ""
	if v.Manager.WalletAddress != "" {
		managerAddress = v.Manager.WalletAddress
	}
	return VaultResponse{
		ID:                v.ID.String(),
		Address:           v.Address,
		ManagerID:         v.ManagerID.String(),
		ManagerAddress:    managerAddress,
		Status:            v.Status,
		Metadata:          meta,
		PerformanceFeeBps: v.PerformanceFeeBps,
		ManagementFeeBps:  v.ManagementFeeBps,
		TVL:               v.TVL,
		CreatedAt:         v.CreatedAt,
		UpdatedAt:         v.UpdatedAt,
	}
}
