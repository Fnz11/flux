package database

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"time"

	"github.com/flux-protocol/backend/internal/config"
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

	applyPoolSettings(sqlDB)

	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

func Connect(cfg *config.Config) (*gorm.DB, error) {
	return ConnectWithRetry(cfg)
}

func applyPoolSettings(sqlDB *sql.DB) {
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
}

type ReadReplicaSet struct {
	Primary *gorm.DB
	Replica *gorm.DB
}

func ConnectReadReplica(cfg *config.Config) (*ReadReplicaSet, error) {
	primary, err := ConnectWithRetry(cfg)
	if err != nil {
		return nil, err
	}

	replicaURL := os.Getenv("READ_REPLICA_URL")
	if replicaURL == "" {
		return &ReadReplicaSet{Primary: primary}, nil
	}

	replica, err := gorm.Open(postgres.Open(replicaURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("read replica connect failed: %w", err)
	}
	replicaSQLDB, err := replica.DB()
	if err != nil {
		return nil, err
	}
	applyPoolSettings(replicaSQLDB)

	return &ReadReplicaSet{Primary: primary, Replica: replica}, nil
}
