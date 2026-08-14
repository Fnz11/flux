package seed

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/flux-protocol/backend/internal/models"
	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// Run seeds the database with a realistic dataset backed by real Solana
// accounts and real SOL.
//
//   - Every user and vault is a real keypair airdropped real SOL on the local
//     test validator.
//   - Every trade (Deposit, Withdraw, Buy, Sell) carries a REAL, verified
//     on-chain signature: Deposits/Withdraws move actual SOL via
//     system.Transfer, and Buy/Sell vault-internal swaps submit a real memo
//     transaction signed by the vault keypair. No simulated or mock signatures
//     are ever minted.
func Run(ctx context.Context, db *gorm.DB, opts Options, logger *logrus.Logger, sol *SolanaSeedClient) error {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	now := time.Now().UTC()

	if opts.Clean {
		if err := cleanTables(db); err != nil {
			return err
		}
	}

	// ---- 1. Real user accounts (keypairs) ----
	users := make([]*models.User, 0, opts.Users)
	userKeys := make([]*solana.Wallet, 0, opts.Users)
	for i := 0; i < opts.Users; i++ {
		w := sol.NewKeypair()
		users = append(users, &models.User{
			ID:            uuid.New(),
			WalletAddress: w.PublicKey().String(),
			Nonce:         uuid.NewString(),
			CreatedAt:     now,
			UpdatedAt:     now,
		})
		userKeys = append(userKeys, w)
	}
	if err := db.Create(&users).Error; err != nil {
		return fmt.Errorf("create users: %w", err)
	}
	logger.WithField("users", len(users)).Info("users persisted")

	// ---- 2. Pre-fund user accounts with real SOL ----
	if err := fundAccounts(ctx, sol, userKeys, opts.AirdropSOL, logger, "users"); err != nil {
		return err
	}

	// ---- 3. Generate vault dataset in memory ----
	specs := generateVaults(rng, opts, users, now)

	// ---- 4. Create real vault accounts, persist vaults ----
	vaultKeys := map[string]*solana.Wallet{}
	for _, spec := range specs {
		vk := sol.NewKeypair()
		spec.Vault.Address = vk.PublicKey().String()
		vaultKeys[spec.Vault.Address] = vk
		if err := db.Create(spec.Vault).Error; err != nil {
			return fmt.Errorf("create vault: %w", err)
		}
	}
	logger.WithField("vaults", len(specs)).Info("vaults created")

	var vaultKeyList []*solana.Wallet
	for _, vk := range vaultKeys {
		vaultKeyList = append(vaultKeyList, vk)
	}
	if err := fundAccounts(ctx, sol, vaultKeyList, opts.VaultSOL, logger, "vaults"); err != nil {
		return err
	}

	// ---- 5. Mint signatures ----
	// ledger tracks lamport balances so no account ever overdraws.
	ledger := newAccountLedger()
	userByID := map[string]*solana.Wallet{}
	for i, w := range userKeys {
		ledger.register(w, uint64(opts.AirdropSOL*float64(lamportsPerSOL)))
		userByID[users[i].ID.String()] = w
	}
	for _, vk := range vaultKeyList {
		ledger.register(vk, uint64(opts.VaultSOL*float64(lamportsPerSOL)))
	}

	// Every trade gets a real on-chain signature. Deposit/Withdraw jobs move
	// actual SOL via system.Transfer; Buy/Sell jobs submit a real memo
	// transaction signed by the vault keypair (vault-internal swaps that do not
	// move tracked balances). No fake signatures are ever produced.
	type sigJob struct {
		trade    *models.TradeHistory
		transfer bool // true: system.Transfer; false: memo-only Sign
		from     *solana.Wallet
		to       solana.PublicKey
		lamport  uint64
		idx      int
	}
	var jobs []*sigJob
	for _, spec := range specs {
		vk := vaultKeys[spec.Vault.Address]
		to, _ := solana.PublicKeyFromBase58(spec.Vault.Address)
		for _, t := range spec.Trades {
			amt, _ := t.AmountOut.Float64()
			if amt <= 0 {
				amt, _ = t.AmountIn.Float64()
			}
			lamport := uint64(clampLamport(amt))
			idx := len(jobs)
			switch t.TradeType {
			case "Deposit":
				if from := userByID[t.ActorID.String()]; from != nil {
					jobs = append(jobs, &sigJob{trade: t, transfer: true, from: from, to: to, lamport: lamport, idx: idx})
				}
			case "Withdraw":
				if toUser := userByID[t.ActorID.String()]; toUser != nil {
					jobs = append(jobs, &sigJob{trade: t, transfer: true, from: vk, to: toUser.PublicKey(), lamport: lamport, idx: idx})
				}
			default: // Buy / Sell: real memo signature signed by the vault keypair.
				jobs = append(jobs, &sigJob{trade: t, from: vk, idx: idx})
			}
		}
	}

	// Submit every job through a bounded worker pool. Each result is either a
	// real confirmed signature or a non-nil error; nothing is silently
	// substituted.
	type sigOut struct {
		sig string
		err error
	}
	results := make([]sigOut, len(jobs))
	var wg sync.WaitGroup
	jobCh := make(chan *sigJob)
	workerCount := 8
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobCh {
				if !j.transfer {
					sig, err := sol.Sign(ctx, j.from, j.trade.ID.String())
					if err != nil {
						results[j.idx] = sigOut{err: err}
						continue
					}
					results[j.idx] = sigOut{sig: sig}
					continue
				}
				// ensureSender drains the ledged balance first; only tops up on
				// an actual shortfall.
				if err := ledger.ensureSender(ctx, sol, j.from, j.lamport); err != nil {
					results[j.idx] = sigOut{err: err}
					continue
				}
				sig, err := sol.Transfer(ctx, j.from, j.to, j.lamport, j.trade.ID.String())
				if err != nil {
					results[j.idx] = sigOut{err: err}
					continue
				}
				ledger.credit(j.to, j.lamport)
				results[j.idx] = sigOut{sig: sig}
			}
		}()
	}
	for _, j := range jobs {
		jobCh <- j
	}
	close(jobCh)
	wg.Wait()

	var firstErr error
	sigCount := 0
	for i, j := range jobs {
		if results[i].err != nil {
			if firstErr == nil {
				firstErr = results[i].err
			}
			logger.WithError(results[i].err).WithFields(logrus.Fields{
				"trade": j.trade.ID,
				"type":  j.trade.TradeType,
				"vault": j.trade.VaultID,
			}).Error("trade signature mint failed")
			continue
		}
		j.trade.TransactionSignature = results[i].sig
		sigCount++
	}
	if firstErr != nil {
		return fmt.Errorf("seed aborted: %d of %d trade signatures failed to mint on chain (first error: %w)", len(jobs)-sigCount, len(jobs), firstErr)
	}
	logger.WithField("signatures", sigCount).Info("real trade signatures minted and verified")

	// ---- 6. Persist trades, portfolios, metrics, price history ----
	if err := db.CreateInBatches(tradeList(specs), 500).Error; err != nil {
		return fmt.Errorf("create trades: %w", err)
	}
	var portfolios []*models.Portfolio
	var metrics []*models.VaultMetric
	var priceHist []*models.PriceHistory
	for _, spec := range specs {
		portfolios = append(portfolios, spec.Portfolio...)
		metrics = append(metrics, spec.Metrics...)
		priceHist = append(priceHist, spec.PriceHist...)
	}
	if err := db.CreateInBatches(portfolios, 500).Error; err != nil {
		return fmt.Errorf("create portfolios: %w", err)
	}
	if err := db.CreateInBatches(metrics, 500).Error; err != nil {
		return fmt.Errorf("create metrics: %w", err)
	}
	if err := db.CreateInBatches(priceHist, 500).Error; err != nil {
		return fmt.Errorf("create price history: %w", err)
	}
	logger.WithFields(logrus.Fields{
		"trades":     len(tradeList(specs)),
		"portfolios": len(portfolios),
		"metrics":    len(metrics),
		"price_hist": len(priceHist),
	}).Info("dataset persisted")

	// ---- 7. Refresh matviews so the API reads correct aggregates ----
	if err := refreshMatviews(db); err != nil {
		logger.WithError(err).Warn("matview refresh failed")
	} else {
		logger.Info("materialized views refreshed")
	}

	return nil
}

