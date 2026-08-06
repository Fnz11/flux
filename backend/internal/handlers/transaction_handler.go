package handlers

import (
	"crypto/sha256"
	"net/http"

	"github.com/mr-tron/base58"

	"github.com/gin-gonic/gin"
)

type TransactionHandler struct{}

func NewTransactionHandler() *TransactionHandler {
	return &TransactionHandler{}
}

type SimulateTransactionRequest struct {
	VaultID    string  `json:"vaultId"`
	Amount     float64 `json:"amount"`
	TokenMint  string  `json:"tokenMint"`
	UserPubkey string  `json:"userPubkey"`
	Action     string  `json:"action"`
}

type SimulateTransactionResponse struct {
	Signature   string `json:"signature"`
	ExplorerURL string `json:"explorerUrl"`
	Status      string `json:"status"`
}

func (h *TransactionHandler) SimulateTransaction(c *gin.Context) {
	var req SimulateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	raw := req.VaultID + req.UserPubkey + req.Action
	hash := sha256.Sum256([]byte(raw))

	// Solana transaction signatures are 64 bytes, which base58 encodes to 87 or 88 characters.
	// Repeating the 32-byte sha256 hash gives a 64-byte slice whose base58 encoding is exactly length 88.
	var sigBytes [64]byte
	copy(sigBytes[:32], hash[:])
	copy(sigBytes[32:], hash[:])

	signature := base58.Encode(sigBytes[:])

	resp := SimulateTransactionResponse{
		Signature:   signature,
		ExplorerURL: "https://solscan.io/tx/" + signature,
		Status:      "simulated",
	}

	SuccessResponse(c, resp)
}
