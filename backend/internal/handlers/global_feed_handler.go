package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type GlobalFeedHandler struct {
	repo  domain.GlobalFeedRepository
	cache cache.Cache
}

func NewGlobalFeedHandler(repo domain.GlobalFeedRepository) *GlobalFeedHandler {
	return &GlobalFeedHandler{repo: repo}
}

func (h *GlobalFeedHandler) SetCache(c cache.Cache) {
	h.cache = c
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

	tradeType := c.Query("type")
	wallet := c.Query("wallet")
	if wallet == "" {
		if val, exists := c.Get("wallet_address"); exists {
			if s, ok := val.(string); ok {
				wallet = s
			}
		}
	}

	// Enterprise Fast Path: Default global unfiltered feed via Redis List + MGET
	isDefaultFeed := tradeType == "" && wallet == ""
	if h.cache != nil && isDefaultFeed {
		listKey := cache.FeedGlobalListKey()
		totalCount, err := h.cache.LLen(c.Request.Context(), listKey)
		if err == nil && totalCount > 0 {
			start := int64((page - 1) * limit)
			stop := start + int64(limit) - 1
			txIDs, err := h.cache.LRange(c.Request.Context(), listKey, start, stop)
			if err == nil && len(txIDs) > 0 {
				keys := make([]string, len(txIDs))
				for i, id := range txIDs {
					keys[i] = cache.TxEntityKey(id)
				}
				rawEntities, err := h.cache.MGet(c.Request.Context(), keys...)
				if err == nil && len(rawEntities) == len(txIDs) {
					cachedItems := make([]globalFeedItemResponse, len(rawEntities))
					allValid := true
					for i, raw := range rawEntities {
						if err := json.Unmarshal(raw, &cachedItems[i]); err != nil {
							allValid = false
							break
						}
					}
					if allValid {
						SuccessResponse(c, globalFeedData{
							Items: cachedItems,
							Total: totalCount,
						})
						return
					}
				}
			}
		}
	}

	items, total, err := h.repo.ListGlobalFeed(c.Request.Context(), domain.FeedFilter{
		Page:   page,
		Limit:  limit,
		Wallet: wallet,
		Type:   tradeType,
	})
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch transactions")
		return
	}

	resp := make([]globalFeedItemResponse, len(items))
	for i, it := range items {
		resp[i] = globalFeedItemResponse{
			ID:                   it.ID,
			ExecutedAt:           it.ExecutedAt.Format("2006-01-02T15:04:05Z07:00"),
			Action:               it.Action,
			VaultID:              it.VaultID,
			VaultName:            it.VaultName,
			Symbol:               it.Symbol,
			Amount:               it.Amount,
			TransactionSignature: it.TransactionSignature,
			Wallet:               it.Wallet,
		}
	}

	result := globalFeedData{
		Items: resp,
		Total: total,
	}

	// Enterprise Hydration: Cache individual tx entities and push IDs to rolling list
	if h.cache != nil && isDefaultFeed && page == 1 && len(resp) > 0 {
		for _, item := range resp {
			_ = h.cache.SetWithTTL(c.Request.Context(), cache.TxEntityKey(item.ID), item, cache.GlobalFeedTTL)
		}
		// Push latest IDs
		txIDs := make([]any, len(resp))
		for i, item := range resp {
			txIDs[i] = item.ID
		}
		_ = h.cache.LPush(c.Request.Context(), cache.FeedGlobalListKey(), txIDs...)
		_ = h.cache.LTrim(c.Request.Context(), cache.FeedGlobalListKey(), 0, 499)
	}

	SuccessResponse(c, result)
}
