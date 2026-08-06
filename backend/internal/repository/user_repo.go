package repository

import (
	"context"
	"errors"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"gorm.io/gorm"
)

type userRepo struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) domain.UserRepository {
	return &userRepo{db: db}
}

func (r *userRepo) FindOrCreateByWallet(ctx context.Context, walletAddress string) (*domain.UserDetail, error) {
	user := models.User{WalletAddress: walletAddress}
	err := getDB(ctx, r.db).Where("wallet_address = ?", walletAddress).FirstOrCreate(&user).Error
	if err != nil {
		return nil, err
	}
	return &domain.UserDetail{ID: user.ID.String(), WalletAddress: user.WalletAddress, Nonce: user.Nonce}, nil
}

func (r *userRepo) FindByWallet(ctx context.Context, walletAddress string) (*domain.UserDetail, error) {
	var user models.User
	err := getDB(ctx, r.db).Where("wallet_address = ?", walletAddress).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &domain.UserDetail{ID: user.ID.String(), WalletAddress: user.WalletAddress, Nonce: user.Nonce}, nil
}

func (r *userRepo) UpdateNonce(ctx context.Context, walletAddress, nonce string) error {
	return getDB(ctx, r.db).Model(&models.User{}).Where("wallet_address = ?", walletAddress).Update("nonce", nonce).Error
}
