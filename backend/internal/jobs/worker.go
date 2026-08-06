package jobs

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	envRefreshInterval     = "MV_REFRESH_INTERVAL"
	defaultRefreshInterval = 5 * time.Minute

	// refreshTimeout bounds every individual REFRESH so one slow view can
	// never delay the next scheduled cycle indefinitely.
	refreshTimeout = 90 * time.Second

	// refreshJitterMax caps the random sleep applied before each scheduled
	// refresh so horizontally scaled replicas desynchronize their ExclusiveLock
	// acquisitions without drifting beyond an acceptable window.
	refreshJitterMax = 15 * time.Second

	// redisRefreshChannel is the pub/sub channel used to broadcast that a full
	// materialized view refresh completed, letting cache layers evict stale keys.
	redisRefreshChannel = "mv:refreshed"
)

var (
	errNilDB = errors.New("nil database connection")

	matViews = []string{"portfolio_summary", "user_pnl_summary"}

	// jitterRng is a concurrency-safe, explicitly seeded PRNG for refresh jitter.
	jitterRng   = rand.New(rand.NewSource(time.Now().UnixNano()))
	jitterRngMu sync.Mutex
)

// MVRefreshWorker periodically refreshes the materialized views that back
// portfolio and PNL reads so they never serve stale aggregates.
type MVRefreshWorker struct {
	db       *gorm.DB
	interval time.Duration
	logger   *logrus.Logger

	// notifier is invoked after each fully successful refresh to let the cache
	// layer evict stale keys. Nil-safe.
	notifier func()
	// redisClient, when set, is used to PUBLISH a refresh-done event after a
	// successful refresh. Publish errors are logged, never fatal.
	redisClient *redis.Client

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

// SetNotifier registers a callback invoked after each successful full refresh
// so consumers can invalidate cached data. Passing nil disables it.
func (w *MVRefreshWorker) SetNotifier(n func()) {
	w.notifier = n
}

// SetRedis configures the worker to PUBLISH the message "all" to the Redis
// channel "mv:refreshed" after each successful refresh. Publish errors are
// logged and never fail the refresh. Passing nil disables publishing.
func (w *MVRefreshWorker) SetRedis(client *redis.Client) {
	w.redisClient = client
}

// Start launches the refresh loop in a background goroutine. It refreshes
// immediately, then every interval. The loop stops when ctx is canceled or
// Stop is called; an in-flight refresh is not interrupted.
func (w *MVRefreshWorker) Start(ctx context.Context) {
	go w.run(ctx)
}

func (w *MVRefreshWorker) run(ctx context.Context) {
	// The immediate first refresh is not jittered so startup latency and first
	// data availability stay predictable; only scheduled iterations are spread.
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
			if !w.sleepWithCtx(ctx, jitter()) {
				return
			}
			_ = w.RefreshViews(ctx)
		}
	}
}

// sleepWithCtx waits for d, aborting early on ctx cancel or Stop so the loop
// exits promptly. It reports whether the full sleep completed.
func (w *MVRefreshWorker) sleepWithCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	case <-w.stopCh:
		return false
	}
}

// jitter returns a random duration in [0, refreshJitterMax). It is used to
// desynchronize refresh ticks across replicated pods.
func jitter() time.Duration {
	jitterRngMu.Lock()
	defer jitterRngMu.Unlock()
	return time.Duration(jitterRng.Int63n(int64(refreshJitterMax)))
}

// RefreshViews refreshes all materialized views concurrently and reports
// per-view execution duration. Each view gets its own timeout context so a slow
// one cannot delay the others. A failure on one view is logged and does not
// prevent the remaining views from refreshing; the first error is returned. On
// full success it emits the cache-invalidation signal.
func (w *MVRefreshWorker) RefreshViews(ctx context.Context) error {
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		firstErr error
	)
	for _, view := range matViews {
		wg.Add(1)
		go func(view string) {
			defer wg.Done()
			vctx, cancel := context.WithTimeout(ctx, refreshTimeout)
			defer cancel()
			start := time.Now()
			if err := w.refreshView(vctx, view); err != nil {
				w.logger.WithError(err).WithField("view", view).Error("materialized view refresh failed")
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				return
			}
			w.logger.WithFields(logrus.Fields{
				"view":        view,
				"duration_ms": time.Since(start).Milliseconds(),
			}).Info("materialized view refreshed")
		}(view)
	}
	wg.Wait()
	if firstErr == nil {
		w.notifyRefresh()
	}
	return firstErr
}

// notifyRefresh emits the refresh-done signal to both the in-process notifier
// and the optional Redis subscriber. Errors are logged, never returned.
func (w *MVRefreshWorker) notifyRefresh() {
	if w.notifier != nil {
		w.notifier()
	}
	if w.redisClient != nil {
		if err := w.redisClient.Publish(context.Background(), redisRefreshChannel, "all").Err(); err != nil {
			w.logger.WithError(err).Error("failed to publish materialized view refresh event")
		}
	}
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