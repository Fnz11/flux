package handlers

import (
	"net/http"
	"strconv"

	"github.com/flux-protocol/backend/internal/domain"
	"github.com/flux-protocol/backend/internal/middleware"
	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	notificationRepo domain.NotificationRepository
	userRepo         domain.UserRepository
	svc              *services.NotificationService
}

func NewNotificationHandler(notificationRepo domain.NotificationRepository, userRepo domain.UserRepository, svc *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationRepo: notificationRepo,
		userRepo:         userRepo,
		svc:              svc,
	}
}

func (h *NotificationHandler) List(c *gin.Context) {
	wallet := middleware.GetWalletAddress(c)
	if wallet == "" {
		ErrorResponse(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.userRepo.FindOrCreateByWallet(c.Request.Context(), wallet)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to resolve user")
		return
	}

	unreadOnly := c.Query("unread") == "true"
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		page = 10000
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	items, total, unread, err := h.svc.List(c.Request.Context(), user.ID, unreadOnly, page, limit)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to fetch notifications")
		return
	}

	SuccessResponse(c, gin.H{
		"items":  items,
		"total":  total,
		"page":   page,
		"limit":  limit,
		"unread": unread,
	})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	wallet := middleware.GetWalletAddress(c)
	if wallet == "" {
		ErrorResponse(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.userRepo.FindOrCreateByWallet(c.Request.Context(), wallet)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to resolve user")
		return
	}

	if err := h.notificationRepo.MarkAllRead(c.Request.Context(), user.ID); err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to mark notifications read")
		return
	}

	SuccessResponse(c, gin.H{"updated": true})
}

type CreateNotificationRequest struct {
	Type    string `json:"type"`
	Title   string `json:"title"`
	Message string `json:"message"`
}

func (h *NotificationHandler) Create(c *gin.Context) {
	wallet := middleware.GetWalletAddress(c)
	if wallet == "" {
		ErrorResponse(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.userRepo.FindOrCreateByWallet(c.Request.Context(), wallet)
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to resolve user")
		return
	}

	var req CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.svc.Create(c.Request.Context(), user.ID, wallet, req.Type, req.Title, req.Message); err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to create notification")
		return
	}

	SuccessResponse(c, gin.H{"created": true})
}
