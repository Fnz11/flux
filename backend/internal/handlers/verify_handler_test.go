package handlers

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gin-gonic/gin"
	"github.com/mr-tron/base58"
)

type stubTxVerifier struct {
	result *rpc.GetTransactionResult
	err    error
}

func (s *stubTxVerifier) GetTransaction(ctx context.Context, signature string) (*rpc.GetTransactionResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

type stubVerifyTradeRepo struct {
	found *domain.TradeDetail
	err   error
}

func (s *stubVerifyTradeRepo) FindBySignature(ctx context.Context, sig string) (*domain.TradeDetail, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.found == nil {
		return nil, domain.ErrNotFound
	}
	return s.found, nil
}

func (s *stubVerifyTradeRepo) Create(ctx context.Context, trade *domain.TradeDetail) error {
	return nil
}
func (s *stubVerifyTradeRepo) ListByVault(ctx context.Context, vaultID string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return nil, 0, nil
}
func (s *stubVerifyTradeRepo) ListByVaultIDs(ctx context.Context, vaultIDs []string, tradeType string, page, limit int) ([]domain.TradeDetail, int64, error) {
	return nil, 0, nil
}

func randomSig(t *testing.T) string {
	t.Helper()
	return base58.Encode(make([]byte, 64))
}

func randomPubkey(t *testing.T, seed byte) string {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	return base58.Encode(pub)
}

// anchorDiscriminatorBytes mirrors solana.anchorDiscriminator.
func anchorDiscriminatorBytes(name string) []byte {
	h := sha256.Sum256([]byte("global:" + name))
	return h[:8]
}

// buildBuyIXData encodes an execute_trade_pyth instruction payload:
// discriminator + amount_in + amount_out + slippage (each u64 LE).
func buildBuyIXData(amountIn, amountOut, slippage uint64) []byte {
	data := anchorDiscriminatorBytes("execute_trade_pyth")
	for _, v := range []uint64{amountIn, amountOut, slippage} {
		b := make([]byte, 8)
		binary.LittleEndian.PutUint64(b, v)
		data = append(data, b...)
	}
	return data
}

// buildRX constructs a valid rpc.GetTransactionResult whose single instruction
// references all account keys (signer, vault, program) and targets the program
// key at the last index.
func buildRX(t *testing.T, signature, signer, vault, program string, ixData []byte, blockTime time.Time, success bool) *rpc.GetTransactionResult {
	t.Helper()

	all := []string{signer, vault, program}
	keys := make(solana.PublicKeySlice, 0, len(all))
	for _, a := range all {
		pk, err := solana.PublicKeyFromBase58(a)
		if err != nil {
			t.Fatalf("bad pubkey %q: %v", a, err)
		}
		keys = append(keys, pk)
	}

	accIdx := make([]uint16, len(all))
	for i := range all {
		accIdx[i] = uint16(i)
	}

	sig, err := solana.SignatureFromBase58(signature)
	if err != nil {
		t.Fatalf("bad signature: %v", err)
	}

	tx := &solana.Transaction{
		Signatures: []solana.Signature{sig},
		Message: solana.Message{
			AccountKeys: keys,
			Header: solana.MessageHeader{
				NumRequiredSignatures:     1,
				NumReadonlySignedAccounts: 0,
			},
			RecentBlockhash: solana.MustHashFromBase58("11111111111111111111111111111111"),
			Instructions: []solana.CompiledInstruction{{
				ProgramIDIndex: uint16(len(keys) - 1),
				Accounts:       accIdx,
				Data:           ixData,
			}},
		},
	}
	tx.Message.SetVersion(solana.MessageVersionLegacy)

	raw, err := json.Marshal(tx)
	if err != nil {
		t.Fatalf("marshal transaction: %v", err)
	}
	env := new(rpc.TransactionResultEnvelope)
	if err := env.UnmarshalJSON(raw); err != nil {
		t.Fatalf("unmarshal transaction envelope: %v", err)
	}

	meta := &rpc.TransactionMeta{Fee: 5000}
	if !success {
		meta.Err = "InstructionError: 0"
	}

	bt := solana.UnixTimeSeconds(blockTime.Unix())
	return &rpc.GetTransactionResult{
		Transaction: env,
		Meta:        meta,
		Slot:        12345,
		BlockTime:   &bt,
	}
}

func doVerifyRequest(h *VerifyHandler, body string) (*httptest.ResponseRecorder, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/transactions/verify", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	h.Verify(c)
	var out map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func TestVerifyHandler_InvalidSignature_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewVerifyHandler(nil, nil)

	w, _ := doVerifyRequest(h, `{"signature": "not-a-base58-signature"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestVerifyHandler_MissingSignature_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewVerifyHandler(nil, nil)

	w, _ := doVerifyRequest(h, `{"vault_id": "vault-123"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing signature, got %d", w.Code)
	}
}

func TestVerifyHandler_TxNotFound_ReturnsVerifiedFalse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	verifier := &stubTxVerifier{err: errors.New("failed to get transaction: Signature not found")}
	h := NewVerifyHandler(nil, nil)
	h.client = verifier

	w, out := doVerifyRequest(h, `{"signature": "`+sig+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
	}
	data, _ := out["data"].(map[string]interface{})
	if data["verified"] != false {
		t.Errorf("expected verified false, got %v", data["verified"])
	}
	if data["reason"] != "not_found" {
		t.Errorf("expected reason not_found, got %v", data["reason"])
	}
	if data["data_scope"] != "rpc" {
		t.Errorf("expected data_scope rpc, got %v", data["data_scope"])
	}
}

func TestVerifyHandler_AlreadySynced_ReturnsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	repo := &stubVerifyTradeRepo{found: &domain.TradeDetail{TransactionSignature: sig}}
	h := NewVerifyHandler(nil, repo)

	w, out := doVerifyRequest(h, `{"signature": "`+sig+`", "vault_id": "vault-123"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
	}
	data, _ := out["data"].(map[string]interface{})
	if data["verified"] != true {
		t.Errorf("expected verified true, got %v", data["verified"])
	}
	if data["already_synced"] != true {
		t.Errorf("expected already_synced true, got %v", data["already_synced"])
	}
	if data["synced"] != true {
		t.Errorf("expected synced true, got %v", data["synced"])
	}
}

func TestVerifyHandler_Success_PopulatesFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	signer := randomPubkey(t, 1)
	vault := randomPubkey(t, 2)
	program := randomPubkey(t, 3)
	bt := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)

	txResult := buildRX(t, sig, signer, vault, program, nil, bt, true)
	h := NewVerifyHandler(nil, nil)
	h.client = &stubTxVerifier{result: txResult}

	w, out := doVerifyRequest(h, `{"signature": "`+sig+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
	}
	data, _ := out["data"].(map[string]interface{})
	if data["verified"] != true {
		t.Errorf("expected verified true, got %v", data["verified"])
	}
	if data["signature"] != sig {
		t.Errorf("expected signature %q, got %v", sig, data["signature"])
	}
	if data["signer"] != signer {
		t.Errorf("expected signer %q, got %v", signer, data["signer"])
	}
	if data["block_time"] != float64(bt.Unix()) {
		t.Errorf("expected block_time %d, got %v", bt.Unix(), data["block_time"])
	}
	if data["block_time_iso"] == "" {
		t.Errorf("expected block_time_iso to be populated, got %v", data["block_time_iso"])
	}
	parsedISO, err := time.Parse(time.RFC3339, data["block_time_iso"].(string))
	if err != nil {
		t.Fatalf("block_time_iso not RFC3339: %q: %v", data["block_time_iso"], err)
	}
	if parsedISO.Equal(bt) != true {
		t.Errorf("expected block_time_iso to represent %v, got %v", bt, data["block_time_iso"])
	}
	if data["trade_type"] != "" {
		t.Errorf("expected empty trade_type without vault_id, got %v", data["trade_type"])
	}
}

func TestVerifyHandler_Success_BuyClassification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	signer := randomPubkey(t, 1)
	vault := randomPubkey(t, 2)
	program := randomPubkey(t, 3)
	bt := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)

	ixData := buildBuyIXData(100_000_000, 250_000_000, 10)
	txResult := buildRX(t, sig, signer, vault, program, ixData, bt, true)
	h := NewVerifyHandler(nil, nil)
	h.client = &stubTxVerifier{result: txResult}

	w, out := doVerifyRequest(h, `{"signature": "`+sig+`", "vault_id": "`+vault+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
	}
	data, _ := out["data"].(map[string]interface{})
	if data["verified"] != true {
		t.Errorf("expected verified true, got %v", data["verified"])
	}
	if data["trade_type"] != "Buy" {
		t.Errorf("expected trade_type Buy, got %v", data["trade_type"])
	}
	if data["amount_in"] != "100" {
		t.Errorf("expected amount_in 100, got %v", data["amount_in"])
	}
	if data["amount_out"] != "250" {
		t.Errorf("expected amount_out 250, got %v", data["amount_out"])
	}
	if data["price_at_execution"] != "2.5" {
		t.Errorf("expected price_at_execution 2.5, got %v", data["price_at_execution"])
	}
	if data["vault_id"] != vault {
		t.Errorf("expected vault_id %q, got %v", vault, data["vault_id"])
	}
}

