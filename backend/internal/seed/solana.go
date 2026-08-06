package seed

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/memo"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/jsonrpc"
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
// on-chain signature (confirmed processed/confirmed/finalized). A unique memo
// instruction is added so two otherwise-identical transfers produce distinct
// transaction bytes and therefore distinct signatures (the DB enforces a
// unique constraint on transaction_signature).
func (s *SolanaSeedClient) Transfer(ctx context.Context, from *solana.Wallet, to solana.PublicKey, lamports uint64, memoText string) (string, error) {
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

		transferIx := system.NewTransferInstruction(lamports, from.PublicKey(), to).Build()
		var ixs []solana.Instruction
		if memoText != "" {
			ixs = append(ixs, memo.NewMemoInstruction([]byte(memoText), from.PublicKey()).Build())
		}
		ixs = append(ixs, transferIx)
		tx, err := solana.NewTransaction(
			ixs,
			recent.Value.Blockhash,
			solana.TransactionPayer(from.PublicKey()),
		)
		if err != nil {
			lastErr = err
			continue
		}

		priv := from.PrivateKey
		if _, err := tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
			if key.Equals(from.PublicKey()) {
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
