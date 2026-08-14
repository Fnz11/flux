package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type vaultRepo struct {
	db *gorm.DB
}

func NewVaultRepository(db *gorm.DB) domain.VaultRepository {
	return &vaultRepo{db: db}
}

func (r *vaultRepo) GetByAddress(ctx context.Context, address string) (*domain.VaultDetail, error) {
	db := getDB(ctx, r.db)
	var v models.Vault
	var err error
	if uid, parseErr := uuid.Parse(address); parseErr == nil {
		err = db.Preload("Manager").Where("id = ? OR address = ?", uid, address).First(&v).Error
	} else {
		err = db.Preload("Manager").Where("address = ?", address).First(&v).Error
	}
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	detail := vaultToDetail(&v)
	counts, err := r.fetchVaultCounts(db, []uuid.UUID{v.ID})
	if err != nil {
		return nil, err
	}
	if c, ok := counts[v.ID]; ok {
		detail.TradeCount = c.TradeCount
		detail.PortfolioCount = c.PortfolioCount
	}
	detail.InvestorCount = int(detail.PortfolioCount)
	return detail, nil
}

func (r *vaultRepo) GetByID(ctx context.Context, id string) (*domain.VaultDetail, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, domain.ErrNotFound
	}
	db := getDB(ctx, r.db)
	var v models.Vault
	err := db.Preload("Manager").Where("id = ?", id).First(&v).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	detail := vaultToDetail(&v)
	counts, err := r.fetchVaultCounts(db, []uuid.UUID{v.ID})
	if err != nil {
		return nil, err
	}
	if c, ok := counts[v.ID]; ok {
		detail.TradeCount = c.TradeCount
		detail.PortfolioCount = c.PortfolioCount
	}
	detail.InvestorCount = int(detail.PortfolioCount)
	return detail, nil
}

func (r *vaultRepo) ExistsByAddress(ctx context.Context, address string) (bool, error) {
	var count int64
	err := getDB(ctx, r.db).Model(&models.Vault{}).Where("address = ?", address).Count(&count).Error
	return count > 0, err
}

func (r *vaultRepo) Create(ctx context.Context, vault *domain.VaultDetail) error {
	managerID, err := uuid.Parse(vault.ManagerID)
	if err != nil {
		return err
	}
	status := vault.Status
	if status == "" {
		status = "Fundraising"
	}
	vaultType := vault.VaultType
	if vaultType == "" {
		vaultType = "open"
	}
	vault.Status = status
	vault.VaultType = vaultType

	var existing models.Vault
	db := getDB(ctx, r.db)
	if err := db.Where("address = ?", vault.Address).First(&existing).Error; err == nil {
		// Vault already exists (e.g. registered by indexer/draft flow) -> update metadata & fields
		existing.ManagerID = managerID
		existing.Status = status
		existing.Metadata = vault.Metadata
		existing.PerformanceFeeBps = vault.PerformanceFeeBps
		existing.ManagementFeeBps = vault.ManagementFeeBps
		existing.MinRaiseAmount = vault.MinRaiseAmount
		existing.LockupPeriod = vault.LockupPeriod
		existing.VaultType = vaultType
		if err := db.Save(&existing).Error; err != nil {
			return err
		}
		vault.ID = existing.ID.String()
		vault.CreatedAt = existing.CreatedAt
		vault.UpdatedAt = existing.UpdatedAt
		return nil
	}

	m := models.Vault{
		Address:           vault.Address,
		ManagerID:         managerID,
		Status:            status,
		Metadata:          vault.Metadata,
		PerformanceFeeBps: vault.PerformanceFeeBps,
		ManagementFeeBps:  vault.ManagementFeeBps,
		MinRaiseAmount:    vault.MinRaiseAmount,
		LockupPeriod:      vault.LockupPeriod,
		VaultType:         vaultType,
		TVL:               vault.TVL,
	}
	if vault.ID != "" {
		if parsed, err := uuid.Parse(vault.ID); err == nil {
			m.ID = parsed
		}
	}
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := db.Create(&m).Error; err != nil {
		return err
	}
	vault.ID = m.ID.String()
	vault.CreatedAt = m.CreatedAt
	vault.UpdatedAt = m.UpdatedAt
	return nil
}

