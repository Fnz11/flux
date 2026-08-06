package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/shopspring/decimal"
)

type Config struct {
	DatabaseURL          string
	ServerPort           int
	JWTSecret            string
	EnablePprof          bool
	DustThreshold        decimal.Decimal
	FocusAssetsWhitelist []string
	SSLMode              string
	SolanaRPCURL         string
	SolanaProgramID      string
}

func Load() (*Config, error) {
	port := 8080
	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			port = v
		}
	}

	sslMode := os.Getenv("SSLMODE")
	if sslMode == "" {
		sslMode = "disable"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}
	if !strings.Contains(dsn, "sslmode=") {
		dsn += fmt.Sprintf(" sslmode=%s", sslMode)
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET environment variable must be at least 32 bytes long, got %d bytes", len(jwtSecret))
	}

	dust := decimal.NewFromFloat(0.001)
	if d := os.Getenv("DUST_THRESHOLD"); d != "" {
		if v, err := decimal.NewFromString(d); err == nil {
			dust = v
		}
	}

	var whitelist []string
	if wl := os.Getenv("FOCUS_ASSETS_WHITELIST"); wl != "" {
		for _, s := range strings.Split(wl, ",") {
			whitelist = append(whitelist, strings.TrimSpace(s))
		}
	}

	solanaURL := os.Getenv("SOLANA_RPC_URL")
	if solanaURL == "" {
		solanaURL = "https://api.mainnet-beta.solana.com"
	}

	solanaProgramID := os.Getenv("SOLANA_PROGRAM_ID")

	return &Config{
		DatabaseURL:          dsn,
		ServerPort:           port,
		JWTSecret:            jwtSecret,
		EnablePprof:          os.Getenv("ENABLE_PPROF") == "true",
		DustThreshold:        dust,
		FocusAssetsWhitelist: whitelist,
		SSLMode:              sslMode,
		SolanaRPCURL:         solanaURL,
		SolanaProgramID:      solanaProgramID,
	}, nil
}
