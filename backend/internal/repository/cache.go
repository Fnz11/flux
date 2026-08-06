package repository

import "github.com/flux-protocol/backend/internal/cache"

// Cache is the real internal/cache.Cache interface (agent 6). Repository
// decorators consume it so read/write paths share the same key contract.
type Cache = cache.Cache
