package repository

import (
	"context"
	"errors"

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
	err := getDB(ctx, r.db).Where("transaction_signature = ?", sig).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return tradeToDetail(&t), nil
}

func (r *tradeRepo) Create(ctx context.Context, trade *domain.TradeDetail) error {
	vaultID, err := uuid.Parse(trade.VaultID)
	if err != nil {
		return err
	}
	actorID, err := uuid.Parse(trade.ActorID)
	if err != nil {
		return err
	}

	m := models.TradeHistory{
		VaultID:              vaultID,
		ActorID:              actorID,
		TransactionSignature: trade.TransactionSignature,
		TradeType:            trade.TradeType,
		InputToken:           trade.InputToken,
		OutputToken:          trade.OutputToken,
		AmountIn:             trade.AmountIn,
		AmountOut:            trade.AmountOut,
		PriceAtExecution:     trade.PriceAtExecution,
		ExecutedAt:           trade.ExecutedAt,
	}
	if err := getDB(ctx, r.db).Create(&m).Error; err != nil {
		return err
	}
	trade.ID = m.ID.String()
	return nil
}

func (r *tradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	db := getDB(ctx, r.db)
	query := db.Model(&models.TradeHistory{})
	countQuery := db.Model(&models.TradeHistory{})

	if vaultID != "" {
		vid, err := uuid.Parse(vaultID)
		if err == nil {
			query = query.Where("vault_id = ?", vid)
			countQuery = countQuery.Where("vault_id = ?", vid)
		} else {
			query = query.Where("vault_id = ?", vaultID)
			countQuery = countQuery.Where("vault_id = ?", vaultID)
		}
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

func (r *tradeRepo) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	db := getDB(ctx, r.db)
	query := db.Model(&models.TradeHistory{})
	countQuery := db.Model(&models.TradeHistory{})

	if len(vaultIDs) > 0 {
		var uuids []uuid.UUID
		var strIDs []string
		for _, v := range vaultIDs {
			if v == "" {
				continue
			}
			if vid, err := uuid.Parse(v); err == nil {
				uuids = append(uuids, vid)
			} else {
				strIDs = append(strIDs, v)
			}
		}

		if len(uuids) > 0 && len(strIDs) > 0 {
			query = query.Where("vault_id IN (?) OR vault_id IN (?)", uuids, strIDs)
			countQuery = countQuery.Where("vault_id IN (?) OR vault_id IN (?)", uuids, strIDs)
		} else if len(uuids) > 0 {
			query = query.Where("vault_id IN (?)", uuids)
			countQuery = countQuery.Where("vault_id IN (?)", uuids)
		} else if len(strIDs) > 0 {
			query = query.Where("vault_id IN (?)", strIDs)
			countQuery = countQuery.Where("vault_id IN (?)", strIDs)
		}
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
