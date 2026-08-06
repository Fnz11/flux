package repository

import (
	"context"

	"github.com/flux-protocol/backend/internal/domain"
	"gorm.io/gorm"
)

type txKey struct{}

type txManager struct {
	db *gorm.DB
}

func NewTxManager(db *gorm.DB) domain.TxManager {
	return &txManager{db: db}
}

func (m *txManager) ExecTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txCtx := context.WithValue(ctx, txKey{}, tx)
		return fn(txCtx)
	})
}

func (m *txManager) Ping(ctx context.Context) error {
	if m.db == nil {
		return nil
	}
	sqlDB, err := m.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

func getDB(ctx context.Context, defaultDB *gorm.DB) *gorm.DB {
	if tx, ok := ctx.Value(txKey{}).(*gorm.DB); ok {
		return tx
	}
	if defaultDB != nil {
		return defaultDB.WithContext(ctx)
	}
	return nil
}