func (r *vaultRepo) UpdateMetadata(ctx context.Context, address string, metadata interface{}) error {
	metaBytes, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	if uid, parseErr := uuid.Parse(address); parseErr == nil {
		return getDB(ctx, r.db).Model(&models.Vault{}).Where("id = ? OR address = ?", uid, address).Update("metadata", metaBytes).Error
	}
	return getDB(ctx, r.db).Model(&models.Vault{}).Where("address = ?", address).Update("metadata", metaBytes).Error
}

func (r *vaultRepo) List(ctx context.Context, filter domain.VaultListFilter) ([]domain.VaultDetail, int64, error) {
	db := getDB(ctx, r.db)
	query := db.Model(&models.Vault{}).Preload("Manager")
	countQuery := db.Model(&models.Vault{})

	if filter.Status != "" {
		query = query.Where("LOWER(status) = LOWER(?)", filter.Status)
		countQuery = countQuery.Where("LOWER(status) = LOWER(?)", filter.Status)
	}

	if filter.ManagerAddress != "" {
		subQuery := db.Model(&models.User{}).Select("id").Where("LOWER(wallet_address) = LOWER(?)", filter.ManagerAddress)
		query = query.Where("manager_id IN (?)", subQuery)
		countQuery = countQuery.Where("manager_id IN (?)", subQuery)
	}

	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		searchClause := "(LOWER(address) LIKE ? OR LOWER(CAST(metadata AS TEXT)) LIKE ?)"
		query = query.Where(searchClause, searchTerm, searchTerm)
		countQuery = countQuery.Where(searchClause, searchTerm, searchTerm)
	}

	var total int64
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortCol := "created_at"
	switch strings.ToLower(filter.SortBy) {
	case "tvl":
		sortCol = "tvl"
	case "created_at":
		sortCol = "created_at"
	case "min_raise_amount":
		sortCol = "min_raise_amount"
	case "pnl":
		sortCol = "tvl"
	case "investors":
		sortCol = "(SELECT COUNT(*) FROM portfolios WHERE portfolios.vault_id = vaults.id)"
	}

	orderDir := "DESC"
	if strings.EqualFold(filter.SortOrder, "asc") {
		orderDir = "ASC"
	}

	orderClause := sortCol + " " + orderDir + ", id ASC"

	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var vaults []models.Vault
	offset := (page - 1) * limit
	if err := query.Offset(offset).Limit(limit).Order(orderClause).Find(&vaults).Error; err != nil {
		return nil, 0, err
	}

	vaultIDs := make([]uuid.UUID, len(vaults))
	for i, v := range vaults {
		vaultIDs[i] = v.ID
	}
	counts, err := r.fetchVaultCounts(db, vaultIDs)
	if err != nil {
		return nil, 0, err
	}

	sparklines := r.fetchBatchSparklines(db, vaultIDs)

	details := make([]domain.VaultDetail, len(vaults))
	for i, v := range vaults {
		d := vaultToDetail(&v)
		if c, ok := counts[v.ID]; ok {
			d.TradeCount = c.TradeCount
			d.PortfolioCount = c.PortfolioCount
		}
		if s, ok := sparklines[v.ID]; ok {
			d.Sparkline = s
		} else {
			d.Sparkline = []domain.HistoryPoint{}
		}
		d.InvestorCount = int(d.PortfolioCount)
		details[i] = *d
	}
	return details, total, nil
}

type vaultCount struct {
	VaultID        uuid.UUID
	TradeCount     int64
	PortfolioCount int64
}

