package domain

import "context"

type UserRepository interface {
	FindOrCreateByWallet(ctx context.Context, walletAddress string) (*UserDetail, error)
	FindByWallet(ctx context.Context, walletAddress string) (*UserDetail, error)
	UpdateNonce(ctx context.Context, walletAddress, nonce string) error
}

type UserDetail struct {
	ID            string
	WalletAddress string
	Nonce         string
}
