package handlers

import (
	"errors"
	"net/http"

	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	uploadService services.UploadService
	maxSizeBytes  int64
}

func NewUploadHandler(uploadService services.UploadService, maxSizeBytes int64) *UploadHandler {
	if maxSizeBytes <= 0 {
		maxSizeBytes = 5 << 20 // 5MB default
	}
	return &UploadHandler{
		uploadService: uploadService,
		maxSizeBytes:  maxSizeBytes,
	}
}

func (h *UploadHandler) UploadVaultCover(c *gin.Context) {
	// Guard against payload larger than max size at HTTP stream level
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxSizeBytes)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		ErrorResponse(c, http.StatusBadRequest, "Invalid upload form: 'file' field is required")
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		ErrorResponse(c, http.StatusInternalServerError, "Failed to open uploaded file")
		return
	}
	defer file.Close()

	processed, err := h.uploadService.ProcessAndStoreVaultCover(file, h.maxSizeBytes)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrFileTooLarge):
			ErrorResponse(c, http.StatusRequestEntityTooLarge, "File size exceeds 5MB limit")
		case errors.Is(err, services.ErrInvalidFileType):
			ErrorResponse(c, http.StatusBadRequest, "Unsupported image type. Only JPEG, PNG, and WebP are allowed")
		case errors.Is(err, services.ErrImageTooLarge):
			ErrorResponse(c, http.StatusBadRequest, "Image dimensions exceed 4096x4096 limit")
		case errors.Is(err, services.ErrCorruptImage):
			ErrorResponse(c, http.StatusBadRequest, "Corrupt or unreadable image file")
		default:
			ErrorResponse(c, http.StatusInternalServerError, "Failed to process image")
		}
		return
	}

	SuccessResponse(c, processed)
}
