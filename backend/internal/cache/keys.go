package cache

import (
	"fmt"
	"sort"
	"strings"
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

// LeaderboardKey returns app:global:leaderboard. It backs the dashboard's
// default leaderboard request (trending over 7d) so the single-key invalidators
// in the handlers keep working without knowing about type-scoped keys.
func LeaderboardKey() string {
	return fmt.Sprintf("%s:global:leaderboard", keyPrefix)
}

// LeaderboardTypeKey returns app:global:leaderboard:type:{lbType}:period:{period},
// a full-scoped cache key for a specific leaderboard query (lbType × period).
// The default trending/7d dashboard request is served on LeaderboardKey
// itself; every other combination uses this scoped key.
func LeaderboardTypeKey(lbType, period string) string {
	return fmt.Sprintf("%s:global:leaderboard:type:%s:period:%s", keyPrefix, lbType, period)
}

// LeaderboardPrefix returns app:global:leaderboard:, the shared prefix of every
// leaderboard family key. Intended for prefix-based invalidation (SCAN+DEL) of
// all leaderboard variants in one pass.
func LeaderboardPrefix() string {
	return fmt.Sprintf("%s:global:leaderboard:", keyPrefix)
}

// UserPortfolioPrefix returns app:user:*:portfolio, a glob pattern for
// pattern-based invalidation (SCAN + DEL) of all user portfolios.
func UserPortfolioPrefix() string {
	return fmt.Sprintf("%s:user:*:portfolio", keyPrefix)
}

// UserPortfolioSummaryKey returns app:user:{userID}:portfolio-summary.
func UserPortfolioSummaryKey(userID string) string {
	return fmt.Sprintf("%s:user:%s:portfolio-summary", keyPrefix, userID)
}

// UserPnlSummaryKey returns app:user:{userID}:pnl-summary.
func UserPnlSummaryKey(userID string) string {
	return fmt.Sprintf("%s:user:%s:pnl-summary", keyPrefix, userID)
}

// VaultTotalSharesKey returns app:vault:{vaultID}:total-shares.
func VaultTotalSharesKey(vaultID string) string {
	return fmt.Sprintf("%s:vault:%s:total-shares", keyPrefix, vaultID)
}

// TradeSignatureKey returns app:trade:signature:{signature}.
func TradeSignatureKey(signature string) string {
	return fmt.Sprintf("%s:trade:signature:%s", keyPrefix, signature)
}

// TradeListKey returns app:vault:{vaultID}:trades:{tradeType}:{page}:{limit}.
// Used to cache paginated trade listings keyed by vault + page + limit.
func TradeListKey(vaultID, tradeType string, page, limit int) string {
	if tradeType == "" {
		tradeType = "all"
	}
	return fmt.Sprintf("%s:vault:%s:trades:%s:%d:%d", keyPrefix, vaultID, tradeType, page, limit)
}

// TradeListByVaultIDsKey returns app:vaults:{sorted-ids}:trades:{tradeType}:{page}:{limit}.
// The vault ids are sorted and joined so the key is deterministic regardless of
// the caller's slice ordering.
func TradeListByVaultIDsKey(vaultIDs []string, tradeType string, page, limit int) string {
	ids := append([]string(nil), vaultIDs...)
	sort.Strings(ids)
	joined := strings.Join(ids, "+")
	if tradeType == "" {
		tradeType = "all"
	}
	return fmt.Sprintf("%s:vaults:%s:trades:%s:%d:%d", keyPrefix, joined, tradeType, page, limit)
}
