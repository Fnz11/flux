package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/fbyt-clone/backend/internal/cache"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/fbyt-clone/backend/pkg/solana"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	syncDB           *gorm.DB
	syncClient       *solana.Client
	syncEventService *services.EventService
	syncCache        cache.Cache
)

func InitSyncHandler(db *gorm.DB, client *solana.Client, eventService *services.EventService) {
	syncDB = db
	syncClient = client
	syncEventService = eventService
}

func SetSyncCache(c cache.Cache) {
	syncCache = c
}

type SyncVaultRequest struct {
	Signature      string `json:"signature" binding:"required"`
	ManagerAddress string `json:"manager_address" binding:"required"`
}

type SyncTradeRequest struct {
	Signature string `json:"signature" binding:"required"`
	VaultID   string `json:"vault_id" binding:"required"`
}

func SyncVault(c *gin.Context) {
	var req SyncVaultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	txResult, err := syncClient.GetTransaction(c.Request.Context(), req.Signature)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid signature") {
			ErrorResponse(c, http.StatusBadRequest, "Invalid transaction signature")
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
			if len(ix.Accounts) > 0 {
				vaultAddress = ix.Accounts[0]
			}
			found = true
			break
		}
	}

	if !found {
		ErrorResponse(c, http.StatusBadRequest, "No initialize_vault instruction found in transaction")
		return
	}

	var existing models.Vault
	result := syncDB.WithContext(c.Request.Context()).Where("address = ?", vaultAddress).First(&existing)
	if result.Error == nil {
		if err := syncDB.WithContext(c.Request.Context()).Preload("Manager").First(&existing, existing.ID).Error; err != nil {
			SuccessResponse(c, existing)
			return
		}
		SuccessResponse(c, existing)
		return
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	user := &models.User{}
	if err := syncDB.WithContext(c.Request.Context()).Where("wallet_address = ?", req.ManagerAddress).FirstOrCreate(user, models.User{WalletAddress: req.ManagerAddress}).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create user")
		return
	}

	vault := models.Vault{
		Address:   vaultAddress,
		ManagerID: user.ID,
		Status:    "Fundraising",
	}

	if err := syncDB.WithContext(c.Request.Context()).Create(&vault).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create vault")
		return
	}

	invalidateLeaderboardCache(syncCache, c.Request.Context())

	if err := syncDB.WithContext(c.Request.Context()).Preload("Manager").First(&vault, vault.ID).Error; err != nil {
		SuccessResponse(c, vault)
		return
	}

	if syncEventService != nil {
		syncEventService.DispatchVaultUpdate(vault.ID.String())
	}

	SuccessResponse(c, vault)
}

func SyncTrade(c *gin.Context) {
	var req SyncTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	var existing models.TradeHistory
	result := syncDB.WithContext(c.Request.Context()).Where("transaction_signature = ?", req.Signature).First(&existing)
	if result.Error == nil {
		ErrorResponse(c, http.StatusConflict, "Transaction already synced")
		return
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	vaultID, err := uuid.Parse(req.VaultID)
	if err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid vault ID")
		return
	}

	var vault models.Vault
	if err := syncDB.WithContext(c.Request.Context()).First(&vault, "id = ?", vaultID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ErrorResponse(c, http.StatusNotFound, "Vault not found")
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Database error")
		return
	}

	// PgBouncer (transaction pool mode): no gorm transaction spans the external RPC call —
	// every statement above and below checks out its own pooled connection.
	txResult, err := syncClient.GetTransaction(c.Request.Context(), req.Signature)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid signature") {
			ErrorResponse(c, http.StatusBadRequest, "Invalid transaction signature")
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

	tradeType, amountIn, amountOut, priceAtExecution := classifyInstructions(parsed, vault.Address)
	if tradeType == "" {
		ErrorResponse(c, http.StatusBadRequest, "No recognized instruction found in transaction")
		return
	}

	actor := &models.User{}
	if err := syncDB.WithContext(c.Request.Context()).Where("wallet_address = ?", parsed.Signer).FirstOrCreate(actor, models.User{WalletAddress: parsed.Signer}).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to resolve user")
		return
	}

	trade := models.TradeHistory{
		VaultID:              vaultID,
		ActorID:              actor.ID,
		TransactionSignature: req.Signature,
		TradeType:            tradeType,
		AmountIn:             amountIn,
		AmountOut:            amountOut,
		PriceAtExecution:     priceAtExecution,
		ExecutedAt:           parsed.BlockTime,
	}

	if err := syncDB.WithContext(c.Request.Context()).Create(&trade).Error; err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create trade record")
		return
	}

	switch tradeType {
	case "Deposit":
		if err := services.UpsertPosition(syncDB, actor.ID, vaultID, amountIn, amountOut, priceAtExecution); err != nil {
			ErrorResponse(c, http.StatusInternalServerError, "Failed to update portfolio")
			return
		}
	case "Withdraw":
		if err := services.ReducePosition(syncDB, actor.ID, vaultID, amountIn); err != nil {
			ErrorResponse(c, http.StatusInternalServerError, "Failed to update portfolio")
			return
		}
	}

	invalidateVaultPortfolioCaches(syncCache, syncDB, c.Request.Context(), vaultID)
	invalidateLeaderboardCache(syncCache, c.Request.Context())
	invalidateVaultSummaryCache(syncCache, c.Request.Context(), vault.Address)

	if err := syncDB.WithContext(c.Request.Context()).Preload("Actor").Preload("Vault").First(&trade, trade.ID).Error; err != nil {
		SuccessResponse(c, trade)
		return
	}

	if syncEventService != nil {
		syncEventService.DispatchTradeConfirmed(trade.VaultID.String(), trade.TransactionSignature, trade.TradeType)
	}

	SuccessResponse(c, trade)
}

func classifyInstructions(parsed *solana.ParsedTransaction, vaultAddress string) (tradeType string, amountIn, amountOut, priceAtExecution float64) {
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
			if v, ok := anchorIx.Args["amount_in"].(uint64); ok {
				amountIn = float64(v)
			}
			if v, ok := anchorIx.Args["amount_out"].(uint64); ok {
				amountOut = float64(v)
			}
			if amountIn > 0 {
				priceAtExecution = amountOut / amountIn
			}
			return
		case "deposit":
			if !hasVault {
				continue
			}
			tradeType = "Deposit"
			if v, ok := anchorIx.Args["amount"].(uint64); ok {
				amountIn = float64(v)
			}
			amountOut = amountIn
			priceAtExecution = 1.0
			return
		case "withdraw":
			if !hasVault {
				continue
			}
			tradeType = "Withdraw"
			if v, ok := anchorIx.Args["shares"].(uint64); ok {
				amountIn = float64(v)
			}
			return
		}
	}
	return
}
