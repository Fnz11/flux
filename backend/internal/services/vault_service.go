package services

import (
	"sync"
	"time"

	"github.com/flux-protocol/backend/internal/models"
	"gorm.io/gorm"
)

type cacheEntry struct {
	vault     *models.Vault
	expiresAt time.Time
}

type VaultService struct {
	db       *gorm.DB
	cache    sync.Map
	stop     chan struct{}
	stopOnce sync.Once
}

func NewVaultService(db *gorm.DB) *VaultService {
	vs := &VaultService{db: db, stop: make(chan struct{})}
	go vs.cleanupLoop()
	return vs
}

func (vs *VaultService) Stop() {
	vs.stopOnce.Do(func() {
		close(vs.stop)
	})
}

func (vs *VaultService) cleanupLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			now := time.Now()
			vs.cache.Range(func(key, value interface{}) bool {
				entry := value.(*cacheEntry)
				if now.After(entry.expiresAt) {
					vs.cache.Delete(key)
				}
				return true
			})
		case <-vs.stop:
			return
		}
	}
}

func (vs *VaultService) GetByAddress(address string) (*models.Vault, error) {
	if entry, ok := vs.cache.Load(address); ok {
		cached := entry.(*cacheEntry)
		if time.Now().Before(cached.expiresAt) {
			return cached.vault, nil
		}
		vs.cache.Delete(address)
	}

	var vault models.Vault
	err := vs.db.Preload("Manager").Where("address = ?", address).First(&vault).Error
	if err != nil {
		return nil, err
	}

	vs.cache.Store(address, &cacheEntry{
		vault:     &vault,
		expiresAt: time.Now().Add(30 * time.Second),
	})
	return &vault, nil
}

func (vs *VaultService) Invalidate(address string) {
	vs.cache.Delete(address)
}
