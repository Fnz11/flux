package services

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createTestImage(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 100, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func TestLocalStorageService_ProcessAndStore(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "upload-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	svc, err := NewLocalStorageService(tempDir)
	require.NoError(t, err)

	t.Run("Valid image upload and deduplication", func(t *testing.T) {
		imgBytes := createTestImage(100, 100)

		// First upload
		res1, err := svc.ProcessAndStoreVaultCover(bytes.NewReader(imgBytes), 5<<20)
		require.NoError(t, err)
		assert.NotEmpty(t, res1.URL)
		assert.NotEmpty(t, res1.Hash)
		assert.Equal(t, 100, res1.Width)
		assert.Equal(t, 100, res1.Height)

		// Check file exists on disk
		diskPath := filepath.Join(tempDir, res1.URL[len("/uploads/"):])
		_, err = os.Stat(diskPath)
		assert.NoError(t, err)

		// Second upload with same image (Deduplication)
		res2, err := svc.ProcessAndStoreVaultCover(bytes.NewReader(imgBytes), 5<<20)
		require.NoError(t, err)
		assert.Equal(t, res1.Hash, res2.Hash)
		assert.Equal(t, res1.URL, res2.URL)
	})

	t.Run("Reject non-image payload", func(t *testing.T) {
		fakeFile := []byte("<html><script>alert('xss')</script></html>")
		_, err := svc.ProcessAndStoreVaultCover(bytes.NewReader(fakeFile), 5<<20)
		assert.ErrorIs(t, err, ErrInvalidFileType)
	})

	t.Run("Reject file exceeding size limit", func(t *testing.T) {
		imgBytes := createTestImage(200, 200)
		_, err := svc.ProcessAndStoreVaultCover(bytes.NewReader(imgBytes), 50) // only 50 bytes limit
		assert.ErrorIs(t, err, ErrFileTooLarge)
	})
}
