package cache

import (
	"fmt"
	"time"
)

// Key format: app:{entity}:{id}. Both the read path (cache-aside) and the write
// path (invalidation) MUST build keys exclusively through these helpers so
// reads and invalidations always target the same keys.

// TTLs follow the plan: volatile portfolio/vault data 30s, shared leaderboards 60s.
const (
	PortfolioTTL    = 30 * time.Second
	VaultSummaryTTL = 30 * time.Second
	LeaderboardTTL  = 60 * time.Second
)

const keyPrefix = "app"

// UserPortfolioKey returns app:user:{userID}:portfolio.
func UserPortfolioKey(userID string) string {
	return fmt.Sprintf("%s:user:%s:portfolio", keyPrefix, userID)
}

// UserPnLKey returns app:user:{userID}:pnl.
func UserPnLKey(userID string) string {
	return fmt.Sprintf("%s:user:%s:pnl", keyPrefix, userID)
}

// VaultSummaryKey returns app:vault:{address}:summary.
func VaultSummaryKey(address string) string {
	return fmt.Sprintf("%s:vault:%s:summary", keyPrefix, address)
}

// LeaderboardKey returns app:global:leaderboard.
func LeaderboardKey() string {
	return fmt.Sprintf("%s:global:leaderboard", keyPrefix)
}

// UserPortfolioPrefix returns app:user:*:portfolio, a glob pattern for
// pattern-based invalidation (SCAN + DEL) of all user portfolios.
func UserPortfolioPrefix() string {
	return fmt.Sprintf("%s:user:*:portfolio", keyPrefix)
}
