package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL          string
	ServerPort           int
	JWTSecret            string
	EnablePprof          bool
	DustThreshold        float64
	FocusAssetsWhitelist []string
	SSLMode              string
	SolanaRPCURL         string
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

	dust := 0.001
	if d := os.Getenv("DUST_THRESHOLD"); d != "" {
		if v, err := strconv.ParseFloat(d, 64); err == nil {
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

	return &Config{
		DatabaseURL:          dsn,
		ServerPort:           port,
		JWTSecret:            os.Getenv("JWT_SECRET"),
		EnablePprof:          os.Getenv("ENABLE_PPROF") == "true",
		DustThreshold:        dust,
		FocusAssetsWhitelist: whitelist,
		SSLMode:              sslMode,
		SolanaRPCURL:         solanaURL,
	}, nil
}
