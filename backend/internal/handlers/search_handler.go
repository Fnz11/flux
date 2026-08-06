package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type SearchHandler struct {
	svc *services.SearchService
}

func NewSearchHandler(svc *services.SearchService) *SearchHandler {
	return &SearchHandler{svc: svc}
}

func (h *SearchHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		SuccessResponse(c, gin.H{"items": []interface{}{}})
		return
	}

	limit := 10
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "10")); err == nil {
		limit = l
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}

	switch strings.ToLower(c.DefaultQuery("role", "investor")) {
	case "manager":
		pairs := h.svc.ManagerPairs(c.Request.Context(), q, limit)
		SuccessResponse(c, gin.H{"kind": "pairs", "items": pairs})
	default:
		vaults, err := h.svc.InvestorVaults(c.Request.Context(), q, limit)
		if err != nil {
			ErrorResponse(c, http.StatusInternalServerError, "Failed to search vaults")
			return
		}
		SuccessResponse(c, gin.H{"kind": "vaults", "items": vaultsToSearchResponse(vaults)})
	}
}

type searchVaultItem struct {
	ID          string `json:"id"`
	Address     string `json:"address"`
	DisplayName string `json:"display_name"`
	TVL         string `json:"tvl"`
}

func vaultsToSearchResponse(vaults []domain.SearchVaultMatch) []searchVaultItem {
	resp := make([]searchVaultItem, len(vaults))
	for i, v := range vaults {
		resp[i] = searchVaultItem{
			ID:          v.ID,
			Address:     v.Address,
			DisplayName: v.DisplayName,
			TVL:         v.TVL.String(),
		}
	}
	return resp
}