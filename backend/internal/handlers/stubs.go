package handlers

import (
	"net/http"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	pinger domain.Pinger
	cache  cache.Cache
}

func NewHealthHandler(pinger domain.Pinger) *HealthHandler {
	return &HealthHandler{pinger: pinger}
}

func (h *HealthHandler) SetCache(c cache.Cache) {
	h.cache = c
}

func (h *HealthHandler) HealthCheck(c *gin.Context) {
	dbStatus := "ok"
	redisStatus := "ok"
	healthy := true

	if h.pinger != nil {
		if err := h.pinger.Ping(c.Request.Context()); err != nil {
			dbStatus = "down"
			healthy = false
		}
	}

	if h.cache != nil {
		if err := h.cache.Ping(c.Request.Context()); err != nil {
			redisStatus = "down"
			healthy = false
		}
	}

	details := gin.H{
		"status": map[string]string{
			"db":    dbStatus,
			"redis": redisStatus,
		},
	}

	if !healthy {
		writeJSON(c, http.StatusServiceUnavailable, APIResponse{
			Success: false,
			Error:   "service degraded",
			Data:    details,
		})
		return
	}

	SuccessResponse(c, details)
}

func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	h.HealthCheck(c)
}

func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	SuccessResponse(c, gin.H{"status": "alive"})
}
