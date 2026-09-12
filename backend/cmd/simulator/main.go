package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/flux-protocol/backend/internal/config"
	"github.com/flux-protocol/backend/internal/database"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	gorillawebsocket "github.com/gorilla/websocket"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type SimulatorOptions struct {
	IntervalMs int
	Burst      bool
	Mode       string
	WSURL      string
	Wallet     string
	VaultID    string
}

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})

	opts := SimulatorOptions{}
	flag.IntVar(&opts.IntervalMs, "interval", 100, "Tick interval in milliseconds (e.g. 50, 100, 250)")
	flag.BoolVar(&opts.Burst, "burst", false, "Enable burst mode with random spikes")
	flag.StringVar(&opts.Mode, "mode", "stream", "Mode: 'stream' (inject into server via ws) or 'client-listener' (listen & benchmark stats)")
	flag.StringVar(&opts.WSURL, "ws", "ws://localhost:8080/api/v1/ws", "WebSocket endpoint of running backend")
	flag.StringVar(&opts.Wallet, "wallet", "", "Target wallet address (if empty, finds from DB)")
	flag.StringVar(&opts.VaultID, "vault", "", "Target vault ID (if empty, finds from DB)")
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	if opts.Mode == "client-listener" {
		runListener(ctx, logger, opts)
		return
	}

	runWSSimulator(ctx, logger, opts)
}

