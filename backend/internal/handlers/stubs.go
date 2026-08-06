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
	state  func() map[string]string
}

func NewHealthHandler(pinger domain.Pinger) *HealthHandler {
	return &HealthHandler{pinger: pinger}
}

func (h *HealthHandler) SetCache(c cache.Cache) {
	h.cache = c
}

// SetState registers a callback that returns dependency circuit-breaker
// states (name -> "closed"/"open"/"half-open") for inclusion in the health
// details. Passing nil disables it.
func (h *HealthHandler) SetState(fn func() map[string]string) {
	h.state = fn
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

	if h.state != nil {
		if states := h.state(); states != nil {
			details["circuit_breakers"] = states
		}
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
