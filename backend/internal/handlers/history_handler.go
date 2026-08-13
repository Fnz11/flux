package handlers

import (
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type HistoryHandler struct {
	repo domain.HistoryRepository
}

func NewHistoryHandler(repo domain.HistoryRepository) *HistoryHandler {
	return &HistoryHandler{repo: repo}
}

var validHistoryRanges = map[string]bool{
	"7d":  true,
	"30d": true,
	"90d": true,
}

func (h *HistoryHandler) GetVaultSparkline(c *gin.Context) {
	if h.repo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "history repository not initialized")
		return
	}

	vaultID := c.Param("id")
	if vaultID == "" {
		vaultID = c.Param("address")
	}
	if vaultID == "" {
		ErrorResponse(c, http.StatusBadRequest, "vault id is required")
		return
	}

	rng := c.DefaultQuery("range", "30d")
	if !validHistoryRanges[rng] {
		ErrorResponse(c, http.StatusBadRequest, "invalid range parameter")
		return
	}

	resolution := c.DefaultQuery("resolution", "day")
	if resolution != "day" && resolution != "hour" {
		ErrorResponse(c, http.StatusBadRequest, "invalid resolution parameter")
		return
	}

	points, err := h.repo.GetVaultSparkline(c.Request.Context(), vaultID, rng, resolution)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch vault sparkline")
		return
	}

	if points == nil {
		points = []domain.HistoryPoint{}
	}

	SuccessResponse(c, domain.VaultSparklineResponse{
		VaultID: vaultID,
		Range:   rng,
		Points:  points,
	})
}

func (h *HistoryHandler) GetPortfolioHistory(c *gin.Context) {
	if h.repo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "history repository not initialized")
		return
	}

	wallet := c.Query("wallet")
	if wallet == "" {
		ErrorResponse(c, http.StatusBadRequest, "wallet parameter is required")
		return
	}
	if !IsValidWalletAddress(wallet) {
		ErrorResponse(c, http.StatusBadRequest, "invalid wallet address")
		return
	}

	rng := c.DefaultQuery("range", "30d")
	if !validHistoryRanges[rng] {
		ErrorResponse(c, http.StatusBadRequest, "invalid range parameter")
		return
	}

	points, err := h.repo.GetPortfolioHistory(c.Request.Context(), wallet, rng)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch portfolio history")
		return
	}

	if points == nil {
		points = []domain.HistoryPoint{}
	}

	SuccessResponse(c, domain.PortfolioHistoryResponse{
		Wallet: wallet,
		Range:  rng,
		Points: points,
	})
}