func tradeList(specs []*vaultSpec) []*models.TradeHistory {
	out := make([]*models.TradeHistory, 0)
	for _, spec := range specs {
		out = append(out, spec.Trades...)
	}
	return out
}

// clampLamport keeps on-chain SOL transfers small but real (1 lamport .. 1 SOL).
func clampLamport(f float64) float64 {
	if f < 1 {
		return 1
	}
	if f > float64(lamportsPerSOL) {
		return float64(lamportsPerSOL)
	}
	return f
}

func cleanTables(db *gorm.DB) error {
	tables := []string{"trade_histories", "portfolios", "price_histories", "vault_metrics", "vaults", "users"}
	for _, t := range tables {
		if err := db.Exec("TRUNCATE TABLE " + t + " CASCADE").Error; err != nil {
			return fmt.Errorf("truncate %s: %w", t, err)
		}
	}
	return nil
}

func refreshMatviews(db *gorm.DB) error {
	for _, mv := range []string{"portfolio_summary", "user_pnl_summary", "vault_daily_sparkline_mv", "vault_balances_summary"} {
		if err := db.Exec("REFRESH MATERIALIZED VIEW CONCURRENTLY " + mv).Error; err != nil {
			// fall back to non-concurrent refresh
			if err2 := db.Exec("REFRESH MATERIALIZED VIEW " + mv).Error; err2 != nil {
				return err2
			}
		}
	}
	return nil
}

