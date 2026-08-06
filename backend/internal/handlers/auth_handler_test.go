package handlers

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mr-tron/base58"
)

type mockUserRepo struct {
	users          map[string]*domain.UserDetail
	nonces         map[string]string
	findByErr      error
	findOrCreateErr error
	updateNonceErr error
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{
		users:  make(map[string]*domain.UserDetail),
		nonces: make(map[string]string),
	}
}

func (m *mockUserRepo) FindByWallet(ctx context.Context, wallet string) (*domain.UserDetail, error) {
	if m.findByErr != nil {
		return nil, m.findByErr
	}
	u, ok := m.users[wallet]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return u, nil
}

func (m *mockUserRepo) FindOrCreateByWallet(ctx context.Context, wallet string) (*domain.UserDetail, error) {
	if m.findOrCreateErr != nil {
		return nil, m.findOrCreateErr
	}
	if u, ok := m.users[wallet]; ok {
		return u, nil
	}
	u := &domain.UserDetail{
		ID:            "user-uuid-123",
		WalletAddress: wallet,
	}
	m.users[wallet] = u
	return u, nil
}

func (m *mockUserRepo) UpdateNonce(ctx context.Context, wallet, nonce string) error {
	if m.updateNonceErr != nil {
		return m.updateNonceErr
	}
	u, ok := m.users[wallet]
	if !ok {
		return domain.ErrNotFound
	}
	u.Nonce = nonce
	m.nonces[wallet] = nonce
	return nil
}

func generateTestKeyPair() (pubKeyBase58 string, privKey ed25519.PrivateKey) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	return base58.Encode(pub), priv
}

func TestAuthHandler_Nonce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "supersecretjwtkeythatis32byteslong!!"

	t.Run("Nonce_HappyPath", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)
		pub58, _ := generateTestKeyPair()

		body := map[string]string{"wallet_address": pub58}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
		}
		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		nonceStr, ok := resp["nonce"].(string)
		if !ok || !strings.HasPrefix(nonceStr, "Sign this message to authenticate with FBYT: ") {
			t.Fatalf("unexpected nonce response: %+v", resp)
		}
	})

	t.Run("Nonce_MissingWalletAddress", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader([]byte("{}")))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_EmptyWalletAddress", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		body := map[string]string{"wallet_address": ""}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_WhitespaceOnlyAddress", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		body := map[string]string{"wallet_address": "   "}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_MalformedJSON", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader([]byte("{bad json")))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_WalletAddressExceedsMaxLength", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		longAddr := strings.Repeat("A", 10000)
		body := map[string]string{"wallet_address": longAddr}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_SQLInjectionInWalletAddress", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)

		body := map[string]string{"wallet_address": "' OR 1=1--"}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Nonce(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", w.Code)
		}
	})

	t.Run("Nonce_HighVolumeRequests", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)
		pub58, _ := generateTestKeyPair()

		lastNonce := ""
		for i := 0; i < 10; i++ {
			body := map[string]string{"wallet_address": pub58}
			b, _ := json.Marshal(body)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
			c.Request.Header.Set("Content-Type", "application/json")
			h.Nonce(c)
			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", w.Code)
			}
			var resp map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &resp)
			currentNonce := resp["nonce"].(string)
			if currentNonce == lastNonce {
				t.Fatalf("nonce was not updated on subsequent call")
			}
			lastNonce = currentNonce
		}
	})
}

func TestAuthHandler_Verify(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "supersecretjwtkeythatis32byteslong!!"

	t.Run("Verify_HappyPath", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)
		pub58, priv := generateTestKeyPair()

		// Request nonce
		body := map[string]string{"wallet_address": pub58}
		b, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")
		h.Nonce(c)

		var nonceResp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &nonceResp)
		nonceStr := nonceResp["nonce"].(string)

		// Sign nonce
		sigBytes := ed25519.Sign(priv, []byte(nonceStr))
		sigB64 := base64.StdEncoding.EncodeToString(sigBytes)

		// Call Verify
		verifyBody := map[string]string{
			"wallet_address": pub58,
			"signature":      sigB64,
		}
		vb, _ := json.Marshal(verifyBody)
		vw := httptest.NewRecorder()
		vc, _ := gin.CreateTestContext(vw)
		vc.Request = httptest.NewRequest("POST", "/api/v1/auth/verify", bytes.NewReader(vb))
		vc.Request.Header.Set("Content-Type", "application/json")

		h.Verify(vc)

		if vw.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d, body: %s", vw.Code, vw.Body.String())
		}
		var vResp verifyResponse
		if err := json.Unmarshal(vw.Body.Bytes(), &vResp); err != nil {
			t.Fatalf("failed to unmarshal response: %v", err)
		}
		if vResp.Token == "" || vResp.WalletAddress != pub58 {
			t.Fatalf("unexpected verify response: %+v", vResp)
		}

		// Check JWT claims
		token, err := jwt.ParseWithClaims(vResp.Token, &AuthClaims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			t.Fatalf("failed to parse returned JWT: %v", err)
		}
		claims := token.Claims.(*AuthClaims)
		if claims.WalletAddress != pub58 {
			t.Fatalf("expected wallet in JWT %s, got %s", pub58, claims.WalletAddress)
		}
	})

	t.Run("Verify_NonceAlreadyConsumed", func(t *testing.T) {
		repo := newMockUserRepo()
		h := NewAuthHandler(repo, jwtSecret)
		pub58, priv := generateTestKeyPair()

		body := map[string]string{"wallet_address": pub58}
		b, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/auth/nonce", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")
		h.Nonce(c)

		var nonceResp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &nonceResp)
		nonceStr := nonceResp["nonce"].(string)

		sigBytes := ed25519.Sign(priv, []byte(nonceStr))
		sigB64 := base64.StdEncoding.EncodeToString(sigBytes)

		verifyBody := map[string]string{"wallet_address": pub58, "signature": sigB64}
		vb, _ := json.Marshal(verifyBody)

		// Call 1
		vw := httptest.NewRecorder()
		vc, _ := gin.CreateTestContext(vw)
		vc.Request = httptest.NewRequest("POST", "/api/v1/auth/verify", bytes.NewReader(vb))
		vc.Request.Header.Set("Content-Type", "application/json")
		h.Verify(vc)
		if vw.Code != http.StatusOK {
			t.Fatalf("expected 200 on first verify call")
		}

		// Replay Call 2
		vw2 := httptest.NewRecorder()
		vc2, _ := gin.CreateTestContext(vw2)
		vc2.Request = httptest.NewRequest("POST", "/api/v1/auth/verify", bytes.NewReader(vb))
		vc2.Request.Header.Set("Content-Type", "application/json")
		h.Verify(vc2)

		if vw2.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 on replay verify call, got %d", vw2.Code)
		}
	})
}
