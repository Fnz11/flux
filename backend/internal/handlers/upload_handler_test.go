package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/flux-protocol/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockUploadService struct {
	processFn func(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error)
}

func (m *mockUploadService) ProcessAndStoreVaultCover(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error) {
	if m.processFn != nil {
		return m.processFn(reader, maxSizeBytes)
	}
	return &services.ProcessedImage{
		URL:       "/uploads/vaults/ab/cd/abcdef123456.jpg",
		Hash:      "abcdef123456",
		Width:     800,
		Height:    600,
		SizeBytes: 12345,
		MimeType:  "image/jpeg",
	}, nil
}

func TestUploadHandler_UploadVaultCover(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Successful upload with mock service", func(t *testing.T) {
		mockSvc := &mockUploadService{}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "cover.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("fake-image-bytes"))
		require.NoError(t, err)
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var resp map[string]interface{}
		err = json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp["success"].(bool))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "/uploads/vaults/ab/cd/abcdef123456.jpg", data["url"])
		assert.Equal(t, "abcdef123456", data["hash"])
		assert.Equal(t, float64(800), data["width"])
	})

	t.Run("Missing file field in form", func(t *testing.T) {
		mockSvc := &mockUploadService{}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("File exceeds size limit error from service", func(t *testing.T) {
		mockSvc := &mockUploadService{
			processFn: func(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error) {
				return nil, services.ErrFileTooLarge
			},
		}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("file", "cover.png")
		part.Write([]byte("fake-image-bytes"))
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	})

	t.Run("Invalid file type error from service", func(t *testing.T) {
		mockSvc := &mockUploadService{
			processFn: func(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error) {
				return nil, services.ErrInvalidFileType
			},
		}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("file", "cover.txt")
		part.Write([]byte("not an image"))
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("Corrupt image error from service", func(t *testing.T) {
		mockSvc := &mockUploadService{
			processFn: func(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error) {
				return nil, services.ErrCorruptImage
			},
		}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("file", "corrupt.png")
		part.Write([]byte("corrupt-data"))
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("Internal server error from service", func(t *testing.T) {
		mockSvc := &mockUploadService{
			processFn: func(reader io.Reader, maxSizeBytes int64) (*services.ProcessedImage, error) {
				return nil, errors.New("disk full")
			},
		}
		handler := NewUploadHandler(mockSvc, 5<<20)

		r := gin.New()
		r.POST("/api/v1/upload/vault-cover", handler.UploadVaultCover)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("file", "cover.png")
		part.Write([]byte("image"))
		writer.Close()

		req := httptest.NewRequest(http.MethodPost, "/api/v1/upload/vault-cover", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})
}
