package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/config"
	"github.com/flux-protocol/backend/internal/database"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/handlers"
	"github.com/flux-protocol/backend/internal/jobs"
	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/repository"
	"github.com/flux-protocol/backend/internal/router"
	"github.com/flux-protocol/backend/internal/server"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/flux-protocol/backend/internal/ws"
	"github.com/flux-protocol/backend/pkg/solana"
)

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("failed to load config: %v", err)
	}

	db, err := database.Connect(cfg)
	if err != nil {
		logger.Fatalf("failed to connect database: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	vaultRepo := repository.NewVaultRepository(db)
	tradeRepo := repository.NewTradeRepository(db)
	portfolioRepo := repository.NewPortfolioRepository(db)
	metricsRepo := repository.NewMetricsRepository(db)
	txManager := repository.NewTxManager(db)

	pinger, _ := txManager.(domain.Pinger)

	redisClient, err := cache.NewRedisClient("")
	if err != nil {
		logger.WithError(err).Warn("redis init failed, caching disabled")
	}
	var c cache.Cache
	if redisClient != nil {
		c = cache.NewRedisCache(redisClient)
	}

	solanaClient := solana.NewClient(cfg.SolanaRPCURL).WithProgramID(cfg.SolanaProgramID)
	hub := ws.NewHub()
	go hub.Run()
	eventService := services.NewEventService(hub, db)

	syncHandler := handlers.NewSyncHandler(vaultRepo, userRepo, tradeRepo, portfolioRepo, txManager, solanaClient, eventService)
	syncHandler.SetCache(c)

	vaultSvc := services.NewVaultService(db)
	vaultHandler := handlers.NewVaultHandler(vaultRepo, portfolioRepo, userRepo, vaultSvc, cfg.FocusAssetsWhitelist)
	vaultHandler.SetCache(c)

	authHandler := handlers.NewAuthHandler(userRepo, cfg.JWTSecret)

	tradeHandler := handlers.NewTradeHandler(tradeRepo, vaultRepo)
	tradeHandler.SetCache(c)

	portfolioSvc := services.NewPortfolioService(db, c)
	portfolioHandler := handlers.NewPortfolioHandler(userRepo, portfolioRepo)
	portfolioHandler.SetService(portfolioSvc)

	wsHandler := handlers.NewWSHandler(hub, cfg.JWTSecret)

	healthHandler := handlers.NewHealthHandler(pinger)
	healthHandler.SetCache(c)
	healthHandler.SetState(func() map[string]string {
		m := middleware.BreakerStates()
		m["solana_rpc"] = solanaClient.CircuitState()
		if rc, ok := c.(*cache.RedisCache); ok {
			m["redis"] = rc.BreakerState()
		}
		return m
	})

	configHandler := handlers.NewConfigHandler(&handlers.AppConfig{
		DustThreshold:        cfg.DustThreshold,
		FocusAssetsWhitelist: cfg.FocusAssetsWhitelist,
	})

	metricsHandler := handlers.NewMetricsHandler(metricsRepo)
	marketHandler := handlers.NewMarketHandler(repository.NewMarketRepository(db))
	leaderboardHandler := handlers.NewLeaderboardHandler(repository.NewCachedLeaderboardRepository(repository.NewLeaderboardRepository(db), c))
	historyHandler := handlers.NewHistoryHandler(repository.NewHistoryRepository(db))
	globalFeedHandler := handlers.NewGlobalFeedHandler(repository.NewGlobalFeedRepository(db))
	globalFeedHandler.SetCache(c)
	globalMetricsHandler := handlers.NewGlobalMetricsHandler(repository.NewGlobalMetricsRepository(db))
	verifyHandler := handlers.NewVerifyHandler(solanaClient, tradeRepo)

	notificationRepo := repository.NewNotificationRepository(db)
	searchRepo := repository.NewSearchRepository(db)
	notificationSvc := services.NewNotificationService(notificationRepo, hub)
	searchSvc := services.NewSearchService(searchRepo)
	notificationHandler := handlers.NewNotificationHandler(notificationRepo, userRepo, notificationSvc)
	searchHandler := handlers.NewSearchHandler(searchSvc)
	feeHandler := handlers.NewFeeHandler(vaultRepo)

	storageSvc, err := services.NewLocalStorageService("./uploads")
	if err != nil {
		logger.Fatalf("failed to initialize upload storage service: %v", err)
	}
	uploadHandler := handlers.NewUploadHandler(storageSvc, 5<<20)

	draftRepo := repository.NewGormTransactionDraftRepository(db)
	txPrepareSvc := services.NewTxPrepareService(draftRepo, vaultRepo, solanaClient)
	txPrepareHandler := handlers.NewTxPrepareHandler(txPrepareSvc)

	txIndexerWorker := jobs.NewTxIndexerWorker(db, vaultRepo, userRepo, tradeRepo, portfolioRepo, solanaClient, eventService, logger, 5*time.Second)
	txIndexerWorker.Start(context.Background())
	txPrepareSvc.SetReconcileCallback(txIndexerWorker.TriggerAsyncReconcile)

	mvWorker := jobs.NewMVRefreshWorker(db, logger, 0)
	mvWorker.SetRedis(redisClient)
	mvWorker.SetNotifier(func() {
		logger.WithField("event", "mv:refreshed").
			Debug("materialized view refresh complete; cache eviction signal emitted")
	})
	mvWorker.Start(context.Background())

	// Warm high-traffic keys at startup to avoid a DB thundering herd after a
	// pod restart (audit 1.3.5). The loader map is intentionally empty for now.
	// TODO(audit 1.3.5): add real loaders (leaderboard, vault list) once the
	// backing queries are exposed without an import cycle; the empty set still
	// exercises the warming infrastructure.
	if redisClient != nil {
		go func() {
			warmCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			cache.WarmCache(warmCtx, redisClient, map[string]func() (any, error){})
		}()
	}

	r := router.Setup(&router.HandlerSet{
		Auth:         authHandler,
		Vault:        vaultHandler,
		Trade:        tradeHandler,
		Portfolio:    portfolioHandler,
		Sync:         syncHandler,
		Health:       healthHandler,
		Config:       configHandler,
		WS:           wsHandler,
		Metrics:      metricsHandler,
		Market:       marketHandler,
		Leaderboard:  leaderboardHandler,
		History:      historyHandler,
		GlobalFeed:   globalFeedHandler,
		Global:       globalMetricsHandler,
		Verify:       verifyHandler,
		Notification: notificationHandler,
		Search:       searchHandler,
		Fee:          feeHandler,
		TxPrepare:    txPrepareHandler,
		Upload:       uploadHandler,
		UploadsDir:   "./uploads",
		JWTSecret:    cfg.JWTSecret,
		Redis:        redisClient,
	})

	if cfg.EnablePprof {
		middleware.RegisterPprof(r)
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.ServerPort),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.WithField("port", cfg.ServerPort).Info("server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("server error: %v", err)
		}
	}()

	server.GracefulShutdown(srv, db, hub, logger, mvWorker.Stop, vaultSvc.Stop)
}
