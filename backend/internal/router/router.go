package router

import (
	"time"

	"github.com/fbyt-clone/backend/internal/handlers"
	"github.com/fbyt-clone/backend/internal/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type HandlerSet struct {
	Auth        *handlers.AuthHandler
	Vault       *handlers.VaultHandler
	Trade       *handlers.TradeHandler
	Portfolio   *handlers.PortfolioHandler
	Sync        *handlers.SyncHandler
	Health      *handlers.HealthHandler
	Config      *handlers.ConfigHandler
	WS          *handlers.WSHandler
	Metrics     *handlers.MetricsHandler
	Transaction *handlers.TransactionHandler
	Notification *handlers.NotificationHandler
	Search       *handlers.SearchHandler
	JWTSecret   string
	Redis       *redis.Client
}

func Setup(hs *HandlerSet) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.JSONMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(middleware.TimeoutMiddleware(10 * time.Second))
	r.Use(middleware.PrometheusMiddleware())

	authMW := middleware.AuthMiddleware(hs.JWTSecret)

	// withIdem returns an authMW chain with the Redis-backed idempotency
	// middleware appended whenever a Redis client is available. Applied to all
	// mutation endpoints so safe client retries never double-apply.
	withIdem := func(handlers ...gin.HandlerFunc) gin.HandlersChain {
		chain := gin.HandlersChain{authMW}
		if hs.Redis != nil {
			chain = append(chain, middleware.IdempotencyMiddleware(hs.Redis, 24*time.Hour))
		}
		return append(chain, handlers...)
	}

	v1 := r.Group("/api/v1")
	{
		if hs.Health != nil {
			v1.GET("/health", hs.Health.HealthCheck)
			v1.GET("/health/ready", hs.Health.ReadinessCheck)
			v1.GET("/health/live", hs.Health.LivenessCheck)
		}
		if hs.Config != nil {
			v1.GET("/config", hs.Config.GetConfig)
		}

		auth := v1.Group("/auth")
		if hs.Redis != nil && hs.Auth != nil {
			auth.Use(middleware.RedisTokenBucketMiddleware(hs.Redis, 5, time.Minute))
		} else {
			auth.Use(middleware.RateLimitMiddleware(5, time.Minute))
		}
		{
			if hs.Auth != nil {
				auth.POST("/nonce", hs.Auth.Nonce)
				auth.POST("/verify", hs.Auth.Verify)
			}
		}

		vaults := v1.Group("/vaults")
		{
			if hs.Vault != nil {
				vaults.GET("", hs.Vault.ListVaults)
				vaults.POST("", withIdem(hs.Vault.CreateVault)...)
				vaults.GET("/:address", hs.Vault.GetVault)
				vaults.GET("/:address/balances", hs.Vault.GetVaultBalances)
				vaults.PATCH("/:address", withIdem(hs.Vault.UpdateVaultMetadata)...)
			}
			if hs.Sync != nil {
				vaults.POST("/sync", withIdem(hs.Sync.SyncVault)...)
			}
			if hs.Trade != nil {
				vaults.GET("/trades", hs.Trade.GetBatchTrades)
				vaults.GET("/:address/trades", hs.Trade.GetTrades)
			}
		}

		trades := v1.Group("/trades")
		{
			if hs.Sync != nil {
				trades.POST("/sync", withIdem(hs.Sync.SyncTrade)...)
			}
		}

		portfolio := v1.Group("/portfolio")
		{
			if hs.Portfolio != nil {
				portfolio.GET("/:wallet", hs.Portfolio.GetPortfolio)
			}
		}

		if hs.WS != nil {
			v1.GET("/ws", hs.WS.HandleWS)
		}

		metrics := v1.Group("/metrics")
		{
			if hs.Metrics != nil {
				metrics.GET("/series", hs.Metrics.GetMetricsSeries)
			}
		}

		transactions := v1.Group("/transactions")
		{
			if hs.Transaction != nil {
				transactions.POST("/simulate", hs.Transaction.SimulateTransaction)
			}
		}

		notifications := v1.Group("/notifications")
		{
			if hs.Notification != nil {
				notifications.GET("", hs.Notification.List)
				notifications.POST("", hs.Notification.Create)
				notifications.POST("/read", hs.Notification.MarkAllRead)
			}
		}

		if hs.Search != nil {
			v1.GET("/search", hs.Search.Search)
		}
	}

	// Prometheus scrape endpoint (standard top-level location).
	r.GET("/metrics", middleware.MetricsHandler())

	return r
}
