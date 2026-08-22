package handlers

import (
	"net/http"
	"strconv"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type GlobalFeedHandler struct {
	repo domain.GlobalFeedRepository
}

func NewGlobalFeedHandler(repo domain.GlobalFeedRepository) *GlobalFeedHandler {
	return &GlobalFeedHandler{repo: repo}
}

type globalFeedItemResponse struct {
	ID                   string          `json:"id"`
	ExecutedAt           string          `json:"executed_at"`
	Action               string          `json:"action"`
	VaultID              string          `json:"vault_id"`
	VaultName            string          `json:"vault_name"`
	Symbol               string          `json:"symbol"`
	Amount               decimal.Decimal `json:"amount"`
	TransactionSignature string          `json:"transaction_signature"`
	Wallet               string          `json:"wallet"`
}

type globalFeedData struct {
	Items []globalFeedItemResponse `json:"items"`
	Total int64                    `json:"total"`
}

// List returns the platform-wide recent transactions feed.
func (h *GlobalFeedHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if page > 10000 {
		page = 10000
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	wallet := c.Query("wallet")
	if wallet == "" {
		if val, exists := c.Get("wallet_address"); exists {
			if s, ok := val.(string); ok {
				wallet = s
			}
		}
	}

	items, total, err := h.repo.ListGlobalFeed(c.Request.Context(), domain.FeedFilter{
		Page:   page,
		Limit:  limit,
		Wallet: wallet,
		Type:   c.Query("type"),
	})
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch transactions")
		return
	}

	resp := make([]globalFeedItemResponse, len(items))
	for i, it := range items {
		resp[i] = globalFeedItemResponse{
			ID:                   it.ID,
			ExecutedAt:           it.ExecutedAt.Format("2006-01-02T15:04:05Z"),
			Action:               it.Action,
			VaultID:              it.VaultID,
			VaultName:            it.VaultName,
			Symbol:               it.Symbol,
			Amount:               it.Amount,
			TransactionSignature: it.TransactionSignature,
			Wallet:               it.Wallet,
		}
	}

	SuccessResponse(c, globalFeedData{
		Items: resp,
		Total: total,
	})
}