const vaultCountsQuery = `
SELECT v.id AS vault_id,
	COALESCE(t.cnt, 0) AS trade_count,
	COALESCE(p.cnt, 0) AS portfolio_count
FROM vaults v
LEFT JOIN (SELECT vault_id, COUNT(*) AS cnt FROM trade_histories GROUP BY vault_id) t ON t.vault_id = v.id
LEFT JOIN (SELECT vault_id, COUNT(*) AS cnt FROM portfolios GROUP BY vault_id) p ON p.vault_id = v.id
WHERE v.id IN ?`

func (r *vaultRepo) fetchVaultCounts(db *gorm.DB, ids []uuid.UUID) (map[uuid.UUID]vaultCount, error) {
	result := make(map[uuid.UUID]vaultCount, len(ids))
	if len(ids) == 0 {
		return result, nil
	}

	if db.Migrator().HasTable("portfolio_summary") {
		type psRow struct {
			VaultID        uuid.UUID `gorm:"column:vault_id"`
			TradeCount     int64     `gorm:"column:trade_count"`
			PortfolioCount int64     `gorm:"column:share_holders_count"`
		}
		var rows []psRow
		if err := db.Table("portfolio_summary").
			Select("vault_id, trade_count, share_holders_count").
			Where("vault_id IN ?", ids).
			Scan(&rows).Error; err == nil && len(rows) > 0 {
			for _, row := range rows {
				result[row.VaultID] = vaultCount{
					VaultID:        row.VaultID,
					TradeCount:     row.TradeCount,
					PortfolioCount: row.PortfolioCount,
				}
			}
			if len(result) == len(ids) {
				return result, nil
			}
		}
	}

	var rows []vaultCount
	if err := db.Raw(vaultCountsQuery, ids).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.VaultID] = row
	}
	return result, nil
}

func (r *vaultRepo) fetchBatchSparklines(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID][]domain.HistoryPoint {
	result := make(map[uuid.UUID][]domain.HistoryPoint, len(ids))
	if len(ids) == 0 {
		return result
	}
	for _, id := range ids {
		result[id] = []domain.HistoryPoint{}
	}

	to := time.Now().UTC()
	from := to.AddDate(0, 0, -30)

	type metricRow struct {
		VaultID string          `gorm:"column:vault_id"`
		Bucket  interface{}     `gorm:"column:bucket"`
		Val     decimal.Decimal `gorm:"column:val"`
	}

	if db.Migrator().HasTable("vault_daily_sparkline_mv") {
		var rows []metricRow
		err := db.Table("vault_daily_sparkline_mv").
			Select("vault_id, bucket, val").
			Where("bucket >= ? AND bucket <= ? AND vault_id IN ?", from, to, ids).
			Order("bucket ASC").Scan(&rows).Error
		if err == nil && len(rows) > 0 {
			for _, row := range rows {
				if uid, parseErr := uuid.Parse(row.VaultID); parseErr == nil {
					ts, err := parseHistoryBucketTime(row.Bucket)
					if err == nil {
						result[uid] = append(result[uid], domain.HistoryPoint{
							Date:  ts.UTC().Format(time.RFC3339),
							Value: row.Val,
						})
					}
				}
			}
			return result
		}
	}

	if db.Migrator().HasTable("vault_metrics") {
		var rows []metricRow
		bucketSQL := "DATE_TRUNC('day', timestamp)"
		if db.Dialector != nil && db.Dialector.Name() == "sqlite" {
			bucketSQL = "DATE(timestamp)"
		}
		err := db.Table("vault_metrics").
			Select(fmt.Sprintf("vault_id, %s AS bucket, AVG(value) AS val", bucketSQL)).
			Where("metric = ? AND timestamp >= ? AND timestamp <= ? AND vault_id IN ?", "tvl", from, to, ids).
			Group("vault_id, bucket").Order("bucket ASC").Scan(&rows).Error
		if err == nil && len(rows) > 0 {
			for _, row := range rows {
				if uid, parseErr := uuid.Parse(row.VaultID); parseErr == nil {
					ts, err := parseHistoryBucketTime(row.Bucket)
					if err == nil {
						result[uid] = append(result[uid], domain.HistoryPoint{
							Date:  ts.UTC().Format(time.RFC3339),
							Value: row.Val,
						})
					}
				}
			}
			return result
		}
	}

	priceTable := ""
	if db.Migrator().HasTable("price_histories") {
		priceTable = "price_histories"
	} else if db.Migrator().HasTable("price_history") {
		priceTable = "price_history"
	}
	if priceTable != "" {
		var rows []metricRow
		bucketSQL := "DATE_TRUNC('day', fetched_at)"
		if db.Dialector != nil && db.Dialector.Name() == "sqlite" {
			bucketSQL = "DATE(fetched_at)"
		}
		err := db.Table(priceTable).
			Select(fmt.Sprintf("vault_id, %s AS bucket, AVG(price) AS val", bucketSQL)).
			Where("fetched_at >= ? AND fetched_at <= ? AND vault_id IN ?", from, to, ids).
			Group("vault_id, bucket").Order("bucket ASC").Scan(&rows).Error
		if err == nil && len(rows) > 0 {
			for _, row := range rows {
				if uid, parseErr := uuid.Parse(row.VaultID); parseErr == nil {
					ts, err := parseHistoryBucketTime(row.Bucket)
					if err == nil {
						result[uid] = append(result[uid], domain.HistoryPoint{
							Date:  ts.UTC().Format(time.RFC3339),
							Value: row.Val,
						})
					}
				}
			}
		}
	}

	return result
}

