package solana

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

type AnchorInstruction struct {
	Name string
	Args map[string]interface{}
}

var (
	discInitializeVault  = anchorDiscriminator("initialize_vault")
	discDeposit          = anchorDiscriminator("deposit")
	discWithdraw         = anchorDiscriminator("withdraw")
	discExecuteTradePyth = anchorDiscriminator("execute_trade_pyth")
)

func anchorDiscriminator(name string) [8]byte {
	h := sha256.Sum256([]byte("global:" + name))
	var d [8]byte
	copy(d[:], h[:8])
	return d
}

func ParseAnchorInstruction(data []byte) (*AnchorInstruction, error) {
	if len(data) < 8 {
		return nil, fmt.Errorf("data too short for discriminator")
	}

	var disc [8]byte
	copy(disc[:], data[:8])

	switch disc {
	case discInitializeVault:
		return parseInitializeVault(data[8:])
	case discDeposit:
		return parseDeposit(data[8:])
	case discWithdraw:
		return parseWithdraw(data[8:])
	case discExecuteTradePyth:
		return parseExecuteTradePyth(data[8:])
	default:
		return nil, fmt.Errorf("unknown anchor instruction discriminator: %x", disc)
	}
}

func parseInitializeVault(data []byte) (*AnchorInstruction, error) {
	if len(data) < 20 {
		return nil, fmt.Errorf("data too short for initialize_vault")
	}

	offset := 0
	minRaise, offset, err := readU64(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read min_raise: %w", err)
	}
	perfFee, offset, err := readU16(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read perf_fee: %w", err)
	}
	mgmtFee, offset, err := readU16(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read mgmt_fee: %w", err)
	}
	lockup, _, err := readI64(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read lockup: %w", err)
	}

	return &AnchorInstruction{
		Name: "initialize_vault",
		Args: map[string]interface{}{
			"min_raise": minRaise,
			"perf_fee":  perfFee,
			"mgmt_fee":  mgmtFee,
			"lockup":    lockup,
		},
	}, nil
}

func parseDeposit(data []byte) (*AnchorInstruction, error) {
	if len(data) < 8 {
		return nil, fmt.Errorf("data too short for deposit")
	}

	amount, _, err := readU64(data, 0)
	if err != nil {
		return nil, fmt.Errorf("read amount: %w", err)
	}

	return &AnchorInstruction{
		Name: "deposit",
		Args: map[string]interface{}{
			"amount": amount,
		},
	}, nil
}

func parseWithdraw(data []byte) (*AnchorInstruction, error) {
	if len(data) < 8 {
		return nil, fmt.Errorf("data too short for withdraw")
	}

	shares, _, err := readU64(data, 0)
	if err != nil {
		return nil, fmt.Errorf("read shares: %w", err)
	}

	return &AnchorInstruction{
		Name: "withdraw",
		Args: map[string]interface{}{
			"shares": shares,
		},
	}, nil
}

func parseExecuteTradePyth(data []byte) (*AnchorInstruction, error) {
	if len(data) < 24 {
		return nil, fmt.Errorf("data too short for execute_trade_pyth")
	}

	offset := 0
	amountIn, offset, err := readU64(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read amount_in: %w", err)
	}
	amountOut, offset, err := readU64(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read amount_out: %w", err)
	}
	slippage, _, err := readU64(data, offset)
	if err != nil {
		return nil, fmt.Errorf("read slippage: %w", err)
	}

	return &AnchorInstruction{
		Name: "execute_trade_pyth",
		Args: map[string]interface{}{
			"amount_in":  amountIn,
			"amount_out": amountOut,
			"slippage":   slippage,
		},
	}, nil
}

func readU64(data []byte, offset int) (uint64, int, error) {
	if offset+8 > len(data) {
		return 0, 0, fmt.Errorf("short read for u64 at offset %d", offset)
	}
	return binary.LittleEndian.Uint64(data[offset:]), offset + 8, nil
}

func readU16(data []byte, offset int) (uint16, int, error) {
	if offset+2 > len(data) {
		return 0, 0, fmt.Errorf("short read for u16 at offset %d", offset)
	}
	return binary.LittleEndian.Uint16(data[offset:]), offset + 2, nil
}

func readI64(data []byte, offset int) (int64, int, error) {
	if offset+8 > len(data) {
		return 0, 0, fmt.Errorf("short read for i64 at offset %d", offset)
	}
	return int64(binary.LittleEndian.Uint64(data[offset:])), offset + 8, nil
}
