package domain

import (
	"context"

	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
)

type TransactionDraftRepository interface {
	Create(ctx context.Context, draft *models.TransactionDraft) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.TransactionDraft, error)
	GetBySignature(ctx context.Context, sig string) (*models.TransactionDraft, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.TransactionDraftStatus, signature *string) error
	ListPendingByUser(ctx context.Context, userPubkey string) ([]models.TransactionDraft, error)
}
