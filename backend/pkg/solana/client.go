package solana

import (
	"context"
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

type Client struct {
	rpcClient *rpc.Client
	timeout   time.Duration
	programID string
}

func NewClient(rpcURL string) *Client {
	return &Client{
		rpcClient: rpc.New(rpcURL),
		timeout:   30 * time.Second,
	}
}

func (c *Client) WithTimeout(timeout time.Duration) *Client {
	c.timeout = timeout
	return c
}

func (c *Client) WithProgramID(programID string) *Client {
	c.programID = programID
	return c
}

func (c *Client) ProgramID() string {
	return c.programID
}

func (c *Client) GetTransaction(ctx context.Context, signature string) (*rpc.GetTransactionResult, error) {
	sig, err := solana.SignatureFromBase58(signature)
	if err != nil {
		return nil, fmt.Errorf("invalid signature: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.rpcClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
		Commitment: rpc.CommitmentConfirmed,
	})
	if err != nil {
		return nil, fmt.Errorf("get transaction: %w", err)
	}

	return result, nil
}

func (c *Client) GetBalance(ctx context.Context, pubkey string) (uint64, error) {
	pk, err := solana.PublicKeyFromBase58(pubkey)
	if err != nil {
		return 0, fmt.Errorf("invalid pubkey: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.rpcClient.GetBalance(ctx, pk, rpc.CommitmentConfirmed)
	if err != nil {
		return 0, fmt.Errorf("get balance: %w", err)
	}

	return result.Value, nil
}

func (c *Client) GetRecentBlockhash(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
	if err != nil {
		return "", fmt.Errorf("get recent blockhash: %w", err)
	}

	return result.Value.Blockhash.String(), nil
}
