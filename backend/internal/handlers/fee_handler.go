package handlers

import (
	"errors"
	"net/http"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
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
	VaultID               string  `json:"vault_id"`
	AccruedPerformanceFee float64 `json:"accrued_performance_fee"`
	AccruedManagementFee  float64 `json:"accrued_management_fee"`
	TotalAccrued          float64 `json:"total_accrued"`
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
	tvlFloat, _ := vault.TVL.Float64()
	perfFeeBps := float64(vault.PerformanceFeeBps)
	mgmtFeeBps := float64(vault.ManagementFeeBps)

	// Sample heuristic / calculation for fee breakdown
	accruedPerf := tvlFloat * (perfFeeBps / 10000.0)
	accruedMgmt := tvlFloat * (mgmtFeeBps / 10000.0)
	totalAccrued := accruedPerf + accruedMgmt

	resp := FeeResponse{
		VaultID:               vault.ID,
		AccruedPerformanceFee: accruedPerf,
		AccruedManagementFee:  accruedMgmt,
		TotalAccrued:          totalAccrued,
	}

	c.JSON(http.StatusOK, resp)
}
