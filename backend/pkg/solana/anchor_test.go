package solana

import (
	"encoding/binary"
	"testing"
)

func TestParseAnchorInstruction(t *testing.T) {
	t.Run("data_too_short", func(t *testing.T) {
		_, err := ParseAnchorInstruction([]byte{1, 2, 3})
		if err == nil {
			t.Errorf("expected error for data shorter than 8 bytes")
		}
	})

	t.Run("unknown_discriminator", func(t *testing.T) {
		_, err := ParseAnchorInstruction([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10})
		if err == nil {
			t.Errorf("expected error for unknown discriminator")
		}
	})

	t.Run("initialize_vault_happy_path", func(t *testing.T) {
		disc := anchorDiscriminator("initialize_vault")
		data := make([]byte, 8+20)
		copy(data[:8], disc[:])

		binary.LittleEndian.PutUint64(data[8:16], 1000000)
		binary.LittleEndian.PutUint16(data[16:18], 100)
		binary.LittleEndian.PutUint16(data[18:20], 200)
		binary.LittleEndian.PutUint64(data[20:28], uint64(86400))

		ix, err := ParseAnchorInstruction(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ix.Name != "initialize_vault" {
			t.Errorf("expected name initialize_vault, got %s", ix.Name)
		}
		if minRaise, ok := ix.Args["min_raise"].(uint64); !ok || minRaise != 1000000 {
			t.Errorf("expected min_raise=1000000, got %v", ix.Args["min_raise"])
		}
		if perfFee, ok := ix.Args["perf_fee"].(uint16); !ok || perfFee != 100 {
			t.Errorf("expected perf_fee=100, got %v", ix.Args["perf_fee"])
		}
		if mgmtFee, ok := ix.Args["mgmt_fee"].(uint16); !ok || mgmtFee != 200 {
			t.Errorf("expected mgmt_fee=200, got %v", ix.Args["mgmt_fee"])
		}
		if lockup, ok := ix.Args["lockup"].(int64); !ok || lockup != 86400 {
			t.Errorf("expected lockup=86400, got %v", ix.Args["lockup"])
		}
	})

	t.Run("deposit_happy_path", func(t *testing.T) {
		disc := anchorDiscriminator("deposit")
		data := make([]byte, 8+8)
		copy(data[:8], disc[:])
		binary.LittleEndian.PutUint64(data[8:16], 5000000000)

		ix, err := ParseAnchorInstruction(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ix.Name != "deposit" {
			t.Errorf("expected name deposit, got %s", ix.Name)
		}
		if amt, ok := ix.Args["amount"].(uint64); !ok || amt != 5000000000 {
			t.Errorf("expected amount=5000000000, got %v", ix.Args["amount"])
		}
	})

	t.Run("withdraw_happy_path", func(t *testing.T) {
		disc := anchorDiscriminator("withdraw")
		data := make([]byte, 8+8)
		copy(data[:8], disc[:])
		binary.LittleEndian.PutUint64(data[8:16], 2500000)

		ix, err := ParseAnchorInstruction(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ix.Name != "withdraw" {
			t.Errorf("expected name withdraw, got %s", ix.Name)
		}
		if shares, ok := ix.Args["shares"].(uint64); !ok || shares != 2500000 {
			t.Errorf("expected shares=2500000, got %v", ix.Args["shares"])
		}
	})

	t.Run("execute_trade_pyth_happy_path", func(t *testing.T) {
		disc := anchorDiscriminator("execute_trade_pyth")
		// Only 2 args: amount_in (u64) + min_amount_out (u64) = 16 bytes
		data := make([]byte, 8+16)
		copy(data[:8], disc[:])

		binary.LittleEndian.PutUint64(data[8:16], 1000)
		binary.LittleEndian.PutUint64(data[16:24], 950)

		ix, err := ParseAnchorInstruction(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ix.Name != "execute_trade_pyth" {
			t.Errorf("expected name execute_trade_pyth, got %s", ix.Name)
		}
		if amtIn, ok := ix.Args["amount_in"].(uint64); !ok || amtIn != 1000 {
			t.Errorf("expected amount_in=1000, got %v", ix.Args["amount_in"])
		}
		if minOut, ok := ix.Args["min_amount_out"].(uint64); !ok || minOut != 950 {
			t.Errorf("expected min_amount_out=950, got %v", ix.Args["min_amount_out"])
		}
	})

	t.Run("short_payload_errors", func(t *testing.T) {
		discInit := anchorDiscriminator("initialize_vault")
		discDep := anchorDiscriminator("deposit")
		discWith := anchorDiscriminator("withdraw")
		discTrade := anchorDiscriminator("execute_trade_pyth")

		shortPayloads := map[string][]byte{
			"initialize_vault": append(discInit[:], 1, 2, 3),
			"deposit":          append(discDep[:], 1, 2, 3),
			"withdraw":         append(discWith[:], 1, 2, 3),
			"execute_trade":    append(discTrade[:], 1, 2, 3),
		}

		for name, payload := range shortPayloads {
			_, err := ParseAnchorInstruction(payload)
			if err == nil {
				t.Errorf("expected error for short data payload in instruction %s", name)
			}
		}
	})
}
