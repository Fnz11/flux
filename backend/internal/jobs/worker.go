package jobs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	envRefreshInterval     = "MV_REFRESH_INTERVAL"
	defaultRefreshInterval = 5 * time.Minute
)

var (
	errNilDB = errors.New("nil database connection")

	matViews = []string{"portfolio_summary", "user_pnl_summary"}
)

// MVRefreshWorker periodically refreshes the materialized views that back
// portfolio and PNL reads so they never serve stale aggregates.
type MVRefreshWorker struct {
	db       *gorm.DB
	interval time.Duration
	logger   *logrus.Logger

	stopOnce sync.Once
	stopCh   chan struct{}
}

func NewMVRefreshWorker(db *gorm.DB, logger *logrus.Logger, interval time.Duration) *MVRefreshWorker {
	if logger == nil {
		logger = logrus.New()
	}
	return &MVRefreshWorker{
		db:       db,
		interval: interval,
		logger:   logger,
		stopCh:   make(chan struct{}),
	}
}

// Start launches the refresh loop in a background goroutine. It refreshes
// immediately, then every interval. The loop stops when ctx is canceled or
// Stop is called; an in-flight refresh is not interrupted.
func (w *MVRefreshWorker) Start(ctx context.Context) {
	go w.run(ctx)
}

func (w *MVRefreshWorker) run(ctx context.Context) {
	_ = w.RefreshViews(ctx)
	ticker := time.NewTicker(w.effectiveInterval())
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopCh:
			return
		case <-ticker.C:
			_ = w.RefreshViews(ctx)
		}
	}
}

// RefreshViews refreshes both materialized views sequentially and reports
// per-view execution duration. A failure on one view is logged and does not
// prevent the remaining views from refreshing; the first error is returned.
func (w *MVRefreshWorker) RefreshViews(ctx context.Context) error {
	var firstErr error
	for _, view := range matViews {
		start := time.Now()
		if err := w.refreshView(ctx, view); err != nil {
			w.logger.WithError(err).WithField("view", view).Error("materialized view refresh failed")
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		w.logger.WithFields(logrus.Fields{
			"view":        view,
			"duration_ms": time.Since(start).Milliseconds(),
		}).Info("materialized view refreshed")
	}
	return firstErr
}

func (w *MVRefreshWorker) refreshView(ctx context.Context, name string) error {
	if w.db == nil {
		return fmt.Errorf("refresh materialized view %s: %w", name, errNilDB)
	}
	if err := w.db.WithContext(ctx).Exec("REFRESH MATERIALIZED VIEW CONCURRENTLY " + name).Error; err != nil {
		return fmt.Errorf("refresh materialized view %s: %w", name, err)
	}
	return nil
}

// Stop halts the refresh loop. Safe to call multiple times.
func (w *MVRefreshWorker) Stop() {
	w.stopOnce.Do(func() { close(w.stopCh) })
}

func (w *MVRefreshWorker) effectiveInterval() time.Duration {
	if w.interval > 0 {
		return w.interval
	}
	return refreshIntervalFromEnv()
}

// refreshIntervalFromEnv reads MV_REFRESH_INTERVAL in seconds and falls back
// to 5 minutes when the variable is unset or invalid.
func refreshIntervalFromEnv() time.Duration {
	raw := os.Getenv(envRefreshInterval)
	if raw == "" {
		return defaultRefreshInterval
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return defaultRefreshInterval
	}
	return time.Duration(seconds) * time.Second
}
