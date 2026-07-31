package middleware

import (
	"crypto/ed25519"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var testSecret = []byte("test-secret-for-testing")

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGenerateAndValidateToken(t *testing.T) {
	token, err := GenerateToken("test_wallet", testSecret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	claims, err := ValidateToken(token, testSecret)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if claims.WalletAddress != "test_wallet" {
		t.Errorf("WalletAddress = %v, want test_wallet", claims.WalletAddress)
	}
}

func TestExpiredToken(t *testing.T) {
	claims := Claims{
		WalletAddress: "test_wallet",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(testSecret)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	_, err = ValidateToken(tokenString, testSecret)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestVerifySignature(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey failed: %v", err)
	}

	message := "test message for signing"
	sig := ed25519.Sign(priv, []byte(message))

	pubHex := hex.EncodeToString(pub)
	sigHex := hex.EncodeToString(sig)

	t.Run("valid_signature", func(t *testing.T) {
		if !VerifySignature(pubHex, message, sigHex) {
			t.Error("expected valid signature")
		}
	})

	t.Run("wrong_message", func(t *testing.T) {
		if VerifySignature(pubHex, "wrong message", sigHex) {
			t.Error("expected invalid signature for wrong message")
		}
	})

	t.Run("invalid_hex", func(t *testing.T) {
		if VerifySignature("invalid", message, sigHex) {
			t.Error("expected false for invalid pubkey hex")
		}
	})

	t.Run("wrong_key", func(t *testing.T) {
		pub2, _, _ := ed25519.GenerateKey(nil)
		pub2Hex := hex.EncodeToString(pub2)
		if VerifySignature(pub2Hex, message, sigHex) {
			t.Error("expected invalid signature for wrong pubkey")
		}
	})
}

func TestAuthMiddleware(t *testing.T) {
	tests := []struct {
		name         string
		authHeader   string
		wantStatus   int
		wantBody     string
	}{
		{
			name:       "missing_header",
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid_format",
			authHeader: "InvalidFormat token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "expired_token",
			authHeader: func() string {
				claims := Claims{
					WalletAddress: "test",
					RegisteredClaims: jwt.RegisteredClaims{
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
					},
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				s, _ := token.SignedString(testSecret)
				return "Bearer " + s
			}(),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "valid_token",
			authHeader: func() string {
				s, _ := GenerateToken("test_wallet", testSecret)
				return "Bearer " + s
			}(),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			r.Use(AuthMiddleware(string(testSecret)))
			r.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			c.Request, _ = http.NewRequest(http.MethodGet, "/test", nil)
			if tt.authHeader != "" {
				c.Request.Header.Set("Authorization", tt.authHeader)
			}

			r.ServeHTTP(w, c.Request)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
