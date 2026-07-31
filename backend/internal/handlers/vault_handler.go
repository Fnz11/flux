package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/middleware"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VaultHandler struct {
	db        *gorm.DB
	svc       *services.VaultService
	whitelist []string
	cache     cache.Cache
}

func NewVaultHandler(db *gorm.DB, svc *services.VaultService, whitelist []string) *VaultHandler {
	return &VaultHandler{db: db, svc: svc, whitelist: whitelist}
}

func (h *VaultHandler) SetCache(c cache.Cache) {
	h.cache = c
}

func (h *VaultHandler) ListVaults(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if page > 10000 {
		page = 10000
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	query := h.db.Model(&models.Vault{}).Preload("Manager")
	countQuery := h.db.Model(&models.Vault{})

	if status != "" {
		query = query.Where("status = ?", status)
		countQuery = countQuery.Where("status = ?", status)
	}

	var total int64
	if err := countQuery.WithContext(c.Request.Context()).Count(&total).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to count vaults")
		return
	}

	var vaults []models.Vault
	offset := (page - 1) * limit
	if err := query.WithContext(c.Request.Context()).Offset(offset).Limit(limit).Order("id ASC").Find(&vaults).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vaults")
		return
	}

	resp := make([]models.VaultResponse, len(vaults))
	for i, v := range vaults {
		resp[i] = models.ToVaultResponse(&v)
	}

	PaginatedResponse(c, resp, int(total), page, limit)
}

func (h *VaultHandler) GetVault(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		ErrorResponse(c, http.StatusBadRequest, "Address is required")
		return
	}

	vault, err := h.svc.GetByAddress(address)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault")
		return
	}

	var tradeCount int64
	if err := h.db.WithContext(c.Request.Context()).Model(&models.TradeHistory{}).Where("vault_id = ?", vault.ID).Count(&tradeCount).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to count trades")
		return
	}

	var portfolioCount int64
	if err := h.db.WithContext(c.Request.Context()).Model(&models.Portfolio{}).Where("vault_id = ?", vault.ID).Count(&portfolioCount).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to count portfolios")
		return
	}

	resp := models.ToVaultResponse(vault)

	SuccessResponse(c, gin.H{
		"vault":           resp,
		"trade_count":     tradeCount,
		"portfolio_count": portfolioCount,
	})
}

type UpdateMetadataRequest struct {
	DisplayName *string   `json:"display_name"`
	Description *string   `json:"description"`
	FocusAssets *[]string `json:"focus_assets"`
}

func (h *VaultHandler) UpdateVaultMetadata(c *gin.Context) {
	requesterAddr := middleware.GetWalletAddress(c)
	if requesterAddr == "" {
		ErrorResponse(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	address := c.Param("address")
	if address == "" {
		ErrorResponse(c, http.StatusBadRequest, "Address is required")
		return
	}

	var req UpdateMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.DisplayName != nil {
		trimmed := strings.TrimSpace(*req.DisplayName)
		req.DisplayName = &trimmed
	}
	if req.Description != nil {
		trimmed := strings.TrimSpace(*req.Description)
		req.Description = &trimmed
	}

	if req.DisplayName == nil && req.Description == nil && req.FocusAssets == nil {
		ErrorResponse(c, http.StatusBadRequest, "No fields to update")
		return
	}

	vault, err := h.svc.GetByAddress(address)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault")
		return
	}

	if vault.Manager.WalletAddress != requesterAddr {
		ErrorResponse(c, http.StatusForbidden, "Only the vault manager can update metadata")
		return
	}

	var metadata map[string]interface{}
	if vault.Metadata != nil {
		if err := json.Unmarshal(vault.Metadata, &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	if req.DisplayName != nil {
		metadata["displayName"] = *req.DisplayName
	}
	if req.Description != nil {
		metadata["description"] = *req.Description
	}
	if req.FocusAssets != nil {
		for _, asset := range *req.FocusAssets {
			if !h.isValidAsset(asset) {
				ErrorResponse(c, http.StatusBadRequest, "Invalid focus asset")
				return
			}
		}
		metadata["focusAssets"] = *req.FocusAssets
	}

	metaBytes, err := json.Marshal(metadata)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to serialize metadata")
		return
	}

	if err := h.db.WithContext(c.Request.Context()).Model(&models.Vault{}).Where("address = ?", address).Update("metadata", metaBytes).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to update metadata")
		return
	}

	h.svc.Invalidate(address)
	invalidateLeaderboardCache(h.cache, c.Request.Context())
	invalidateVaultSummaryCache(h.cache, c.Request.Context(), vault.Address)
	invalidateVaultPortfolioCaches(h.cache, h.db, c.Request.Context(), vault.ID)

	updated, err := h.svc.GetByAddress(address)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch updated vault")
		return
	}

	SuccessResponse(c, gin.H{"vault": models.ToVaultResponse(updated)})
}

func (h *VaultHandler) isValidAsset(asset string) bool {
	if len(h.whitelist) == 0 {
		return true
	}
	for _, wl := range h.whitelist {
		if strings.EqualFold(asset, wl) {
			return true
		}
	}
	return false
}
