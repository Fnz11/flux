package handlers

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/fbyt-clone/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mr-tron/base58"
	"gorm.io/gorm"
)

type AuthClaims struct {
	WalletAddress string `json:"wallet_address"`
	jwt.RegisteredClaims
}

type AuthHandler struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthHandler(db *gorm.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}
}

type nonceRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
}

type verifyRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
}

type nonceResponse struct {
	Nonce string `json:"nonce"`
}

type verifyResponse struct {
	Token         string `json:"token"`
	WalletAddress string `json:"wallet_address"`
}

func (h *AuthHandler) Nonce(c *gin.Context) {
	var req nonceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet_address is required"})
		return
	}

	req.WalletAddress = strings.TrimSpace(req.WalletAddress)

	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate nonce"})
		return
	}

	nonce := "Sign this message to authenticate with FBYT: " + hex.EncodeToString(random)

	user := models.User{WalletAddress: req.WalletAddress}
	if err := h.db.WithContext(c.Request.Context()).Where("wallet_address = ?", req.WalletAddress).FirstOrCreate(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if err := h.db.WithContext(c.Request.Context()).Model(&user).Update("nonce", nonce).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save nonce"})
		return
	}

	c.JSON(http.StatusOK, nonceResponse{Nonce: nonce})
}

func (h *AuthHandler) Verify(c *gin.Context) {
	var req verifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet_address and signature are required"})
		return
	}

	req.WalletAddress = strings.TrimSpace(req.WalletAddress)

	var user models.User
	if err := h.db.WithContext(c.Request.Context()).Where("wallet_address = ?", req.WalletAddress).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nonce not requested"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if user.Nonce == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "nonce already consumed"})
		return
	}

	pubkey, err := base58.Decode(req.WalletAddress)
	if err != nil || len(pubkey) != ed25519.PublicKeySize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
		return
	}

	sig, err := base64.StdEncoding.DecodeString(req.Signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	if !ed25519.Verify(ed25519.PublicKey(pubkey), []byte(user.Nonce), sig) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	if err := h.db.WithContext(c.Request.Context()).Model(&user).Update("nonce", "").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update nonce"})
		return
	}

	now := time.Now()
	claims := AuthClaims{
		WalletAddress: req.WalletAddress,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, verifyResponse{
		Token:         tokenString,
		WalletAddress: req.WalletAddress,
	})
}
