package handlers

import (
	"errors"
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type FeeHandler struct {
	vaultRepo domain.VaultRepository
}

func NewFeeHandler(vaultRepo domain.VaultRepository) *FeeHandler {
	return &FeeHandler{
		vaultRepo: vaultRepo,
	}
}

type FeeResponse struct {
	VaultID               string          `json:"vault_id"`
	AccruedPerformanceFee decimal.Decimal `json:"accrued_performance_fee"`
	AccruedManagementFee  decimal.Decimal `json:"accrued_management_fee"`
	TotalAccrued          decimal.Decimal `json:"total_accrued"`
	ClaimedAmount         decimal.Decimal `json:"claimed_amount"`
	Status                string          `json:"status"`
}

func (h *FeeHandler) GetVaultFees(c *gin.Context) {
	vaultID := c.Param("vaultId")
	if vaultID == "" {
		vaultID = c.Param("address")
	}
	if vaultID == "" {
		ErrorResponse(c, http.StatusBadRequest, "vaultId or address is required")
		return
	}

	if h.vaultRepo == nil {
		ErrorResponse(c, http.StatusInternalServerError, "vault repository not initialized")
		return
	}

	vault, err := h.vaultRepo.GetByID(c.Request.Context(), vaultID)
	if err != nil {
		vault, err = h.vaultRepo.GetByAddress(c.Request.Context(), vaultID)
	}

	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch vault fees")
		return
	}

	// Calculate estimated accrued fees based on vault TVL and bps
	perfFeeBps := decimal.NewFromInt(int64(vault.PerformanceFeeBps))
	mgmtFeeBps := decimal.NewFromInt(int64(vault.ManagementFeeBps))
	bpsDiv := decimal.NewFromInt(10000)

	accruedPerf := vault.TVL.Mul(perfFeeBps).Div(bpsDiv)
	accruedMgmt := vault.TVL.Mul(mgmtFeeBps).Div(bpsDiv)
	totalAccrued := accruedPerf.Add(accruedMgmt)

	status := "Claimable"
	if totalAccrued.IsZero() {
		status = "Claimed"
	}

	resp := FeeResponse{
		VaultID:               vault.ID,
		AccruedPerformanceFee: accruedPerf,
		AccruedManagementFee:  accruedMgmt,
		TotalAccrued:          totalAccrued,
		ClaimedAmount:         decimal.Zero,
		Status:                status,
	}

	c.JSON(http.StatusOK, resp)
}
