package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/config"
	"github.com/fbyt-clone/backend/internal/database"
	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/handlers"
	"github.com/fbyt-clone/backend/internal/jobs"
	"github.com/fbyt-clone/backend/internal/middleware"
	"github.com/fbyt-clone/backend/internal/repository"
	"github.com/fbyt-clone/backend/internal/router"
	"github.com/fbyt-clone/backend/internal/server"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/fbyt-clone/backend/internal/ws"
	"github.com/fbyt-clone/backend/pkg/solana"
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

	configHandler := handlers.NewConfigHandler(&handlers.AppConfig{
		DustThreshold:        cfg.DustThreshold,
		FocusAssetsWhitelist: cfg.FocusAssetsWhitelist,
	})

	metricsHandler := handlers.NewMetricsHandler(metricsRepo)
	transactionHandler := handlers.NewTransactionHandler()

	mvWorker := jobs.NewMVRefreshWorker(db, logger, 0)
	mvWorker.Start(context.Background())

	r := router.Setup(&router.HandlerSet{
		Auth:        authHandler,
		Vault:       vaultHandler,
		Trade:       tradeHandler,
		Portfolio:   portfolioHandler,
		Sync:        syncHandler,
		Health:      healthHandler,
		Config:      configHandler,
		WS:          wsHandler,
		Metrics:     metricsHandler,
		Transaction: transactionHandler,
		JWTSecret:   cfg.JWTSecret,
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
