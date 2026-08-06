package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
)

type VaultHandler struct {
	vaultRepo     domain.VaultRepository
	portfolioRepo domain.PortfolioRepository
	userRepo      domain.UserRepository
	svc           *services.VaultService
	whitelist     []string
	cache         cache.Cache
}

func NewVaultHandler(vaultRepo domain.VaultRepository, portfolioRepo domain.PortfolioRepository, userRepo domain.UserRepository, svc *services.VaultService, whitelist []string) *VaultHandler {
	return &VaultHandler{
		vaultRepo:     vaultRepo,
		portfolioRepo: portfolioRepo,
		userRepo:      userRepo,
		svc:           svc,
		whitelist:     whitelist,
	}
}

func (h *VaultHandler) SetCache(c cache.Cache) {
	h.cache = c
}

func (h *VaultHandler) ListVaults(c *gin.Context) {
	status := c.Query("status")
	managerAddress := c.Query("manager_address")
	sortBy := c.Query("sort_by")
	sortOrder := c.Query("sort_order")
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

	filter := domain.VaultListFilter{
		Status:         status,
		ManagerAddress: managerAddress,
		SortBy:         sortBy,
		SortOrder:      sortOrder,
		Page:           page,
		Limit:          limit,
	}

	details, total, err := h.vaultRepo.List(c.Request.Context(), filter)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vaults")
		return
	}

	resp := make([]models.VaultResponse, len(details))
	for i, d := range details {
		resp[i] = vaultDetailToResponse(&d)
	}

	PaginatedResponse(c, resp, int(total), page, limit)
}

type CreateVaultRequest struct {
	Address           string          `json:"address" binding:"required"`
	ManagerAddress    string          `json:"manager_address" binding:"required"`
	Status            string          `json:"status"`
	PerformanceFeeBps int             `json:"performance_fee_bps"`
	ManagementFeeBps  int             `json:"management_fee_bps"`
	MinRaiseAmount    decimal.Decimal `json:"min_raise_amount"`
	LockupPeriod      int64           `json:"lockup_period"`
	VaultType         string          `json:"vault_type"`
	Metadata          datatypes.JSON  `json:"metadata"`
}

func (h *VaultHandler) CreateVault(c *gin.Context) {
	var req CreateVaultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	var managerID string
	if h.userRepo != nil {
		user, err := h.userRepo.FindOrCreateByWallet(c.Request.Context(), req.ManagerAddress)
		if err != nil {
			ErrorResponse(c, http.StatusInternalServerError, "Failed to find or create user")
			return
		}
		managerID = user.ID
	}

	status := req.Status
	if status == "" {
		status = "Fundraising"
	}
	vaultType := req.VaultType
	if vaultType == "" {
		vaultType = "open"
	}

	vaultDetail := domain.VaultDetail{
		Address:           req.Address,
		ManagerID:         managerID,
		ManagerAddress:    req.ManagerAddress,
		Status:            status,
		Metadata:          req.Metadata,
		PerformanceFeeBps: req.PerformanceFeeBps,
		ManagementFeeBps:  req.ManagementFeeBps,
		MinRaiseAmount:    req.MinRaiseAmount,
		LockupPeriod:      req.LockupPeriod,
		VaultType:         vaultType,
	}

	if err := h.vaultRepo.Create(c.Request.Context(), &vaultDetail); err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create vault")
		return
	}

	invalidateLeaderboardCache(h.cache, c.Request.Context())

	SuccessResponse(c, vaultDetailToResponse(&vaultDetail))
}

func (h *VaultHandler) GetVault(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		ErrorResponse(c, http.StatusBadRequest, "Address is required")
		return
	}

	vault, err := h.vaultRepo.GetByAddress(c.Request.Context(), address)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault")
		return
	}

	resp := vaultDetailToResponse(vault)

	SuccessResponse(c, gin.H{
		"vault":           resp,
		"trade_count":     vault.TradeCount,
		"portfolio_count": vault.PortfolioCount,
	})
}

func (h *VaultHandler) GetVaultBalances(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		ErrorResponse(c, http.StatusBadRequest, "Address is required")
		return
	}

	balances, err := h.vaultRepo.GetVaultBalances(c.Request.Context(), address)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch balances")
		return
	}

	SuccessResponse(c, gin.H{
		"balances": balances,
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

	vault, err := h.vaultRepo.GetByAddress(c.Request.Context(), address)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault")
		return
	}

	if vault.ManagerAddress != requesterAddr {
		ErrorResponse(c, http.StatusForbidden, "Only the vault manager can update metadata")
		return
	}

	var metadata map[string]interface{}
	if len(vault.Metadata) > 0 {
		_ = json.Unmarshal(vault.Metadata, &metadata)
	}
	if metadata == nil {
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

	if err := h.vaultRepo.UpdateMetadata(c.Request.Context(), address, metadata); err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to update metadata")
		return
	}

	if h.svc != nil {
		h.svc.Invalidate(address)
	}
	invalidateLeaderboardCache(h.cache, c.Request.Context())
	invalidateVaultSummaryCache(h.cache, c.Request.Context(), vault.Address)
	invalidateVaultPortfolioCaches(h.cache, h.portfolioRepo, c.Request.Context(), vault.ID)

	updated, err := h.vaultRepo.GetByAddress(c.Request.Context(), address)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch updated vault")
		return
	}

	SuccessResponse(c, gin.H{"vault": vaultDetailToResponse(updated)})
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

func vaultDetailToResponse(d *domain.VaultDetail) models.VaultResponse {
	return models.VaultResponse{
		ID:                d.ID,
		Address:           d.Address,
		ManagerAddress:    d.ManagerAddress,
		Status:            d.Status,
		Metadata:          d.Metadata,
		PerformanceFeeBps: d.PerformanceFeeBps,
		ManagementFeeBps:  d.ManagementFeeBps,
		MinRaiseAmount:    d.MinRaiseAmount,
		LockupPeriod:      d.LockupPeriod,
		VaultType:         d.VaultType,
		InvestorCount:     d.InvestorCount,
		TVL:               d.TVL,
		CreatedAt:         d.CreatedAt,
		UpdatedAt:         d.UpdatedAt,
	}
}
