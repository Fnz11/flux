package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// knownMintSymbols maps well-known token mint addresses to their ticker so a
// mint address stored in trade_histories.input_token / price_history.token
// renders as the human-readable symbol the UI expects.
var knownMintSymbols = map[string]string{
	"So11111111111111111111111111111111111111112":  "SOL",
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
	"Es9vMaa7ThFuvFXtxh1Jc7PwQudXf6bS2qLW12345678": "USDT",
}

// knownTokenIcons provides icon URLs for well-known tokens. Derived from the
// icon URLs the frontend LeaderboardWidget already ships; unknown symbols
// simply get an empty icon.
var knownTokenIcons = map[string]string{
	"SOL":  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
	"USDC": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
	"USDT": "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
	"JUP":  "https://static.jup.ag/jup/icon.png",
	"PYTH": "https://coin-images.coingecko.com/coins/images/31924/large/pyth.png",
}

type leaderboardRepo struct {
	db              *gorm.DB
	hasTradeHistory bool
	priceTable      string
	hasVault        bool
	hasCAGGOHLCV1h  bool
	hasCAGGVolume1h bool
}

func NewLeaderboardRepository(db *gorm.DB) domain.LeaderboardRepository {
	r := &leaderboardRepo{db: db}
	if db != nil {
		r.hasTradeHistory = db.Migrator().HasTable(&models.TradeHistory{})
		switch {
		case db.Migrator().HasTable("price_history"):
			r.priceTable = "price_history"
		case db.Migrator().HasTable("price_histories"):
			r.priceTable = "price_histories"
		}
		r.hasVault = db.Migrator().HasTable(&models.Vault{})
		r.hasCAGGOHLCV1h = db.Migrator().HasTable("cagg_price_ohlcv_1h")
		r.hasCAGGVolume1h = db.Migrator().HasTable("cagg_trade_volume_1h")
	}
	return r
}

// periodDays converts a compact period shorthand to a day count. "24h" maps
// to a single rolling day; anything unrecognized falls back to 7 days.
func periodDays(period string) int {
	switch strings.ToLower(strings.TrimSpace(period)) {
	case "24h":
		return 1
	case "7d":
		return 7
	case "14d":
		return 14
	case "30d":
		return 30
	case "90d":
		return 90
	default:
		return 7
	}
}

func (r *leaderboardRepo) GetLeaderboard(ctx context.Context, lbType string, limit int, period string) ([]domain.LeaderboardItem, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}

	db := getDB(ctx, r.db)
	if db == nil {
		return nil, fmt.Errorf("leaderboard repository not initialized")
	}

	from := time.Now().UTC().AddDate(0, 0, -periodDays(period))

	switch strings.ToLower(strings.TrimSpace(lbType)) {
	case "trending":
		return r.getTrending(ctx, db, from, limit)
	case "gainers":
		return r.getGainers(ctx, db, from, limit)
	case "new":
		return r.getNew(ctx, db, from, limit)
	default:
		return nil, fmt.Errorf("%w: unknown leaderboard type %q", domain.ErrInvalidInput, lbType)
	}
}

// volumeByToken aggregates 24h traded volume (SUM amount_in) per token from
// trade_histories.
func (r *leaderboardRepo) volumeByToken(ctx context.Context, db *gorm.DB, from time.Time) (map[string]decimal.Decimal, error) {
	vols := make(map[string]decimal.Decimal)
	if !r.hasTradeHistory {
		return vols, nil
	}

	type volumeRow struct {
		Symbol string
		Volume decimal.Decimal
	}
	var rows []volumeRow
	err := db.Table("trade_histories").
		Select("input_token AS symbol, SUM(amount_in) AS volume").
		Where("input_token IS NOT NULL AND input_token <> '' AND executed_at >= ?", from).
		Group("input_token").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		sym := normalizeSymbol(row.Symbol)
		if sym == "" {
			continue
		}
		vols[sym] = vols[sym].Add(row.Volume)
	}
	return vols, nil
}

