package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/fbyt-clone/backend/internal/models"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type positionResponse struct {
	VaultID            uuid.UUID `json:"vault_id"`
	VaultAddress       string    `json:"vault_address"`
	VaultName          string    `json:"vault_name"`
	SharesOwned        float64   `json:"shares_owned"`
	TotalInvestedValue float64   `json:"total_invested_value"`
	AverageEntryPrice  float64   `json:"average_entry_price"`
	CurrentValue       float64   `json:"current_value"`
	PnL                float64   `json:"pnl"`
	PnLPercent         float64   `json:"pnl_percent"`
}

type portfolioData struct {
	Positions []positionResponse `json:"positions"`
	Wallet    string             `json:"wallet"`
}

type PortfolioHandler struct {
	DB  *gorm.DB
	svc *services.PortfolioService
}

func (h *PortfolioHandler) SetService(svc *services.PortfolioService) {
	h.svc = svc
}

func (h *PortfolioHandler) GetPortfolio(c *gin.Context) {
	wallet := c.Param("wallet")
	if wallet == "" {
		ErrorResponse(c, http.StatusBadRequest, "wallet address required")
		return
	}

	var user models.User
	if err := h.DB.WithContext(c.Request.Context()).Where("wallet_address = ?", wallet).
		First(&user).Error; err != nil {
		ErrorResponse(c, http.StatusNotFound, "not found")
		return
	}

	if h.svc != nil {
		h.getPortfolioFromService(c, wallet, user)
		return
	}

	if err := h.DB.WithContext(c.Request.Context()).
		Preload("Portfolios.Vault").
		First(&user).Error; err != nil {
		ErrorResponse(c, http.StatusNotFound, "not found")
		return
	}

	if len(user.Portfolios) == 0 {
		SuccessResponse(c, portfolioData{
			Positions: []positionResponse{},
			Wallet:    wallet,
		})
		return
	}

	vaultIDs := make([]uuid.UUID, len(user.Portfolios))
	for i, p := range user.Portfolios {
		vaultIDs[i] = p.VaultID
	}

	type vaultShareSum struct {
		VaultID uuid.UUID
		Total   float64
	}
	var shares []vaultShareSum
	if err := h.DB.WithContext(c.Request.Context()).Model(&models.Portfolio{}).
		Select("vault_id, COALESCE(SUM(shares_owned), 0) as total").
		Where("vault_id IN ?", vaultIDs).
		Group("vault_id").
		Scan(&shares).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to aggregate shares")
		return
	}

	totalSharesMap := make(map[uuid.UUID]float64)
	for _, s := range shares {
		totalSharesMap[s.VaultID] = s.Total
	}

	positions := make([]positionResponse, 0, len(user.Portfolios))
	for _, p := range user.Portfolios {
		totalShares := totalSharesMap[p.VaultID]
		var currentValue float64
		if totalShares > 0 {
			currentValue = (p.SharesOwned / totalShares) * p.Vault.TVL
		}

		pnl := currentValue - p.TotalInvestedValue
		var pnlPercent float64
		if p.TotalInvestedValue > 0 {
			pnlPercent = (pnl / p.TotalInvestedValue) * 100
		}

		positions = append(positions, positionResponse{
			VaultID:            p.VaultID,
			VaultAddress:       p.Vault.Address,
			VaultName:          vaultDisplayName(p.Vault),
			SharesOwned:        p.SharesOwned,
			TotalInvestedValue: p.TotalInvestedValue,
			AverageEntryPrice:  p.AverageEntryPrice,
			CurrentValue:       currentValue,
			PnL:                pnl,
			PnLPercent:         pnlPercent,
		})
	}

	SuccessResponse(c, portfolioData{
		Positions: positions,
		Wallet:    wallet,
	})
}

func (h *PortfolioHandler) getPortfolioFromService(c *gin.Context, wallet string, user models.User) {
	details, err := h.svc.GetPortfolio(c.Request.Context(), user.ID)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to load portfolio")
		return
	}

	positions := make([]positionResponse, 0, len(details))
	for _, d := range details {
		vid, err := uuid.Parse(d.VaultID)
		if err != nil {
			continue
		}
		name := d.VaultName
		if name == "" {
			name = d.VaultAddress
		}
		positions = append(positions, positionResponse{
			VaultID:            vid,
			VaultAddress:       d.VaultAddress,
			VaultName:          name,
			SharesOwned:        d.SharesOwned,
			TotalInvestedValue: d.TotalInvestedValue,
			AverageEntryPrice:  d.AverageEntryPrice,
			CurrentValue:       d.CurrentValue,
			PnL:                d.PnL,
			PnLPercent:         d.PnLPercent,
		})
	}

	SuccessResponse(c, portfolioData{
		Positions: positions,
		Wallet:    wallet,
	})
}

func vaultDisplayName(v models.Vault) string {
	if len(v.Metadata) == 0 {
		return v.Address
	}
	var meta map[string]interface{}
	if err := json.Unmarshal(v.Metadata, &meta); err != nil {
		return v.Address
	}
	if name, ok := meta["name"]; ok {
		if s, ok := name.(string); ok && s != "" {
			return s
		}
	}
	return v.Address
}