func (r *vaultRepo) UpdateTVL(ctx context.Context, vaultID string, delta decimal.Decimal) error {
	uid, err := uuid.Parse(vaultID)
	if err != nil {
		return err
	}
	db := getDB(ctx, r.db)
	return db.Model(&models.Vault{}).Where("id = ?", uid).
		Update("tvl", gorm.Expr("GREATEST(0, tvl + ?)", delta)).Error
}

func (r *vaultRepo) GetVaultBalances(ctx context.Context, vaultIDOrAddress string) ([]domain.VaultBalance, error) {
	db := getDB(ctx, r.db)
	var v models.Vault
	var err error

	if uid, parseErr := uuid.Parse(vaultIDOrAddress); parseErr == nil {
		err = db.Where("id = ?", uid).First(&v).Error
	} else {
		err = db.Where("address = ?", vaultIDOrAddress).First(&v).Error
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	solMint := "So11111111111111111111111111111111111111112"
	usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	// Fetch latest SOL price from price_histories or price_history if available
	solPrice := decimal.NewFromFloat(150.0)
	var pricePoint struct {
		Price decimal.Decimal
	}
	if db.Migrator().HasTable("price_histories") {
		if err := db.Table("price_histories").
			Select("price").
			Where("token IN ?", []string{"SOL", solMint}).
			Order("fetched_at DESC").
			Limit(1).
			Scan(&pricePoint).Error; err == nil && !pricePoint.Price.IsZero() {
			solPrice = pricePoint.Price
		}
	} else if db.Migrator().HasTable("price_history") {
		if err := db.Table("price_history").
			Select("price").
			Where("token IN ?", []string{"SOL", solMint}).
			Order("fetched_at DESC").
			Limit(1).
			Scan(&pricePoint).Error; err == nil && !pricePoint.Price.IsZero() {
			solPrice = pricePoint.Price
		}
	}

	holdings := make(map[string]decimal.Decimal)
	hasBalancesMV := false

	if db.Migrator().HasTable("vault_balances_summary") {
		type balRow struct {
			Token  string          `gorm:"column:token"`
			Amount decimal.Decimal `gorm:"column:amount"`
		}
		var rows []balRow
		if err := db.Table("vault_balances_summary").Where("vault_id = ?", v.ID).Scan(&rows).Error; err == nil && len(rows) > 0 {
			for _, row := range rows {
				holdings[row.Token] = row.Amount
			}
			hasBalancesMV = true
		}
	}

	var trades []models.TradeHistory
	if !hasBalancesMV {
		// Fetch trades to calculate actual on-chain asset balances if MV not present
		if err := db.Where("vault_id = ?", v.ID).Order("executed_at ASC").Find(&trades).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		for _, t := range trades {
			inTok := t.InputToken
			if inTok == "" {
				inTok = solMint
			}
			outTok := t.OutputToken
			if outTok == "" {
				outTok = solMint
			}

			switch t.TradeType {
			case "Deposit":
				holdings[inTok] = holdings[inTok].Add(t.AmountIn)
			case "Withdraw":
				holdings[outTok] = holdings[outTok].Sub(t.AmountOut)
			case "Buy", "Sell":
				holdings[inTok] = holdings[inTok].Sub(t.AmountIn)
				holdings[outTok] = holdings[outTok].Add(t.AmountOut)
			}
		}
	}

	for k, val := range holdings {
		if val.IsNegative() {
			holdings[k] = decimal.Zero
		}
	}

	solAmt := holdings[solMint]
	if solAmt.IsZero() && holdings["SOL"].IsPositive() {
		solAmt = holdings["SOL"]
	}
	usdcAmt := holdings[usdcMint]
	if usdcAmt.IsZero() && holdings["USDC"].IsPositive() {
		usdcAmt = holdings["USDC"]
	}

	// If no trades exist yet, default 100% of TVL to SOL as base deposit
	if (!hasBalancesMV && len(trades) == 0) || (solAmt.IsZero() && usdcAmt.IsZero()) {
		if !solPrice.IsZero() {
			solAmt = v.TVL.Div(solPrice)
		}
		solUSD := v.TVL
		balances := []domain.VaultBalance{
			{
				Mint:     solMint,
				Symbol:   "SOL",
				Amount:   solAmt,
				USDValue: solUSD,
			},
			{
				Mint:     usdcMint,
				Symbol:   "USDC",
				Amount:   decimal.Zero,
				USDValue: decimal.Zero,
			},
		}
		return balances, nil
	}

	solUSD := solAmt.Mul(solPrice)
	usdcUSD := usdcAmt

	balances := []domain.VaultBalance{
		{
			Mint:     solMint,
			Symbol:   "SOL",
			Amount:   solAmt,
			USDValue: solUSD,
		},
		{
			Mint:     usdcMint,
			Symbol:   "USDC",
			Amount:   usdcAmt,
			USDValue: usdcUSD,
		},
	}

	for tok, amt := range holdings {
		if tok == solMint || tok == "SOL" || tok == usdcMint || tok == "USDC" {
			continue
		}
		if amt.IsPositive() {
			balances = append(balances, domain.VaultBalance{
				Mint:     tok,
				Symbol:   tok,
				Amount:   amt,
				USDValue: amt,
			})
		}
	}

	return balances, nil
}

func vaultToDetail(v *models.Vault) *domain.VaultDetail {
	managerAddress := ""
	if v.Manager.WalletAddress != "" {
		managerAddress = v.Manager.WalletAddress
	}
	return &domain.VaultDetail{
		ID:                v.ID.String(),
		Address:           v.Address,
		ManagerID:         v.ManagerID.String(),
		ManagerAddress:    managerAddress,
		Status:            v.Status,
		Metadata:          v.Metadata,
		PerformanceFeeBps: v.PerformanceFeeBps,
		ManagementFeeBps:  v.ManagementFeeBps,
		MinRaiseAmount:    v.MinRaiseAmount,
		LockupPeriod:      v.LockupPeriod,
		VaultType:         v.VaultType,
		TVL:               v.TVL,
		CreatedAt:         v.CreatedAt,
		UpdatedAt:         v.UpdatedAt,
	}
}