func runWSSimulator(ctx context.Context, logger *logrus.Logger, opts SimulatorOptions) {
	if os.Getenv("DATABASE_URL") == "" && os.Getenv("DIRECT_DATABASE_URL") == "" {
		_ = os.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/fbyt?sslmode=disable")
	} else if os.Getenv("DATABASE_URL") == "" && os.Getenv("DIRECT_DATABASE_URL") != "" {
		_ = os.Setenv("DATABASE_URL", os.Getenv("DIRECT_DATABASE_URL"))
	}
	if os.Getenv("JWT_SECRET") == "" {
		_ = os.Setenv("JWT_SECRET", "flux-protocol-development-secret-key-32bytes!")
	}

	cfg, _ := config.Load()
	var db *gorm.DB
	var vaults []models.Vault
	var users []models.User

	if cfg != nil {
		var err error
		db, err = database.Connect(cfg)
		if err == nil {
			if opts.VaultID != "" {
				var v models.Vault
				if err := db.Where("id = ? OR address = ?", opts.VaultID, opts.VaultID).First(&v).Error; err == nil {
					vaults = append(vaults, v)
				}
			}
			if len(vaults) == 0 {
				// Query vaults to match UI viewport
				db.Order("created_at DESC").Limit(50).Find(&vaults)
			}

			if opts.Wallet != "" {
				var u models.User
				if err := db.Where("wallet_address = ?", opts.Wallet).First(&u).Error; err == nil {
					users = append(users, u)
				} else {
					u = models.User{WalletAddress: opts.Wallet}
					db.Create(&u)
					users = append(users, u)
				}
			} else {
				db.Limit(10).Find(&users)
			}
		}
	}

	if len(vaults) == 0 {
		logger.Warn("No vaults found in DB. Run seed first for best results.")
		vaults = append(vaults, models.Vault{Address: "mock-vault-1"})
	} else {
		logger.Infof("Loaded %d vaults from DB: %s...", len(vaults), vaults[0].Address)
	}
	if len(users) == 0 {
		users = append(users, models.User{WalletAddress: "mock-wallet-1"})
	}

	logger.Infof("Connecting feeder client to %s...", opts.WSURL)
	c, _, err := gorillawebsocket.DefaultDialer.Dial(opts.WSURL, nil)
	if err != nil {
		logger.Fatalf("Failed to connect to backend WebSocket at %s: %v", opts.WSURL, err)
	}
	defer c.Close()

	logger.Infof("🚀 Connected! Starting High-Frequency Multi-Vault Simulation (Updating ALL %d Vaults/tick) | Wallets: %d | Interval: %dms",
		len(vaults), len(users), opts.IntervalMs)

	tokens := []string{"SOL", "USDC", "JUP", "RAY", "WBTC", "RENDER"}
	tradeTypes := []string{"swap", "deposit", "withdraw"}

	ticker := time.NewTicker(time.Duration(opts.IntervalMs) * time.Millisecond)
	defer ticker.Stop()

	tickCount := 0
	startTime := time.Now()

	for {
		select {
		case <-ctx.Done():
			logger.Infof("Simulator stopped. Dispatched %d ticks in %v", tickCount, time.Since(startTime))
			return
		case <-ticker.C:
			tickCount++

			// Update ALL 10 vaults in this single tick to mimic real busy blockchain network
			for i := 0; i < len(vaults); i++ {
				v := &vaults[i]
				u := users[rand.Intn(len(users))]

				tradeType := tradeTypes[rand.Intn(len(tradeTypes))]
				inToken := tokens[rand.Intn(len(tokens))]
				outToken := tokens[rand.Intn(len(tokens))]
				for outToken == inToken {
					outToken = tokens[rand.Intn(len(tokens))]
				}

				amt := 150.0 + rand.Float64()*2500.0
				price := 50.0 + rand.Float64()*150.0
				fakeSig := fmt.Sprintf("sim_%d_%d", time.Now().UnixNano(), rand.Intn(10000))

				// Bump TVL & PnL
				delta := (rand.Float64() - 0.47) * 850.0
				newTvl := v.TVL.Add(decimal.NewFromFloat(delta))
				if newTvl.LessThan(decimal.NewFromFloat(10000.0)) {
					newTvl = decimal.NewFromFloat(120000.0)
				}
				v.TVL = newTvl

				pnlDelta := (rand.Float64() - 0.48) * 0.35

				// Persist into database asynchronously or directly
				if db != nil && v.ID != uuid.Nil && u.ID != uuid.Nil {
					th := models.TradeHistory{
						VaultID:              v.ID,
						ActorID:              u.ID,
						TransactionSignature: fakeSig,
						TradeType:            tradeType,
						InputToken:           inToken,
						OutputToken:          outToken,
						AmountIn:             decimal.NewFromFloat(amt),
						AmountOut:            decimal.NewFromFloat(amt * 0.98),
						PriceAtExecution:     decimal.NewFromFloat(price),
						ExecutedAt:           time.Now(),
					}
					db.Create(&th)
					db.Model(&models.Vault{}).Where("id = ?", v.ID).Update("tvl", newTvl)
				}

				// 1. Dispatch trade_confirmed with full rich payload
				tradeMsg, _ := json.Marshal(map[string]interface{}{
					"type": "trade_confirmed",
					"data": map[string]interface{}{
						"id":                    fakeSig,
						"vault_id":              v.ID.String(),
						"vault_address":         v.Address,
						"vault_name":            v.Address[:min(8, len(v.Address))],
						"signature":             fakeSig,
						"transaction_signature": fakeSig,
						"status":                "confirmed",
						"action":                tradeType,
						"trade_type":            tradeType,
						"input_token":           inToken,
						"output_token":          outToken,
						"symbol":                inToken,
						"amount":                amt,
						"amount_in":             amt,
						"amount_out":            amt * 0.98,
						"wallet":                u.WalletAddress,
						"tvl":                   newTvl.InexactFloat64(),
						"pnl_percent":           pnlDelta,
						"executed_at":           time.Now().Format(time.RFC3339),
					},
					"timestamp": time.Now().Unix(),
				})
				_ = c.WriteMessage(gorillawebsocket.TextMessage, tradeMsg)

				// 2. Dispatch vault_portfolio_update with new TVL and PnL payload
				vaultMsg, _ := json.Marshal(map[string]interface{}{
					"type": "vault_portfolio_update",
					"data": map[string]interface{}{
						"vault_id":      v.ID.String(),
						"vault_address": v.Address,
						"tvl":           newTvl.InexactFloat64(),
						"pnl_percent":   pnlDelta,
					},
					"timestamp": time.Now().Unix(),
				})
				_ = c.WriteMessage(gorillawebsocket.TextMessage, vaultMsg)
			}

			// Also update user portfolio
			targetWallet := opts.Wallet
			if targetWallet == "" && len(users) > 0 {
				targetWallet = users[0].WalletAddress
			}

			if targetWallet != "" {
				pnlDelta := (rand.Float64() - 0.48) * 15.0
				portfolioMsg, _ := json.Marshal(map[string]interface{}{
					"type": "portfolio_update",
					"data": map[string]interface{}{
						"wallet":    targetWallet,
						"pnl_delta": pnlDelta,
					},
					"timestamp": time.Now().Unix(),
				})
				_ = c.WriteMessage(gorillawebsocket.TextMessage, portfolioMsg)

				summaryMsg, _ := json.Marshal(map[string]interface{}{
					"type": "portfolio_summary_update",
					"data": map[string]interface{}{
						"wallet":    targetWallet,
						"pnl_delta": pnlDelta,
					},
					"timestamp": time.Now().Unix(),
				})
				_ = c.WriteMessage(gorillawebsocket.TextMessage, summaryMsg)
			}

			if tickCount%10 == 0 {
				logger.Infof("⚡ Tick %d: Updated ALL %d Vaults in parallel | Top TVL: $%s",
					tickCount, len(vaults), vaults[0].TVL.StringFixed(2))
			}
		}
	}
}

func runListener(ctx context.Context, logger *logrus.Logger, opts SimulatorOptions) {
	logger.Infof("Connecting test listener to %s...", opts.WSURL)
	c, _, err := gorillawebsocket.DefaultDialer.Dial(opts.WSURL, nil)
	if err != nil {
		logger.Fatalf("Dial failed: %v", err)
	}
	defer c.Close()

	subs := []string{"global:activity", "global:leaderboard"}
	if opts.VaultID != "" {
		subs = append(subs, "vault:"+opts.VaultID)
	}
	if opts.Wallet != "" {
		subs = append(subs, "portfolio:"+opts.Wallet)
	}

	for _, ch := range subs {
		subMsg := fmt.Sprintf(`{"type":"subscribe","channel":"%s"}`, ch)
		if err := c.WriteMessage(gorillawebsocket.TextMessage, []byte(subMsg)); err != nil {
			logger.Warnf("Subscribe error: %v", err)
		}
	}

	logger.Infof("Listening on channels: %v. Press Ctrl+C to stop.", subs)

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			if !strings.Contains(err.Error(), "use of closed network connection") {
				logger.Errorf("Read error: %v", err)
			}
			return
		}
		if len(message) > 0 && rand.Float64() < 0.05 {
			logger.Debugf("Sample msg: %s", string(message))
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
