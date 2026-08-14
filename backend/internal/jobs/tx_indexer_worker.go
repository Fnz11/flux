package jobs

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/models"
	"github.com/flux-protocol/backend/internal/services"
	pkgSolana "github.com/flux-protocol/backend/pkg/solana"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type TxIndexerWorker struct {
	db           *gorm.DB
	vaultRepo    domain.VaultRepository
	userRepo     domain.UserRepository
	client       *pkgSolana.Client
	eventService *services.EventService
	logger       *logrus.Logger
	interval     time.Duration
	stopCh       chan struct{}
	stopOnce     sync.Once
}

func NewTxIndexerWorker(
	db *gorm.DB,
	vaultRepo domain.VaultRepository,
	userRepo domain.UserRepository,
	client *pkgSolana.Client,
	eventService *services.EventService,
	logger *logrus.Logger,
	interval time.Duration,
) *TxIndexerWorker {
	if logger == nil {
		logger = logrus.New()
	}
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &TxIndexerWorker{
		db:           db,
		vaultRepo:    vaultRepo,
		userRepo:     userRepo,
		client:       client,
		eventService: eventService,
		logger:       logger,
		interval:     interval,
		stopCh:       make(chan struct{}),
	}
}

func (w *TxIndexerWorker) Start(ctx context.Context) {
	go w.run(ctx)
}

func (w *TxIndexerWorker) Stop() {
	w.stopOnce.Do(func() {
		close(w.stopCh)
	})
}

func (w *TxIndexerWorker) run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.processPendingDrafts(ctx)
		}
	}
}

func (w *TxIndexerWorker) processPendingDrafts(ctx context.Context) {
	var drafts []models.TransactionDraft
	err := w.db.WithContext(ctx).
		Where("status IN ? AND signature IS NOT NULL", []models.TransactionDraftStatus{
			models.TxDraftStatusSubmitted,
			models.TxDraftStatusPendingSignature,
		}).
		Order("created_at asc").
		Limit(20).
		Find(&drafts).Error

	if err != nil || len(drafts) == 0 {
		return
	}

	for _, draft := range drafts {
		if draft.Signature == nil || *draft.Signature == "" {
			continue
		}
		w.reconcileDraft(ctx, &draft)
	}

	// Mark expired drafts
	w.db.WithContext(ctx).
		Model(&models.TransactionDraft{}).
		Where("status = ? AND expires_at < ? AND (signature IS NULL OR signature = '')", models.TxDraftStatusPendingSignature, time.Now().UTC().Add(-2*time.Minute)).
		Update("status", models.TxDraftStatusExpired)
}

func (w *TxIndexerWorker) reconcileDraft(ctx context.Context, draft *models.TransactionDraft) {
	if w.client == nil {
		return
	}

	txResult, err := w.client.GetTransaction(ctx, *draft.Signature)
	if err != nil || txResult == nil {
		// If tx is older than 5m and still not on-chain, mark failed
		if time.Since(draft.ExpiresAt) > 5*time.Minute {
			w.db.WithContext(ctx).Model(draft).Update("status", models.TxDraftStatusFailed)
		}
		return
	}

	if txResult.Meta != nil && txResult.Meta.Err != nil {
		w.db.WithContext(ctx).Model(draft).Update("status", models.TxDraftStatusFailed)
		return
	}

	// Successfully confirmed on-chain!
	switch draft.TxType {
	case "CREATE_VAULT":
		w.finalizeCreateVault(ctx, draft)
	case "DEPOSIT":
		w.finalizeDeposit(ctx, draft)
	case "WITHDRAW":
		w.finalizeWithdraw(ctx, draft)
	}
}

func (w *TxIndexerWorker) finalizeCreateVault(ctx context.Context, draft *models.TransactionDraft) {
	var meta struct {
		DisplayName       string   `json:"displayName"`
		Description       string   `json:"description"`
		CoverImageUrl     string   `json:"coverImageUrl"`
		FocusAssets       []string `json:"focusAssets"`
		Tags              []string `json:"tags"`
		VaultType         string   `json:"vaultType"`
		MinRaiseAmount    uint64   `json:"minRaiseAmount"`
		PerformanceFeeBps int      `json:"performanceFeeBps"`
		ManagementFeeBps  int      `json:"managementFeeBps"`
		LockupPeriod      int64    `json:"lockupPeriod"`
		ShareTokenMint    string   `json:"shareTokenMint"`
		VaultAddress      string   `json:"vaultAddress"`
	}
	_ = json.Unmarshal(draft.Metadata, &meta)

	if meta.VaultAddress == "" {
		return
	}

	// Find or create manager user
	user, err := w.userRepo.FindOrCreateByWallet(ctx, draft.UserPubkey)
	if err != nil {
		return
	}

	vaultMetadata := map[string]interface{}{
		"displayName":    meta.DisplayName,
		"description":    meta.Description,
		"coverImageUrl":  meta.CoverImageUrl,
		"focusAssets":    meta.FocusAssets,
		"tags":           meta.Tags,
		"shareTokenMint": meta.ShareTokenMint,
	}
	metaJSON, _ := json.Marshal(vaultMetadata)

	minRaiseDec := decimal.NewFromInt(int64(meta.MinRaiseAmount)).Div(decimal.NewFromInt(1e9))

	vaultDetail := &domain.VaultDetail{
		ID:                uuid.New().String(),
		Address:           meta.VaultAddress,
		ManagerID:         user.ID,
		ManagerAddress:    draft.UserPubkey,
		Status:            "Active",
		Metadata:          datatypes.JSON(metaJSON),
		PerformanceFeeBps: meta.PerformanceFeeBps,
		ManagementFeeBps:  meta.ManagementFeeBps,
		MinRaiseAmount:    minRaiseDec,
		LockupPeriod:      meta.LockupPeriod,
		VaultType:         meta.VaultType,
		TVL:               decimal.Zero,
	}

	_ = w.vaultRepo.Create(ctx, vaultDetail)
	w.db.WithContext(ctx).Model(draft).Update("status", models.TxDraftStatusConfirmed)

	if w.eventService != nil {
		w.eventService.DispatchVaultUpdate(meta.VaultAddress)
	}
}

func (w *TxIndexerWorker) finalizeDeposit(ctx context.Context, draft *models.TransactionDraft) {
	var meta struct {
		VaultAddress   string `json:"vaultAddress"`
		AmountLamports uint64 `json:"amountLamports"`
	}
	_ = json.Unmarshal(draft.Metadata, &meta)

	if meta.VaultAddress != "" && meta.AmountLamports > 0 {
		amountDec := decimal.NewFromInt(int64(meta.AmountLamports)).Div(decimal.NewFromInt(1e9))
		_ = w.vaultRepo.UpdateTVL(ctx, meta.VaultAddress, amountDec)
	}

	w.db.WithContext(ctx).Model(draft).Update("status", models.TxDraftStatusConfirmed)

	if w.eventService != nil {
		w.eventService.DispatchVaultUpdate(meta.VaultAddress)
	}
}

func (w *TxIndexerWorker) finalizeWithdraw(ctx context.Context, draft *models.TransactionDraft) {
	var meta struct {
		VaultAddress string `json:"vaultAddress"`
		SharesToBurn uint64 `json:"sharesToBurn"`
	}
	_ = json.Unmarshal(draft.Metadata, &meta)

	w.db.WithContext(ctx).Model(draft).Update("status", models.TxDraftStatusConfirmed)

	if w.eventService != nil {
		w.eventService.DispatchVaultUpdate(meta.VaultAddress)
	}
}
