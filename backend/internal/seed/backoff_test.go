package seed

import (
	"context"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/jsonrpc"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

// withShortBackoff shrinks the retry schedule so backoff tests run in ms.
func withShortBackoff(t *testing.T) {
	t.Helper()
	oldMax, oldInit, oldCap := backoffMaxAttempts, backoffInitial, backoffCap
	backoffMaxAttempts, backoffInitial, backoffCap = 6, time.Millisecond, 8*time.Millisecond
	t.Cleanup(func() {
		backoffMaxAttempts, backoffInitial, backoffCap = oldMax, oldInit, oldCap
	})
}

// stubAirRPC is an in-memory airdropRPC that fails the first N requests with
// err, then succeeds, so no live validator is needed.
type stubAirRPC struct {
	failures int
	attempts int
	err      error
}

func (s *stubAirRPC) requestAirdrop(_ context.Context, to solana.PublicKey, lamports uint64, commitment rpc.CommitmentType) (solana.Signature, error) {
	s.attempts++
	if s.attempts <= s.failures {
		return solana.Signature{}, s.err
	}
	return solana.Signature{}, nil
}

func (s *stubAirRPC) confirm(context.Context, solana.Signature) error {
	return nil
}

func TestAirdropBackoffRetriesOnRateLimit(t *testing.T) {
	withShortBackoff(t)
	stub := &stubAirRPC{failures: 2, err: &jsonrpc.RPCError{Code: 429, Message: "TooManyRequests"}}
	err := airdropWithRetry(context.Background(), stub, solana.NewWallet().PublicKey(), 1000)
	assert.NoError(t, err)
	assert.Equal(t, 3, stub.attempts)
}

func TestAirdropBackoffRetriesOnRateLimitMessage(t *testing.T) {
	withShortBackoff(t)
	stub := &stubAirRPC{failures: 1, err: &jsonrpc.RPCError{Code: -32600, Message: "slotHashesRoot busy: RPC rate limit exceeded"}}
	err := airdropWithRetry(context.Background(), stub, solana.NewWallet().PublicKey(), 1000)
	assert.NoError(t, err)
	assert.Equal(t, 2, stub.attempts)
}

func TestAirdropFailImmediatelyOnHardError(t *testing.T) {
	withShortBackoff(t)
	stub := &stubAirRPC{failures: 1, err: &jsonrpc.RPCError{Code: -32016, Message: "BlockhashNotFound"}}
	err := airdropWithRetry(context.Background(), stub, solana.NewWallet().PublicKey(), 1000)
	assert.Error(t, err)
	assert.Equal(t, 1, stub.attempts)
}

func TestAirdropGivesUpAfterMaxAttempts(t *testing.T) {
	withShortBackoff(t)
	stub := &stubAirRPC{failures: 1000, err: &jsonrpc.RPCError{Code: 429, Message: "TooManyRequests"}}
	err := airdropWithRetry(context.Background(), stub, solana.NewWallet().PublicKey(), 1000)
	assert.Error(t, err)
	assert.Equal(t, backoffMaxAttempts, stub.attempts)
}

func TestAirdropHonorsContextCancellation(t *testing.T) {
	backoffMaxAttempts, backoffInitial, backoffCap = 6, 10*time.Second, 30*time.Second

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	stub := &stubAirRPC{failures: 1, err: &jsonrpc.RPCError{Code: 429, Message: "TooManyRequests"}}
	start := time.Now()
	err := airdropWithRetry(ctx, stub, solana.NewWallet().PublicKey(), 1000)
	assert.Error(t, err)
	assert.Less(t, time.Since(start), 2*time.Second)
	assert.Equal(t, 1, stub.attempts)
}

// stubFunder is an in-memory airdropper recording balances and airdrops.
type stubFunder struct {
	mu       sync.Mutex
	bal      map[string]uint64
	airSols  map[string]float64
	airCalls map[string]int
}

func (s *stubFunder) GetBalance(_ context.Context, to solana.PublicKey) (uint64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.bal[to.String()], nil
}

func (s *stubFunder) Airdrop(_ context.Context, to solana.PublicKey, sol float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.airSols[to.String()] = sol
	s.airCalls[to.String()]++
	return nil
}

func TestFundAccountsAirdropsOnlyShortfall(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)

	target := 100 * lamportsPerSOL
	stub := &stubFunder{
		bal:      map[string]uint64{},
		airSols:  map[string]float64{},
		airCalls: map[string]int{},
	}

	wFull := solana.NewWallet()  // already funded: skipped entirely
	wShort := solana.NewWallet() // short by 50 SOL: airdrop exactly 50
	wTiny := solana.NewWallet()  // short by 0.001 SOL: below threshold, skipped
	wEmpty := solana.NewWallet() // zero balance: airdrop full target

	stub.bal[wFull.PublicKey().String()] = target
	stub.bal[wShort.PublicKey().String()] = target - 50*lamportsPerSOL
	stub.bal[wTiny.PublicKey().String()] = target - 1_000_000

	err := fundAccounts(context.Background(), stub, []*solana.Wallet{wFull, wShort, wTiny, wEmpty}, 100, logger, "test")
	assert.NoError(t, err)
	assert.Equal(t, 0, stub.airCalls[wFull.PublicKey().String()])
	assert.Equal(t, 0, stub.airCalls[wTiny.PublicKey().String()])
	assert.Equal(t, 1, stub.airCalls[wShort.PublicKey().String()])
	assert.Equal(t, 50.0, stub.airSols[wShort.PublicKey().String()])
	assert.Equal(t, 100.0, stub.airSols[wEmpty.PublicKey().String()])
}