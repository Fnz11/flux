package handlers

import (
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type GlobalMetricsHandler struct {
	globalMetricsRepo domain.GlobalMetricsRepository
}

func NewGlobalMetricsHandler(globalMetricsRepo domain.GlobalMetricsRepository) *GlobalMetricsHandler {
	return &GlobalMetricsHandler{
		globalMetricsRepo: globalMetricsRepo,
	}
}

func (h *GlobalMetricsHandler) GetGlobalMetrics(c *gin.Context) {
	if h.globalMetricsRepo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "global metrics repository not initialized")
		return
	}

	data, err := h.globalMetricsRepo.GetGlobalMetrics(c.Request.Context())
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch global metrics")
		return
	}

	SuccessResponse(c, data)
}