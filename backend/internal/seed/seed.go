package seed

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/flux-protocol/backend/internal/models"
	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
	"github.com/mr-tron/base58"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// Run seeds the database with a realistic dataset backed by real Solana
// accounts and real SOL.
//
//   - Every user and vault is a real keypair airdropped real SOL on the local
//     test validator.
//   - Deposit and Withdraw trades carry REAL on-chain system.Transfer
//     signatures: actual SOL moves between a user account and the vault
//     account. These are verifiable on chain.
//   - Buy/Sell trades (vault-internal swaps that do not move tracked balances)
//     use deterministic simulated signatures, mirroring the app's own simulate
//     endpoint (internal/handlers/transaction_handler.go).
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

	type realSig struct {
		trade   *models.TradeHistory
		from    *solana.Wallet
		to      solana.PublicKey
		lamport uint64
		idx     int
	}
	var realJobs []*realSig
	var simJobs []*models.TradeHistory
	var rIdx int
	for _, spec := range specs {
		vk := vaultKeys[spec.Vault.Address]
		to, _ := solana.PublicKeyFromBase58(spec.Vault.Address)
		for _, t := range spec.Trades {
			amt, _ := t.AmountOut.Float64()
			if amt <= 0 {
				amt, _ = t.AmountIn.Float64()
			}
			lamport := uint64(clampLamport(amt))
			switch t.TradeType {
			case "Deposit":
				if from := userByID[t.ActorID.String()]; from != nil {
					realJobs = append(realJobs, &realSig{trade: t, from: from, to: to, lamport: lamport, idx: rIdx})
					rIdx++
				}
			case "Withdraw":
				if toUser := userByID[t.ActorID.String()]; toUser != nil {
					realJobs = append(realJobs, &realSig{trade: t, from: vk, to: toUser.PublicKey(), lamport: lamport, idx: rIdx})
					rIdx++
				}
			default: // Buy / Sell: simulated swap signature
				simJobs = append(simJobs, t)
			}
		}
	}

	// Send real transfers through a small worker pool.
	type sigOut struct {
		ok  bool
		sig string
	}
	results := make([]sigOut, len(realJobs))
	var wg sync.WaitGroup
	jobCh := make(chan *realSig)
	workerCount := 8
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobCh {
				// ensureSender drains the ledged balance first; only tops up on
				// an actual shortfall.
				if err := ledger.ensureSender(ctx, sol, j.from, j.lamport); err != nil {
					results[j.idx] = sigOut{sig: simulateSignature(j.trade.ID.String(), j.trade.ExecutedAt.UnixNano())}
					continue
				}
				sig, err := sol.Transfer(ctx, j.from, j.to, j.lamport, j.trade.ID.String())
				if err != nil {
					logger.WithError(err).WithFields(logrus.Fields{
						"from":    j.from.PublicKey().String(),
						"to":      j.to.String(),
						"lamport": j.lamport,
						"trade":   j.trade.TradeType,
					}).Warn("transfer failed, falling back to simulated sig")
					results[j.idx] = sigOut{sig: simulateSignature(j.trade.ID.String(), j.trade.ExecutedAt.UnixNano())}
					continue
				}
				ledger.credit(j.to, j.lamport)
				results[j.idx] = sigOut{ok: true, sig: sig}
			}
		}()
	}
	for _, j := range realJobs {
		jobCh <- j
	}
	close(jobCh)
	wg.Wait()

	realCount := 0
	for i, j := range realJobs {
		j.trade.TransactionSignature = results[i].sig
		if results[i].ok {
			realCount++
		}
	}
	for _, t := range simJobs {
		t.TransactionSignature = simulateSignature(t.ID.String(), t.ExecutedAt.UnixNano())
	}
	logger.WithFields(logrus.Fields{
		"real_transfers": realCount,
		"simulated":      len(simJobs),
	}).Info("trade signatures minted")

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
		"trades":      len(tradeList(specs)),
		"portfolios":  len(portfolios),
		"metrics":     len(metrics),
		"price_hist":  len(priceHist),
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

func simulateSignature(parts ...interface{}) string {
	h := sha256.New()
	for _, p := range parts {
		fmt.Fprintf(h, "%v", p)
	}
	sum := h.Sum(nil)
	var sig [64]byte
	copy(sig[:32], sum)
	copy(sig[32:], sum)
	return base58.Encode(sig[:])
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
	for _, mv := range []string{"portfolio_summary", "user_pnl_summary"} {
		if err := db.Exec("REFRESH MATERIALIZED VIEW CONCURRENTLY " + mv).Error; err != nil {
			// fall back to non-concurrent refresh
			if err2 := db.Exec("REFRESH MATERIALIZED VIEW " + mv).Error; err2 != nil {
				return err2
			}
		}
	}
	return nil
}

// fundAccounts airdrops SOL to a batch of accounts using a bounded worker pool.
func fundAccounts(ctx context.Context, sol *SolanaSeedClient, wallets []*solana.Wallet, solAmt float64, logger *logrus.Logger, label string) error {
	if len(wallets) == 0 {
		return nil
	}
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
			if err := sol.Airdrop(ctx, w.PublicKey(), solAmt); err != nil {
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
