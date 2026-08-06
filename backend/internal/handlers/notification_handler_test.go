package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/fbyt-clone/backend/internal/domain"
	"github.com/fbyt-clone/backend/internal/models"
	"github.com/fbyt-clone/backend/internal/services"
	"github.com/fbyt-clone/backend/internal/ws"
	"github.com/gin-gonic/gin"
)

type fakeNotificationRepo struct {
	notifications []domain.Notification
}

func (f *fakeNotificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	n.ID = "notif-" + n.Type
	f.notifications = append(f.notifications, *n)
	return nil
}

func (f *fakeNotificationRepo) List(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]domain.Notification, int64, error) {
	var res []domain.Notification
	for _, n := range f.notifications {
		if n.UserID != userID {
			continue
		}
		if unreadOnly && n.ReadAt != nil {
			continue
		}
		res = append(res, n)
	}
	return res, int64(len(res)), nil
}

func (f *fakeNotificationRepo) CountUnread(ctx context.Context, userID string) (int64, error) {
	var count int64
	for _, n := range f.notifications {
		if n.UserID == userID && n.ReadAt == nil {
			count++
		}
	}
	return count, nil
}

func (f *fakeNotificationRepo) MarkAllRead(ctx context.Context, userID string) error {
	now := time.Now()
	for i := range f.notifications {
		if f.notifications[i].UserID == userID && f.notifications[i].ReadAt == nil {
			f.notifications[i].ReadAt = &now
		}
	}
	return nil
}

func newNotificationHandler(repo *fakeNotificationRepo, svc *services.NotificationService) *NotificationHandler {
	users := newMockUserRepo()
	users.users["wallet_123"] = &domain.UserDetail{ID: "user-uuid-123", WalletAddress: "wallet_123"}
	return NewNotificationHandler(repo, users, svc)
}

func TestNotificationHandler_List(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("List_Unauthorized", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		h := newNotificationHandler(repo, services.NewNotificationService(repo, nil))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/notifications", nil)

		h.List(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("List_PaginatedWithUnreadCount", func(t *testing.T) {
		repo := &fakeNotificationRepo{
			notifications: []domain.Notification{
				{ID: "n1", UserID: "user-uuid-123", Type: "trade", Title: "Trade", Message: "m1"},
				{ID: "n2", UserID: "user-uuid-123", Type: "vault", Title: "Vault", Message: "m2"},
			},
		}
		users := newMockUserRepo()
		users.users["wallet_123"] = &domain.UserDetail{ID: "user-uuid-123", WalletAddress: "wallet_123"}
		h := NewNotificationHandler(repo, users, services.NewNotificationService(repo, nil))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", "wallet_123")
		c.Request = httptest.NewRequest("GET", "/api/v1/notifications?page=1&limit=20", nil)

		h.List(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				Items  []models.NotificationResponse `json:"items"`
				Total  int                           `json:"total"`
				Page   int                           `json:"page"`
				Limit  int                           `json:"limit"`
				Unread int                           `json:"unread"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if len(resp.Data.Items) != 2 || resp.Data.Total != 2 || resp.Data.Unread != 2 {
			t.Fatalf("unexpected list payload: %+v", resp.Data)
		}
	})

	t.Run("List_UnreadOnlyFilter", func(t *testing.T) {
		now := time.Now()
		repo := &fakeNotificationRepo{
			notifications: []domain.Notification{
				{ID: "n1", UserID: "user-uuid-123", Title: "unread1"},
				{ID: "n2", UserID: "user-uuid-123", Title: "read1", ReadAt: &now},
			},
		}
		users := newMockUserRepo()
		users.users["wallet_123"] = &domain.UserDetail{ID: "user-uuid-123", WalletAddress: "wallet_123"}
		h := NewNotificationHandler(repo, users, services.NewNotificationService(repo, nil))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", "wallet_123")
		c.Request = httptest.NewRequest("GET", "/api/v1/notifications?unread=true", nil)

		h.List(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var resp struct {
			Data struct {
				Items []struct {
					ID    string `json:"id"`
					Title string `json:"title"`
				} `json:"items"`
				Unread int `json:"unread"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if len(resp.Data.Items) != 1 || resp.Data.Items[0].ID != "n1" || resp.Data.Unread != 1 {
			t.Fatalf("expected only unread item, got %+v", resp.Data)
		}
	})
}

func TestNotificationHandler_MarkAllRead(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("MarkAllRead_Unauthorized", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		h := newNotificationHandler(repo, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/notifications/read", nil)

		h.MarkAllRead(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("MarkAllRead_Success", func(t *testing.T) {
		repo := &fakeNotificationRepo{
			notifications: []domain.Notification{
				{ID: "n1", UserID: "user-uuid-123"},
				{ID: "n2", UserID: "user-uuid-123"},
			},
		}
		users := newMockUserRepo()
		users.users["wallet_123"] = &domain.UserDetail{ID: "user-uuid-123", WalletAddress: "wallet_123"}
		h := NewNotificationHandler(repo, users, services.NewNotificationService(repo, nil))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", "wallet_123")
		c.Request = httptest.NewRequest("POST", "/api/v1/notifications/read", nil)

		h.MarkAllRead(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}
		for _, n := range repo.notifications {
			if n.ReadAt == nil {
				t.Fatalf("expected notification %s to be marked read", n.ID)
			}
		}
	})
}

func TestNotificationHandler_Create(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Create_Unauthorized", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		h := newNotificationHandler(repo, services.NewNotificationService(repo, nil))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/api/v1/notifications", nil)

		h.Create(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("Create_Success", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		users := newMockUserRepo()
		users.users["wallet_123"] = &domain.UserDetail{ID: "user-uuid-123", WalletAddress: "wallet_123"}
		h := NewNotificationHandler(repo, users, services.NewNotificationService(repo, nil))

		body := map[string]string{"type": "trade", "title": "Trade", "message": "filled"}
		b, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("wallet_address", "wallet_123")
		c.Request = httptest.NewRequest("POST", "/api/v1/notifications", bytes.NewReader(b))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Create(c)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d, body: %s", w.Code, w.Body.String())
		}
		if len(repo.notifications) != 1 {
			t.Fatalf("expected 1 notification created, got %d", len(repo.notifications))
		}
		if repo.notifications[0].UserID != "user-uuid-123" {
			t.Fatalf("expected notification for user-uuid-123, got %s", repo.notifications[0].UserID)
		}
	})
}

func TestNotificationService_Create_PushesToHub(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Create_WithRealHubDoesNotPanic", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		hub := ws.NewHub()
		svc := services.NewNotificationService(repo, hub)

		if err := svc.Create(context.Background(), "user-uuid-123", "wallet_123", "trade", "T", "M"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(repo.notifications) != 1 {
			t.Fatalf("expected notification persisted, got %d", len(repo.notifications))
		}
	})

	t.Run("with_NilHubStillPersists", func(t *testing.T) {
		repo := &fakeNotificationRepo{}
		svc := services.NewNotificationService(repo, nil)

		if err := svc.Create(context.Background(), "user-uuid-123", "wallet_123", "vault", "V", "Msg"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(repo.notifications) != 1 {
			t.Fatalf("expected notification persisted, got %d", len(repo.notifications))
		}
	})
}
