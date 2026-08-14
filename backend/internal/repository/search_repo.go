package repository

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type searchRepo struct {
	db *gorm.DB
}

func NewSearchRepository(db *gorm.DB) domain.SearchRepository {
	return &searchRepo{db: db}
}

// maxSearchScanRows bounds the vault scan so a very large vaults table is
// never fully materialized. Matching happens in Go (address + metadata name)
// so the query stays portable across postgres and the sqlite test dialect.
const maxSearchScanRows = 500

const searchVaultsQuery = `
SELECT CAST(id AS TEXT) AS id, address, metadata, tvl
FROM vaults
WHERE deleted_at IS NULL
ORDER BY tvl DESC, id ASC
LIMIT ?`

type searchVaultRow struct {
	ID       string
	Address  string
	Metadata datatypes.JSON
	TVL      decimal.Decimal
}

func (r *searchRepo) SearchVaults(ctx context.Context, q string, limit int) ([]domain.SearchVaultMatch, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, nil
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}

	db := getDB(ctx, r.db)
	var rows []searchVaultRow
	if err := db.Raw(searchVaultsQuery, maxSearchScanRows).Scan(&rows).Error; err != nil {
		return nil, err
	}

	needle := strings.ToLower(q)
	matches := make([]domain.SearchVaultMatch, 0, limit)
	for _, row := range rows {
		if len(matches) >= limit {
			break
		}
		matched, name := vaultMatches(row, needle)
		if matched {
			if name == "" {
				name = row.Address
			}
			matches = append(matches, domain.SearchVaultMatch{
				ID:          row.ID,
				Address:     row.Address,
				DisplayName: name,
				TVL:         row.TVL,
			})
		}
	}
	return matches, nil
}

func vaultMatches(row searchVaultRow, needle string) (bool, string) {
	name := vaultSearchName(row.Metadata)
	if strings.Contains(strings.ToLower(row.Address), needle) {
		return true, name
	}
	if name != "" && strings.Contains(strings.ToLower(name), needle) {
		return true, name
	}
	if len(row.Metadata) > 0 {
		var m map[string]interface{}
		if err := json.Unmarshal(row.Metadata, &m); err == nil {
			if fa, ok := m["focusAssets"].([]interface{}); ok {
				for _, asset := range fa {
					if str, ok := asset.(string); ok && strings.Contains(strings.ToLower(str), needle) {
						return true, name
					}
				}
			}
			if fa, ok := m["focus_assets"].([]interface{}); ok {
				for _, asset := range fa {
					if str, ok := asset.(string); ok && strings.Contains(strings.ToLower(str), needle) {
						return true, name
					}
				}
			}
			if desc, ok := m["description"].(string); ok && strings.Contains(strings.ToLower(desc), needle) {
				return true, name
			}
		}
	}
	return false, name
}

func vaultSearchName(meta datatypes.JSON) string {
	if len(meta) == 0 {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(meta, &m); err != nil {
		return ""
	}
	for _, key := range []string{"display_name", "displayName", "name"} {
		if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	for _, key := range []string{"symbol"} {
		if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}