package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var healthDB *gorm.DB

func SetHealthDB(db *gorm.DB) {
	healthDB = db
}

func HealthCheck(c *gin.Context) {
	if healthDB != nil {
		sqlDB, err := healthDB.DB()
		if err == nil {
			if err := sqlDB.PingContext(c.Request.Context()); err != nil {
				writeJSON(c, http.StatusServiceUnavailable, APIResponse{Success: false, Error: "database unavailable"})
				return
			}
		}
	}
	SuccessResponse(c, gin.H{"status": "ok"})
}

func GetConfig(c *gin.Context) {
	cfg := GetAppConfig()
	if cfg == nil {
		SuccessResponse(c, gin.H{
			"dust_threshold":         0.001,
			"focus_assets_whitelist": []string{"SOL", "USDC", "BONK"},
		})
		return
	}
	SuccessResponse(c, gin.H{
		"dust_threshold":         cfg.DustThreshold,
		"focus_assets_whitelist": cfg.FocusAssetsWhitelist,
	})
}
