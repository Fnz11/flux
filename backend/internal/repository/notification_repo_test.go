package repository

import (
	"context"
	"testing"
	"time"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupNotificationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect sqlite memory db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	_ = db.Exec(`CREATE TABLE notifications (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		type TEXT NOT NULL,
		title TEXT NOT NULL,
		message TEXT NOT NULL DEFAULT '',
		read_at DATETIME,
		created_at DATETIME,
		updated_at DATETIME
	)`)

	return db
}

func TestNotificationRepository_Create_List(t *testing.T) {
	db := setupNotificationTestDB(t)
	repo := NewNotificationRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	otherUserID := uuid.New()
	now := time.Now()

	seed := []*domain.Notification{
		{UserID: userID.String(), Type: "TRADE", Title: "Trade executed", Message: "Buy 10 SOL", CreatedAt: now.Add(-3 * time.Hour), UpdatedAt: now.Add(-3 * time.Hour)},
		{UserID: userID.String(), Type: "VAULT", Title: "Vault updated", Message: "TVL changed", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{UserID: otherUserID.String(), Type: "TRADE", Title: "Other user", Message: "ignored", CreatedAt: now, UpdatedAt: now},
	}

	for _, n := range seed {
		if err := repo.Create(ctx, n); err != nil {
			t.Fatalf("failed to seed notification: %v", err)
		}
	}

	t.Run("List_Paginated", func(t *testing.T) {
		list, total, err := repo.List(ctx, userID.String(), false, 1, 2)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 2 {
			t.Errorf("expected total 2, got %d", total)
		}
		if len(list) != 2 {
			t.Fatalf("expected 2 items, got %d", len(list))
		}
		// ordered created_at DESC
		if list[0].Type != "VAULT" {
			t.Errorf("expected newest (VAULT) first, got %s", list[0].Type)
		}
	})

	t.Run("Create_PopulatesID", func(t *testing.T) {
		n := &domain.Notification{
			UserID:  userID.String(),
			Type:    "VAULT",
			Title:   "New vault",
			Message: "A vault was created",
		}
		if err := repo.Create(ctx, n); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if n.ID == "" {
			t.Errorf("expected notification ID to be populated")
		}
	})
}

func TestNotificationRepository_List_UnreadOnly(t *testing.T) {
	db := setupNotificationTestDB(t)
	repo := NewNotificationRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	now := time.Now()

	readAt := now.Add(-1 * time.Hour)
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "Read one", Message: "x", ReadAt: &readAt, CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "Unread one", Message: "x", CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now.Add(-1 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "Unread two", Message: "x", CreatedAt: now, UpdatedAt: now})

	t.Run("UnreadOnly_Filters", func(t *testing.T) {
		list, total, err := repo.List(ctx, userID.String(), true, 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 2 {
			t.Errorf("expected total 2, got %d", total)
		}
		if len(list) != 2 {
			t.Fatalf("expected 2 items, got %d", len(list))
		}
		for _, n := range list {
			if n.ReadAt != nil {
				t.Errorf("expected only unread items, got read item %s", n.Title)
			}
		}
	})

	t.Run("All_Unfiltered", func(t *testing.T) {
		_, total, err := repo.List(ctx, userID.String(), false, 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 3 {
			t.Errorf("expected total 3, got %d", total)
		}
	})

	t.Run("Empty_ForUnknownUser", func(t *testing.T) {
		list, total, err := repo.List(ctx, uuid.New().String(), false, 1, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total != 0 || len(list) != 0 {
			t.Errorf("expected empty list and zero total, got len=%d total=%d", len(list), total)
		}
	})

	t.Run("InvalidUserID", func(t *testing.T) {
		if _, _, err := repo.List(ctx, "not-a-uuid", false, 1, 10); err == nil {
			t.Errorf("expected error for invalid user id")
		}
	})
}

func TestNotificationRepository_CountUnread(t *testing.T) {
	db := setupNotificationTestDB(t)
	repo := NewNotificationRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	otherUserID := uuid.New()
	now := time.Now()

	readAt := now.Add(-1 * time.Hour)
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "read", Message: "x", ReadAt: &readAt, CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "unread a", Message: "x", CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now.Add(-1 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "unread b", Message: "x", CreatedAt: now, UpdatedAt: now})
	_ = repo.Create(ctx, &domain.Notification{UserID: otherUserID.String(), Type: "TRADE", Title: "other", Message: "x", CreatedAt: now, UpdatedAt: now})

	t.Run("CountUnread_HappyPath", func(t *testing.T) {
		count, err := repo.CountUnread(ctx, userID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count != 2 {
			t.Errorf("expected unread count 2, got %d", count)
		}
	})

	t.Run("CountUnread_Zero", func(t *testing.T) {
		count, err := repo.CountUnread(ctx, uuid.New().String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count != 0 {
			t.Errorf("expected zero unread, got %d", count)
		}
	})
}

func TestNotificationRepository_MarkAllRead(t *testing.T) {
	db := setupNotificationTestDB(t)
	repo := NewNotificationRepository(db)
	ctx := context.Background()

	userID := uuid.New()
	otherUserID := uuid.New()
	now := time.Now()

	readAt := now.Add(-1 * time.Hour)
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "already read", Message: "x", ReadAt: &readAt, CreatedAt: now.Add(-3 * time.Hour), UpdatedAt: now.Add(-3 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "TRADE", Title: "unread a", Message: "x", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: userID.String(), Type: "VAULT", Title: "unread b", Message: "x", CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now.Add(-1 * time.Hour)})
	_ = repo.Create(ctx, &domain.Notification{UserID: otherUserID.String(), Type: "TRADE", Title: "other user unread", Message: "x", CreatedAt: now, UpdatedAt: now})

	t.Run("MarkAllRead_OnlyOwnedUnread", func(t *testing.T) {
		if err := repo.MarkAllRead(ctx, userID.String()); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		count, err := repo.CountUnread(ctx, userID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count != 0 {
			t.Errorf("expected 0 unread after mark all read, got %d", count)
		}

		otherCount, err := repo.CountUnread(ctx, otherUserID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if otherCount != 1 {
			t.Errorf("expected other user's unread untouched (1), got %d", otherCount)
		}
	})
}