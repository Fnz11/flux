package seed

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/memo"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/jsonrpc"
)

const (
	lamportsPerSOL    = uint64(1_000_000_000)
	minAirdropLamports = uint64(10_000_000) // 0.01 SOL: ignore sub-threshold shortfalls
)

// Airdrop retry knobs. Sleep grows exponentially with jitter so a Devnet burst
// of airdrops backs off instead of hammering the rate limiter.
var (
	backoffMaxAttempts = 6
	backoffInitial     = 500 * time.Millisecond
	backoffCap         = 30 * time.Second
)

// SolanaSeedClient talks to a local Solana test validator and creates real
// accounts, airdrops real SOL, and submits real transfer transactions so every
// seeded trade carries a genuine on-chain signature.
type SolanaSeedClient struct {
	client *rpc.Client
	ctx    context.Context
}

func NewSolanaSeedClient(rpcURL string) *SolanaSeedClient {
	return &SolanaSeedClient{
		client: rpc.New(rpcURL),
		ctx:    context.Background(),
	}
}

// NewKeypair returns a fresh real Solana keypair.
func (s *SolanaSeedClient) NewKeypair() *solana.Wallet {
	return solana.NewWallet()
}

func (s *SolanaSeedClient) requestAirdrop(ctx context.Context, to solana.PublicKey, lamports uint64, commitment rpc.CommitmentType) (solana.Signature, error) {
	return s.client.RequestAirdrop(ctx, to, lamports, commitment)
}

// GetBalance returns the account's current on-chain balance (Confirmed), used
// to airdrop only real shortfalls.
func (s *SolanaSeedClient) GetBalance(ctx context.Context, to solana.PublicKey) (uint64, error) {
	res, err := s.client.GetBalance(ctx, to, rpc.CommitmentConfirmed)
	if err != nil {
		return 0, fmt.Errorf("get balance: %w", err)
	}
	return res.Value, nil
}

// Airdrop funds an account in 100 SOL chunks (test validator caps airdrops);
// each chunk retries on rate-limit / transient errors with backoff.
func (s *SolanaSeedClient) Airdrop(ctx context.Context, to solana.PublicKey, sol float64) error {
	lamports := uint64(sol * float64(lamportsPerSOL))
	const chunk = uint64(100) * lamportsPerSOL
	for lamports > 0 {
		amt := chunk
		if amt > lamports {
			amt = lamports
		}
		if err := airdropWithRetry(ctx, s, to, amt); err != nil {
			return err
		}
		lamports -= amt
	}
	return nil
}

// airdropRPC is the SolanaSeedClient surface the airdrop machinery (and tests)
// needs, so backoff/retry runs against a stub without a live validator.
type airdropRPC interface {
	requestAirdrop(ctx context.Context, to solana.PublicKey, lamports uint64, commitment rpc.CommitmentType) (solana.Signature, error)
	confirm(ctx context.Context, sig solana.Signature) error
}

// airdropWithRetry issues a single airdrop, backing off exponentially on
// rate-limit / transient errors and failing fast on hard errors (blockhash not
// found, insufficient funds, ...). A canceled ctx aborts any pending sleep.
func airdropWithRetry(ctx context.Context, sub airdropRPC, to solana.PublicKey, lamports uint64) error {
	var lastErr error
	for attempt := 0; attempt < backoffMaxAttempts; attempt++ {
		sig, err := sub.requestAirdrop(ctx, to, lamports, rpc.CommitmentConfirmed)
		if err == nil {
			return sub.confirm(ctx, sig)
		}
		lastErr = err
		if !isRetryable(err) {
			return fmt.Errorf("airdrop: %w", err)
		}
		if attempt == backoffMaxAttempts-1 {
			break
		}
		if err := sleepCtx(ctx, backoffDelay(attempt)); err != nil {
			return fmt.Errorf("airdrop: %w", err)
		}
	}
	return fmt.Errorf("airdrop: giving up after %d attempts (last: %w)", backoffMaxAttempts, lastErr)
}

// isRetryable reports whether err looks like a rate limit or transient RPC
// failure worth backing off on. Hard errors (blockhash, insufficient funds,
// etc.) are not retryable.
func isRetryable(err error) bool {
	var rpcErr *jsonrpc.RPCError
	if errors.As(err, &rpcErr) {
		if isRateLimitCode(rpcErr.Code) {
			return true
		}
		if hasRateLimitMarker(rpcErr.Message) {
			return true
		}
	}
	var httpErr *jsonrpc.HTTPError
	if errors.As(err, &httpErr) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	return hasRateLimitMarker(err.Error())
}

// isRateLimitCode matches Solana/cloud RPC error codes that mean "slow down".
// 429 is the cloud HTTP code; 32002/32005 (and their JSON-RPC negative forms)
// are server-busy / rate-limit codes.
func isRateLimitCode(code int) bool {
	switch code {
	case 429, -32007, 32002, 32005, -32002, -32005:
		return true
	default:
		return false
	}
}

// hasRateLimitMarker does a best-effort case-insensitive substring match on
// the two signals every rate limiter leaks: a bounded 429 or a known phrase.
func hasRateLimitMarker(msg string) bool {
	m := strings.ToLower(msg)
	for _, needle := range []string{"toomanyrequests", "rate limit", "rate-limited", "429", "slothashroot"} {
		if strings.Contains(m, needle) {
			return true
		}
	}
	return false
}

