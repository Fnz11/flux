package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/flux-protocol/backend/internal/cache"
	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/flux-protocol/backend/pkg/solana"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type SyncHandler struct {
	vaultRepo     domain.VaultRepository
	userRepo      domain.UserRepository
	tradeRepo     domain.TradeRepository
	portfolioRepo domain.PortfolioRepository
	txManager     domain.TxManager
	client        *solana.Client
	eventService  *services.EventService
	cache         cache.Cache
}

func NewSyncHandler(
	vaultRepo domain.VaultRepository,
	userRepo domain.UserRepository,
	tradeRepo domain.TradeRepository,
	portfolioRepo domain.PortfolioRepository,
	txManager domain.TxManager,
	client *solana.Client,
	eventService *services.EventService,
) *SyncHandler {
	return &SyncHandler{
		vaultRepo:     vaultRepo,
		userRepo:      userRepo,
		tradeRepo:     tradeRepo,
		portfolioRepo: portfolioRepo,
		txManager:     txManager,
		client:        client,
		eventService:  eventService,
	}
}

func (h *SyncHandler) SetCache(c cache.Cache) {
	h.cache = c
}

type SyncVaultRequest struct {
	Signature      string `json:"signature" binding:"required"`
	ManagerAddress string `json:"manager_address" binding:"required"`
}

type SyncTradeRequest struct {
	Signature string `json:"signature" binding:"required"`
	VaultID   string `json:"vault_id" binding:"required"`
}

func isNotFoundRPCError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, rpc.ErrNotFound) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found") || strings.Contains(msg, "notfound") || strings.Contains(msg, "null")
}

func (h *SyncHandler) SyncVault(c *gin.Context) {
	var req SyncVaultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.ManagerAddress = strings.TrimSpace(req.ManagerAddress)
	if !IsValidWalletAddress(req.ManagerAddress) {
		ErrorResponse(c, http.StatusBadRequest, "invalid wallet address")
		return
	}

	jwtWallet := middleware.GetWalletAddress(c)
	if jwtWallet == "" || req.ManagerAddress != jwtWallet {
		ErrorResponse(c, http.StatusForbidden, "Manager address mismatch")
		return
	}

	txResult, err := h.client.GetTransaction(c.Request.Context(), req.Signature)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid signature") {
			ErrorResponse(c, http.StatusBadRequest, "Invalid transaction signature")
			return
		}
		if isNotFoundRPCError(err) {
			writeJSON(c, http.StatusAccepted, gin.H{
				"success":   false,
				"error":     "Transaction not found on chain yet. Please retry shortly",
				"retryable": true,
			})
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Transaction verification failed")
		return
	}

	parsed, err := solana.ParseTransaction(txResult)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to parse transaction")
		return
	}

	if !parsed.Success {
		ErrorResponse(c, http.StatusBadRequest, "Transaction failed on chain")
		return
	}

	var vaultAddress string
	found := false
	for _, ix := range parsed.Instructions {
		anchorIx, err := solana.ParseAnchorInstruction(ix.Data)
		if err != nil {
			continue
		}
		if anchorIx.Name == "initialize_vault" {
			if len(ix.Accounts) > 1 {
				vaultAddress = ix.Accounts[1]
			}
			found = true
			break
		}
	}

	if !found {
		ErrorResponse(c, http.StatusBadRequest, "No initialize_vault instruction found in transaction")
		return
	}

	existing, err := h.vaultRepo.GetByAddress(c.Request.Context(), vaultAddress)
	if err == nil && existing != nil {
		SuccessResponse(c, existing)
		return
	}
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	user, err := h.userRepo.FindOrCreateByWallet(c.Request.Context(), req.ManagerAddress)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create user")
		return
	}

	vaultDetail := domain.VaultDetail{
		Address:   vaultAddress,
		ManagerID: user.ID,
		Status:    "Fundraising",
	}

	if err := h.vaultRepo.Create(c.Request.Context(), &vaultDetail); err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create vault")
		return
	}

	invalidateLeaderboardCache(h.cache, c.Request.Context())

	reloaded, err := h.vaultRepo.GetByAddress(c.Request.Context(), vaultAddress)
	if err != nil {
		SuccessResponse(c, vaultDetail)
		return
	}

	if h.eventService != nil {
		h.eventService.DispatchVaultUpdate(reloaded.ID)
		h.eventService.DispatchGlobalLeaderboard()
	}

	SuccessResponse(c, reloaded)
}

