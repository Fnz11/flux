package repository

import (
	"context"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type tradeRepo struct {
	db *gorm.DB
}

func NewTradeRepository(db *gorm.DB) domain.TradeRepository {
	return &tradeRepo{db: db}
}

func (r *tradeRepo) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	var t models.TradeHistory
	err := r.db.WithContext(ctx).Where("transaction_signature = ?", sig).First(&t).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return tradeToDetail(&t), nil
}

func (r *tradeRepo) Create(ctx context.Context, trade *domain.TradeDetail) error {
	m := models.TradeHistory{
		VaultID:              uuid.MustParse(trade.VaultID),
		ActorID:              uuid.MustParse(trade.ActorID),
		TransactionSignature: trade.TransactionSignature,
		TradeType:            trade.TradeType,
		InputToken:           trade.InputToken,
		OutputToken:          trade.OutputToken,
		AmountIn:             trade.AmountIn,
		AmountOut:            trade.AmountOut,
		PriceAtExecution:     trade.PriceAtExecution,
		ExecutedAt:           trade.ExecutedAt,
	}
	return r.db.WithContext(ctx).Create(&m).Error
}

func (r *tradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.TradeHistory{})
	countQuery := r.db.WithContext(ctx).Model(&models.TradeHistory{})

	if vaultID != "" {
		query = query.Where("vault_id = ?", vaultID)
		countQuery = countQuery.Where("vault_id = ?", vaultID)
	}
	if tradeType != "" {
		query = query.Where("trade_type = ?", tradeType)
		countQuery = countQuery.Where("trade_type = ?", tradeType)
	}

	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var trades []models.TradeHistory
	offset := (page - 1) * limit
	if err := query.Offset(offset).Limit(limit).Order("executed_at DESC").Find(&trades).Error; err != nil {
		return nil, 0, err
	}

	details := make([]domain.TradeDetail, len(trades))
	for i, t := range trades {
		details[i] = *tradeToDetail(&t)
	}
	return details, total, nil
}

func tradeToDetail(t *models.TradeHistory) *domain.TradeDetail {
	return &domain.TradeDetail{
		ID:                   t.ID.String(),
		VaultID:              t.VaultID.String(),
		ActorID:              t.ActorID.String(),
		TransactionSignature: t.TransactionSignature,
		TradeType:            t.TradeType,
		InputToken:           t.InputToken,
		OutputToken:          t.OutputToken,
		AmountIn:             t.AmountIn,
		AmountOut:            t.AmountOut,
		PriceAtExecution:     t.PriceAtExecution,
		ExecutedAt:           t.ExecutedAt,
	}
}
