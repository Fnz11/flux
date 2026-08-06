package middleware

import (
	"errors"
	"testing"

	"github.com/sony/gobreaker"
)

func TestCircuitBreakerMiddleware(t *testing.T) {
	t.Run("NewBreaker_initial_closed_state", func(t *testing.T) {
		cb := NewBreaker("solana-rpc-test")
		if cb.Name() != "solana-rpc-test" {
			t.Errorf("expected breaker name 'solana-rpc-test', got %s", cb.Name())
		}
		if cb.State() != gobreaker.StateClosed {
			t.Errorf("expected initial state Closed, got %v", cb.State())
		}
	})

	t.Run("breaker_trips_to_open_after_5_consecutive_failures", func(t *testing.T) {
		cb := NewBreaker("test-service")

		// Execute 4 failing requests -> state should remain Closed
		for i := 0; i < 4; i++ {
			_, err := cb.Execute(func() (interface{}, error) {
				return nil, errors.New("rpc timeout")
			})
			if err == nil {
				t.Fatalf("expected error from execute")
			}
		}
		if cb.State() != gobreaker.StateClosed {
			t.Errorf("expected state Closed after 4 failures, got %v", cb.State())
		}

		// 5th failure -> state trips to Open
		_, err := cb.Execute(func() (interface{}, error) {
			return nil, errors.New("rpc timeout 5")
		})
		if err == nil {
			t.Fatalf("expected error from 5th execute")
		}
		if cb.State() != gobreaker.StateOpen {
			t.Errorf("expected state Open after 5 consecutive failures, got %v", cb.State())
		}

		// Subsequent call while Open is blocked immediately by gobreaker
		_, err = cb.Execute(func() (interface{}, error) {
			return "should not run", nil
		})
		if !errors.Is(err, gobreaker.ErrOpenState) {
			t.Errorf("expected ErrOpenState when breaker is Open, got %v", err)
		}
	})

	t.Run("success_resets_consecutive_failure_counter", func(t *testing.T) {
		cb := NewBreaker("reset-service")

		// 4 failures
		for i := 0; i < 4; i++ {
			_, _ = cb.Execute(func() (interface{}, error) {
				return nil, errors.New("transient error")
			})
		}
		// 1 success
		_, err := cb.Execute(func() (interface{}, error) {
			return "ok", nil
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// 4 more failures -> still closed because counter was reset
		for i := 0; i < 4; i++ {
			_, _ = cb.Execute(func() (interface{}, error) {
				return nil, errors.New("transient error 2")
			})
		}
		if cb.State() != gobreaker.StateClosed {
			t.Errorf("expected state Closed after counter reset, got %v", cb.State())
		}
	})

	t.Run("RegisterBreaker_and_BreakerStates_snapshot", func(t *testing.T) {
		cb1 := NewBreaker("redis-cluster")
		cb2 := NewBreaker("solana-mainnet")

		RegisterBreaker("redis-cluster", cb1)
		RegisterBreaker("solana-mainnet", cb2)

		states := BreakerStates()
		if states["redis-cluster"] != "closed" {
			t.Errorf("expected redis-cluster state 'closed', got %s", states["redis-cluster"])
		}
		if states["solana-mainnet"] != "closed" {
			t.Errorf("expected solana-mainnet state 'closed', got %s", states["solana-mainnet"])
		}

		// Trip cb1
		for i := 0; i < 5; i++ {
			_, _ = cb1.Execute(func() (interface{}, error) {
				return nil, errors.New("redis error")
			})
		}

		states = BreakerStates()
		if states["redis-cluster"] != "open" {
			t.Errorf("expected redis-cluster state 'open' after trip, got %s", states["redis-cluster"])
		}
		if states["solana-mainnet"] != "closed" {
			t.Errorf("expected solana-mainnet to stay 'closed', got %s", states["solana-mainnet"])
		}
	})
}
