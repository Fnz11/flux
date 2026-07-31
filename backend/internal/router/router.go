package router

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/fbyt-clone/backend/internal/handlers"
	"github.com/fbyt-clone/backend/internal/middleware"
)

type HandlerSet struct {
	Auth      *handlers.AuthHandler
	Vault     *handlers.VaultHandler
	Trade     *handlers.TradeHandler
	Portfolio *handlers.PortfolioHandler
	WS        *handlers.WSHandler
}

func Setup(hs *HandlerSet) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.JSONMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())

	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", handlers.HealthCheck)
		v1.GET("/config", handlers.GetConfig)

		auth := v1.Group("/auth")
		auth.Use(middleware.RateLimitMiddleware(5, time.Minute))
		{
			auth.POST("/nonce", hs.Auth.Nonce)
			auth.POST("/verify", hs.Auth.Verify)
		}

		vaults := v1.Group("/vaults")
		{
			vaults.GET("", hs.Vault.ListVaults)
			vaults.GET("/:address", hs.Vault.GetVault)
			vaults.PATCH("/:address", hs.Vault.UpdateVaultMetadata)
			vaults.POST("/sync", handlers.SyncVault)
			vaults.GET("/:address/trades", hs.Trade.GetTrades)
		}

		trades := v1.Group("/trades")
		{
			trades.POST("/sync", handlers.SyncTrade)
		}

		portfolio := v1.Group("/portfolio")
		{
			portfolio.GET("/:wallet", hs.Portfolio.GetPortfolio)
		}

		v1.GET("/ws", hs.WS.HandleWS)
	}

	return r
}
