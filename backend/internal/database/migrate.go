package database

import (
	"github.com/fbyt-clone/backend/internal/models"
	"gorm.io/gorm"
)

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&models.User{}, &models.Vault{}, &models.Portfolio{}, &models.TradeHistory{})
}
