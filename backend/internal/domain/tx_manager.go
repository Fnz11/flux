package domain

import "context"

type TxManager interface {
	ExecTx(ctx context.Context, fn func(ctx context.Context) error) error
}

type Pinger interface {
	Ping(ctx context.Context) error
}
