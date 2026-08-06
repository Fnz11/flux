package middleware

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var testSecret = []byte("test-secret-for-testing-must-be-long-enough")

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGenerateAndValidateToken(t *testing.T) {
	t.Run("GenerateToken_RoundTrip", func(t *testing.T) {
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
	})

	t.Run("ValidateToken_WalletAddressPreserved", func(t *testing.T) {
		testWallets := []string{"4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", "alice_wallet_123", "0x12345"}
		for _, w := range testWallets {
			token, err := GenerateToken(w, testSecret)
			if err != nil {
				t.Fatalf("GenerateToken failed for %s: %v", w, err)
			}
			claims, err := ValidateToken(token, testSecret)
			if err != nil {
				t.Fatalf("ValidateToken failed for %s: %v", w, err)
			}
			if claims.WalletAddress != w {
				t.Errorf("WalletAddress = %v, want %v", claims.WalletAddress, w)
			}
		}
	})
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

func TestInvalidAlgorithm(t *testing.T) {
	claims := Claims{
		WalletAddress: "test_wallet",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}

	t.Run("AuthMW_HS384", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS384, claims)
		tokenString, err := token.SignedString(testSecret)
		if err != nil {
			t.Fatalf("failed to sign token: %v", err)
		}

		_, err = ValidateToken(tokenString, testSecret)
		if err == nil {
			t.Fatal("expected error for non-HS256 algorithm (HS384)")
		}
	})

	t.Run("AuthMW_AlgNone", func(t *testing.T) {
		// Construct an alg=none token string header.payload.
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
		payload := base64.RawURLEncoding.EncodeToString([]byte(`{"wallet_address":"hacker"}`))
		noneToken := fmt.Sprintf("%s.%s.", header, payload)

		_, err := ValidateToken(noneToken, testSecret)
		if err == nil {
			t.Fatal("expected error for alg=none token")
		}
	})

	t.Run("AuthMW_RS256Token", func(t *testing.T) {
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
		payload := base64.RawURLEncoding.EncodeToString([]byte(`{"wallet_address":"hacker"}`))
		rsToken := fmt.Sprintf("%s.%s.fakesig", header, payload)

		_, err := ValidateToken(rsToken, testSecret)
		if err == nil {
			t.Fatal("expected error for RS256 token")
		}
	})
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

	t.Run("VerifySignature_ValidHex", func(t *testing.T) {
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

	t.Run("VerifySignature_WrongLength", func(t *testing.T) {
		truncatedPub := pubHex[:30]
		if VerifySignature(truncatedPub, message, sigHex) {
			t.Error("expected false for truncated pubkey hex")
		}
		truncatedSig := sigHex[:30]
		if VerifySignature(pubHex, message, truncatedSig) {
			t.Error("expected false for truncated signature hex")
		}
	})
}

func TestAuthMiddleware(t *testing.T) {
	t.Run("AuthMW_ValidToken", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		var contextWallet string
		r.GET("/test", func(c *gin.Context) {
			contextWallet = GetWalletAddress(c)
			c.Status(http.StatusOK)
		})

		tok, _ := GenerateToken("wallet_abc_123", testSecret)
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		if contextWallet != "wallet_abc_123" {
			t.Errorf("context wallet = %q, want %q", contextWallet, "wallet_abc_123")
		}
	})

	t.Run("AuthMW_NoHeader", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_InvalidFormat_NoBearer", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		tok, _ := GenerateToken("test_wallet", testSecret)
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", tok) // Missing "Bearer " prefix
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_EmptyToken", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer ")
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_ExpiredToken", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		claims := Claims{
			WalletAddress: "test",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		s, _ := token.SignedString(testSecret)

		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+s)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_WrongSecret", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		tok, _ := GenerateToken("test_wallet", []byte("different-secret-key-1234567890"))
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_TamperedPayload", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		tok, _ := GenerateToken("test_wallet", testSecret)
		parts := strings.Split(tok, ".")
		if len(parts) == 3 {
			// Tamper with payload part
			tamperedPayload := parts[1] + "A"
			tamperedToken := fmt.Sprintf("%s.%s.%s", parts[0], tamperedPayload, parts[2])

			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Authorization", "Bearer "+tamperedToken)
			c.Request = req

			r.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
			}
		}
	})

	t.Run("AuthMW_AlgNone", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
		payload := base64.RawURLEncoding.EncodeToString([]byte(`{"wallet_address":"hacker"}`))
		noneToken := fmt.Sprintf("%s.%s.", header, payload)

		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+noneToken)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("AuthMW_RS256Token", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, r := gin.CreateTestContext(w)

		r.Use(AuthMiddleware(string(testSecret)))
		r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
		payload := base64.RawURLEncoding.EncodeToString([]byte(`{"wallet_address":"hacker"}`))
		rsToken := fmt.Sprintf("%s.%s.fakesig", header, payload)

		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+rsToken)
		c.Request = req

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})
}
