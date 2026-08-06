package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mr-tron/base58"
)

func TestSimulateTransaction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewTransactionHandler()

	r := gin.New()
	r.POST("/api/v1/transactions/simulate", handler.SimulateTransaction)

	t.Run("Simulate_HappyPath", func(t *testing.T) {
		reqBody := SimulateTransactionRequest{
			VaultID:    "vault-123",
			Amount:     100.50,
			TokenMint:  "So11111111111111111111111111111111111111112",
			UserPubkey: "user-456",
			Action:     "deposit",
		}
		bodyBytes, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/simulate", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rec.Code)
		}

		var resp map[string]interface{}
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if !resp["success"].(bool) {
			t.Fatalf("expected success true")
		}

		data := resp["data"].(map[string]interface{})
		sig := data["signature"].(string)
		if len(sig) < 87 || len(sig) > 88 {
			t.Fatalf("expected signature length 87 or 88, got %d (%s)", len(sig), sig)
		}

		// Verify base58 signature
		_, err := base58.Decode(sig)
		if err != nil {
			t.Fatalf("signature is not valid base58: %v", err)
		}

		explorerUrl := data["explorerUrl"].(string)
		if !strings.HasPrefix(explorerUrl, "https://solscan.io/tx/") {
			t.Fatalf("explorer URL does not start with expected prefix: %s", explorerUrl)
		}
	})

	t.Run("Simulate_Determinism", func(t *testing.T) {
		reqBody := SimulateTransactionRequest{
			VaultID:    "vault-123",
			Amount:     100.50,
			TokenMint:  "So11111111111111111111111111111111111111112",
			UserPubkey: "user-456",
			Action:     "deposit",
		}
		bodyBytes, _ := json.Marshal(reqBody)

		req1 := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/simulate", bytes.NewBuffer(bodyBytes))
		req1.Header.Set("Content-Type", "application/json")
		rec1 := httptest.NewRecorder()
		r.ServeHTTP(rec1, req1)

		req2 := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/simulate", bytes.NewBuffer(bodyBytes))
		req2.Header.Set("Content-Type", "application/json")
		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, req2)

		var resp1, resp2 map[string]interface{}
		_ = json.Unmarshal(rec1.Body.Bytes(), &resp1)
		_ = json.Unmarshal(rec2.Body.Bytes(), &resp2)

		data1 := resp1["data"].(map[string]interface{})
		data2 := resp2["data"].(map[string]interface{})
		if data1["signature"] != data2["signature"] {
			t.Fatalf("signatures should be identical for identical input")
		}
	})

	t.Run("Simulate_DifferentAction", func(t *testing.T) {
		reqBody1 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-456", Action: "deposit"}
		reqBody2 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-456", Action: "withdraw"}

		b1, _ := json.Marshal(reqBody1)
		b2, _ := json.Marshal(reqBody2)

		rec1 := httptest.NewRecorder()
		r.ServeHTTP(rec1, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b1)))

		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b2)))

		var resp1, resp2 map[string]interface{}
		json.Unmarshal(rec1.Body.Bytes(), &resp1)
		json.Unmarshal(rec2.Body.Bytes(), &resp2)

		d1 := resp1["data"].(map[string]interface{})
		d2 := resp2["data"].(map[string]interface{})
		if d1["signature"] == d2["signature"] {
			t.Fatalf("expected different signatures for different actions")
		}
	})

	t.Run("Simulate_DifferentUser", func(t *testing.T) {
		reqBody1 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-1", Action: "deposit"}
		reqBody2 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-2", Action: "deposit"}

		b1, _ := json.Marshal(reqBody1)
		b2, _ := json.Marshal(reqBody2)

		rec1 := httptest.NewRecorder()
		r.ServeHTTP(rec1, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b1)))

		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b2)))

		var resp1, resp2 map[string]interface{}
		json.Unmarshal(rec1.Body.Bytes(), &resp1)
		json.Unmarshal(rec2.Body.Bytes(), &resp2)

		d1 := resp1["data"].(map[string]interface{})
		d2 := resp2["data"].(map[string]interface{})
		if d1["signature"] == d2["signature"] {
			t.Fatalf("expected different signatures for different users")
		}
	})

	t.Run("Simulate_EmptyBody", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/simulate", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 for empty body (optional fields), got %d", rec.Code)
		}
	})

	t.Run("Simulate_MalformedJSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/simulate", bytes.NewBufferString("{bad json"))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("Simulate_AmountNotInSignature_DocumentedDesignLimitation", func(t *testing.T) {
		reqBody1 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-456", Action: "deposit", Amount: 100}
		reqBody2 := SimulateTransactionRequest{VaultID: "vault-123", UserPubkey: "user-456", Action: "deposit", Amount: 500}

		b1, _ := json.Marshal(reqBody1)
		b2, _ := json.Marshal(reqBody2)

		rec1 := httptest.NewRecorder()
		r.ServeHTTP(rec1, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b1)))

		rec2 := httptest.NewRecorder()
		r.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/v1/transactions/simulate", bytes.NewReader(b2)))

		var resp1, resp2 map[string]interface{}
		json.Unmarshal(rec1.Body.Bytes(), &resp1)
		json.Unmarshal(rec2.Body.Bytes(), &resp2)

		d1 := resp1["data"].(map[string]interface{})
		d2 := resp2["data"].(map[string]interface{})

		// Signatures match because amount is not included in simulation seed hash (documented limitation)
		if d1["signature"] != d2["signature"] {
			t.Fatalf("expected identical signature for different amounts")
		}
	})
}
