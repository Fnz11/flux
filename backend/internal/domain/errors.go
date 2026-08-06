package domain

import "errors"

var (
	ErrNotFound     = errors.New("resource not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
	ErrConflict     = errors.New("resource already exists")

	// ErrAlreadySynced is returned when a transaction signature is replayed.
	// Handlers match it with errors.Is to avoid fragile string comparison.
	ErrAlreadySynced = errors.New("already_synced")
)
