package middleware

import (
	"sync"
	"time"

	"github.com/sony/gobreaker"
)

var (
	breakerMu     sync.RWMutex
	breakerStates = make(map[string]*gobreaker.CircuitBreaker)
)

// NewBreaker builds a gobreaker.CircuitBreaker tuned for backend dependencies
// (Solana RPC, Redis, etc.): max 1 in-flight request during the half-open probe,
// trips after 5 consecutive failures within a 10s interval, and opens for 30s
// before probing again.
func NewBreaker(name string) *gobreaker.CircuitBreaker {
	return gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        name,
		MaxRequests: 1,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
	})
}

// RegisterBreaker stores a circuit breaker in the package-level registry.
func RegisterBreaker(name string, cb *gobreaker.CircuitBreaker) {
	breakerMu.Lock()
	defer breakerMu.Unlock()
	breakerStates[name] = cb
}

// BreakerStates returns a snapshot of name -> state ("closed", "open", or
// "half-open") for all registered breakers. It returns an empty map if none
// have been registered.
func BreakerStates() map[string]string {
	breakerMu.RLock()
	defer breakerMu.RUnlock()
	states := make(map[string]string, len(breakerStates))
	for name, cb := range breakerStates {
		states[name] = cb.State().String()
	}
	return states
}