func (h *SyncHandler) SyncTrade(c *gin.Context) {
	var req SyncTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	vault, err := h.vaultRepo.GetByID(c.Request.Context(), req.VaultID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	// Signature pre-check outside transaction
	if existing, err := h.tradeRepo.FindBySignature(c.Request.Context(), req.Signature); err == nil && existing != nil {
		ErrorResponse(c, http.StatusConflict, "Transaction already synced")
		return
	}

	// Fetch transaction from Solana RPC outside DB transaction span
	txResult, err := h.client.GetTransaction(c.Request.Context(), req.Signature)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid signature") {
			ErrorResponse(c, http.StatusBadRequest, "Invalid transaction signature")
			return
		}
		if isNotFoundRPCError(err) {
			writeJSON(c, http.StatusAccepted, gin.H{
				"success":   false,
				"error":     "Transaction not found on chain yet. Please retry shortly",
				"retryable": true,
			})
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Transaction verification failed")
		return
	}

	parsed, err := solana.ParseTransaction(txResult)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to parse transaction")
		return
	}

	if !parsed.Success {
		ErrorResponse(c, http.StatusBadRequest, "Transaction failed on chain")
		return
	}

	jwtWallet := middleware.GetWalletAddress(c)
	if jwtWallet == "" || parsed.Signer != jwtWallet {
		ErrorResponse(c, http.StatusForbidden, "Signer mismatch with authenticated user")
		return
	}

	var totalShares decimal.Decimal
	if h.portfolioRepo != nil {
		totalShares, _ = h.portfolioRepo.GetTotalSharesByVault(c.Request.Context(), vault.ID)
	}

	tradeType, amountIn, amountOut, priceAtExecution := classifyInstructions(parsed, vault.Address, vault.TVL, totalShares)
	if tradeType == "" {
		ErrorResponse(c, http.StatusBadRequest, "No recognized instruction found in transaction")
		return
	}

	var tradeDetail *domain.TradeDetail

	// Wrap trade insert, portfolio position recalculation, and TVL update inside a single database transaction
	err = h.txManager.ExecTx(c.Request.Context(), func(ctx context.Context) error {
		// Re-check unique signature inside tx to avoid race conditions
		if existing, err := h.tradeRepo.FindBySignature(ctx, req.Signature); err == nil && existing != nil {
			return domain.ErrAlreadySynced
		}

		actor, err := h.userRepo.FindOrCreateByWallet(ctx, parsed.Signer)
		if err != nil {
			return err
		}

		tradeDetail = &domain.TradeDetail{
			VaultID:              vault.ID,
			ActorID:              actor.ID,
			TransactionSignature: req.Signature,
			TradeType:            tradeType,
			AmountIn:             amountIn,
			AmountOut:            amountOut,
			PriceAtExecution:     priceAtExecution,
			ExecutedAt:           parsed.BlockTime,
		}

		if err := h.tradeRepo.Create(ctx, tradeDetail); err != nil {
			if errors.Is(err, domain.ErrAlreadySynced) {
				return domain.ErrAlreadySynced
			}
			return err
		}

		switch tradeType {
		case "Deposit":
			if err := h.portfolioRepo.UpsertPosition(ctx, actor.ID, vault.ID, amountIn, amountOut, priceAtExecution); err != nil {
				return err
			}
			if err := h.vaultRepo.UpdateTVL(ctx, vault.ID, amountIn); err != nil {
				return err
			}
		case "Buy":
			if err := h.portfolioRepo.UpsertPosition(ctx, actor.ID, vault.ID, amountIn, amountOut, priceAtExecution); err != nil {
				return err
			}
		case "Withdraw":
			if err := h.portfolioRepo.ReducePosition(ctx, actor.ID, vault.ID, amountIn); err != nil {
				return err
			}
			if err := h.vaultRepo.UpdateTVL(ctx, vault.ID, amountOut.Neg()); err != nil {
				return err
			}
		case "Sell":
			// Trade logged in trade_histories table
		}

		return nil
	})

	if err != nil {
		if errors.Is(err, domain.ErrAlreadySynced) {
			ErrorResponse(c, http.StatusConflict, "Transaction already synced")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to record trade and update portfolio")
		return
	}

	invalidateVaultPortfolioCaches(h.cache, h.portfolioRepo, c.Request.Context(), vault.ID)
	invalidateLeaderboardCache(h.cache, c.Request.Context())
	invalidateVaultSummaryCache(h.cache, c.Request.Context(), vault.Address)

	if h.eventService != nil {
		h.eventService.DispatchTradeConfirmed(tradeDetail.VaultID, tradeDetail.TransactionSignature, tradeDetail.TradeType)
		h.eventService.DispatchGlobalLeaderboard()
	}

	SuccessResponse(c, tradeDetail)
}

