package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect sqlite memory db: %v", err)
	}

	_ = db.Exec(`CREATE TABLE trade_histories (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		actor_id TEXT NOT NULL,
		transaction_signature TEXT UNIQUE NOT NULL,
		trade_type TEXT NOT NULL,
		input_token TEXT NOT NULL,
		output_token TEXT NOT NULL,
		amount_in NUMERIC NOT NULL,
		amount_out NUMERIC NOT NULL,
		price_at_execution NUMERIC NOT NULL,
		executed_at DATETIME NOT NULL
	)`)

	return db
}

func TestTradeRepo_FindBySignature_Create(t *testing.T) {
	db := setupTestDB(t)
	repo := NewTradeRepository(db)
	ctx := context.Background()

	vaultID := uuid.New()
	actorID := uuid.New()
	sig := "signature11111111111111111111111111111111"

	trade := &domain.TradeDetail{
		VaultID:              vaultID.String(),
		ActorID:              actorID.String(),
		TransactionSignature: sig,
		TradeType:            "Deposit",
		InputToken:           "SOL",
		OutputToken:          "SOL",
		AmountIn:             decimal.NewFromFloat(10.0),
		AmountOut:            decimal.NewFromFloat(10.0),
		PriceAtExecution:     decimal.NewFromFloat(150.0),
		ExecutedAt:           time.Now().Truncate(time.Second),
	}

	t.Run("FindBySignature_NotFound", func(t *testing.T) {
		_, err := repo.FindBySignature(ctx, "non_existent_signature")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("Create_HappyPath", func(t *testing.T) {
		err := repo.Create(ctx, trade)
		if err != nil {
			t.Fatalf("unexpected error creating trade: %v", err)
		}
		if trade.ID == "" {
			t.Errorf("expected trade ID to be populated")
		}
	})

	t.Run("FindBySignature_Found", func(t *testing.T) {
		found, err := repo.FindBySignature(ctx, sig)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if found.TransactionSignature != sig {
			t.Errorf("expected signature %s, got %s", sig, found.TransactionSignature)
		}
		if found.VaultID != vaultID.String() {
			t.Errorf("expected vaultID %s, got %s", vaultID.String(), found.VaultID)
		}
	})

	t.Run("Create_DuplicateSignature", func(t *testing.T) {
		dupTrade := &domain.TradeDetail{
			VaultID:              vaultID.String(),
			ActorID:              actorID.String(),
			TransactionSignature: sig,
			TradeType:            "Deposit",
			InputToken:           "SOL",
			OutputToken:          "SOL",
			AmountIn:             decimal.NewFromFloat(5.0),
			AmountOut:            decimal.NewFromFloat(5.0),
			PriceAtExecution:     decimal.NewFromFloat(150.0),
			ExecutedAt:           time.Now(),
		}
		err := repo.Create(ctx, dupTrade)
		if err == nil {
			t.Errorf("expected error when inserting duplicate signature, got nil")
		}
	})

	t.Run("Create_InvalidUUID", func(t *testing.T) {
		badTrade := &domain.TradeDetail{
			VaultID:              "bad-vault-id",
			ActorID:              actorID.String(),
			TransactionSignature: "sig_bad_vault",
		}
		err := repo.Create(ctx, badTrade)
		if err == nil {
			t.Errorf("expected error for invalid vault UUID")
		}

		badTradeActor := &domain.TradeDetail{
			VaultID:              vaultID.String(),
			ActorID:              "bad-actor-id",
			TransactionSignature: "sig_bad_actor",
		}
		err = repo.Create(ctx, badTradeActor)
		if err == nil {
			t.Errorf("expected error for invalid actor UUID")
		}
	})
}

func TestTradeRepo_ListByVault(t *testing.T) {
	db := setupTestDB(t)
	repo := NewTradeRepository(db)
	ctx := context.Background()

	vaultID := uuid.New()
	actorID := uuid.New()
	now := time.Now()

	t1 := &domain.TradeDetail{
		VaultID:              vaultID.String(),
		ActorID:              actorID.String(),
		TransactionSignature: "sig_list_1",
		TradeType:            "Deposit",
		InputToken:           "SOL",
		OutputToken:          "SOL",
		AmountIn:             decimal.NewFromInt(10),
		AmountOut:            decimal.NewFromInt(10),
		PriceAtExecution:     decimal.NewFromInt(150),
		ExecutedAt:           now.Add(-2 * time.Hour),
	}
	t2 := &domain.TradeDetail{
		VaultID:              vaultID.String(),
		ActorID:              actorID.String(),
		TransactionSignature: "sig_list_2",
		TradeType:            "Withdraw",
		InputToken:           "SOL",
		OutputToken:          "SOL",
		AmountIn:             decimal.NewFromInt(5),
		AmountOut:            decimal.NewFromInt(5),
		PriceAtExecution:     decimal.NewFromInt(150),
		ExecutedAt:           now.Add(-1 * time.Hour),
	}

	_ = repo.Create(ctx, t1)
	_ = repo.Create(ctx, t2)

	t.Run("ListByVault_Paginated_DESC", func(t *testing.T) {
		trades, total, err := repo.ListByVault(ctx, vaultID.String(), "", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 2 {
			t.Errorf("expected total 2, got %d", total)
		}
		if len(trades) != 2 {
			t.Fatalf("expected 2 trades, got %d", len(trades))
		}
		// Ordered by executed_at DESC so t2 (1 hour ago) comes before t1 (2 hours ago)
		if trades[0].TransactionSignature != "sig_list_2" {
			t.Errorf("expected most recent trade first, got %s", trades[0].TransactionSignature)
		}
	})

	t.Run("ListByVault_TypeFilter", func(t *testing.T) {
		trades, total, err := repo.ListByVault(ctx, vaultID.String(), "Withdraw", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 1 || len(trades) != 1 {
			t.Fatalf("expected 1 trade, got total=%d len=%d", total, len(trades))
		}
		if trades[0].TradeType != "Withdraw" {
			t.Errorf("expected trade type Withdraw, got %s", trades[0].TradeType)
		}
	})
}

func TestTradeRepo_ListByVaultIDs(t *testing.T) {
	db := setupTestDB(t)
	repo := NewTradeRepository(db)

	vault1 := uuid.New()
	vault2 := uuid.New()
	vault3 := uuid.New()
	actorID := uuid.New()
	now := time.Now()

	t1 := &domain.TradeDetail{
		VaultID:              vault1.String(),
		ActorID:              actorID.String(),
		TransactionSignature: "sig1",
		TradeType:            "buy",
		InputToken:           "SOL",
		OutputToken:          "USDC",
		AmountIn:             decimal.NewFromInt(10),
		AmountOut:            decimal.NewFromInt(100),
		PriceAtExecution:     decimal.NewFromInt(10),
		ExecutedAt:           now.Add(-2 * time.Hour),
	}
	t2 := &domain.TradeDetail{
		VaultID:              vault2.String(),
		ActorID:              actorID.String(),
		TransactionSignature: "sig2",
		TradeType:            "sell",
		InputToken:           "USDC",
		OutputToken:          "SOL",
		AmountIn:             decimal.NewFromInt(100),
		AmountOut:            decimal.NewFromInt(10),
		PriceAtExecution:     decimal.NewFromInt(10),
		ExecutedAt:           now.Add(-1 * time.Hour),
	}
	t3 := &domain.TradeDetail{
		VaultID:              vault3.String(),
		ActorID:              actorID.String(),
		TransactionSignature: "sig3",
		TradeType:            "buy",
		InputToken:           "SOL",
		OutputToken:          "USDC",
		AmountIn:             decimal.NewFromInt(5),
		AmountOut:            decimal.NewFromInt(50),
		PriceAtExecution:     decimal.NewFromInt(10),
		ExecutedAt:           now,
	}

	ctx := context.Background()
	_ = repo.Create(ctx, t1)
	_ = repo.Create(ctx, t2)
	_ = repo.Create(ctx, t3)

	t.Run("filter by multiple vault IDs", func(t *testing.T) {
		trades, total, err := repo.ListByVaultIDs(ctx, []string{vault1.String(), vault2.String()}, "", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 2 {
			t.Errorf("expected total 2, got %d", total)
		}
		if len(trades) != 2 {
			t.Errorf("expected 2 trades, got %d", len(trades))
		}
	})

	t.Run("filter by vault IDs and tradeType", func(t *testing.T) {
		trades, total, err := repo.ListByVaultIDs(ctx, []string{vault1.String(), vault2.String()}, "buy", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 1 {
			t.Errorf("expected total 1, got %d", total)
		}
		if len(trades) != 1 || trades[0].VaultID != vault1.String() {
			t.Errorf("unexpected trade list: %+v", trades)
		}
	})

	t.Run("empty vault IDs returns all trades", func(t *testing.T) {
		trades, total, err := repo.ListByVaultIDs(ctx, []string{}, "", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 3 {
			t.Errorf("expected total 3, got %d", total)
		}
		if len(trades) != 3 {
			t.Errorf("expected 3 trades, got %d", len(trades))
		}
	})

	t.Run("mixed UUID and non-UUID string IDs", func(t *testing.T) {
		trades, total, err := repo.ListByVaultIDs(ctx, []string{vault1.String(), "non-uuid-string"}, "", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 1 {
			t.Errorf("expected total 1, got %d", total)
		}
		if len(trades) != 1 || trades[0].VaultID != vault1.String() {
			t.Errorf("unexpected trades result: %+v", trades)
		}
	})

	t.Run("duplicate vault IDs and empty string filtering", func(t *testing.T) {
		trades, total, err := repo.ListByVaultIDs(ctx, []string{vault1.String(), vault1.String(), "", " "}, "", 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 1 {
			t.Errorf("expected total 1, got %d", total)
		}
		if len(trades) != 1 {
			t.Errorf("expected 1 trade result, got %d", len(trades))
		}
	})
}
