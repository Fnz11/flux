package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func setupVaultTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	_ = db.Exec(`CREATE TABLE users (
		id TEXT PRIMARY KEY,
		wallet_address TEXT NOT NULL,
		nonce TEXT,
		created_at DATETIME,
		updated_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE vaults (
		id UUID PRIMARY KEY,
		address TEXT NOT NULL,
		manager_id TEXT NOT NULL,
		status TEXT DEFAULT 'Fundraising',
		metadata TEXT DEFAULT '{}',
		performance_fee_bps INTEGER DEFAULT 0,
		management_fee_bps INTEGER DEFAULT 0,
		min_raise_amount NUMERIC DEFAULT 0,
		lockup_period INTEGER DEFAULT 0,
		vault_type TEXT DEFAULT 'open',
		tvl NUMERIC DEFAULT 0,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE trade_histories (
		id TEXT PRIMARY KEY,
		vault_id TEXT NOT NULL,
		actor_id TEXT,
		transaction_signature TEXT,
		trade_type TEXT,
		input_token TEXT,
		output_token TEXT,
		amount_in NUMERIC,
		amount_out NUMERIC,
		price_at_execution NUMERIC,
		executed_at DATETIME
	)`)
	_ = db.Exec(`CREATE TABLE portfolios (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		vault_id TEXT NOT NULL,
		shares_owned NUMERIC DEFAULT 0,
		total_invested_value NUMERIC DEFAULT 0,
		average_entry_price NUMERIC DEFAULT 0,
		created_at DATETIME,
		updated_at DATETIME
	)`)

	return db
}

