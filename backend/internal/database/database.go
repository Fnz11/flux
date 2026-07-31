package database

import (
	"fmt"
	"math"
	"time"

	"github.com/fbyt-clone/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func ConnectWithRetry(cfg *config.Config) (*gorm.DB, error) {
	var db *gorm.DB
	var err error
	maxRetries := 5
	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
		if err == nil {
			break
		}
		backoff := time.Duration(math.Pow(2, float64(i))) * time.Second
		fmt.Printf("db connect attempt %d/%d failed, retrying in %v: %v\n", i+1, maxRetries, backoff, err)
		time.Sleep(backoff)
	}
	if err != nil {
		return nil, fmt.Errorf("db connect failed after %d retries: %w", maxRetries, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

func Connect(cfg *config.Config) (*gorm.DB, error) {
	return ConnectWithRetry(cfg)
}
