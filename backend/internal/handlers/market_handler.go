package handlers

import (
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type MarketHandler struct {
	marketRepo domain.MarketRepository
}

func NewMarketHandler(marketRepo domain.MarketRepository) *MarketHandler {
	return &MarketHandler{
		marketRepo: marketRepo,
	}
}

func (h *MarketHandler) GetMarket(c *gin.Context) {
	if h.marketRepo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "market repository not initialized")
		return
	}

	data, err := h.marketRepo.GetMarketData(c.Request.Context())
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch market data")
		return
	}

	SuccessResponse(c, data)
}