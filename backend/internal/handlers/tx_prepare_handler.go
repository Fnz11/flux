package handlers

import (
	"net/http"
	"strings"

	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type TxPrepareHandler struct {
	svc *services.TxPrepareService
}

func NewTxPrepareHandler(svc *services.TxPrepareService) *TxPrepareHandler {
	return &TxPrepareHandler{svc: svc}
}

type PrepareCreateVaultRequest struct {
	ManagerAddress    string   `json:"manager_address" binding:"required"`
	DisplayName       string   `json:"display_name" binding:"required"`
	Description       string   `json:"description"`
	CoverImageUrl     string   `json:"cover_image_url"`
	FocusAssets       []string `json:"focus_assets"`
	Tags              []string `json:"tags"`
	MinRaiseAmount    uint64   `json:"min_raise_amount"`
	PerformanceFeeBps uint16   `json:"performance_fee_bps"`
	ManagementFeeBps  uint16   `json:"management_fee_bps"`
	LockupPeriodSec   int64    `json:"lockup_period_sec"`
	VaultType         string   `json:"vault_type"`
	DepositMint       string   `json:"deposit_mint"`
}

func (h *TxPrepareHandler) PrepareCreateVault(c *gin.Context) {
	var req PrepareCreateVaultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	req.ManagerAddress = strings.TrimSpace(req.ManagerAddress)
	if !IsValidWalletAddress(req.ManagerAddress) {
		ErrorResponse(c, http.StatusBadRequest, "Invalid manager address")
		return
	}

	jwtWallet := middleware.GetWalletAddress(c)
	if jwtWallet != "" && req.ManagerAddress != jwtWallet {
		ErrorResponse(c, http.StatusForbidden, "Manager address mismatch with authenticated session")
		return
	}

	res, err := h.svc.PrepareCreateVault(c.Request.Context(), services.PrepareCreateVaultDTO{
		ManagerAddress:    req.ManagerAddress,
		DisplayName:       req.DisplayName,
		Description:       req.Description,
		CoverImageUrl:     req.CoverImageUrl,
		FocusAssets:       req.FocusAssets,
		Tags:              req.Tags,
		MinRaiseAmount:    req.MinRaiseAmount,
		PerformanceFeeBps: req.PerformanceFeeBps,
		ManagementFeeBps:  req.ManagementFeeBps,
		LockupPeriodSec:   req.LockupPeriodSec,
		VaultType:         req.VaultType,
		DepositMint:       req.DepositMint,
	})
	if err != nil {
		ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessResponse(c, res)
}

type PrepareDepositRequest struct {
	InvestorAddress string `json:"investor_address" binding:"required"`
	VaultAddress    string `json:"vault_address" binding:"required"`
	AmountLamports  uint64 `json:"amount_lamports" binding:"required"`
	DepositMint     string `json:"deposit_mint"`
}

func (h *TxPrepareHandler) PrepareDeposit(c *gin.Context) {
	var req PrepareDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	req.InvestorAddress = strings.TrimSpace(req.InvestorAddress)
	if !IsValidWalletAddress(req.InvestorAddress) {
		ErrorResponse(c, http.StatusBadRequest, "Invalid investor address")
		return
	}

	jwtWallet := middleware.GetWalletAddress(c)
	if jwtWallet != "" && req.InvestorAddress != jwtWallet {
		ErrorResponse(c, http.StatusForbidden, "Investor address mismatch with authenticated session")
		return
	}

	res, err := h.svc.PrepareDeposit(c.Request.Context(), services.PrepareDepositDTO{
		InvestorAddress: req.InvestorAddress,
		VaultAddress:    req.VaultAddress,
		AmountLamports:  req.AmountLamports,
		DepositMint:     req.DepositMint,
	})
	if err != nil {
		ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessResponse(c, res)
}

type PrepareWithdrawRequest struct {
	InvestorAddress string `json:"investor_address" binding:"required"`
	VaultAddress    string `json:"vault_address" binding:"required"`
	SharesToBurn    uint64 `json:"shares_to_burn" binding:"required"`
	WithdrawMint    string `json:"withdraw_mint"`
}

func (h *TxPrepareHandler) PrepareWithdraw(c *gin.Context) {
	var req PrepareWithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	req.InvestorAddress = strings.TrimSpace(req.InvestorAddress)
	if !IsValidWalletAddress(req.InvestorAddress) {
		ErrorResponse(c, http.StatusBadRequest, "Invalid investor address")
		return
	}

	jwtWallet := middleware.GetWalletAddress(c)
	if jwtWallet != "" && req.InvestorAddress != jwtWallet {
		ErrorResponse(c, http.StatusForbidden, "Investor address mismatch with authenticated session")
		return
	}

	res, err := h.svc.PrepareWithdraw(c.Request.Context(), services.PrepareWithdrawDTO{
		InvestorAddress: req.InvestorAddress,
		VaultAddress:    req.VaultAddress,
		SharesToBurn:    req.SharesToBurn,
		WithdrawMint:    req.WithdrawMint,
	})
	if err != nil {
		ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessResponse(c, res)
}

type SubmitTxRequest struct {
	DraftID   string `json:"draft_id" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

func (h *TxPrepareHandler) SubmitTransaction(c *gin.Context) {
	var req SubmitTxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	req.Signature = strings.TrimSpace(req.Signature)
	if len(req.Signature) < 32 {
		ErrorResponse(c, http.StatusBadRequest, "Invalid signature length")
		return
	}

	if err := h.svc.RecordSubmission(c.Request.Context(), req.DraftID, req.Signature); err != nil {
		ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessResponse(c, gin.H{
		"draft_id":  req.DraftID,
		"signature": req.Signature,
		"status":    "SUBMITTED",
	})
}
