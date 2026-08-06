package database

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/fbyt-clone/backend/internal/models"
	"gorm.io/gorm"
)

// AutoMigrate drops matviews that pin column types, runs GORM migrate, then
// recreates matviews from migrations/030_matviews.sql when present.
// GORM often emits ALTER COLUMN on numeric(36,18) even when already correct;
// Postgres rejects that while matviews depend on the column (SQLSTATE 0A000).
func AutoMigrate(db *gorm.DB) error {
	_ = dropMatviews(db)

	if err := db.AutoMigrate(
		&models.User{},
		&models.Vault{},
		&models.Portfolio{},
		&models.TradeHistory{},
		&models.PriceHistory{},
		&models.VaultMetric{},
	); err != nil {
		return err
	}

	if err := recreateMatviews(db); err != nil {
		return err
	}

	return SeedDemoData(db)
}

func dropMatviews(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	_, _ = sqlDB.Exec("DROP MATERIALIZED VIEW IF EXISTS user_pnl_summary CASCADE;")
	_, _ = sqlDB.Exec("DROP MATERIALIZED VIEW IF EXISTS portfolio_summary CASCADE;")
	return nil
}


func recreateMatviews(db *gorm.DB) error {
	sqlBytes, err := readMatviewSQL()
	if err != nil {
		return nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	_, err = sqlDB.Exec(string(sqlBytes))
	return err
}

func readMatviewSQL() ([]byte, error) {
	candidates := []string{
		filepath.Join("migrations", "030_matviews.sql"),
		filepath.Join("backend", "migrations", "030_matviews.sql"),
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "migrations", "030_matviews.sql"),
			filepath.Join(filepath.Dir(wd), "backend", "migrations", "030_matviews.sql"),
		)
	}
	for _, p := range candidates {
		b, err := os.ReadFile(p)
		if err == nil && len(strings.TrimSpace(string(b))) > 0 {
			return b, nil
		}
	}
	return nil, os.ErrNotExist
}
