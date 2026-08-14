package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type TransactionDraftStatus string

const (
	TxDraftStatusPendingSignature TransactionDraftStatus = "PENDING_SIGNATURE"
	TxDraftStatusSubmitted        TransactionDraftStatus = "SUBMITTED"
	TxDraftStatusConfirmed        TransactionDraftStatus = "CONFIRMED"
	TxDraftStatusFailed           TransactionDraftStatus = "FAILED"
	TxDraftStatusExpired          TransactionDraftStatus = "EXPIRED"
)

type TransactionDraft struct {
	ID                   uuid.UUID              `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserPubkey           string                 `gorm:"type:varchar(64);not null;index" json:"user_pubkey"`
	TxType               string                 `gorm:"type:varchar(32);not null;index" json:"tx_type"` // CREATE_VAULT, DEPOSIT, WITHDRAW
	RelatedEntityID      *uuid.UUID             `gorm:"type:uuid;index" json:"related_entity_id,omitempty"`
	Signature            *string                `gorm:"type:varchar(88);index" json:"signature,omitempty"`
	Status               TransactionDraftStatus `gorm:"type:varchar(32);default:'PENDING_SIGNATURE';not null;index" json:"status"`
	SerializedTx         string                 `gorm:"type:text;not null" json:"serialized_tx"`
	RecentBlockhash      string                 `gorm:"type:varchar(64);not null" json:"recent_blockhash"`
	LastValidBlockHeight uint64                 `gorm:"default:0" json:"last_valid_block_height"`
	Metadata             datatypes.JSON         `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	ExpiresAt            time.Time              `gorm:"not null;index" json:"expires_at"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
	DeletedAt            gorm.DeletedAt         `gorm:"index" json:"-"`
}
