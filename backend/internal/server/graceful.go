package server

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fbyt-clone/backend/internal/ws"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func GracefulShutdown(srv *http.Server, db *gorm.DB, hub *ws.Hub, logger *logrus.Logger, stops ...func()) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatalf("Server forced to shutdown: %v", err)
	}

	hub.Stop()
	for _, stop := range stops {
		stop()
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.Close()
	}

	logger.Info("Server exited gracefully")
}
