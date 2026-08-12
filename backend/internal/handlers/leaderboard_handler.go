package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

var validLeaderboardTypes = map[string]bool{
	"trending": true,
	"gainers":  true,
	"new":      true,
}

type LeaderboardHandler struct {
	leaderboardRepo domain.LeaderboardRepository
}

func NewLeaderboardHandler(leaderboardRepo domain.LeaderboardRepository) *LeaderboardHandler {
	return &LeaderboardHandler{
		leaderboardRepo: leaderboardRepo,
	}
}

func (h *LeaderboardHandler) GetLeaderboard(c *gin.Context) {
	lbType := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", "trending")))
	if !validLeaderboardTypes[lbType] {
		ErrorResponse(c, http.StatusBadRequest, "invalid type parameter")
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

	period := c.DefaultQuery("period", "7d")

	if h.leaderboardRepo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "leaderboard repository not initialized")
		return
	}

	items, err := h.leaderboardRepo.GetLeaderboard(c.Request.Context(), lbType, limit, period)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch leaderboard")
		return
	}

	if items == nil {
		items = []domain.LeaderboardItem{}
	}

	SuccessResponse(c, gin.H{"type": lbType, "items": items})
}
