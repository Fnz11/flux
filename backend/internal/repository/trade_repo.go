package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	tradeListSelect = `
SELECT id, vault_id, actor_id, transaction_signature, trade_type,
       input_token, output_token, amount_in, amount_out,
       price_at_execution, executed_at
FROM trade_histories `

	tradeListCount = `
SELECT COUNT(*)
FROM trade_histories `

	tradeListOrderPagination = `
ORDER BY executed_at DESC LIMIT ? OFFSET ?`

	tradeFindBySignature = `
SELECT id, vault_id, actor_id, transaction_signature, trade_type,
       input_token, output_token, amount_in, amount_out,
       price_at_execution, executed_at
FROM trade_histories
WHERE transaction_signature = ?`
)

type tradeRepo struct {
	db *gorm.DB
}

func NewTradeRepository(db *gorm.DB) domain.TradeRepository {
	return &tradeRepo{db: db}
}

func sqlPlaceholders(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "?"
	}
	return strings.Join(parts, ", ")
}

func (r *tradeRepo) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	var t models.TradeHistory
	err := getDB(ctx, r.db).Raw(tradeFindBySignature, sig).Take(&t).Error
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

	db := getDB(ctx, r.db)
	// The unique index on (transaction_signature, executed_at) exists in
	// postgres (migration 010). ON CONFLICT requires a matching unique index,
	// which the sqlite test schema does not have, so only use it on postgres.
	if db.Dialector.Name() == "postgres" {
		db = db.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "transaction_signature"},
				{Name: "executed_at"},
			},
			DoNothing: true,
		})
	}

	result := db.Create(&m)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrAlreadySynced
	}
	trade.ID = m.ID.String()
	return nil
}

func (r *tradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	db := getDB(ctx, r.db)

	var where string
	var args []interface{}
	if vaultID != "" {
		if vid, err := uuid.Parse(vaultID); err == nil {
			where = "vault_id = ?"
			args = append(args, vid)
		} else {
			var v models.Vault
			if err := db.Select("id").Where("address = ?", vaultID).First(&v).Error; err == nil {
				where = "vault_id = ?"
				args = append(args, v.ID)
			} else {
				where = "vault_id = ?"
				args = append(args, vaultID)
			}
		}
	}
	if tradeType != "" {
		if where == "" {
			where = "trade_type = ?"
		} else {
			where += " AND trade_type = ?"
		}
		args = append(args, tradeType)
	}
	if where != "" {
		where = "WHERE " + where
	}

	var total int64
	if err := db.Raw(tradeListCount+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	queryArgs := append(append([]interface{}{}, args...), limit, offset)
	var trades []models.TradeHistory
	if err := db.Raw(tradeListSelect+where+tradeListOrderPagination, queryArgs...).Scan(&trades).Error; err != nil {
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

	var where string
	var args []interface{}
	switch {
	case len(uuids) > 0 && len(strIDs) > 0:
		where = "(vault_id IN (" + sqlPlaceholders(len(uuids)) + ") OR vault_id IN (" + sqlPlaceholders(len(strIDs)) + "))"
		for _, u := range uuids {
			args = append(args, u)
		}
		for _, s := range strIDs {
			args = append(args, s)
		}
	case len(uuids) > 0:
		where = "vault_id IN (" + sqlPlaceholders(len(uuids)) + ")"
		for _, u := range uuids {
			args = append(args, u)
		}
	case len(strIDs) > 0:
		where = "vault_id IN (" + sqlPlaceholders(len(strIDs)) + ")"
		for _, s := range strIDs {
			args = append(args, s)
		}
	}

	if tradeType != "" {
		if where == "" {
			where = "trade_type = ?"
		} else {
			where += " AND trade_type = ?"
		}
		args = append(args, tradeType)
	}
	if where != "" {
		where = "WHERE " + where
	}

	var total int64
	if err := db.Raw(tradeListCount+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	queryArgs := append(append([]interface{}{}, args...), limit, offset)
	var trades []models.TradeHistory
	if err := db.Raw(tradeListSelect+where+tradeListOrderPagination, queryArgs...).Scan(&trades).Error; err != nil {
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
