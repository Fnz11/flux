package cache

import "golang.org/x/sync/singleflight"

// Group wraps golang.org/x/sync/singleflight.Group so the repository layer can
// collapse concurrent cache misses for the same key into a single database
// read (thundering-herd / stampede protection, audit 1.3.3).
type Group struct {
	sf singleflight.Group
}

// NewGroup returns an empty Group ready for use.
func NewGroup() *Group {
	return &Group{}
}

// Do executes fn once for all callers sharing the same key; every caller of
// that flight receives the same value and error.
func (g *Group) Do(key string, fn func() (any, error)) (any, error) {
	v, err, _ := g.sf.Do(key, fn)
	return v, err
}