package services

import (
	"testing"
	"time"
)

func TestVaultService_Stop(t *testing.T) {
	vs := NewVaultService(nil)
	if vs == nil {
		t.Fatal("expected non-nil VaultService")
	}

	// Ensure Stop() finishes cleanupLoop without blocking or panicking
	done := make(chan struct{})
	go func() {
		vs.Stop()
		// Calling Stop again should be safe (idempotent)
		vs.Stop()
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(2 * time.Second):
		t.Fatal("VaultService.Stop() timed out")
	}
}
