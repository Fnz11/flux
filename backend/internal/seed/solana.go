package seed

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

const lamportsPerSOL = uint64(1_000_000_000)

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

// Airdrop funds an account in 100 SOL chunks (test validator caps airdrops).
func (s *SolanaSeedClient) Airdrop(ctx context.Context, to solana.PublicKey, sol float64) error {
	lamports := uint64(sol * float64(lamportsPerSOL))
	const chunk = uint64(100) * lamportsPerSOL
	for lamports > 0 {
		amt := chunk
		if amt > lamports {
			amt = lamports
		}
		sig, err := s.client.RequestAirdrop(ctx, to, amt, rpc.CommitmentConfirmed)
		if err != nil {
			return fmt.Errorf("airdrop: %w", err)
		}
		if err := s.confirm(ctx, sig); err != nil {
			return err
		}
		lamports -= amt
	}
	return nil
}

// Transfer submits a real system.Transfer from a wallet and returns the
// on-chain signature (confirmed processed/confirmed/finalized).
func (s *SolanaSeedClient) Transfer(ctx context.Context, from *solana.Wallet, to solana.PublicKey, lamports uint64) (string, error) {
	recent, err := s.client.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
	if err != nil {
		return "", fmt.Errorf("blockhash: %w", err)
	}

	ix := system.NewTransferInstruction(lamports, from.PublicKey(), to).Build()
	tx, err := solana.NewTransaction(
		[]solana.Instruction{ix},
		recent.Value.Blockhash,
		solana.TransactionPayer(from.PublicKey()),
	)
	if err != nil {
		return "", err
	}

	priv := from.PrivateKey
	if _, err := tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(from.PublicKey()) {
			return &priv
		}
		return nil
	}); err != nil {
		return "", err
	}

	sig, err := s.client.SendTransaction(ctx, tx)
	if err != nil {
		return "", err
	}
	if err := s.confirm(ctx, sig); err != nil {
		return sig.String(), err
	}
	return sig.String(), nil
}

func (s *SolanaSeedClient) confirm(ctx context.Context, sig solana.Signature) error {
	deadline := time.Now().Add(20 * time.Second)
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
