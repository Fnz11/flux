package solana

import (
	"testing"

	"github.com/gagliardetto/solana-go/rpc"
)

func TestParseTransaction(t *testing.T) {
	t.Run("nil_txResult", func(t *testing.T) {
		_, err := ParseTransaction(nil)
		if err == nil {
			t.Errorf("expected error for nil txResult")
		}
	})

	t.Run("missing_meta", func(t *testing.T) {
		_, err := ParseTransaction(&rpc.GetTransactionResult{})
		if err == nil {
			t.Errorf("expected error for missing meta")
		}
	})

	t.Run("missing_transaction_data", func(t *testing.T) {
		txResult := &rpc.GetTransactionResult{
			Meta: &rpc.TransactionMeta{},
		}
		_, err := ParseTransaction(txResult)
		if err == nil {
			t.Errorf("expected error for missing transaction data")
		}
	})

	t.Run("resolve_account_keys_bounds_check", func(t *testing.T) {
		key1 := "Key111111111111111111111111111111111111111"
		keys := []string{key1}
		// Index 5 is out of bounds
		accs := []uint16{0, 5}

		resolved := resolveAccountKeysStrings(accs, keys)
		if len(resolved) != 2 {
			t.Fatalf("expected 2 elements in resolved accounts, got %d", len(resolved))
		}
		if resolved[0] != key1 {
			t.Errorf("expected resolved[0]=%s, got %s", key1, resolved[0])
		}
		if resolved[1] != "" {
			t.Errorf("expected resolved[1] empty for out-of-bounds index, got %s", resolved[1])
		}
	})
}

func resolveAccountKeysStrings(accs []uint16, keys []string) []string {
	result := make([]string, len(accs))
	for i, idx := range accs {
		if int(idx) < len(keys) {
			result[i] = keys[idx]
		}
	}
	return result
}
