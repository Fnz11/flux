package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type positionResponse struct {
	VaultID            uuid.UUID       `json:"vault_id"`
	VaultAddress       string          `json:"vault_address"`
	VaultName          string          `json:"vault_name"`
	SharesOwned        decimal.Decimal `json:"shares_owned"`
	TotalInvestedValue decimal.Decimal `json:"total_invested_value"`
	AverageEntryPrice  decimal.Decimal `json:"average_entry_price"`
	CurrentValue       decimal.Decimal `json:"current_value"`
	PnL                decimal.Decimal `json:"pnl"`
	PnLPercent         decimal.Decimal `json:"pnl_percent"`
	CreatedAt          string          `json:"created_at,omitempty"`
	InvestedAt         string          `json:"invested_at,omitempty"`
}

type portfolioData struct {
	Positions []positionResponse `json:"positions"`
	Wallet    string             `json:"wallet"`
}

type PortfolioHandler struct {
	userRepo      domain.UserRepository
	portfolioRepo domain.PortfolioRepository
	svc           *services.PortfolioService
}

func NewPortfolioHandler(userRepo domain.UserRepository, portfolioRepo domain.PortfolioRepository) *PortfolioHandler {
	return &PortfolioHandler{
		userRepo:      userRepo,
		portfolioRepo: portfolioRepo,
	}
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

	user, err := h.userRepo.FindByWallet(c.Request.Context(), wallet)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "database error")
		return
	}

	uid, err := uuid.Parse(user.ID)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "invalid user id")
		return
	}

	if h.svc != nil {
		h.getPortfolioFromService(c, wallet, uid)
		return
	}

	details, err := h.portfolioRepo.GetByUser(c.Request.Context(), user.ID)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "failed to fetch portfolio")
		return
	}

	positions := make([]positionResponse, 0, len(details))
	for _, d := range details {
		vid, err := uuid.Parse(d.VaultID)
		if err != nil {
			continue
		}
		var createdAtStr string
		if !d.CreatedAt.IsZero() {
			createdAtStr = d.CreatedAt.Format(time.RFC3339)
		}
		positions = append(positions, positionResponse{
			VaultID:            vid,
			VaultAddress:       d.VaultAddress,
			VaultName:          d.VaultName,
			SharesOwned:        d.SharesOwned,
			TotalInvestedValue: d.TotalInvestedValue,
			AverageEntryPrice:  d.AverageEntryPrice,
			CurrentValue:       d.CurrentValue,
			PnL:                d.PnL,
			PnLPercent:         d.PnLPercent,
			CreatedAt:          createdAtStr,
			InvestedAt:         createdAtStr,
		})
	}

	SuccessResponse(c, portfolioData{
		Positions: positions,
		Wallet:    wallet,
	})
}

func (h *PortfolioHandler) getPortfolioFromService(c *gin.Context, wallet string, userID uuid.UUID) {
	details, err := h.svc.GetPortfolio(c.Request.Context(), userID)
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
		var createdAtStr string
		if !d.CreatedAt.IsZero() {
			createdAtStr = d.CreatedAt.Format(time.RFC3339)
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
			CreatedAt:          createdAtStr,
			InvestedAt:         createdAtStr,
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