func TestVaultRepository_Create_Get_Exists(t *testing.T) {
	db := setupVaultTestDB(t)
	repo := NewVaultRepository(db)
	ctx := context.Background()

	managerID := uuid.New()
	managerWallet := "ManagerWalletAddress1111111111111111111"
	user := models.User{
		ID:            managerID,
		WalletAddress: managerWallet,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create manager user: %v", err)
	}

	vaultAddr := "VaultAddr1111111111111111111111111111111111"
	detail := &domain.VaultDetail{
		Address:           vaultAddr,
		ManagerID:         managerID.String(),
		PerformanceFeeBps: 100,
		ManagementFeeBps:  200,
		TVL:               decimal.NewFromFloat(5000.0),
		Metadata:          datatypes.JSON([]byte(`{"name": "Test Vault"}`)),
	}

	t.Run("CreateVault_HappyPath", func(t *testing.T) {
		err := repo.Create(ctx, detail)
		if err != nil {
			t.Fatalf("unexpected error creating vault: %v", err)
		}
		if detail.ID == "" {
			t.Errorf("expected detail.ID to be populated")
		}
		if detail.Status != "Fundraising" {
			t.Errorf("expected default status Fundraising, got %s", detail.Status)
		}
		if detail.VaultType != "open" {
			t.Errorf("expected default vault_type open, got %s", detail.VaultType)
		}
	})

	t.Run("CreateVault_InvalidManagerUUID", func(t *testing.T) {
		badDetail := &domain.VaultDetail{
			Address:   "BadManagerVault",
			ManagerID: "invalid-uuid",
		}
		err := repo.Create(ctx, badDetail)
		if err == nil {
			t.Errorf("expected error for invalid manager UUID")
		}
	})

	t.Run("GetByAddress_Found", func(t *testing.T) {
		found, err := repo.GetByAddress(ctx, vaultAddr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		t.Logf("found.ID = %q, detail.ID = %q", found.ID, detail.ID)
		if found.Address != vaultAddr {
			t.Errorf("expected address %s, got %s", vaultAddr, found.Address)
		}
		if found.ManagerAddress != managerWallet {
			t.Errorf("expected manager wallet %s, got %s", managerWallet, found.ManagerAddress)
		}
	})

	t.Run("GetByAddress_NotFound", func(t *testing.T) {
		_, err := repo.GetByAddress(ctx, "NonExistentAddress")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("GetByID_ValidUUID", func(t *testing.T) {
		found, err := repo.GetByID(ctx, detail.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if found.ID != detail.ID {
			t.Errorf("expected ID %s, got %s", detail.ID, found.ID)
		}
	})

	t.Run("GetByID_InvalidUUID", func(t *testing.T) {
		_, err := repo.GetByID(ctx, "not-a-uuid")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound for invalid UUID, got %v", err)
		}
	})

	t.Run("GetByID_NotFound", func(t *testing.T) {
		_, err := repo.GetByID(ctx, uuid.New().String())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("ExistsByAddress_True_False", func(t *testing.T) {
		exists, err := repo.ExistsByAddress(ctx, vaultAddr)
		if err != nil || !exists {
			t.Errorf("expected true for existing vault address, got %v, err %v", exists, err)
		}

		exists, err = repo.ExistsByAddress(ctx, "UnknownAddress")
		if err != nil || exists {
			t.Errorf("expected false for unknown vault address, got %v, err %v", exists, err)
		}
	})
}

func TestVaultRepository_UpdateMetadata(t *testing.T) {
	db := setupVaultTestDB(t)
	repo := NewVaultRepository(db)
	ctx := context.Background()

	managerID := uuid.New()
	vaultAddr := "VaultUpdateMetadataAddress11111111111111"
	vault := models.Vault{
		ID:        uuid.New(),
		Address:   vaultAddr,
		ManagerID: managerID,
		Status:    "Active",
	}
	if err := db.Create(&vault).Error; err != nil {
		t.Fatalf("failed to seed vault: %v", err)
	}

	newMeta := map[string]interface{}{
		"display_name": "Updated Vault",
		"description":  "New Description",
	}
	err := repo.UpdateMetadata(ctx, vaultAddr, newMeta)
	if err != nil {
		t.Fatalf("unexpected error updating metadata: %v", err)
	}

	var updated models.Vault
	if err := db.Where("address = ?", vaultAddr).First(&updated).Error; err != nil {
		t.Fatalf("failed to fetch updated vault: %v", err)
	}
}

func TestVaultRepository_List(t *testing.T) {
	db := setupVaultTestDB(t)
	repo := NewVaultRepository(db)
	ctx := context.Background()

	m1 := uuid.New()
	w1 := "ManagerWallet111111111111111111111111111"
	_ = db.Create(&models.User{ID: m1, WalletAddress: w1}).Error

	v1 := models.Vault{ID: uuid.New(), Address: "Addr1", ManagerID: m1, Status: "Active", TVL: decimal.NewFromFloat(1000.0)}
	v2 := models.Vault{ID: uuid.New(), Address: "Addr2", ManagerID: m1, Status: "Fundraising", TVL: decimal.NewFromFloat(2000.0)}
	v3 := models.Vault{ID: uuid.New(), Address: "Addr3", ManagerID: m1, Status: "Active", TVL: decimal.NewFromFloat(500.0)}
	_ = db.Create(&v1).Error
	_ = db.Create(&v2).Error
	_ = db.Create(&v3).Error

	t.Run("List_Paginated", func(t *testing.T) {
		list, total, err := repo.List(ctx, domain.VaultListFilter{Page: 1, Limit: 2})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 3 {
			t.Errorf("expected total 3, got %d", total)
		}
		if len(list) != 2 {
			t.Errorf("expected 2 items, got %d", len(list))
		}
	})

	t.Run("List_StatusFilter", func(t *testing.T) {
		list, total, err := repo.List(ctx, domain.VaultListFilter{Status: "Fundraising"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 1 || len(list) != 1 {
			t.Fatalf("expected 1 item, got total=%d len=%d", total, len(list))
		}
		if list[0].Address != "Addr2" {
			t.Errorf("expected Addr2, got %s", list[0].Address)
		}
	})

	t.Run("List_ManagerAddressFilter", func(t *testing.T) {
		list, total, err := repo.List(ctx, domain.VaultListFilter{ManagerAddress: w1})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 3 || len(list) != 3 {
			t.Errorf("expected 3 items for manager w1, got total=%d len=%d", total, len(list))
		}

		_, totalEmpty, err := repo.List(ctx, domain.VaultListFilter{ManagerAddress: "NonExistentWallet"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if totalEmpty != 0 {
			t.Errorf("expected 0 items for unknown manager, got %d", totalEmpty)
		}
	})

	t.Run("List_SortBy", func(t *testing.T) {
		list, _, err := repo.List(ctx, domain.VaultListFilter{SortBy: "tvl", SortOrder: "asc"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) > 0 && !list[0].TVL.Equal(decimal.NewFromFloat(500.0)) {
			t.Errorf("expected first item TVL 500, got %s", list[0].TVL)
		}
	})
}

func TestVaultRepository_TradeAndPortfolioCounts(t *testing.T) {
	db := setupVaultTestDB(t)
	repo := NewVaultRepository(db)
	ctx := context.Background()

	m1 := uuid.New()
	_ = db.Create(&models.User{ID: m1, WalletAddress: "ManagerWallet"}).Error

	vaultID := uuid.New()
	vault := models.Vault{ID: vaultID, Address: "VaultWithCounts", ManagerID: m1}
	_ = db.Create(&vault).Error

	// Add 3 trade histories and 2 portfolio entries
	for i := 0; i < 3; i++ {
		_ = db.Exec(`INSERT INTO trade_histories (id, vault_id) VALUES (?, ?)`, uuid.New().String(), vaultID.String()).Error
	}
	for i := 0; i < 2; i++ {
		_ = db.Exec(`INSERT INTO portfolios (id, user_id, vault_id) VALUES (?, ?, ?)`, uuid.New().String(), m1.String(), vaultID.String()).Error
	}

	detail, err := repo.GetByAddress(ctx, "VaultWithCounts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detail.TradeCount != 3 {
		t.Errorf("expected TradeCount 3, got %d", detail.TradeCount)
	}
	if detail.PortfolioCount != 2 {
		t.Errorf("expected PortfolioCount 2, got %d", detail.PortfolioCount)
	}
	if detail.InvestorCount != 2 {
		t.Errorf("expected InvestorCount 2, got %d", detail.InvestorCount)
	}
}

func TestGetVaultBalances(t *testing.T) {
	db := setupVaultTestDB(t)
	repo := NewVaultRepository(db)

	vaultID := uuid.New()
	managerID := uuid.New()
	vaultAddr := "VaultAddress1111111111111111111111111111111"
	tvlVal := decimal.NewFromFloat(1000.0)

	user := models.User{
		ID:            managerID,
		WalletAddress: "ManagerWalletAddress1111111111111111111",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	vault := models.Vault{
		ID:        vaultID,
		Address:   vaultAddr,
		ManagerID: managerID,
		Status:    "Active",
		TVL:       tvlVal,
	}
	if err := db.Create(&vault).Error; err != nil {
		t.Fatalf("failed to create vault: %v", err)
	}

	t.Run("GetVaultBalances by address default 100% SOL when no trades", func(t *testing.T) {
		balances, err := repo.GetVaultBalances(context.Background(), vaultAddr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(balances) != 2 {
			t.Fatalf("expected 2 balances (SOL, USDC), got %d", len(balances))
		}

		// SOL check (100% of 1000 TVL = 1000 USD, price 150 = 6.6666666666666667 SOL)
		sol := balances[0]
		if sol.Symbol != "SOL" {
			t.Errorf("expected symbol SOL, got %s", sol.Symbol)
		}
		if !sol.USDValue.Equal(decimal.NewFromFloat(1000.0)) {
			t.Errorf("expected SOL USDValue 1000, got %s", sol.USDValue)
		}
		expectedSolAmt := decimal.NewFromFloat(1000.0).Div(decimal.NewFromFloat(150.0))
		if !sol.Amount.Equal(expectedSolAmt) {
			t.Errorf("expected SOL Amount %s, got %s", expectedSolAmt, sol.Amount)
		}

		// USDC check (0% when no trades)
		usdc := balances[1]
		if usdc.Symbol != "USDC" {
			t.Errorf("expected symbol USDC, got %s", usdc.Symbol)
		}
		if !usdc.USDValue.IsZero() || !usdc.Amount.IsZero() {
			t.Errorf("expected 0 for USDC without trades, got %s", usdc.USDValue)
		}
	})

	t.Run("GetVaultBalances calculated dynamically from trade history", func(t *testing.T) {
		tradeVaultID := uuid.New()
		tradeVaultAddr := "DynamicTradeVaultAddress111111111111111"
		_ = db.Create(&models.Vault{ID: tradeVaultID, Address: tradeVaultAddr, ManagerID: managerID, TVL: decimal.NewFromFloat(1000.0)}).Error

		solMint := "So11111111111111111111111111111111111111112"
		usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

		solAmt := decimal.NewFromInt(700).Div(decimal.NewFromInt(150))
		_ = db.Exec(`INSERT INTO trade_histories (id, vault_id, trade_type, input_token, amount_in, amount_out, price_at_execution) VALUES (?, ?, 'Deposit', ?, 300, 300, 1)`, uuid.New().String(), tradeVaultID.String(), usdcMint).Error
		_ = db.Exec(`INSERT INTO trade_histories (id, vault_id, trade_type, input_token, amount_in, amount_out, price_at_execution) VALUES (?, ?, 'Deposit', ?, ?, ?, 150)`, uuid.New().String(), tradeVaultID.String(), solMint, solAmt, solAmt).Error

		balances, err := repo.GetVaultBalances(context.Background(), tradeVaultAddr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(balances) < 2 {
			t.Fatalf("expected at least 2 balances, got %d", len(balances))
		}

		sol := balances[0]
		if !sol.USDValue.Round(2).Equal(decimal.NewFromFloat(700.0)) {
			t.Errorf("expected dynamic SOL USDValue 700, got %s", sol.USDValue)
		}
		usdc := balances[1]
		if !usdc.USDValue.Equal(decimal.NewFromFloat(300.0)) {
			t.Errorf("expected dynamic USDC USDValue 300, got %s", usdc.USDValue)
		}
	})

	t.Run("GetVaultBalances by UUID success", func(t *testing.T) {
		balances, err := repo.GetVaultBalances(context.Background(), vaultID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(balances) != 2 {
			t.Fatalf("expected 2 balances, got %d", len(balances))
		}
	})

	t.Run("GetVaultBalances zero TVL", func(t *testing.T) {
		zeroVaultID := uuid.New()
		zeroVaultAddr := "ZeroTVLVaultAddress11111111111111111111"
		_ = db.Create(&models.Vault{ID: zeroVaultID, Address: zeroVaultAddr, ManagerID: managerID, TVL: decimal.Zero}).Error

		balances, err := repo.GetVaultBalances(context.Background(), zeroVaultAddr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(balances) != 2 {
			t.Fatalf("expected 2 balances, got %d", len(balances))
		}
		if !balances[0].Amount.IsZero() || !balances[0].USDValue.IsZero() {
			t.Errorf("expected 0 for SOL amount/usd on 0 TVL, got amount %s, usd %s", balances[0].Amount, balances[0].USDValue)
		}
		if !balances[1].Amount.IsZero() || !balances[1].USDValue.IsZero() {
			t.Errorf("expected 0 for USDC amount/usd on 0 TVL, got amount %s, usd %s", balances[1].Amount, balances[1].USDValue)
		}
	})

	t.Run("fetchVaultCounts from portfolio_summary MV", func(t *testing.T) {
		psVaultID := uuid.New()
		psVaultAddr := "PSVaultAddress1111111111111111111111111"
		_ = db.Create(&models.Vault{ID: psVaultID, Address: psVaultAddr, ManagerID: managerID, TVL: decimal.NewFromFloat(100.0)}).Error

		_ = db.Exec(`CREATE TABLE IF NOT EXISTS portfolio_summary (
			vault_id text,
			trade_count bigint,
			share_holders_count bigint
		)`).Error

		_ = db.Exec(`INSERT INTO portfolio_summary (vault_id, trade_count, share_holders_count) VALUES (?, 42, 7)`, psVaultID.String()).Error

		detail, err := repo.GetByAddress(context.Background(), psVaultAddr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if detail.TradeCount != 42 {
			t.Errorf("expected TradeCount 42 from MV, got %d", detail.TradeCount)
		}
		if detail.PortfolioCount != 7 {
			t.Errorf("expected PortfolioCount 7 from MV, got %d", detail.PortfolioCount)
		}
	})

	t.Run("fetchBatchSparklines from vault_daily_sparkline_mv", func(t *testing.T) {
		spVaultID := uuid.New()
		spVaultAddr := "SPVaultAddress1111111111111111111111111"
		_ = db.Create(&models.Vault{ID: spVaultID, Address: spVaultAddr, ManagerID: managerID, TVL: decimal.NewFromFloat(100.0)}).Error

		_ = db.Exec(`CREATE TABLE IF NOT EXISTS vault_daily_sparkline_mv (
			vault_id text,
			bucket datetime,
			val numeric
		)`).Error

		nowTime := time.Now().UTC().Truncate(24 * time.Hour)
		_ = db.Exec(`INSERT INTO vault_daily_sparkline_mv (vault_id, bucket, val) VALUES (?, ?, 123.45)`, spVaultID.String(), nowTime).Error

		list, _, err := repo.List(context.Background(), domain.VaultListFilter{Search: spVaultAddr})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) == 0 {
			t.Fatalf("expected 1 vault found")
		}
		if len(list[0].Sparkline) == 0 {
			t.Fatalf("expected sparkline points from MV")
		}
		if !list[0].Sparkline[0].Value.Equal(decimal.NewFromFloat(123.45)) {
			t.Errorf("expected sparkline value 123.45, got %s", list[0].Sparkline[0].Value)
		}
	})
}