// changeByToken computes the percent change between the first and last close
// price of the window for each token from price_history. Falls back to the
// Timescale continuous aggregate on postgres where available.
func (r *leaderboardRepo) changeByToken(ctx context.Context, db *gorm.DB, from time.Time) (map[string]decimal.Decimal, error) {
	changes := make(map[string]decimal.Decimal)
	if r.priceTable == "" {
		return changes, nil
	}

	if db.Dialector.Name() == "postgres" && r.hasCAGGOHLCV1h {
		type caggRow struct {
			Symbol     string
			OpenPrice  decimal.Decimal
			ClosePrice decimal.Decimal
		}
		var rows []caggRow
		err := db.Raw(`
			SELECT token AS symbol, open_price, close_price FROM (
				SELECT token,
					first_value(close) OVER (PARTITION BY token ORDER BY bucket ASC)  AS open_price,
					first_value(close) OVER (PARTITION BY token ORDER BY bucket DESC) AS close_price,
					ROW_NUMBER() OVER (PARTITION BY token ORDER BY bucket DESC)       AS rn
				FROM cagg_price_ohlcv_1h
				WHERE bucket >= ?
			) t WHERE rn = 1`, from).Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			sym := normalizeSymbol(row.Symbol)
			if sym == "" {
				continue
			}
			changes[sym] = percentChange(row.OpenPrice, row.ClosePrice)
		}
		return changes, nil
	}

	type priceRow struct {
		Symbol     string
		OpenPrice  decimal.Decimal
		ClosePrice decimal.Decimal
	}
	var rows []priceRow
	err := db.Raw(fmt.Sprintf(`
		SELECT p.token AS symbol,
			(SELECT price FROM %[1]s
			 WHERE token = p.token AND fetched_at >= ? AND fetched_at <= ?
			 ORDER BY fetched_at ASC LIMIT 1)  AS open_price,
			(SELECT price FROM %[1]s
			 WHERE token = p.token AND fetched_at >= ? AND fetched_at <= ?
			 ORDER BY fetched_at DESC LIMIT 1) AS close_price
		FROM (SELECT DISTINCT token FROM %[1]s WHERE fetched_at >= ? AND fetched_at <= ?) p`, r.priceTable),
		from, time.Now().UTC(), from, time.Now().UTC(), from, time.Now().UTC()).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		sym := normalizeSymbol(row.Symbol)
		if sym == "" {
			continue
		}
		changes[sym] = percentChange(row.OpenPrice, row.ClosePrice)
	}
	return changes, nil
}

// getTrending ranks tokens by 24h traded volume, enriched with price change.
func (r *leaderboardRepo) getTrending(ctx context.Context, db *gorm.DB, from time.Time, limit int) ([]domain.LeaderboardItem, error) {
	items := make([]domain.LeaderboardItem, 0)
	vols, err := r.volumeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}
	changes, err := r.changeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}

	syms := sortedKeys(vols)
	rank := 1
	for _, sym := range syms {
		if rank > limit {
			break
		}
		items = append(items, newTokenItem(rank, sym, vols[sym], changes[sym]))
		rank++
	}
	return items, nil
}

// getGainers ranks tokens by their best percent change over the window.
func (r *leaderboardRepo) getGainers(ctx context.Context, db *gorm.DB, from time.Time, limit int) ([]domain.LeaderboardItem, error) {
	items := make([]domain.LeaderboardItem, 0)
	changes, err := r.changeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}
	if len(changes) == 0 {
		return items, nil
	}

	vols, err := r.volumeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}

	syms := make([]string, 0, len(changes))
	for sym := range changes {
		syms = append(syms, sym)
	}
	sort.Slice(syms, func(i, j int) bool {
		if changes[syms[i]].Equal(changes[syms[j]]) {
			return syms[i] < syms[j]
		}
		return changes[syms[i]].GreaterThan(changes[syms[j]])
	})

	rank := 1
	for _, sym := range syms {
		if rank > limit {
			break
		}
		items = append(items, domain.LeaderboardItem{
			Rank:   rank,
			Name:   sym,
			Symbol: sym,
			Tag:    "VAULT",
			Volume: vols[sym],
			Change: changes[sym],
			Icon:   tokenIcon(sym),
		})
		rank++
	}
	return items, nil
}

