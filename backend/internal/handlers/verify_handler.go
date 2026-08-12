package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/pkg/solana"
	solanaGo "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// txVerifier abstracts the Solana RPC calls the verify handler needs so tests
// can substitute a stub without dialing a real RPC endpoint.
type txVerifier interface {
	GetTransaction(ctx context.Context, signature string) (*rpc.GetTransactionResult, error)
}

var _ txVerifier = (*solana.Client)(nil)

// VerifyHandler is a read-only, RPC-scoped transaction verification endpoint.
// It never writes to the database and never invents on-chain state: missing,
// failed and timed-out states are reported explicitly at RPC level integrity.
type VerifyHandler struct {
	client    txVerifier
	tradeRepo domain.TradeRepository
}

// NewVerifyHandler builds the handler. client and tradeRepo are both optional:
// a nil client makes RPC verification unavailable (reported as 502) and a nil
// tradeRepo skips the read-only already-synced idempotency check.
func NewVerifyHandler(client *solana.Client, tradeRepo domain.TradeRepository) *VerifyHandler {
	var verifier txVerifier
	if client != nil {
		verifier = client
	}
	return &VerifyHandler{client: verifier, tradeRepo: tradeRepo}
}

type VerifyTransactionRequest struct {
	Signature string `json:"signature" binding:"required"`
	VaultID   string `json:"vault_id"`
}

type VerifyTransactionResponse struct {
	Verified         bool   `json:"verified"`
	Signature        string `json:"signature"`
	Signer           string `json:"signer"`
	BlockTime        int64  `json:"block_time"`
	BlockTimeISO     string `json:"block_time_iso,omitempty"`
	VaultID          string `json:"vault_id,omitempty"`
	TradeType        string `json:"trade_type"`
	AmountIn         string `json:"amount_in"`
	AmountOut        string `json:"amount_out"`
	PriceAtExecution string `json:"price_at_execution"`
	DataScope        string `json:"data_scope"`
	AlreadySynced    bool   `json:"already_synced,omitempty"`
	Synced           bool   `json:"synced,omitempty"`
	Reason           string `json:"reason,omitempty"`
}

func (h *VerifyHandler) Verify(c *gin.Context) {
	var req VerifyTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Signature = strings.TrimSpace(req.Signature)
	req.VaultID = strings.TrimSpace(req.VaultID)

	if _, err := solanaGo.SignatureFromBase58(req.Signature); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid transaction signature")
		return
	}

	base := VerifyTransactionResponse{
		Signature: req.Signature,
		VaultID:   req.VaultID,
		DataScope: "rpc",
	}

	// Read-only idempotency: if this signature is already synced for the
	// vault, report it without round-tripping the RPC again.
	if req.VaultID != "" && h.tradeRepo != nil {
		existing, err := h.tradeRepo.FindBySignature(c.Request.Context(), req.Signature)
		if err == nil && existing != nil {
			base.Verified = true
			base.AlreadySynced = true
			base.Synced = true
			SuccessResponse(c, base)
			return
		}
		if err != nil && !errors.Is(err, domain.ErrNotFound) {
			ErrorResponse(c, http.StatusInternalServerError, "Database error")
			return
		}
	}

	if h.client == nil {
		ErrorResponse(c, http.StatusBadGateway, "Transaction verification unavailable")
		return
	}

	txResult, err := h.client.GetTransaction(c.Request.Context(), req.Signature)
	if err != nil {
		if isTxNotFound(err) {
			base.Reason = "not_found"
			SuccessResponse(c, base)
			return
		}
		ErrorResponse(c, http.StatusBadGateway, "Transaction verification failed")
		return
	}

	parsed, err := solana.ParseTransaction(txResult)
	if err != nil {
		if txResult == nil {
			base.Reason = "failed"
			SuccessResponse(c, base)
			return
		}
		ErrorResponse(c, http.StatusInternalServerError, "Failed to parse transaction")
		return
	}

	base.Signer = parsed.Signer
	base.BlockTime = parsed.BlockTime.Unix()
	if !parsed.BlockTime.IsZero() {
		base.BlockTimeISO = parsed.BlockTime.Format(time.RFC3339)
	}

	if !parsed.Success {
		base.Reason = "failed"
		SuccessResponse(c, base)
		return
	}

	base.Verified = true

	// On-chain amounts are oracle data only: rendered as "" when unavailable
	// so the frontend never sees a fabricated zero.
	if req.VaultID != "" {
		tradeType, amountIn, amountOut, priceAtExecution := classifyInstructions(parsed, req.VaultID)
		base.TradeType = tradeType
		base.AmountIn = decOrEmpty(amountIn)
		base.AmountOut = decOrEmpty(amountOut)
		base.PriceAtExecution = decOrEmpty(priceAtExecution)
	}

	SuccessResponse(c, base)
}

// isTxNotFound reports whether an RPC error means the signature is simply
// absent on-chain (a reachable state, not an infrastructure failure).
func isTxNotFound(err error) bool {
	msg := strings.ToLower(err.Error())
	for _, needle := range []string{"invalid signature", "signature not found", "transaction not found"} {
		if strings.Contains(msg, needle) {
			return true
		}
	}
	return false
}

// decOrEmpty renders a decimal as its plain string, or "" when zero so the
// frontend can render a dash instead of a fabricated 0.
func decOrEmpty(d decimal.Decimal) string {
	if d.IsZero() {
		return ""
	}
	return d.String()
}
