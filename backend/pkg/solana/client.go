package solana

import (
	"context"
	"fmt"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/sony/gobreaker"
)

type Client struct {
	rpcClient *rpc.Client
	timeout   time.Duration
	programID string
	breaker   *gobreaker.CircuitBreaker
}

func NewClient(rpcURL string) *Client {
	return &Client{
		rpcClient: rpc.New(rpcURL),
		timeout:   30 * time.Second,
		breaker: gobreaker.NewCircuitBreaker(gobreaker.Settings{
			Name:        "solana-rpc",
			MaxRequests: 1,
			Interval:    10 * time.Second,
			Timeout:     30 * time.Second,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 5
			},
		}),
	}
}

// execute runs fn through the circuit breaker. If the breaker is nil it
// passes through unchanged (defensive; used by hand-built clients in tests).
func (c *Client) execute(fn func() (any, error)) (any, error) {
	if c == nil || c.breaker == nil {
		return fn()
	}
	return c.breaker.Execute(fn)
}

// CircuitState returns the current circuit breaker state as a string.
func (c *Client) CircuitState() string {
	if c == nil || c.breaker == nil {
		return "closed"
	}
	switch c.breaker.State() {
	case gobreaker.StateOpen:
		return "open"
	case gobreaker.StateHalfOpen:
		return "half-open"
	default:
		return "closed"
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

	result, err := c.execute(func() (any, error) {
		return c.rpcClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
			Commitment: rpc.CommitmentConfirmed,
		})
	})
	if err != nil {
		return nil, fmt.Errorf("get transaction: %w", err)
	}

	res, _ := result.(*rpc.GetTransactionResult)
	return res, nil
}

func (c *Client) GetBalance(ctx context.Context, pubkey string) (uint64, error) {
	pk, err := solana.PublicKeyFromBase58(pubkey)
	if err != nil {
		return 0, fmt.Errorf("invalid pubkey: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.execute(func() (any, error) {
		res, err := c.rpcClient.GetBalance(ctx, pk, rpc.CommitmentConfirmed)
		if err != nil {
			return uint64(0), err
		}
		return res.Value, nil
	})
	if err != nil {
		return 0, fmt.Errorf("get balance: %w", err)
	}

	val, _ := result.(uint64)
	return val, nil
}

func (c *Client) GetRecentBlockhash(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.execute(func() (any, error) {
		res, err := c.rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
		if err != nil {
			return "", err
		}
		return res.Value.Blockhash.String(), nil
	})
	if err != nil {
		return "", fmt.Errorf("get recent blockhash: %w", err)
	}

	val, _ := result.(string)
	return val, nil
}

type BlockhashDetails struct {
	Blockhash            solana.Hash
	LastValidBlockHeight uint64
}

func (c *Client) GetLatestBlockhashDetails(ctx context.Context) (*BlockhashDetails, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.execute(func() (any, error) {
		res, err := c.rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
		if err != nil {
			return nil, err
		}
		return &BlockhashDetails{
			Blockhash:            res.Value.Blockhash,
			LastValidBlockHeight: res.Value.LastValidBlockHeight,
		}, nil
	})
	if err != nil {
		return nil, fmt.Errorf("get latest blockhash details: %w", err)
	}

	val, _ := result.(*BlockhashDetails)
	return val, nil
}

func (c *Client) SendRawTransaction(ctx context.Context, tx *solana.Transaction) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.execute(func() (any, error) {
		sig, err := c.rpcClient.SendTransactionWithOpts(ctx, tx, rpc.TransactionOpts{
			PreflightCommitment: rpc.CommitmentConfirmed,
		})
		if err != nil {
			return "", err
		}
		return sig.String(), nil
	})
	if err != nil {
		return "", fmt.Errorf("send transaction: %w", err)
	}

	sig, _ := result.(string)
	return sig, nil
}

func (c *Client) GetAccountInfo(ctx context.Context, pubkey solana.PublicKey) (*rpc.GetAccountInfoResult, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	result, err := c.execute(func() (any, error) {
		res, err := c.rpcClient.GetAccountInfoWithOpts(ctx, pubkey, &rpc.GetAccountInfoOpts{
			Commitment: rpc.CommitmentConfirmed,
		})
		if err != nil {
			return nil, err
		}
		return res, nil
	})
	if err != nil {
		return nil, fmt.Errorf("get account info: %w", err)
	}

	res, _ := result.(*rpc.GetAccountInfoResult)
	return res, nil
}


