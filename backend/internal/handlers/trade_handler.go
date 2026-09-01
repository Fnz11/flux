package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

type tradeResponse struct {
	ID                   string          `json:"id"`
	TransactionSignature string          `json:"transaction_signature"`
	TradeType            string          `json:"trade_type"`
	InputToken           string          `json:"input_token"`
	OutputToken          string          `json:"output_token"`
	AmountIn             decimal.Decimal `json:"amount_in"`
	AmountOut            decimal.Decimal `json:"amount_out"`
	PriceAtExecution     decimal.Decimal `json:"price_at_execution"`
	ExecutedAt           string          `json:"executed_at"`
}

type tradesData struct {
	Trades  []tradeResponse `json:"trades"`
	VaultID string          `json:"vault_id"`
	Total   int64           `json:"total"`
}

type TradeHandler struct {
	tradeRepo domain.TradeRepository
	vaultRepo domain.VaultRepository
	cache     cache.Cache
}

func NewTradeHandler(tradeRepo domain.TradeRepository, vaultRepo domain.VaultRepository) *TradeHandler {
	return &TradeHandler{
		tradeRepo: tradeRepo,
		vaultRepo: vaultRepo,
	}
}

func (h *TradeHandler) SetCache(c cache.Cache) {
	h.cache = c
}

func (h *TradeHandler) GetTrades(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		ErrorResponse(c, http.StatusBadRequest, "vault address required")
		return
	}

	vault, err := h.vaultRepo.GetByAddress(c.Request.Context(), address)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	tradeType := c.Query("type")

	if page < 1 {
		page = 1
	}
	if page > 10000 {
		page = 10000
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	trades, total, err := h.tradeRepo.ListByVault(c.Request.Context(), vault.ID, tradeType, page, limit)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch trades")
		return
	}

	result := make([]tradeResponse, len(trades))
	for i, t := range trades {
		result[i] = tradeResponse{
			ID:                   t.ID,
			TransactionSignature: t.TransactionSignature,
			TradeType:            t.TradeType,
			InputToken:           t.InputToken,
			OutputToken:          t.OutputToken,
			AmountIn:             t.AmountIn,
			AmountOut:            t.AmountOut,
			PriceAtExecution:     t.PriceAtExecution,
			ExecutedAt:           t.ExecutedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	SuccessResponse(c, tradesData{
		Trades:  result,
		VaultID: vault.ID,
		Total:   total,
	})
}

type batchTradesData struct {
	Trades []batchTradeResponse `json:"trades"`
	Total  int64                `json:"total"`
}

type batchTradeResponse struct {
	ID                   string          `json:"id"`
	VaultID              string          `json:"vault_id"`
	TransactionSignature string          `json:"transaction_signature"`
	TradeType            string          `json:"trade_type"`
	InputToken           string          `json:"input_token"`
	OutputToken          string          `json:"output_token"`
	AmountIn             decimal.Decimal `json:"amount_in"`
	AmountOut            decimal.Decimal `json:"amount_out"`
	PriceAtExecution     decimal.Decimal `json:"price_at_execution"`
	ExecutedAt           string          `json:"executed_at"`
}

func (h *TradeHandler) GetBatchTrades(c *gin.Context) {
	rawVaultIDs := c.QueryArray("vaultIds[]")
	if len(rawVaultIDs) == 0 {
		rawVaultIDs = c.QueryArray("vaultIds")
	}

	var vaultIDs []string
	seen := make(map[string]bool)
	for _, raw := range rawVaultIDs {
		parts := strings.Split(raw, ",")
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" && !seen[trimmed] {
				seen[trimmed] = true
				vaultIDs = append(vaultIDs, trimmed)
			}
		}
	}

	if len(vaultIDs) > 50 {
		ErrorResponse(c, http.StatusBadRequest, "Too many vault IDs, maximum allowed is 50")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	tradeType := c.Query("type")

	if page < 1 {
		page = 1
	}
	if page > 10000 {
		page = 10000
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	trades, total, err := h.tradeRepo.ListByVaultIDs(c.Request.Context(), vaultIDs, tradeType, page, limit)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch trades")
		return
	}

	result := make([]batchTradeResponse, len(trades))
	for i, t := range trades {
		result[i] = batchTradeResponse{
			ID:                   t.ID,
			VaultID:              t.VaultID,
			TransactionSignature: t.TransactionSignature,
			TradeType:            t.TradeType,
			InputToken:           t.InputToken,
			OutputToken:          t.OutputToken,
			AmountIn:             t.AmountIn,
			AmountOut:            t.AmountOut,
			PriceAtExecution:     t.PriceAtExecution,
			ExecutedAt:           t.ExecutedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	SuccessResponse(c, batchTradesData{
		Trades: result,
		Total:  total,
	})
}

func invalidateUserCache(c cache.Cache, ctx context.Context, userID uuid.UUID) {
	if c == nil {
		return
	}
	if err := c.Delete(ctx, cache.UserPortfolioKey(userID.String())); err != nil {
		logrus.WithError(err).WithField("user_id", userID.String()).Warn("cache invalidation failed for user portfolio")
	}
	if err := c.Delete(ctx, cache.UserPnLKey(userID.String())); err != nil {
		logrus.WithError(err).WithField("user_id", userID.String()).Warn("cache invalidation failed for user pnl")
	}
}

func invalidateLeaderboardCache(c cache.Cache, ctx context.Context) {
	if c == nil {
		return
	}
	if err := c.Delete(ctx, cache.LeaderboardKey()); err != nil {
		logrus.WithError(err).Warn("cache invalidation failed for global leaderboard")
	}
}

func invalidateVaultSummaryCache(c cache.Cache, ctx context.Context, vaultAddress string) {
	if c == nil {
		return
	}
	if err := c.Delete(ctx, cache.VaultSummaryKey(vaultAddress)); err != nil {
		logrus.WithError(err).WithField("vault_address", vaultAddress).Warn("cache invalidation failed for vault summary")
	}
}

func invalidateVaultPortfolioCaches(c cache.Cache, repo domain.PortfolioRepository, ctx context.Context, vaultID string) {
	if c == nil || repo == nil {
		return
	}
	userIDs, err := repo.GetHolderUserIDs(ctx, vaultID)
	if err != nil {
		logrus.WithError(err).WithField("vault_id", vaultID).Warn("failed to load portfolio holders for cache invalidation")
		return
	}
	for _, id := range userIDs {
		uid, err := uuid.Parse(id)
		if err != nil {
			continue
		}
		invalidateUserCache(c, ctx, uid)
	}
}

func invalidateVaultListCache(c cache.Cache, ctx context.Context) {
	if c == nil {
		return
	}
	if err := c.DeletePrefix(ctx, cache.VaultListPrefix()); err != nil {
		logrus.WithError(err).Warn("cache invalidation failed for vault list")
	}
}

func invalidateGlobalFeedCache(c cache.Cache, ctx context.Context) {
	if c == nil {
		return
	}
	if err := c.DeletePrefix(ctx, cache.GlobalFeedPrefix()); err != nil {
		logrus.WithError(err).Warn("cache invalidation failed for global feed")
	}
}
