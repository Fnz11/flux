package repository

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	gdriver "github.com/glebarez/go-sqlite"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func init() {
	_ = gdriver.RegisterScalarFunction("time_bucket", 2, timeBucketFn)
}

func timeBucketFn(ctx *gdriver.FunctionContext, args []driver.Value) (driver.Value, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("time_bucket expects 2 args, got %d", len(args))
	}
	interval, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("time_bucket interval must be a string, got %T", args[0])
	}
	ts, err := driverValueToTime(args[1])
	if err != nil {
		return nil, err
	}
	switch interval {
	case "1 minute":
		return ts.Truncate(time.Minute).UTC().Format(time.RFC3339), nil
	case "1 hour":
		return ts.Truncate(time.Hour).UTC().Format(time.RFC3339), nil
	case "1 day":
		return ts.Truncate(24 * time.Hour).UTC().Format(time.RFC3339), nil
	default:
		return nil, fmt.Errorf("unsupported interval %q", interval)
	}
}

func driverValueToTime(v driver.Value) (time.Time, error) {
	switch t := v.(type) {
	case time.Time:
		return t, nil
	case int64:
		return time.Unix(t, 0).UTC(), nil
	case float64:
		return time.Unix(int64(t), 0).UTC(), nil
	case string:
		layouts := []string{
			time.RFC3339Nano,
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02 15:04:05-07:00",
			"2006-01-02 15:04:05.999999999 -0700 MST",
			"2006-01-02 15:04:05 -0700 MST",
			"2006-01-02 15:04:05.999999999",
			"2006-01-02 15:04:05",
		}
		for _, layout := range layouts {
			if parsed, err := time.Parse(layout, t); err == nil {
				return parsed, nil
			}
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse %v (%T) as time", v, v)
}

func setupTSDBTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	if err := db.Exec(`CREATE TABLE price_history (
		vault_id TEXT NOT NULL,
		price REAL NOT NULL,
		volume REAL NOT NULL,
		fetched_at DATETIME NOT NULL
	)`).Error; err != nil {
		t.Fatalf("failed to create table: %v", err)
	}

	rows := []struct {
		ts     time.Time
		price  float64
		volume float64
	}{
		{time.Date(2026, 7, 31, 10, 0, 0, 0, time.UTC), 100, 10},
		{time.Date(2026, 7, 31, 10, 30, 0, 0, time.UTC), 110, 20},
		{time.Date(2026, 7, 31, 11, 0, 0, 0, time.UTC), 90, 30},
		{time.Date(2026, 7, 31, 11, 15, 0, 0, time.UTC), 105, 40},
	}
	for _, r := range rows {
		if err := db.Exec(`INSERT INTO price_history (vault_id, price, volume, fetched_at) VALUES (?, ?, ?, ?)`,
			"vault-1", r.price, r.volume, r.ts).Error; err != nil {
			t.Fatalf("failed to insert row: %v", err)
		}
	}
	return db
}

func TestGetOHLCV(t *testing.T) {
	db := setupTSDBTestDB(t)
	repo := NewPriceHistoryRepository(db)

	from := time.Date(2026, 7, 31, 10, 0, 0, 0, time.UTC)
	to := time.Date(2026, 7, 31, 12, 0, 0, 0, time.UTC)

	t.Run("hourly_buckets", func(t *testing.T) {
		points, err := repo.GetOHLCV(context.Background(), "vault-1", "1 hour", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(points) != 2 {
			t.Fatalf("got %d points, want 2: %+v", len(points), points)
		}

		want := []domain.OHLCVPoint{
			{Bucket: time.Date(2026, 7, 31, 10, 0, 0, 0, time.UTC), Open: decimal.NewFromInt(100), High: decimal.NewFromInt(110), Low: decimal.NewFromInt(100), Close: decimal.NewFromInt(110), Volume: decimal.NewFromInt(30)},
			{Bucket: time.Date(2026, 7, 31, 11, 0, 0, 0, time.UTC), Open: decimal.NewFromInt(90), High: decimal.NewFromInt(105), Low: decimal.NewFromInt(90), Close: decimal.NewFromInt(105), Volume: decimal.NewFromInt(70)},
		}
		for i, w := range want {
			if !points[i].Bucket.Equal(w.Bucket) {
				t.Errorf("points[%d].Bucket = %v, want %v", i, points[i].Bucket, w.Bucket)
			}
			if !points[i].Open.Equal(w.Open) || !points[i].High.Equal(w.High) ||
				!points[i].Low.Equal(w.Low) || !points[i].Close.Equal(w.Close) || !points[i].Volume.Equal(w.Volume) {
				t.Errorf("points[%d] = %+v, want %+v", i, points[i], w)
			}
		}
	})

	t.Run("minute_buckets", func(t *testing.T) {
		points, err := repo.GetOHLCV(context.Background(), "vault-1", "1 minute", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(points) != 4 {
			t.Fatalf("got %d points, want 4: %+v", len(points), points)
		}
		if !points[0].Open.Equal(decimal.NewFromInt(100)) || !points[1].Open.Equal(decimal.NewFromInt(110)) || !points[2].Open.Equal(decimal.NewFromInt(90)) || !points[3].Open.Equal(decimal.NewFromInt(105)) {
			t.Errorf("unexpected points: %+v", points)
		}
	})

	t.Run("no_rows_in_range", func(t *testing.T) {
		points, err := repo.GetOHLCV(context.Background(), "vault-1", "1 hour",
			time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
			time.Date(2026, 8, 1, 2, 0, 0, 0, time.UTC))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(points) != 0 {
			t.Errorf("got %d points, want 0: %+v", len(points), points)
		}
	})

	t.Run("other_vault_excluded", func(t *testing.T) {
		points, err := repo.GetOHLCV(context.Background(), "vault-2", "1 hour", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(points) != 0 {
			t.Errorf("got %d points, want 0: %+v", len(points), points)
		}
	})

	t.Run("invalid_bucket", func(t *testing.T) {
		_, err := repo.GetOHLCV(context.Background(), "vault-1", "3 fortnights", from, to)
		if !errors.Is(err, domain.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("from_after_to", func(t *testing.T) {
		_, err := repo.GetOHLCV(context.Background(), "vault-1", "1 hour", to, from)
		if !errors.Is(err, domain.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("missing_table_degrades_with_error", func(t *testing.T) {
		emptyDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			t.Fatalf("failed to open test db: %v", err)
		}
		sqlDB, err := emptyDB.DB()
		if err != nil {
			t.Fatalf("failed to get sql.DB: %v", err)
		}
		sqlDB.SetMaxOpenConns(1)

		emptyRepo := NewPriceHistoryRepository(emptyDB)
		_, err = emptyRepo.GetOHLCV(context.Background(), "vault-1", "1 hour", from, to)
		if err == nil {
			t.Fatal("expected error when price_history table is missing")
		}
	})
}
