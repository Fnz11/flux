package seed

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
)

type tokenSpec struct {
	Symbol    string
	BasePrice float64
}

var tokenSpecs = []tokenSpec{
	{"SOL", 150}, {"USDC", 1}, {"BONK", 0.00005}, {"JUP", 1.2},
	{"PYTH", 0.6}, {"RAY", 2.5}, {"WBTC", 60000}, {"WETH", 3000},
	{"tBTC", 60000},
}

var nameAdjectives = []string{"Alpha", "Blue", "Crimson", "Quantum", "Zenith", "Nova", "Hyperion", "Everest", "Prism", "Aurora", "Titan", "Vertex", "Cosmos", "Lumen", "Omega"}
var nameNouns = []string{"Yield", "Momentum", "Capital", "Vault", "Reserve", "Horizon", "Treasure", "Lattice", "Aperture", "Meridian", "Halcyon", "Sentinel", "Arbiter", "Catalyst", "Zephyr"}

type vaultSpec struct {
	Vault     *models.Vault
	Trades    []*models.TradeHistory
	Portfolio []*models.Portfolio
	Metrics   []*models.VaultMetric
	PriceHist []*models.PriceHistory
	Token     string
	Current   float64
}

func pickStatus(rng *rand.Rand) string {
	// Active 45%, Fundraising 35%, Dormant 20% → lots of variety.
	r := rng.Float64()
	switch {
	case r < 0.45:
		return "Active"
	case r < 0.80:
		return "Fundraising"
	default:
		return "Dormant"
	}
}

func generateVaults(rng *rand.Rand, opts Options, users []*models.User, now time.Time) []*vaultSpec {
	specs := make([]*vaultSpec, 0, len(users)*opts.VaultsPerUser)
	for ui, owner := range users {
		for v := 0; v < opts.VaultsPerUser; v++ {
			spec := buildVault(rng, opts, owner, users, now, ui)
			specs = append(specs, spec)
		}
	}
	return specs
}

