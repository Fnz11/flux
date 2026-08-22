package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/shopspring/decimal"
)

// DefaultFocusAssetsWhitelist is the single source of truth for default supported assets.
var DefaultFocusAssetsWhitelist = []string{
	"SOL", "USDC", "USDT", "JUP", "PYTH", "RAY", "ORCA", "KMNO", "DRIFT",
	"JTO", "mSOL", "RENDER", "HNT", "NOS", "WBTC", "WETH", "BLZE",
}

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

// loadEnvFile reads .env if present and sets OS env variables if not already set.
func loadEnvFile() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
					val = val[1 : len(val)-1]
				}
				if os.Getenv(key) == "" {
					_ = os.Setenv(key, val)
				}
			}
		}
		break
	}
}

func init() {
	// Load .env automatically unless running unit tests
	if len(os.Args) > 0 && !strings.HasSuffix(os.Args[0], ".test") && !strings.Contains(os.Args[0], "/_test/") {
		loadEnvFile()
	}
}

func Load() (*Config, error) {
	// Also attempt loading if DATABASE_URL is not set yet and not running a test
	if os.Getenv("DATABASE_URL") == "" && len(os.Args) > 0 && !strings.HasSuffix(os.Args[0], ".test") {
		loadEnvFile()
	}

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
