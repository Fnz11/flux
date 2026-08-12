package domain

import (
	"context"

	"github.com/shopspring/decimal"
)

// LeaderboardItem is a single row of the leaderboard response. Volume is
// numeric USD volume over the window, Change is a numeric percent (e.g. 28.32
// for +28.32%). Fields that cannot be derived (token icon, vault name) are
// left empty rather than filled with placeholder data.
type LeaderboardItem struct {
	Rank   int             `json:"rank"`
	Name   string          `json:"name"`
	Symbol string          `json:"symbol"`
	Tag    string          `json:"tag"`
	Volume decimal.Decimal `json:"volume"`
	Change decimal.Decimal `json:"change"`
	Icon   string          `json:"icon"`
}

// LeaderboardRepository returns ranked market items for a given leaderboard
// type (`trending`, `gainers`, `new`). It contains no hardcoded data: an
// empty bucket is reported as an empty slice, never fabricated rows.
type LeaderboardRepository interface {
	GetLeaderboard(ctx context.Context, lbType string, limit int, period string) ([]LeaderboardItem, error)
}
