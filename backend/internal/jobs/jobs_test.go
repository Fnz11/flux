package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func TestRefreshIntervalFromEnv(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		want     time.Duration
	}{
		{"valid seconds", "30", 30 * time.Second},
		{"unset", "", defaultRefreshInterval},
		{"non-numeric", "abc", defaultRefreshInterval},
		{"zero", "0", defaultRefreshInterval},
		{"negative", "-5", defaultRefreshInterval},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(envRefreshInterval, tt.envValue)
			if got := refreshIntervalFromEnv(); got != tt.want {
				t.Fatalf("refreshIntervalFromEnv() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEffectiveIntervalPrecedence(t *testing.T) {
	t.Setenv(envRefreshInterval, "30")
	w := NewMVRefreshWorker(nil, logrus.New(), time.Minute)
	if got := w.effectiveInterval(); got != time.Minute {
		t.Fatalf("effectiveInterval() = %v, want %v", got, time.Minute)
	}
	w2 := NewMVRefreshWorker(nil, logrus.New(), 0)
	if got := w2.effectiveInterval(); got != 30*time.Second {
		t.Fatalf("effectiveInterval() = %v, want %v", got, 30*time.Second)
	}
}

func TestRefreshViewsNilDB(t *testing.T) {
	w := NewMVRefreshWorker(nil, logrus.New(), time.Minute)
	err := w.RefreshViews(context.Background())
	if !errors.Is(err, errNilDB) {
		t.Fatalf("RefreshViews() error = %v, want errNilDB", err)
	}
}

func TestRefreshViewsUnreachableDB(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	w := NewMVRefreshWorker(db, logrus.New(), time.Minute)
	if err := w.RefreshViews(context.Background()); err == nil {
		t.Fatal("RefreshViews() = nil, want error on a non-postgres db")
	}
}
