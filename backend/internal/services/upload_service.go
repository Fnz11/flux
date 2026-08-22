package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"

	_ "golang.org/x/image/webp"
)

var (
	ErrFileTooLarge    = errors.New("file exceeds maximum allowed size")
	ErrInvalidFileType = errors.New("invalid or unsupported image type (allowed: jpeg, png, webp)")
	ErrCorruptImage    = errors.New("image data is corrupt or cannot be decoded")
	ErrImageTooLarge   = errors.New("image dimensions exceed maximum allowed limits (max 4096x4096)")
)

type ProcessedImage struct {
	URL       string `json:"url"`
	Hash      string `json:"hash"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	SizeBytes int64  `json:"size_bytes"`
	MimeType  string `json:"mime_type"`
}

type UploadService interface {
	ProcessAndStoreVaultCover(reader io.Reader, maxSizeBytes int64) (*ProcessedImage, error)
}

type LocalStorageService struct {
	baseDir string // e.g. "./uploads"
}

func NewLocalStorageService(baseDir string) (*LocalStorageService, error) {
	if baseDir == "" {
		baseDir = "./uploads"
	}
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload base directory: %w", err)
	}
	return &LocalStorageService{baseDir: baseDir}, nil
}

func (s *LocalStorageService) ProcessAndStoreVaultCover(reader io.Reader, maxSizeBytes int64) (*ProcessedImage, error) {
	if maxSizeBytes <= 0 {
		maxSizeBytes = 5 << 20 // Default 5MB
	}

	// 1. Read bounded stream into buffer (prevents memory exhaustion)
	limitedReader := io.LimitReader(reader, maxSizeBytes+1)
	buf := &bytes.Buffer{}
	n, err := io.Copy(buf, limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed reading upload stream: %w", err)
	}
	if n > maxSizeBytes {
		return nil, ErrFileTooLarge
	}
	if n == 0 {
		return nil, errors.New("empty upload payload")
	}

	rawBytes := buf.Bytes()

	// 2. MIME type verification via magic numbers / content sniffing
	detectedType := http.DetectContentType(rawBytes)
	switch detectedType {
	case "image/jpeg", "image/png", "image/webp":
		// Allowed types
	default:
		return nil, ErrInvalidFileType
	}

	// 3. Decode image config to check bounds before full decode (Zip-bomb guard)
	cfg, _, err := image.DecodeConfig(bytes.NewReader(rawBytes))
	if err != nil {
		return nil, ErrCorruptImage
	}
	if cfg.Width > 4096 || cfg.Height > 4096 || (cfg.Width*cfg.Height > 16_000_000) {
		return nil, ErrImageTooLarge
	}

	// 4. Decode full image into memory (strips EXIF, scripts, comments & non-pixel payloads)
	img, _, err := image.Decode(bytes.NewReader(rawBytes))
	if err != nil {
		return nil, ErrCorruptImage
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 5. Re-encode into sanitized, optimized standard format
	var processedBuf bytes.Buffer
	err = jpeg.Encode(&processedBuf, img, &jpeg.Options{Quality: 85})
	if err != nil {
		processedBuf.Reset()
		if err := png.Encode(&processedBuf, img); err != nil {
			return nil, fmt.Errorf("failed to re-encode image: %w", err)
		}
	}

	finalBytes := processedBuf.Bytes()

	// 6. Content Addressable Storage (CAS) Hash (SHA-256 for perfect deduplication)
	hasher := sha256.New()
	hasher.Write(finalBytes)
	hashHex := hex.EncodeToString(hasher.Sum(nil))

	// 7. Directory sharding: uploads/vaults/{hash[0:2]}/{hash[2:4]}/{hash}.jpg
	shard1 := hashHex[0:2]
	shard2 := hashHex[2:4]
	fileName := fmt.Sprintf("%s.jpg", hashHex)

	relDir := filepath.Join("vaults", shard1, shard2)
	fullDir := filepath.Join(s.baseDir, relDir)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directories: %w", err)
	}

	targetFilePath := filepath.Join(fullDir, fileName)
	relURL := fmt.Sprintf("/uploads/vaults/%s/%s/%s", shard1, shard2, fileName)

	// 8. Deduplication check: if file exists already, skip disk write
	if _, err := os.Stat(targetFilePath); err == nil {
		return &ProcessedImage{
			URL:       relURL,
			Hash:      hashHex,
			Width:     width,
			Height:    height,
			SizeBytes: int64(len(finalBytes)),
			MimeType:  "image/jpeg",
		}, nil
	}

	// 9. Atomic File Write (Write to temp file in same directory first, then Rename)
	tempFile, err := os.CreateTemp(fullDir, "upload-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary upload file: %w", err)
	}
	tempPath := tempFile.Name()

	if _, err := tempFile.Write(finalBytes); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return nil, fmt.Errorf("failed to write upload file: %w", err)
	}
	if err := tempFile.Sync(); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return nil, fmt.Errorf("failed to sync upload file: %w", err)
	}
	tempFile.Close()

	if err := os.Rename(tempPath, targetFilePath); err != nil {
		os.Remove(tempPath)
		return nil, fmt.Errorf("failed to atomically commit upload file: %w", err)
	}

	return &ProcessedImage{
		URL:       relURL,
		Hash:      hashHex,
		Width:     width,
		Height:    height,
		SizeBytes: int64(len(finalBytes)),
		MimeType:  "image/jpeg",
	}, nil
}