func classifyInstructions(parsed *solana.ParsedTransaction, vaultAddress string, vaultTVL decimal.Decimal, totalShares decimal.Decimal) (tradeType string, amountIn, amountOut, priceAtExecution decimal.Decimal) {
	solMint := "So11111111111111111111111111111111111111112"
	usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	for _, ix := range parsed.Instructions {
		anchorIx, err := solana.ParseAnchorInstruction(ix.Data)
		if err != nil {
			continue
		}

		hasVault := false
		for _, acc := range ix.Accounts {
			if acc == vaultAddress {
				hasVault = true
				break
			}
		}

		switch anchorIx.Name {
		case "execute_trade_pyth":
			if !hasVault {
				continue
			}
			tradeType = "Buy"
			if len(ix.Accounts) > 6 {
				inputMint := ix.Accounts[4]
				outputMint := ix.Accounts[6]
				if outputMint == solMint || outputMint == usdcMint {
					tradeType = "Sell"
				} else if inputMint == solMint || inputMint == usdcMint {
					tradeType = "Buy"
				}
			}
			if v, ok := anchorIx.Args["amount_in"].(uint64); ok {
				amountIn = decimal.NewFromUint64(v)
			}
			if v, ok := anchorIx.Args["amount_out"].(uint64); ok {
				amountOut = decimal.NewFromUint64(v)
			}
			if amountIn.IsPositive() {
				priceAtExecution = amountOut.Div(amountIn)
			}
			return
		case "deposit":
			if !hasVault {
				continue
			}
			tradeType = "Deposit"
			if v, ok := anchorIx.Args["amount"].(uint64); ok {
				amountIn = decimal.NewFromUint64(v)
			}
			amountOut = amountIn
			priceAtExecution = decimal.NewFromInt(1)
			return
		case "withdraw":
			if !hasVault {
				continue
			}
			tradeType = "Withdraw"
			if v, ok := anchorIx.Args["shares_to_burn"].(uint64); ok {
				amountIn = decimal.NewFromUint64(v)
			} else if v, ok := anchorIx.Args["shares"].(uint64); ok {
				amountIn = decimal.NewFromUint64(v)
			}
			if totalShares.IsPositive() && vaultTVL.IsPositive() {
				navPerShare := vaultTVL.Div(totalShares)
				amountOut = amountIn.Mul(navPerShare)
				priceAtExecution = navPerShare
			} else {
				amountOut = amountIn
				priceAtExecution = decimal.NewFromInt(1)
			}
			return
		}
	}
	return
}
