package router

import (
	"time"

	"github.com/flux-protocol/backend/internal/handlers"
	"github.com/flux-protocol/backend/internal/middleware"
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
	Market      *handlers.MarketHandler
	Leaderboard *handlers.LeaderboardHandler
	History     *handlers.HistoryHandler
	GlobalFeed  *handlers.GlobalFeedHandler
	Global      *handlers.GlobalMetricsHandler
	Verify       *handlers.VerifyHandler
	Notification *handlers.NotificationHandler
	Search       *handlers.SearchHandler
	Fee          *handlers.FeeHandler
	TxPrepare    *handlers.TxPrepareHandler
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

		if hs.Fee != nil {
			v1.GET("/fees/:vaultId", hs.Fee.GetVaultFees)
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
				vaults.POST("", hs.Vault.CreateVault)
				vaults.GET("/:address", hs.Vault.GetVault)
				vaults.GET("/:address/balances", hs.Vault.GetVaultBalances)
				vaults.PATCH("/:address", withIdem(hs.Vault.UpdateVaultMetadata)...)
				vaults.PATCH("/:address/metadata", withIdem(hs.Vault.UpdateVaultMetadata)...)
			}
			if hs.Fee != nil {
				vaults.GET("/:address/fees", hs.Fee.GetVaultFees)
			}
			if hs.Sync != nil {
				vaults.POST("/sync", withIdem(hs.Sync.SyncVault)...)
			}
			if hs.History != nil {
				vaults.GET("/:address/sparkline", hs.History.GetVaultSparkline)
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
			if hs.History != nil {
				portfolio.GET("/history", hs.History.GetPortfolioHistory)
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
			if hs.Market != nil {
				metrics.GET("/market", hs.Market.GetMarket)
			}
			if hs.Leaderboard != nil {
				metrics.GET("/leaderboard", hs.Leaderboard.GetLeaderboard)
			}
			if hs.Global != nil {
				metrics.GET("/global", hs.Global.GetGlobalMetrics)
			}
		}

		transactions := v1.Group("/transactions")
		{
			if hs.GlobalFeed != nil {
				transactions.GET("", hs.GlobalFeed.List)
			}
			if hs.Verify != nil {
				transactions.POST("/verify", authMW, hs.Verify.Verify)
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

		txGroup := v1.Group("/tx")
		{
			if hs.TxPrepare != nil {
				prepare := txGroup.Group("/prepare")
				{
					prepare.POST("/create-vault", hs.TxPrepare.PrepareCreateVault)
					prepare.POST("/deposit", hs.TxPrepare.PrepareDeposit)
					prepare.POST("/withdraw", hs.TxPrepare.PrepareWithdraw)
				}
				txGroup.POST("/submit", hs.TxPrepare.SubmitTransaction)
			}
		}
	}

	// Prometheus scrape endpoint (standard top-level location).
	r.GET("/metrics", middleware.MetricsHandler())

	return r
}