// getNew ranks the most recently created vaults, then tokens first seen in
// trade history when no vault rows exist.
func (r *leaderboardRepo) getNew(ctx context.Context, db *gorm.DB, from time.Time, limit int) ([]domain.LeaderboardItem, error) {
	items := make([]domain.LeaderboardItem, 0)

	vols, err := r.volumeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}
	changes, err := r.changeByToken(ctx, db, from)
	if err != nil {
		return nil, err
	}

	if r.hasVault {
		type vaultRow struct {
			Address   string
			Metadata  datatypes.JSON
			CreatedAt time.Time
		}
		var rows []vaultRow
		err := db.Table("vaults").
			Select("address, metadata, created_at").
			Where("deleted_at IS NULL").
			Order("created_at DESC").
			Limit(limit).
			Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for i, row := range rows {
			name, sym := vaultDisplayInfo(row.Metadata)
			items = append(items, domain.LeaderboardItem{
				Rank:   i + 1,
				Name:   name,
				Symbol: sym,
				Tag:    "NEW",
				Volume: vols[sym],
				Change: changes[sym],
				Icon:   tokenIcon(sym),
			})
		}
		return items, nil
	}

	// Fallback: newest first-seen token from trade_histories.
	type firstSeenRow struct {
		Symbol    string
		FirstSeen time.Time
		Volume    decimal.Decimal
	}
	var rows []firstSeenRow
	err = db.Table("trade_histories").
		Select("input_token AS symbol, MIN(executed_at) AS first_seen, SUM(amount_in) AS volume").
		Where("input_token IS NOT NULL AND input_token <> ''").
		Group("input_token").
		Order("first_seen DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for i, row := range rows {
		sym := normalizeSymbol(row.Symbol)
		if sym == "" {
			continue
		}
		items = append(items, domain.LeaderboardItem{
			Rank:   i + 1,
			Name:   sym,
			Symbol: sym,
			Tag:    "NEW",
			Volume: row.Volume,
			Change: changes[sym],
			Icon:   tokenIcon(sym),
		})
	}
	return items, nil
}

// vaultDisplayInfo extracts a vault's display name and primary focus symbol
// from its metadata JSON. Falls back to the address when no name is stored.
func vaultDisplayInfo(meta datatypes.JSON) (name, symbol string) {
	if len(meta) == 0 {
		return "", ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(meta, &m); err != nil {
		return "", ""
	}
	if v, ok := m["displayName"].(string); ok && strings.TrimSpace(v) != "" {
		name = v
	} else if v, ok := m["display_name"].(string); ok && strings.TrimSpace(v) != "" {
		name = v
	}
	if arr, ok := m["focusAssets"].([]interface{}); ok && len(arr) > 0 {
		if s, ok := arr[0].(string); ok {
			symbol = normalizeSymbol(s)
		}
	}
	return name, symbol
}

func normalizeSymbol(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if sym, ok := knownMintSymbols[strings.ToUpper(s)]; ok {
		return sym
	}
	if sym, ok := knownMintSymbols[s]; ok {
		return sym
	}
	if len(s) <= 10 {
		return strings.ToUpper(s)
	}
	return s
}

func tokenIcon(sym string) string {
	return knownTokenIcons[sym]
}

func newTokenItem(rank int, sym string, volume, change decimal.Decimal) domain.LeaderboardItem {
	return domain.LeaderboardItem{
		Rank:   rank,
		Name:   sym,
		Symbol: sym,
		Tag:    "VAULT",
		Volume: volume,
		Change: change,
		Icon:   tokenIcon(sym),
	}
}

// percentChange computes (last-first)/abs(first)*100, or zero when the first
// price is unknown/zero.
func percentChange(first, last decimal.Decimal) decimal.Decimal {
	if first.IsZero() {
		return decimal.Zero
	}
	return last.Sub(first).Div(first.Abs()).Mul(decimal.NewFromInt(100))
}

func sortedKeys(m map[string]decimal.Decimal) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if m[keys[i]].Equal(m[keys[j]]) {
			return keys[i] < keys[j]
		}
		return m[keys[i]].GreaterThan(m[keys[j]])
	})
	return keys
}
