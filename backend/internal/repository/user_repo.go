package repository

import (
	"context"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
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
	err := r.db.WithContext(ctx).Where("wallet_address = ?", walletAddress).FirstOrCreate(&user).Error
	if err != nil {
		return nil, err
	}
	return &domain.UserDetail{ID: user.ID.String(), WalletAddress: user.WalletAddress, Nonce: user.Nonce}, nil
}

func (r *userRepo) FindByWallet(ctx context.Context, walletAddress string) (*domain.UserDetail, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("wallet_address = ?", walletAddress).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &domain.UserDetail{ID: user.ID.String(), WalletAddress: user.WalletAddress, Nonce: user.Nonce}, nil
}

func (r *userRepo) UpdateNonce(ctx context.Context, walletAddress, nonce string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).Where("wallet_address = ?", walletAddress).Update("nonce", nonce).Error
}
