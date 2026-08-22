package services

import (
	"context"
	"strings"

	"github.com/flux-protocol/backend/internal/domain"
)

type Pair struct {
	Symbol string `json:"symbol"`
}

type TokenPair struct {
	Base  string
	Quote string
}

// tradablePairs is the single source of truth for manager-mode searchable
// pairs. In production this should come from cfg.FocusAssetsWhitelist; a
// static placeholder is kept here so the search service has no config
// dependency.
var tradablePairs = []TokenPair{
	{Base: "SOL", Quote: "USDC"},
	{Base: "SOL", Quote: "USDT"},
	{Base: "BTC", Quote: "USDC"},
	{Base: "ETH", Quote: "USDC"},
	{Base: "JUP", Quote: "USDC"},
	{Base: "PYTH", Quote: "USDC"},
}

type SearchService struct {
	vaults domain.SearchRepository
}

func NewSearchService(v domain.SearchRepository) *SearchService {
	return &SearchService{vaults: v}
}

func (s *SearchService) ManagerPairs(ctx context.Context, q string, limit int) []Pair {
	return pairsFiltered(q, limit)
}

func (s *SearchService) InvestorVaults(ctx context.Context, q string, limit int) ([]domain.SearchVaultMatch, error) {
	return s.vaults.SearchVaults(ctx, q, limit)
}

func pairsFiltered(q string, limit int) []Pair {
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}
	needle := strings.ToLower(strings.TrimSpace(q))
	out := make([]Pair, 0, len(tradablePairs))
	for _, p := range tradablePairs {
		if len(out) >= limit {
			break
		}
		symbol := p.Base + "/" + p.Quote
		if needle == "" || strings.Contains(strings.ToLower(p.Base), needle) ||
			strings.Contains(strings.ToLower(p.Quote), needle) ||
			strings.Contains(strings.ToLower(symbol), needle) {
			out = append(out, Pair{Symbol: symbol})
		}
	}
	return out
}