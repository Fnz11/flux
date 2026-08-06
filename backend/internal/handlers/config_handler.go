package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type AppConfig struct {
	DustThreshold        decimal.Decimal
	FocusAssetsWhitelist []string
}

type ConfigHandler struct {
	cfg *AppConfig
}

func NewConfigHandler(cfg *AppConfig) *ConfigHandler {
	return &ConfigHandler{cfg: cfg}
}

func (h *ConfigHandler) GetConfig(c *gin.Context) {
	if h.cfg == nil {
		SuccessResponse(c, gin.H{
			"dust_threshold":         0.001,
			"focus_assets_whitelist": []string{"SOL", "USDC", "BONK"},
		})
		return
	}
	dust, _ := h.cfg.DustThreshold.Float64()
	SuccessResponse(c, gin.H{
		"dust_threshold":         dust,
		"focus_assets_whitelist": h.cfg.FocusAssetsWhitelist,
	})
}
