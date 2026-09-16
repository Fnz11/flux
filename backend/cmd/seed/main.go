package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/flux-protocol/backend/internal/config"
	"github.com/flux-protocol/backend/internal/database"
	"github.com/flux-protocol/backend/internal/seed"
	"github.com/sirupsen/logrus"
)

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})

	opts := seed.DefaultOptions()

	flag.IntVar(&opts.Users, "users", opts.Users, "number of users (min 25)")
	flag.IntVar(&opts.VaultsPerUser, "vaults-per-user", opts.VaultsPerUser, "vaults each user manages (min 4)")
	flag.IntVar(&opts.TradesPerVault, "trades-per-vault", opts.TradesPerVault, "target trades per vault")
	flag.IntVar(&opts.Days, "days", opts.Days, "history depth (days) for trades")
	flag.IntVar(&opts.MetricDays, "metric-days", opts.MetricDays, "history depth (days) for metrics/price history")
	flag.BoolVar(&opts.Clean, "clean", false, "truncate seeded tables before seeding")
	flag.StringVar(&opts.RPCURL, "rpc", opts.RPCURL, "Solana RPC URL (defaults to local test validator)")
	flag.StringVar(&opts.Wallet, "wallet", opts.Wallet, "specific wallet address to seed/include in dataset")
	flag.Float64Var(&opts.AirdropSOL, "airdrop-sol", opts.AirdropSOL, "SOL airdropped to each user account")
	flag.Float64Var(&opts.VaultSOL, "vault-sol", opts.VaultSOL, "SOL airdropped to each vault account")
	flag.Parse()

	if opts.Wallet != "" {
		if opts.Users < 1 {
			opts.Users = 1
		}
		if opts.VaultsPerUser < 1 {
			opts.VaultsPerUser = 2
		}
	} else {
		if opts.Users < seed.UsersMin {
			fmt.Fprintf(os.Stderr, "--users must be >= %d, got %d\n", seed.UsersMin, opts.Users)
			os.Exit(1)
		}
		if opts.VaultsPerUser < seed.VaultsPerUserMin {
			fmt.Fprintf(os.Stderr, "--vaults-per-user must be >= %d, got %d\n", seed.VaultsPerUserMin, opts.VaultsPerUser)
			os.Exit(1)
		}
	}
	if os.Getenv("DATABASE_URL") == "" {
		if direct := os.Getenv("DIRECT_DATABASE_URL"); direct != "" {
			_ = os.Setenv("DATABASE_URL", direct)
		} else {
			_ = os.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5433/flux?sslmode=disable")
		}
	}
	if os.Getenv("JWT_SECRET") == "" {
		_ = os.Setenv("JWT_SECRET", "change-me-to-at-least-32-bytes-long-secret-key!")
	}

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("config load failed: %v", err)
	}

	// The seeder connects directly to the primary Postgres (never PgBouncer).
	if direct := os.Getenv("DIRECT_DATABASE_URL"); direct != "" {
		cfg.DatabaseURL = direct
	}

	db, err := database.Connect(cfg)
	if err != nil {
		logger.Fatalf("database connect failed: %v", err)
	}

	sol := seed.NewSolanaSeedClient(opts.RPCURL)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	start := time.Now()
	if err := seed.Run(ctx, db, opts, logger, sol); err != nil {
		logger.Fatalf("seed failed: %v", err)
	}
	logger.WithField("elapsed", time.Since(start).String()).Info("seeding complete")
}
