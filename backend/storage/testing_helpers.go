package storage

import (
	"path/filepath"
	"testing"
)

// resolveDir resolves symlinks in temp directories (macOS compatibility)
func resolveDir(t *testing.T, dir string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil {
		t.Fatalf("Failed to resolve symlinks: %v", err)
	}
	return resolved
}