func TestVerifyHandler_FailedOnChain_ReturnsReasonFailed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	signer := randomPubkey(t, 1)
	vault := randomPubkey(t, 2)
	program := randomPubkey(t, 3)
	bt := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)

	txResult := buildRX(t, sig, signer, vault, program, nil, bt, false)
	h := NewVerifyHandler(nil, nil)
	h.client = &stubTxVerifier{result: txResult}

	w, out := doVerifyRequest(h, `{"signature": "`+sig+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
	}
	data, _ := out["data"].(map[string]interface{})
	if data["verified"] != false {
		t.Errorf("expected verified false, got %v", data["verified"])
	}
	if data["reason"] != "failed" {
		t.Errorf("expected reason failed, got %v", data["reason"])
	}
}

func TestVerifyHandler_RPCUnavailable_Returns502(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	h := NewVerifyHandler(nil, nil)
	h.client = &stubTxVerifier{err: errors.New("connection refused")}

	w, _ := doVerifyRequest(h, `{"signature": "`+sig+`"}`)
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestVerifyHandler_NilClient_Returns502(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sig := randomSig(t)
	h := NewVerifyHandler(nil, nil)

	w, _ := doVerifyRequest(h, `{"signature": "`+sig+`"}`)
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 for nil client, got %d", w.Code)
	}
}
