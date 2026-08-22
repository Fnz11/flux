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

type summaryResponse struct {
	Wallet        string          `json:"wallet"`
	VaultCount    int64           `json:"vault_count"`
	TotalInvested decimal.Decimal `json:"total_invested"`
	CurrentValue  decimal.Decimal `json:"current_value"`
	UnrealizedPnL decimal.Decimal `json:"unrealized_pnl"`
	TotalPnL      decimal.Decimal `json:"total_pnl"`
	PnLPercent    decimal.Decimal `json:"pnl_percent"`
	UpdatedAt     string          `json:"updated_at,omitempty"`
}

func (h *PortfolioHandler) GetPortfolioSummary(c *gin.Context) {
	wallet := c.Param("wallet")
	if wallet == "" {
		if val, exists := c.Get("wallet_address"); exists {
			if s, ok := val.(string); ok {
				wallet = s
			}
		}
	}
	if wallet == "" {
		ErrorResponse(c, http.StatusBadRequest, "wallet address required")
		return
	}

	user, err := h.userRepo.FindByWallet(c.Request.Context(), wallet)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			SuccessResponse(c, summaryResponse{
				Wallet:        wallet,
				VaultCount:    0,
				TotalInvested: decimal.Zero,
				CurrentValue:  decimal.Zero,
				UnrealizedPnL: decimal.Zero,
				TotalPnL:      decimal.Zero,
				PnLPercent:    decimal.Zero,
			})
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "database error")
		return
	}

	summary, err := h.portfolioRepo.GetPortfolioSummary(c.Request.Context(), user.ID)
	if err == nil && summary != nil {
		totalPnL := summary.CurrentValue.Sub(summary.TotalInvested)
		returnPct := decimal.Zero
		if summary.TotalInvested.IsPositive() {
			returnPct = totalPnL.Div(summary.TotalInvested).Mul(decimal.NewFromInt(100))
		}

		SuccessResponse(c, summaryResponse{
			Wallet:        wallet,
			VaultCount:    summary.VaultCount,
			TotalInvested: summary.TotalInvested,
			CurrentValue:  summary.CurrentValue,
			UnrealizedPnL: summary.UnrealizedPnL,
			TotalPnL:      totalPnL,
			PnLPercent:    returnPct,
			UpdatedAt:     summary.UpdatedAt,
		})
		return
	}

	// Fallback to live calculation if MV is not refreshed
	if h.svc != nil {
		if uid, err := uuid.Parse(user.ID); err == nil {
			details, err := h.svc.GetPortfolio(c.Request.Context(), uid)
			if err == nil {
				var totalInvested, currentValue decimal.Decimal
				for _, d := range details {
					totalInvested = totalInvested.Add(d.TotalInvestedValue)
					currentValue = currentValue.Add(d.CurrentValue)
				}
				totalPnL := currentValue.Sub(totalInvested)
				returnPct := decimal.Zero
				if totalInvested.IsPositive() {
					returnPct = totalPnL.Div(totalInvested).Mul(decimal.NewFromInt(100))
				}

				SuccessResponse(c, summaryResponse{
					Wallet:        wallet,
					VaultCount:    int64(len(details)),
					TotalInvested: totalInvested,
					CurrentValue:  currentValue,
					UnrealizedPnL: totalPnL,
					TotalPnL:      totalPnL,
					PnLPercent:    returnPct,
				})
				return
			}
		}
	}

	SuccessResponse(c, summaryResponse{
		Wallet:        wallet,
		VaultCount:    0,
		TotalInvested: decimal.Zero,
		CurrentValue:  decimal.Zero,
		UnrealizedPnL: decimal.Zero,
		TotalPnL:      decimal.Zero,
		PnLPercent:    decimal.Zero,
	})
}

func (h *PortfolioHandler) GetMyPortfolio(c *gin.Context) {
	val, exists := c.Get("wallet_address")
	if !exists {
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	wallet, _ := val.(string)
	if wallet == "" {
		ErrorResponse(c, http.StatusUnauthorized, "invalid wallet in session")
		return
	}
	c.Params = append(c.Params, gin.Param{Key: "wallet", Value: wallet})
	h.GetPortfolio(c)
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