// airdropper is the SolanaSeedClient surface fundAccounts needs, so tests can
// stub balances without a live validator.
type airdropper interface {
	GetBalance(ctx context.Context, to solana.PublicKey) (uint64, error)
	Airdrop(ctx context.Context, to solana.PublicKey, sol float64) error
}

// fundAccounts airdrops SOL to a batch of accounts using a bounded worker
// pool. Each account is checked on chain first and only the shortfall to
// `solAmt` is airdropped; accounts already funded are skipped entirely.
func fundAccounts(ctx context.Context, sol airdropper, wallets []*solana.Wallet, solAmt float64, logger *logrus.Logger, label string) error {
	if len(wallets) == 0 {
		return nil
	}
	target := uint64(solAmt * float64(lamportsPerSOL))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6)
	var mu sync.Mutex
	var firstErr error
	for _, w := range wallets {
		wg.Add(1)
		sem <- struct{}{}
		go func(w *solana.Wallet) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := topUpAirdrop(ctx, sol, w.PublicKey(), target); err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
			}
		}(w)
	}
	wg.Wait()
	if firstErr != nil {
		logger.WithError(firstErr).Warnf("partial airdrop failure for %s (continuing)", label)
	}
	logger.WithFields(logrus.Fields{"accounts": len(wallets), "sol": solAmt, "label": label}).Info("accounts funded")
	return nil
}

// topUpAirdrop queries the real on-chain balance and airdrops only the
// shortfall above target, skipping accounts already at/above it. Sub-threshold
// shortfalls are ignored to avoid a flood of near-zero airdrops.
func topUpAirdrop(ctx context.Context, sol airdropper, to solana.PublicKey, target uint64) error {
	bal, err := sol.GetBalance(ctx, to)
	if err != nil {
		return fmt.Errorf("balance %s: %w", to.String(), err)
	}
	if bal >= target {
		return nil
	}
	shortfall := target - bal
	if shortfall < minAirdropLamports {
		return nil
	}
	return sol.Airdrop(ctx, to, float64(shortfall)/float64(lamportsPerSOL))
}
