package handlers

import (
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type MetricsHandler struct {
	metricsRepo domain.MetricsRepository
}

func NewMetricsHandler(metricsRepo domain.MetricsRepository) *MetricsHandler {
	return &MetricsHandler{
		metricsRepo: metricsRepo,
	}
}

var validMetrics = map[string]bool{
	"tvl":      true,
	"invested": true,
	"pnl":      true,
	"fees":     true,
	"volume":   true,
}

var validPeriods = map[string]bool{
	"7d":  true,
	"14d": true,
	"30d": true,
}

func (h *MetricsHandler) GetMetricsSeries(c *gin.Context) {
	metric := c.Query("metric")
	if metric == "" || !validMetrics[metric] {
		ErrorResponse(c, http.StatusBadRequest, "invalid metric parameter")
		return
	}

	period := c.DefaultQuery("period", "30d")
	if !validPeriods[period] {
		ErrorResponse(c, http.StatusBadRequest, "invalid period parameter")
		return
	}
	
	vaultID := c.Query("vault_id")

	if h.metricsRepo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "metrics repository not initialized")
		return
	}

	response, err := h.metricsRepo.GetMetricSeries(c.Request.Context(), vaultID, metric, period)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch metrics series")
		return
	}

	if response.Series == nil {
		response.Series = make([]domain.MetricDataPoint, 0)
	}

	// Because SuccessResponse wraps data in `{"success": true, "data": ...}`, 
	// we will just return the response as `data`. Wait, the requirement was:
	// Sample JSON Response:
	// { "metric": "pnl", ... } 
	// I'll return it directly via JSON, or use SuccessResponse if that's the standard.
	// Actually, the requirement asks for a specific JSON response format, maybe without "success" wrapper?
	// The rest of the app uses APIResponse. I will use JSON directly or SuccessResponse depending on the requirement.
	// I'll stick to SuccessResponse since the rest of handlers use it, or maybe return it raw to strictly match the requirement.
	c.JSON(http.StatusOK, response)
}