// backoffDelay grows exponentially per retry with up to ~50% jitter, capped.
func backoffDelay(retry int) time.Duration {
	d := backoffInitial * time.Duration(1<<uint(retry))
	if d > backoffCap {
		d = backoffCap
	}
	if d > 0 {
		d += time.Duration(rand.Int63n(int64(d)/2 + 1))
	}
	return d
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Transfer submits a real system.Transfer from a wallet and returns the
// on-chain signature (confirmed processed/confirmed/finalized). A unique memo
// instruction is added so two otherwise-identical transfers produce distinct
// transaction bytes and therefore distinct signatures (the DB enforces a
// unique constraint on transaction_signature).
func (s *SolanaSeedClient) Transfer(ctx context.Context, from *solana.Wallet, to solana.PublicKey, lamports uint64, memoText string) (string, error) {
	transferIx := system.NewTransferInstruction(lamports, from.PublicKey(), to).Build()
	var ixs []solana.Instruction
	if memoText != "" {
		ixs = append(ixs, memo.NewMemoInstruction([]byte(memoText), from.PublicKey()).Build())
	}
	ixs = append(ixs, transferIx)
	return s.sendAndConfirm(ctx, from, ixs)
}

// Sign submits a real memo-only transaction signed by `signer` (no transfer)
// and returns the confirmed on-chain signature. Buy/Sell vault-internal swaps
// use this so every trade carries a genuine, verified signature without moving
// tracked balances.
func (s *SolanaSeedClient) Sign(ctx context.Context, signer *solana.Wallet, memoText string) (string, error) {
	if memoText == "" {
		memoText = "seed"
	}
	ixs := []solana.Instruction{
		memo.NewMemoInstruction([]byte(memoText), signer.PublicKey()).Build(),
	}
	return s.sendAndConfirm(ctx, signer, ixs)
}

// sendAndConfirm builds a transaction from `ixs` signed by `payer`, sends it to
// the local validator and confirms it, retrying on stale blockhashes. This is
// the shared core behind Transfer and Sign.
func (s *SolanaSeedClient) sendAndConfirm(ctx context.Context, payer *solana.Wallet, ixs []solana.Instruction) (string, error) {
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		if attempt > 0 {
			time.Sleep(300 * time.Millisecond)
		}
		recent, err := s.client.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
		if err != nil {
			lastErr = fmt.Errorf("blockhash: %w", err)
			continue
		}

		tx, err := solana.NewTransaction(
			ixs,
			recent.Value.Blockhash,
			solana.TransactionPayer(payer.PublicKey()),
		)
		if err != nil {
			lastErr = err
			continue
		}

		priv := payer.PrivateKey
		if _, err := tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
			if key.Equals(payer.PublicKey()) {
				return &priv
			}
			return nil
		}); err != nil {
			lastErr = err
			continue
		}

		sig, err := s.client.SendTransactionWithOpts(ctx, tx, rpc.TransactionOpts{
			SkipPreflight:       true,
			PreflightCommitment: rpc.CommitmentConfirmed,
		})
		if err != nil {
			lastErr = err
			if rpcErr, ok := err.(*jsonrpc.RPCError); ok && isBlockhashNotFound(rpcErr) {
				continue
			}
			return "", err
		}
		if err := s.confirm(ctx, sig); err != nil {
			return sig.String(), err
		}
		return sig.String(), nil
	}
	return "", lastErr
}

func isBlockhashNotFound(rpcErr *jsonrpc.RPCError) bool {
	if rpcErr == nil || rpcErr.Data == nil {
		return false
	}
	data, ok := rpcErr.Data.(map[string]interface{})
	if !ok {
		return false
	}
	if e, ok := data["err"]; ok {
		if s, ok := e.(string); ok && s == "BlockhashNotFound" {
			return true
		}
	}
	return false
}

func (s *SolanaSeedClient) confirm(ctx context.Context, sig solana.Signature) error {
	deadline := time.Now().Add(60 * time.Second)
	for {
		res, err := s.client.GetSignatureStatuses(ctx, true, sig)
		if err == nil && len(res.Value) > 0 && res.Value[0] != nil {
			st := res.Value[0]
			if st.Err != nil {
				return fmt.Errorf("transaction failed: %v", st.Err)
			}
			switch st.ConfirmationStatus {
			case rpc.ConfirmationStatusProcessed, rpc.ConfirmationStatusConfirmed, rpc.ConfirmationStatusFinalized:
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout confirming transaction %s", sig.String())
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// accountLedger tracks lamport balances so we never overdraw an account and
// airdrop top-ups only when needed.
type accountLedger struct {
	mu   sync.Mutex
	bal  map[string]uint64
	keys map[string]*solana.Wallet
}

func newAccountLedger() *accountLedger {
	return &accountLedger{
		bal:  map[string]uint64{},
		keys: map[string]*solana.Wallet{},
	}
}

func (l *accountLedger) register(w *solana.Wallet, lamports uint64) {
	pk := w.PublicKey().String()
	l.keys[pk] = w
	l.bal[pk] += lamports
}

// ensureSender guarantees the account can pay `need` lamports, airdropping the
// shortfall (plus a small buffer) on chain. The mutex is held during the rare
// top-up so concurrent senders can never double-spend.
func (l *accountLedger) ensureSender(ctx context.Context, client *SolanaSeedClient, from *solana.Wallet, need uint64) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	pk := from.PublicKey().String()
	if l.bal[pk] >= need {
		l.bal[pk] -= need
		return nil
	}

	missing := need - l.bal[pk]
	topUp := missing + 10*lamportsPerSOL
	if err := client.Airdrop(ctx, from.PublicKey(), float64(topUp)/float64(lamportsPerSOL)); err != nil {
		return err
	}
	l.bal[pk] += topUp
	l.bal[pk] -= need
	return nil
}

func (l *accountLedger) credit(to solana.PublicKey, lamports uint64) {
	l.mu.Lock()
	l.bal[to.String()] += lamports
	l.mu.Unlock()
}
