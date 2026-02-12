package storage

import (
	"fmt"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

// StreamStore manages stream directories and metadata
type StreamStore struct {
	store *CentralStore
}

// NewStreamStore creates a new StreamStore
func NewStreamStore(store *CentralStore) *StreamStore {
	return &StreamStore{store: store}
}

// streamDir returns the path to a stream directory
func (s *StreamStore) streamDir(projectName, streamName string) string {
	return filepath.Join(s.store.rootDir, "projects", projectName+"-"+streamName)
}

// CreateStreamDir creates a stream directory and fsyncs parent
func (s *StreamStore) CreateStreamDir(projectName, streamName string) (string, error) {
	streamDir := s.streamDir(projectName, streamName)

	// Check if directory already exists
	if _, err := os.Stat(streamDir); err == nil {
		return "", fmt.Errorf("stream directory already exists: %s", streamDir)
	}

	// Create the directory
	if err := os.MkdirAll(streamDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create stream directory: %w", err)
	}

	// Fsync parent directory
	parentDir := filepath.Dir(streamDir)
	if err := syncDir(parentDir); err != nil {
		return "", fmt.Errorf("failed to sync parent directory: %w", err)
	}

	return streamDir, nil
}

// WriteStreamMeta writes stream metadata using atomic write
func (s *StreamStore) WriteStreamMeta(projectName, streamName string, meta types.StreamMeta) error {
	streamDir := s.streamDir(projectName, streamName)
	metaPath := filepath.Join(streamDir, "stream.json")

	if err := WriteJSON(metaPath, meta); err != nil {
		return fmt.Errorf("failed to write stream.json: %w", err)
	}

	return nil
}

// ReadStreamMeta reads stream metadata
func (s *StreamStore) ReadStreamMeta(projectName, streamName string) (*types.StreamMeta, error) {
	streamDir := s.streamDir(projectName, streamName)
	metaPath := filepath.Join(streamDir, "stream.json")

	var meta types.StreamMeta
	if err := ReadJSON(metaPath, &meta); err != nil {
		return nil, fmt.Errorf("failed to read stream.json: %w", err)
	}

	return &meta, nil
}

// StreamDirExists checks if a stream directory exists
func (s *StreamStore) StreamDirExists(projectName, streamName string) bool {
	streamDir := s.streamDir(projectName, streamName)
	_, err := os.Stat(streamDir)
	return err == nil
}
