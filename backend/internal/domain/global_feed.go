package domain

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
)

// FeedFilter holds pagination and optional filters for the platform-wide
// transaction feed. Wallet is a base58 investor wallet; Type is one of
// "deposit", "withdraw" or "swap".
type FeedFilter struct {
	Page   int
	Limit  int
	Wallet string
	Type   string
}

// GlobalFeedItem is a single row in the recent-activity feed. It aggregates
// deposits, withdrawals and vault swaps across every vault on the platform.
type GlobalFeedItem struct {
	ID                   string
	ExecutedAt           time.Time
	Action               string
	VaultID              string
	VaultName            string
	Symbol               string
	Amount               decimal.Decimal
	TransactionSignature string
	Wallet               string
}

// GlobalFeedRepository returns the most recent platform-wide transactions,
// newest first, plus the total number of matching rows.
type GlobalFeedRepository interface {
	ListGlobalFeed(ctx context.Context, filter FeedFilter) ([]GlobalFeedItem, int64, error)
}
