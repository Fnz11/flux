package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

func TestFeeHandler_GetVaultFees(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("GetVaultFees_Success_ByID", func(t *testing.T) {
		repo := &mockVaultRepository{
			vault: &domain.VaultDetail{
				ID:                "vault-1",
				Address:           "addr-1",
				TVL:               decimal.NewFromFloat(10000.0),
				PerformanceFeeBps: 1000, // 10%
				ManagementFeeBps:  200,  // 2%
			},
		}
		h := NewFeeHandler(repo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "vaultId", Value: "vault-1"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/fees/vault-1", nil)

		h.GetVaultFees(c)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var resp FeeResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal response: %v", err)
		}

		if resp.VaultID != "vault-1" {
			t.Errorf("expected vault_id vault-1, got %s", resp.VaultID)
		}
		if resp.AccruedPerformanceFee != 1000.0 {
			t.Errorf("expected accrued_performance_fee 1000.0, got %f", resp.AccruedPerformanceFee)
		}
		if resp.AccruedManagementFee != 200.0 {
			t.Errorf("expected accrued_management_fee 200.0, got %f", resp.AccruedManagementFee)
		}
		if resp.TotalAccrued != 1200.0 {
			t.Errorf("expected total_accrued 1200.0, got %f", resp.TotalAccrued)
		}
	})

	t.Run("GetVaultFees_NotFound", func(t *testing.T) {
		repo := &mockVaultRepository{getByAddrErr: domain.ErrNotFound}
		h := NewFeeHandler(repo)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "vaultId", Value: "unknown"}}
		c.Request = httptest.NewRequest("GET", "/api/v1/fees/unknown", nil)

		h.GetVaultFees(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})
}
