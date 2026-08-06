package solana

import (
	"context"
	"fmt"
	"time"
)

type TradeVerification struct {
	Signature string
	Slot      uint64
	BlockTime time.Time
	Vault     string
	User      string
	AmountIn  uint64
	AmountOut uint64
	Slippage  uint64
	Success   bool
}

type DepositVerification struct {
	Signature string
	Slot      uint64
	BlockTime time.Time
	Vault     string
	User      string
	Amount    uint64
	Success   bool
}

func (c *Client) VerifyTradeExecution(ctx context.Context, signature string, vaultAddress string) (*TradeVerification, error) {
	txResult, err := c.GetTransaction(ctx, signature)
	if err != nil {
		return nil, fmt.Errorf("fetch transaction: %w", err)
	}

	parsed, err := ParseTransaction(txResult)
	if err != nil {
		return nil, fmt.Errorf("parse transaction: %w", err)
	}

	if !parsed.Success {
		return nil, fmt.Errorf("transaction failed on chain")
	}

	var tradeIx *ParsedInstruction
	var anchorIx *AnchorInstruction

	for i := range parsed.Instructions {
		if c.programID != "" && parsed.Instructions[i].ProgramID != c.programID {
			continue
		}
		ix, err := ParseAnchorInstruction(parsed.Instructions[i].Data)
		if err != nil {
			continue
		}
		if ix.Name == "execute_trade_pyth" {
			tradeIx = &parsed.Instructions[i]
			anchorIx = ix
			break
		}
	}

	if tradeIx == nil {
		return nil, fmt.Errorf("no execute_trade_pyth instruction found")
	}

	hasVault := false
	for _, acc := range tradeIx.Accounts {
		if acc == vaultAddress {
			hasVault = true
			break
		}
	}
	if !hasVault {
		return nil, fmt.Errorf("vault address %s not found in instruction accounts", vaultAddress)
	}

	amountIn, _ := anchorIx.Args["amount_in"].(uint64)
	amountOut, _ := anchorIx.Args["amount_out"].(uint64)
	slippage, _ := anchorIx.Args["slippage"].(uint64)

	return &TradeVerification{
		Signature: parsed.Signature,
		Slot:      parsed.Slot,
		BlockTime: parsed.BlockTime,
		Vault:     vaultAddress,
		User:      parsed.Signer,
		AmountIn:  amountIn,
		AmountOut: amountOut,
		Slippage:  slippage,
		Success:   true,
	}, nil
}

func (c *Client) VerifyDeposit(ctx context.Context, signature string, userAddress string, vaultAddress string) (*DepositVerification, error) {
	txResult, err := c.GetTransaction(ctx, signature)
	if err != nil {
		return nil, fmt.Errorf("fetch transaction: %w", err)
	}

	parsed, err := ParseTransaction(txResult)
	if err != nil {
		return nil, fmt.Errorf("parse transaction: %w", err)
	}

	if !parsed.Success {
		return nil, fmt.Errorf("transaction failed on chain")
	}

	if parsed.Signer != userAddress {
		return nil, fmt.Errorf("transaction signer %s does not match user %s", parsed.Signer, userAddress)
	}

	var depositIx *ParsedInstruction
	var anchorIx *AnchorInstruction

	for i := range parsed.Instructions {
		if c.programID != "" && parsed.Instructions[i].ProgramID != c.programID {
			continue
		}
		ix, err := ParseAnchorInstruction(parsed.Instructions[i].Data)
		if err != nil {
			continue
		}
		if ix.Name == "deposit" {
			depositIx = &parsed.Instructions[i]
			anchorIx = ix
			break
		}
	}

	if depositIx == nil {
		return nil, fmt.Errorf("no deposit instruction found")
	}

	hasVault := false
	for _, acc := range depositIx.Accounts {
		if acc == vaultAddress {
			hasVault = true
			break
		}
	}
	if !hasVault {
		return nil, fmt.Errorf("vault address %s not found in instruction accounts", vaultAddress)
	}

	amount, _ := anchorIx.Args["amount"].(uint64)

	return &DepositVerification{
		Signature: parsed.Signature,
		Slot:      parsed.Slot,
		BlockTime: parsed.BlockTime,
		Vault:     vaultAddress,
		User:      userAddress,
		Amount:    amount,
		Success:   true,
	}, nil
}
