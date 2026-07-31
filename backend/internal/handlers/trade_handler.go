package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type tradeResponse struct {
	ID                   string  `json:"id"`
	TransactionSignature string  `json:"transaction_signature"`
	TradeType            string  `json:"trade_type"`
	InputToken           string  `json:"input_token"`
	OutputToken          string  `json:"output_token"`
	AmountIn             float64 `json:"amount_in"`
	AmountOut            float64 `json:"amount_out"`
	PriceAtExecution     float64 `json:"price_at_execution"`
	ExecutedAt           string  `json:"executed_at"`
}

type tradesData struct {
	Trades  []tradeResponse `json:"trades"`
	VaultID string          `json:"vault_id"`
	Total   int64           `json:"total"`
}

type TradeHandler struct {
	DB    *gorm.DB
	cache cache.Cache
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

	var vault models.Vault
	if err := h.DB.WithContext(c.Request.Context()).Where("address = ?", address).First(&vault).Error; err != nil {
		ErrorResponse(c, http.StatusNotFound, "vault not found")
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
	offset := (page - 1) * limit

	query := h.DB.Model(&models.TradeHistory{}).Where("vault_id = ?", vault.ID)
	if tradeType != "" {
		query = query.Where("trade_type = ?", tradeType)
	}

	var total int64
	if err := query.WithContext(c.Request.Context()).Count(&total).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to count trades")
		return
	}

	var trades []models.TradeHistory
	if err := query.WithContext(c.Request.Context()).Order("executed_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&trades).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch trades")
		return
	}

	result := make([]tradeResponse, len(trades))
	for i, t := range trades {
		result[i] = tradeResponse{
			ID:                   t.ID.String(),
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
		VaultID: vault.ID.String(),
		Total:   total,
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

func invalidateVaultPortfolioCaches(c cache.Cache, db *gorm.DB, ctx context.Context, vaultID uuid.UUID) {
	if c == nil {
		return
	}
	var userIDs []string
	if err := db.WithContext(ctx).Model(&models.Portfolio{}).
		Where("vault_id = ?", vaultID).Distinct().Pluck("user_id", &userIDs).Error; err != nil {
		logrus.WithError(err).WithField("vault_id", vaultID.String()).Warn("failed to load portfolio holders for cache invalidation")
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
