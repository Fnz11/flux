package config

import (
	"os"
	"strings"
	"testing"

	"github.com/shopspring/decimal"
)

func TestConfigLoad(t *testing.T) {
	// Helper to clear environment variables before each subtest
	clearEnv := func() {
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("PORT")
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("ENABLE_PPROF")
		os.Unsetenv("DUST_THRESHOLD")
		os.Unsetenv("FOCUS_ASSETS_WHITELIST")
		os.Unsetenv("SSLMODE")
		os.Unsetenv("SOLANA_RPC_URL")
		os.Unsetenv("SOLANA_PROGRAM_ID")
	}

	t.Run("Config_AllEnvSet", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		secret := "12345678901234567890123456789012" // 32 chars
		os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/mydb")
		os.Setenv("PORT", "9090")
		os.Setenv("JWT_SECRET", secret)
		os.Setenv("ENABLE_PPROF", "true")
		os.Setenv("DUST_THRESHOLD", "0.005")
		os.Setenv("FOCUS_ASSETS_WHITELIST", "SOL, ETH, USDC")
		os.Setenv("SSLMODE", "require")
		os.Setenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
		os.Setenv("SOLANA_PROGRAM_ID", "Program111111111111111111111111111111111")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected Load error: %v", err)
		}

		if !strings.HasPrefix(cfg.DatabaseURL, "postgres://user:pass@localhost:5432/mydb") {
			t.Errorf("DatabaseURL = %v", cfg.DatabaseURL)
		}
		if cfg.ServerPort != 9090 {
			t.Errorf("ServerPort = %d, want 9090", cfg.ServerPort)
		}
		if cfg.JWTSecret != secret {
			t.Errorf("JWTSecret = %v, want %v", cfg.JWTSecret, secret)
		}
		if !cfg.EnablePprof {
			t.Error("EnablePprof = false, want true")
		}
		if !cfg.DustThreshold.Equal(decimal.NewFromFloat(0.005)) {
			t.Errorf("DustThreshold = %v, want 0.005", cfg.DustThreshold)
		}
		if len(cfg.FocusAssetsWhitelist) != 3 || cfg.FocusAssetsWhitelist[0] != "SOL" || cfg.FocusAssetsWhitelist[1] != "ETH" || cfg.FocusAssetsWhitelist[2] != "USDC" {
			t.Errorf("FocusAssetsWhitelist = %v, want [SOL, ETH, USDC]", cfg.FocusAssetsWhitelist)
		}
		if cfg.SSLMode != "require" {
			t.Errorf("SSLMode = %v, want require", cfg.SSLMode)
		}
		if cfg.SolanaRPCURL != "https://api.devnet.solana.com" {
			t.Errorf("SolanaRPCURL = %v, want https://api.devnet.solana.com", cfg.SolanaRPCURL)
		}
		if cfg.SolanaProgramID != "Program111111111111111111111111111111111" {
			t.Errorf("SolanaProgramID = %v", cfg.SolanaProgramID)
		}
	})

	t.Run("Config_MissingDatabaseURL", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")

		_, err := Load()
		if err == nil {
			t.Fatal("expected error when DATABASE_URL is missing, got nil")
		}
		if !strings.Contains(err.Error(), "DATABASE_URL environment variable is required") {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("Config_JWTSecretTooShort", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "short_secret")

		_, err := Load()
		if err == nil {
			t.Fatal("expected error for short JWT_SECRET, got nil")
		}
		if !strings.Contains(err.Error(), "at least 32 bytes") {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("Config_JWTSecretExactly31Chars", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		secret31 := "1234567890123456789012345678901" // 31 chars
		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", secret31)

		_, err := Load()
		if err == nil {
			t.Fatal("expected error for 31-char JWT_SECRET, got nil")
		}
	})

	t.Run("Config_JWTSecretExactly32Chars", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		secret32 := "12345678901234567890123456789012" // 32 chars
		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", secret32)

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error for 32-char JWT_SECRET: %v", err)
		}
		if cfg.JWTSecret != secret32 {
			t.Errorf("JWTSecret = %v, want %v", cfg.JWTSecret, secret32)
		}
	})

	t.Run("Config_JWTSecretOver32Chars", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		secret64 := "1234567890123456789012345678901212345678901234567890123456789012" // 64 chars
		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", secret64)

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error for 64-char JWT_SECRET: %v", err)
		}
		if cfg.JWTSecret != secret64 {
			t.Errorf("JWTSecret = %v, want %v", cfg.JWTSecret, secret64)
		}
	})

	t.Run("Config_DefaultPort", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.ServerPort != 8080 {
			t.Errorf("ServerPort = %d, want 8080", cfg.ServerPort)
		}
	})

	t.Run("Config_CustomPort", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("PORT", "9090")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.ServerPort != 9090 {
			t.Errorf("ServerPort = %d, want 9090", cfg.ServerPort)
		}
	})

	t.Run("Config_SSLModeDefault", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.SSLMode != "disable" {
			t.Errorf("SSLMode = %v, want disable", cfg.SSLMode)
		}
		if !strings.Contains(cfg.DatabaseURL, "sslmode=disable") {
			t.Errorf("DatabaseURL missing sslmode=disable: %s", cfg.DatabaseURL)
		}
	})

	t.Run("Config_SSLModeCustom", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("SSLMODE", "require")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.SSLMode != "require" {
			t.Errorf("SSLMode = %v, want require", cfg.SSLMode)
		}
		if !strings.Contains(cfg.DatabaseURL, "sslmode=require") {
			t.Errorf("DatabaseURL missing sslmode=require: %s", cfg.DatabaseURL)
		}
	})

	t.Run("Config_SolanaRPCDefault", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.SolanaRPCURL != "https://api.mainnet-beta.solana.com" {
			t.Errorf("SolanaRPCURL = %v, want https://api.mainnet-beta.solana.com", cfg.SolanaRPCURL)
		}
	})

	t.Run("Config_FocusAssetsWhitelistParsed", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("FOCUS_ASSETS_WHITELIST", "SOL,ETH")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cfg.FocusAssetsWhitelist) != 2 || cfg.FocusAssetsWhitelist[0] != "SOL" || cfg.FocusAssetsWhitelist[1] != "ETH" {
			t.Errorf("FocusAssetsWhitelist = %v, want [SOL, ETH]", cfg.FocusAssetsWhitelist)
		}
	})

	t.Run("Config_FocusAssetsWhitelistTrimmed", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("FOCUS_ASSETS_WHITELIST", "  SOL  ,  ETH  , USDC  ")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cfg.FocusAssetsWhitelist) != 3 || cfg.FocusAssetsWhitelist[0] != "SOL" || cfg.FocusAssetsWhitelist[1] != "ETH" || cfg.FocusAssetsWhitelist[2] != "USDC" {
			t.Errorf("FocusAssetsWhitelist = %v, want trimmed [SOL, ETH, USDC]", cfg.FocusAssetsWhitelist)
		}
	})

	t.Run("Config_DustThresholdDefault", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !cfg.DustThreshold.Equal(decimal.NewFromFloat(0.001)) {
			t.Errorf("DustThreshold = %v, want 0.001", cfg.DustThreshold)
		}
	})

	t.Run("Config_DustThresholdCustom", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("DUST_THRESHOLD", "0.005")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !cfg.DustThreshold.Equal(decimal.NewFromFloat(0.005)) {
			t.Errorf("DustThreshold = %v, want 0.005", cfg.DustThreshold)
		}
	})

	t.Run("Config_InvalidDustThreshold", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", "12345678901234567890123456789012")
		os.Setenv("DUST_THRESHOLD", "invalid_decimal")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !cfg.DustThreshold.Equal(decimal.NewFromFloat(0.001)) {
			t.Errorf("DustThreshold = %v, want default 0.001 when invalid provided", cfg.DustThreshold)
		}
	})

	t.Run("Config_JWTSecretNotLoggedOnError", func(t *testing.T) {
		clearEnv()
		defer clearEnv()

		superSecretValue := "super_secret_password_12345"
		os.Setenv("DATABASE_URL", "postgres://localhost/test")
		os.Setenv("JWT_SECRET", superSecretValue)

		_, err := Load()
		if err == nil {
			t.Fatal("expected error for short JWT_SECRET")
		}
		if strings.Contains(err.Error(), superSecretValue) {
			t.Errorf("error message leaked secret value: %s", err.Error())
		}
	})
}
