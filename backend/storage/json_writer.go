package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// WriteJSON atomically writes JSON data to a file using write-to-tmp-then-rename pattern.
// This ensures that a crash at any point leaves either the old or new file intact -- never corrupt.
//
// Process:
// 1. Marshal data to pretty-printed JSON (2-space indent)
// 2. Write to path.tmp
// 3. fsync to ensure data reaches disk
// 4. Rename path.tmp → path (atomic on POSIX)
func WriteJSON(path string, data any) error {
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal JSON: %w", err)
	}
	content = append(content, '\n') // trailing newline

	tmp := path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	defer func() {
		// Clean up tmp on failure
		if f != nil {
			f.Close()
			os.Remove(tmp)
		}
	}()

	if _, err := f.Write(content); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := f.Sync(); err != nil {
		return fmt.Errorf("fsync temp file: %w", err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}
	f = nil // prevent deferred cleanup

	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename temp to target: %w", err)
	}
	return nil
}

// ReadJSON reads and unmarshals JSON data from a file.
// Returns error if file doesn't exist or contains invalid JSON.
// Callers should check os.IsNotExist(err) and handle corruption with fallback to defaults.
func ReadJSON(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err // caller handles os.IsNotExist
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("corrupt JSON in %s: %w", filepath.Base(path), err)
	}
	return nil
}
