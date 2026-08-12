package repository

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// globalFeedSelect joins trade_histories through the actor (users) and the
// vault so the feed carries wallet + vault display info in a single query.
const globalFeedSelect = `
SELECT t.id, t.executed_at, t.trade_type, t.vault_id,
       t.transaction_signature, t.input_token, t.output_token,
       t.amount_in, t.amount_out,
       u.wallet_address,
       v.address AS vault_address, v.metadata AS vault_metadata
FROM trade_histories t
JOIN users u ON u.id = t.actor_id
JOIN vaults v ON v.id = t.vault_id `

const globalFeedCount = `
SELECT COUNT(*)
FROM trade_histories t
JOIN users u ON u.id = t.actor_id
JOIN vaults v ON v.id = t.vault_id `

const globalFeedOrderPagination = `
ORDER BY t.executed_at DESC, t.id DESC LIMIT ? OFFSET ?`

type globalFeedRow struct {
	ID                   string
	ExecutedAt           string
	TradeType            string
	VaultID              string
	TransactionSignature string
	InputToken           string
	OutputToken          string
	AmountIn             decimal.Decimal
	AmountOut            decimal.Decimal
	WalletAddress        string
	VaultAddress         string
	VaultMetadata        datatypes.JSON
}

type globalFeedRepo struct {
	db *gorm.DB
}

func NewGlobalFeedRepository(db *gorm.DB) domain.GlobalFeedRepository {
	return &globalFeedRepo{db: db}
}

func (r *globalFeedRepo) ListGlobalFeed(ctx context.Context, filter domain.FeedFilter) ([]domain.GlobalFeedItem, int64, error) {
	db := getDB(ctx, r.db)
	// Real data only: without the backing tables the feed is empty rather
	// than an error (pre-deploy / partially migrated environments).
	for _, table := range []string{"trade_histories", "users", "vaults"} {
		if !db.Migrator().HasTable(table) {
			return []domain.GlobalFeedItem{}, 0, nil
		}
	}

	where, args := globalFeedWhere(filter.Wallet, filter.Type)

	var total int64
	if err := db.Raw(globalFeedCount+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var rows []globalFeedRow
	queryArgs := append(append([]interface{}{}, args...), limit, offset)
	if err := db.Raw(globalFeedSelect+where+globalFeedOrderPagination, queryArgs...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	items := make([]domain.GlobalFeedItem, len(rows))
	for i, row := range rows {
		items[i] = row.toItem()
	}
	return items, total, nil
}

// globalFeedWhere builds the WHERE clause (and its args) from the optional
// wallet and action-type filters. Wallet filters via users.actor_id; Type is
// translated from the feed action to the underlying trade_type values.
func globalFeedWhere(wallet, feedType string) (string, []interface{}) {
	var where string
	var args []interface{}

	if wallet != "" {
		where = "u.wallet_address = ?"
		args = append(args, wallet)
	}

	cond, condArgs := globalFeedTypeCondition(feedType)
	if cond != "" {
		if where == "" {
			where = cond
		} else {
			where += " AND " + cond
		}
		args = append(args, condArgs...)
	}

	if where != "" {
		where = "WHERE " + where
	}
	return where, args
}

func globalFeedTypeCondition(feedType string) (string, []interface{}) {
	switch strings.ToLower(strings.TrimSpace(feedType)) {
	case "":
		return "", nil
	case "deposit":
		return "LOWER(t.trade_type) = LOWER(?)", []interface{}{"Deposit"}
	case "withdraw":
		return "LOWER(t.trade_type) = LOWER(?)", []interface{}{"Withdraw"}
	case "swap", "buy", "sell":
		return "LOWER(t.trade_type) IN ('buy','sell','swap')", nil
	default:
		return "LOWER(t.trade_type) = LOWER(?)", []interface{}{feedType}
	}
}

func (r globalFeedRow) toItem() domain.GlobalFeedItem {
	action := feedAction(r.TradeType)
	amount := r.AmountIn
	symbol := r.InputToken
	if action == "withdraw" {
		amount = r.AmountOut
		symbol = r.OutputToken
	}
	return domain.GlobalFeedItem{
		ID:                   r.ID,
		ExecutedAt:           parseFeedTime(r.ExecutedAt),
		Action:               action,
		VaultID:              r.VaultID,
		VaultName:            vaultDisplayName(r.VaultAddress, r.VaultMetadata),
		Symbol:               symbol,
		Amount:               amount,
		TransactionSignature: r.TransactionSignature,
		Wallet:               r.WalletAddress,
	}
}

// feedAction maps the raw trade_type to the feed action vocabulary:
// Deposit -> "deposit", Withdraw -> "withdraw", Buy/Sell/Swap -> "swap".
func feedAction(tradeType string) string {
	switch strings.ToLower(strings.TrimSpace(tradeType)) {
	case "deposit":
		return "deposit"
	case "withdraw":
		return "withdraw"
	case "buy", "sell", "swap":
		return "swap"
	default:
		return "swap"
	}
}

// vaultDisplayName resolves the human-readable vault name from the metadata
// JSON (displayName / display_name / name) and falls back to a shortened
// vault address so the feed never shows an empty label.
func vaultDisplayName(vaultAddress string, metadata datatypes.JSON) string {
	if len(metadata) > 0 {
		var meta map[string]interface{}
		if err := json.Unmarshal(metadata, &meta); err == nil {
			for _, key := range []string{"displayName", "display_name", "name"} {
				if v, ok := meta[key]; ok {
					if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
						return strings.TrimSpace(s)
					}
				}
			}
		}
	}
	return shortVaultAddress(vaultAddress)
}

func shortVaultAddress(addr string) string {
	if len(addr) <= 8 {
		return addr
	}
	return addr[:6] + "..." + addr[len(addr)-4:]
}

func parseFeedTime(s string) (t time.Time) {
	if s == "" {
		return t
	}
	t, _ = time.Parse(time.RFC3339Nano, s)
	return t
}