func buildVault(rng *rand.Rand, opts Options, owner *models.User, users []*models.User, now time.Time, ui int) *vaultSpec {
	tok := tokenSpecs[rng.Intn(len(tokenSpecs))]
	status := pickStatus(rng)

	days := opts.Days
	if days < 1 {
		days = 1
	}
	metricDays := opts.MetricDays
	if metricDays > days {
		metricDays = days
	}

	// Price path: forward random walk ending at the "current" price.
	base := tok.BasePrice * (0.6 + rng.Float64()*1.2)
	vol := 0.02 + rng.Float64()*0.05
	drift := -0.004 + rng.Float64()*0.012
	price := make([]float64, days)
	p := base
	for i := days - 1; i >= 0; i-- {
		if i < days-1 {
			p *= math.Exp(drift + (rng.NormFloat64() * vol))
		}
		if p < tok.BasePrice*0.02 {
			p = tok.BasePrice * 0.02
		}
		price[i] = p
	}
	current := price[0]

	// Vault metadata.
	displayName := fmt.Sprintf("%s %s", nameAdjectives[rng.Intn(len(nameAdjectives))], nameNouns[rng.Intn(len(nameNouns))])
	focus := []string{tok.Symbol}
	if rng.Float64() < 0.4 {
		other := tokenSpecs[rng.Intn(len(tokenSpecs))]
		if other.Symbol != tok.Symbol {
			focus = append(focus, other.Symbol)
		}
	}
	metadata, _ := json.Marshal(map[string]interface{}{
		"displayName": displayName,
		"description": fmt.Sprintf("%s-focused managed vault with disciplined risk controls.", tok.Symbol),
		"focusAssets": focus,
	})

	vaultID := uuid.New()
	createdAt := now.Add(-time.Duration(rng.Intn(10)+days-metricDays) * 24 * time.Hour)

	// Fees: realistic bps ranges.
	perfBps := 500 + rng.Intn(1501)
	mgmtBps := 100 + rng.Intn(300)
	minRaise := decimal.NewFromFloat(float64(25000 + rng.Intn(750000)))
	if status == "Fundraising" {
		minRaise = decimal.NewFromFloat(float64(100000 + rng.Intn(900000)))
	}
	vaultType := []string{"open", "closed", "tokenized"}[rng.Intn(3)]
	lockup := int64(0)
	if rng.Float64() < 0.5 {
		lockup = int64(30 + rng.Intn(181))
	}

	v := &models.Vault{
		ID:                vaultID,
		ManagerID:         owner.ID,
		Status:            status,
		Metadata:          datatypes.JSON(metadata),
		PerformanceFeeBps: perfBps,
		ManagementFeeBps:  mgmtBps,
		MinRaiseAmount:    minRaise,
		LockupPeriod:      lockup,
		VaultType:         vaultType,
		TVL:               decimal.Zero,
		CreatedAt:         createdAt,
		UpdatedAt:         createdAt,
	}

	// Choose investors. Always include the manager.
	investors := []int{ui}
	nInv := 2 + rng.Intn(7) // 2..8 total
	for len(investors) < nInv {
		cand := rng.Intn(len(users))
		dup := false
		for _, x := range investors {
			if x == cand {
				dup = true
				break
			}
		}
		if !dup {
			investors = append(investors, cand)
		}
	}

	// Per-investor running position keyed by user index.
	shares := map[int]float64{}
	invested := map[int]float64{}

	type ev struct {
		day    int
		idx    int
		amount float64
		sold   float64 // withdraw: shares sold
	}
	var deposits []ev
	var withdraws []ev

	scale := 1.0
	switch status {
	case "Fundraising":
		scale = 0.3
	case "Dormant":
		scale = 0.5
	}
	for _, idx := range investors {
		target := (500 + rng.Float64()*20000) * scale
		if status == "Fundraising" {
			target = (200 + rng.Float64()*3000) * scale
		}
		nDep := 1 + rng.Intn(3)
		per := target / float64(nDep)
		for d := 0; d < nDep; d++ {
			day := rng.Intn(days)
			if status == "Fundraising" {
				day = rng.Intn(maxI(14, days/4)) // recent
			} else if status == "Dormant" {
				day = days/3 + rng.Intn(maxI(1, days-days/3)) // older
			}
			deposits = append(deposits, ev{day: day, idx: idx, amount: per})
		}
	}

	if status == "Active" && len(investors) > 0 {
		nWith := rng.Intn(2)
		for w := 0; w < nWith; w++ {
			idx := investors[rng.Intn(len(investors))]
			full := shares[idx]
			if full < 10 {
				continue
			}
			sold := full * (0.1 + rng.Float64()*0.4)
			day := rng.Intn(maxI(1, days/2))
			withdraws = append(withdraws, ev{day: day, idx: idx, sold: sold})
		}
	}

	// Combine events, sort oldest-first (largest day index first).
	all := make([]ev, 0, len(deposits)+len(withdraws))
	all = append(all, deposits...)
	all = append(all, withdraws...)
	for i := 0; i < len(all); i++ {
		for j := i + 1; j < len(all); j++ {
			if all[j].day > all[i].day {
				all[i], all[j] = all[j], all[i]
			}
		}
	}

	// Apply events oldest→newest, producing trades and running positions.
	var trades []*models.TradeHistory
	for _, e := range all {
		execAt := now.Add(-time.Duration(e.day)*24*time.Hour - time.Duration(rng.Intn(86400))*time.Second)
		pr := price[e.day]
		if e.sold > 0 {
			if shares[e.idx] < e.sold {
				e.sold = shares[e.idx]
			}
			proceeds := e.sold * pr
			if shares[e.idx] > 0 {
				invested[e.idx] *= (shares[e.idx] - e.sold) / shares[e.idx]
			}
			shares[e.idx] -= e.sold
			trades = append(trades, &models.TradeHistory{
				ID: uuid.New(), VaultID: vaultID, ActorID: users[e.idx].ID,
				TradeType: "Withdraw", InputToken: tok.Symbol, OutputToken: "SOL",
				AmountIn:           decimal.NewFromFloat(round6(e.sold)),
				AmountOut:          decimal.NewFromFloat(round6(proceeds)),
				PriceAtExecution:   decimal.NewFromFloat(round6(pr)),
				ExecutedAt:         execAt,
			})
		} else {
			s := e.amount / pr
			shares[e.idx] += s
			invested[e.idx] += e.amount
			trades = append(trades, &models.TradeHistory{
				ID: uuid.New(), VaultID: vaultID, ActorID: users[e.idx].ID,
				TradeType: "Deposit", InputToken: "SOL", OutputToken: tok.Symbol,
				AmountIn:           decimal.NewFromFloat(round6(s)),
				AmountOut:          decimal.NewFromFloat(round6(e.amount)),
				PriceAtExecution:   decimal.NewFromFloat(round6(pr)),
				ExecutedAt:         execAt,
			})
		}
	}

	// Buy/Sell trades for Active vaults (manager acts, adds volume).
	nTrade := rng.Intn(3)
	if status == "Active" {
		nTrade += 2
	}
	for t := 0; t < nTrade; t++ {
		day := rng.Intn(days)
		execAt := now.Add(-time.Duration(day)*24*time.Hour - time.Duration(rng.Intn(86400))*time.Second)
		pr := price[day]
		amtIn := (50 + rng.Float64()*800)
		if t%2 == 0 {
			trades = append(trades, &models.TradeHistory{
				ID: uuid.New(), VaultID: vaultID, ActorID: owner.ID,
				TradeType: "Buy", InputToken: "SOL", OutputToken: tok.Symbol,
				AmountIn:           decimal.NewFromFloat(round6(amtIn)),
				AmountOut:          decimal.NewFromFloat(round6(amtIn * pr)),
				PriceAtExecution:   decimal.NewFromFloat(round6(pr)),
				ExecutedAt:         execAt,
			})
		} else {
			trades = append(trades, &models.TradeHistory{
				ID: uuid.New(), VaultID: vaultID, ActorID: owner.ID,
				TradeType: "Sell", InputToken: tok.Symbol, OutputToken: "SOL",
				AmountIn:           decimal.NewFromFloat(round6(amtIn / pr)),
				AmountOut:          decimal.NewFromFloat(round6(amtIn)),
				PriceAtExecution:   decimal.NewFromFloat(round6(pr)),
				ExecutedAt:         execAt,
			})
		}
	}

	// Final portfolios.
	var portfolios []*models.Portfolio
	totalShares := 0.0
	for _, idx := range investors {
		sh := shares[idx]
		inv := invested[idx]
		if sh <= 0 {
			continue
		}
		avg := inv / sh
		totalShares += sh
		portfolios = append(portfolios, &models.Portfolio{
			ID:                 uuid.New(), UserID: users[idx].ID, VaultID: vaultID,
			SharesOwned:        decimal.NewFromFloat(round6(sh)),
			TotalInvestedValue: decimal.NewFromFloat(round6(inv)),
			AverageEntryPrice:  decimal.NewFromFloat(round6(avg)),
			CreatedAt:          now, UpdatedAt: now,
		})
	}

	// TVL = total shares × current price → drives realistic PnL.
	v.TVL = decimal.NewFromFloat(round6(totalShares * current))

	// Running position state across the whole window (for metrics), oldest→newest.
	run := map[int]float64{}
	runInv := map[int]float64{}
	for i := days - 1; i >= 0; i-- {
		for _, e := range all {
			if e.day != i {
				continue
			}
			if e.sold > 0 {
				if run[e.idx] >= e.sold && run[e.idx] > 0 {
					runInv[e.idx] *= (run[e.idx] - e.sold) / run[e.idx]
					run[e.idx] -= e.sold
				}
			} else {
				s := e.amount / price[i]
				run[e.idx] += s
				runInv[e.idx] += e.amount
			}
		}
	}

	totalSh := 0.0
	totalInv := 0.0
	for idx := range run {
		totalSh += run[idx]
		totalInv += runInv[idx]
	}

	mgmtDaily := float64(v.ManagementFeeBps) / 10000 / 365
	var metrics []*models.VaultMetric
	var priceHist []*models.PriceHistory
	for i := days - 1; i >= days-metricDays; i-- {
		tv := totalSh * price[i]
		ts := now.Add(-time.Duration(i) * 24 * time.Hour).Truncate(24 * time.Hour).Add(12 * time.Hour)
		vol := volumeOnDay(trades, now, i)
		metrics = append(metrics,
			metricRow(vaultID, "tvl", tv, ts),
			metricRow(vaultID, "invested", totalInv, ts),
			metricRow(vaultID, "pnl", tv-totalInv, ts),
			metricRow(vaultID, "fees", tv*mgmtDaily, ts),
			metricRow(vaultID, "volume", vol, ts),
		)
		priceHist = append(priceHist, &models.PriceHistory{
			ID: uuid.New(), VaultID: vaultID, Token: tok.Symbol,
			Price: decimal.NewFromFloat(round6(price[i])),
			Volume: decimal.NewFromFloat(round6(vol)),
			FetchedAt: ts,
		})
		if len(focus) > 1 {
			other := price[i] * (0.9 + rng.Float64()*0.2)
			priceHist = append(priceHist, &models.PriceHistory{
				ID: uuid.New(), VaultID: vaultID, Token: focus[1],
				Price: decimal.NewFromFloat(round6(other)),
				Volume: decimal.NewFromFloat(round6(vol)),
				FetchedAt: ts,
			})
		}
	}

	return &vaultSpec{
		Vault:     v,
		Trades:    trades,
		Portfolio: portfolios,
		Metrics:   metrics,
		PriceHist: priceHist,
		Token:     tok.Symbol,
		Current:   current,
	}
}

func volumeOnDay(trades []*models.TradeHistory, now time.Time, day int) float64 {
	start := now.Add(-time.Duration(day)*24*time.Hour).Truncate(24 * time.Hour)
	end := start.Add(24 * time.Hour)
	vv := 0.0
	for _, tr := range trades {
		if !tr.ExecutedAt.Before(start) && tr.ExecutedAt.Before(end) {
			amt, _ := tr.AmountIn.Float64()
			vv += amt
		}
	}
	return vv
}

func metricRow(vaultID uuid.UUID, metric string, val float64, ts time.Time) *models.VaultMetric {
	return &models.VaultMetric{
		ID: uuid.New(), VaultID: vaultID, Metric: metric,
		Value: decimal.NewFromFloat(round6(val)), Timestamp: ts,
	}
}

func round6(f float64) float64 {
	return math.Round(f*1e6) / 1e6
}

func maxI(a, b int) int {
	if a > b {
		return a
	}
	return b
}
