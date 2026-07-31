package solana

import (
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

type ParsedTransaction struct {
	Signature    string
	Slot         uint64
	BlockTime    time.Time
	Fee          uint64
	Signer       string
	Instructions []ParsedInstruction
	Success      bool
	LogMessages  []string
}

type ParsedInstruction struct {
	ProgramID string
	Data      []byte
	Accounts  []string
	InnerIx   []ParsedInstruction
}

func ParseTransaction(txResult *rpc.GetTransactionResult) (*ParsedTransaction, error) {
	if txResult == nil {
		return nil, fmt.Errorf("nil transaction result")
	}
	if txResult.Meta == nil {
		return nil, fmt.Errorf("missing transaction meta")
	}

	if txResult.Transaction == nil {
		return nil, fmt.Errorf("missing transaction data")
	}

	tx, err := txResult.Transaction.GetTransaction()
	if err != nil {
		return nil, fmt.Errorf("decode transaction: %w", err)
	}

	if len(tx.Message.AccountKeys) == 0 {
		return nil, fmt.Errorf("no account keys in transaction")
	}

	var signature string
	if len(tx.Signatures) > 0 {
		signature = tx.Signatures[0].String()
	}

	signer := tx.Message.AccountKeys[0].String()
	success := txResult.Meta.Err == nil

	blockTime := time.Now()
	if txResult.BlockTime != nil {
		blockTime = txResult.BlockTime.Time()
	}

	instructions := make([]ParsedInstruction, len(tx.Message.Instructions))
	for i, ix := range tx.Message.Instructions {
		accounts := resolveAccountKeys(ix.Accounts, tx.Message.AccountKeys)
		instructions[i] = ParsedInstruction{
			ProgramID: tx.Message.AccountKeys[ix.ProgramIDIndex].String(),
			Data:      []byte(ix.Data),
			Accounts:  accounts,
		}
	}

	if txResult.Meta.InnerInstructions != nil {
		for _, inner := range txResult.Meta.InnerInstructions {
			idx := int(inner.Index)
			if idx >= 0 && idx < len(instructions) {
				for _, innerIx := range inner.Instructions {
					accounts := resolveAccountKeys(innerIx.Accounts, tx.Message.AccountKeys)
					instructions[idx].InnerIx = append(instructions[idx].InnerIx, ParsedInstruction{
						ProgramID: tx.Message.AccountKeys[innerIx.ProgramIDIndex].String(),
						Data:      innerIx.Data,
						Accounts:  accounts,
					})
				}
			}
		}
	}

	return &ParsedTransaction{
		Signature:    signature,
		Slot:         txResult.Slot,
		BlockTime:    blockTime,
		Fee:          txResult.Meta.Fee,
		Signer:       signer,
		Instructions: instructions,
		Success:      success,
		LogMessages:  txResult.Meta.LogMessages,
	}, nil
}

func resolveAccountKeys(accs []uint16, keys []solana.PublicKey) []string {
	result := make([]string, len(accs))
	for i, idx := range accs {
		if int(idx) < len(keys) {
			result[i] = keys[idx].String()
		}
	}
	return result
}
