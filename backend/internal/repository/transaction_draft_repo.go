package repository

import (
	"context"
	"errors"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormTransactionDraftRepository struct {
	db *gorm.DB
}

func NewGormTransactionDraftRepository(db *gorm.DB) *GormTransactionDraftRepository {
	return &GormTransactionDraftRepository{db: db}
}

var _ domain.TransactionDraftRepository = (*GormTransactionDraftRepository)(nil)

func (r *GormTransactionDraftRepository) Create(ctx context.Context, draft *models.TransactionDraft) error {
	if draft == nil {
		return errors.New("draft cannot be nil")
	}
	return r.db.WithContext(ctx).Create(draft).Error
}

func (r *GormTransactionDraftRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.TransactionDraft, error) {
	var draft models.TransactionDraft
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&draft).Error
	if err != nil {
		return nil, err
	}
	return &draft, nil
}

func (r *GormTransactionDraftRepository) GetBySignature(ctx context.Context, sig string) (*models.TransactionDraft, error) {
	var draft models.TransactionDraft
	err := r.db.WithContext(ctx).Where("signature = ?", sig).First(&draft).Error
	if err != nil {
		return nil, err
	}
	return &draft, nil
}

func (r *GormTransactionDraftRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.TransactionDraftStatus, signature *string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().UTC(),
	}
	if signature != nil && *signature != "" {
		updates["signature"] = *signature
	}
	return r.db.WithContext(ctx).Model(&models.TransactionDraft{}).Where("id = ?", id).Updates(updates).Error
}

func (r *GormTransactionDraftRepository) ListPendingByUser(ctx context.Context, userPubkey string) ([]models.TransactionDraft, error) {
	var drafts []models.TransactionDraft
	err := r.db.WithContext(ctx).
		Where("user_pubkey = ? AND status = ? AND expires_at > ?", userPubkey, models.TxDraftStatusPendingSignature, time.Now().UTC()).
		Order("created_at desc").
		Find(&drafts).Error
	return drafts, err
}
