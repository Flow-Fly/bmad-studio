package storage

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

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

// archivedStreamDir returns the path to an archived stream directory
func (s *StreamStore) archivedStreamDir(projectName, streamName string) string {
	return filepath.Join(s.store.rootDir, "projects", "archive", projectName+"-"+streamName)
}

// ReadArchivedStreamMeta reads archived stream metadata
func (s *StreamStore) ReadArchivedStreamMeta(projectName, streamName string) (*types.StreamMeta, error) {
	archiveDir := s.archivedStreamDir(projectName, streamName)
	metaPath := filepath.Join(archiveDir, "stream.json")
	streamID := projectName + "-" + streamName

	var meta types.StreamMeta
	if err := ReadJSON(metaPath, &meta); err != nil {
		return nil, fmt.Errorf("failed to read archived stream.json for %s: %w", streamID, err)
	}

	return &meta, nil
}

// CreateStreamDir creates a stream directory and fsyncs parent
func (s *StreamStore) CreateStreamDir(projectName, streamName string) (string, error) {
	streamDir := s.streamDir(projectName, streamName)
	streamID := projectName + "-" + streamName

	// Check if directory already exists
	if _, err := os.Stat(streamDir); err == nil {
		return "", fmt.Errorf("stream %s already exists: %s", streamID, streamDir)
	}

	// Create the directory
	if err := os.MkdirAll(streamDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create stream directory for %s: %w", streamID, err)
	}

	// Fsync parent directory
	parentDir := filepath.Dir(streamDir)
	if err := syncDir(parentDir); err != nil {
		return "", fmt.Errorf("failed to sync parent directory for stream %s: %w", streamID, err)
	}

	return streamDir, nil
}

// WriteStreamMeta writes stream metadata using atomic write
func (s *StreamStore) WriteStreamMeta(projectName, streamName string, meta types.StreamMeta) error {
	streamDir := s.streamDir(projectName, streamName)
	metaPath := filepath.Join(streamDir, "stream.json")
	streamID := projectName + "-" + streamName

	if err := WriteJSON(metaPath, meta); err != nil {
		return fmt.Errorf("failed to write stream.json for %s: %w", streamID, err)
	}

	return nil
}

// ReadStreamMeta reads stream metadata
func (s *StreamStore) ReadStreamMeta(projectName, streamName string) (*types.StreamMeta, error) {
	streamDir := s.streamDir(projectName, streamName)
	metaPath := filepath.Join(streamDir, "stream.json")
	streamID := projectName + "-" + streamName

	var meta types.StreamMeta
	if err := ReadJSON(metaPath, &meta); err != nil {
		return nil, fmt.Errorf("failed to read stream.json for %s: %w", streamID, err)
	}

	return &meta, nil
}

// StreamDirExists checks if a stream directory exists
func (s *StreamStore) StreamDirExists(projectName, streamName string) bool {
	streamDir := s.streamDir(projectName, streamName)
	_, err := os.Stat(streamDir)
	return err == nil
}

// ArchiveStream moves a stream directory to archive/ and updates its metadata
func (s *StreamStore) ArchiveStream(projectName, streamName string, outcome types.StreamOutcome) error {
	streamID := projectName + "-" + streamName
	srcDir := s.streamDir(projectName, streamName)

	// Verify stream exists
	if _, err := os.Stat(srcDir); os.IsNotExist(err) {
		return fmt.Errorf("stream not found: %s", streamID)
	}

	// Read existing metadata
	meta, err := s.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return fmt.Errorf("failed to read stream metadata for %s: %w", streamID, err)
	}

	// Check if already archived
	if meta.Status == types.StreamStatusArchived {
		return fmt.Errorf("stream already archived: %s", streamID)
	}

	// Create archive directory if it doesn't exist
	archiveDir := filepath.Join(s.store.rootDir, "projects", "archive")
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return fmt.Errorf("failed to create archive directory: %w", err)
	}
	if err := syncDir(archiveDir); err != nil {
		return fmt.Errorf("failed to sync archive directory: %w", err)
	}

	// Update metadata
	meta.Status = types.StreamStatusArchived
	meta.Outcome = outcome
	meta.UpdatedAt = fmt.Sprintf("%s", time.Now().UTC().Format(time.RFC3339))

	// Write updated metadata to source directory (before move)
	if err := s.WriteStreamMeta(projectName, streamName, *meta); err != nil {
		return fmt.Errorf("failed to update stream metadata for %s: %w", streamID, err)
	}

	// Move directory to archive
	destDir := filepath.Join(archiveDir, projectName+"-"+streamName)
	if err := os.Rename(srcDir, destDir); err != nil {
		return fmt.Errorf("failed to move stream directory for %s: %w", streamID, err)
	}

	// Fsync archive parent directory
	if err := syncDir(archiveDir); err != nil {
		return fmt.Errorf("failed to sync archive directory after move: %w", err)
	}

	return nil
}

// ListProjectStreams scans all stream directories for a project and returns metadata sorted by UpdatedAt descending
func (s *StreamStore) ListProjectStreams(projectName string) ([]*types.StreamMeta, error) {
	projectsDir := filepath.Join(s.store.rootDir, "projects")
	prefix := projectName + "-"

	// Read all directories in projects/
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		// If projects directory doesn't exist, return empty list
		if os.IsNotExist(err) {
			return []*types.StreamMeta{}, nil
		}
		return nil, fmt.Errorf("failed to read projects directory: %w", err)
	}

	streams := make([]*types.StreamMeta, 0)

	// Scan for matching stream directories
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirName := entry.Name()
		// Check if directory name starts with projectName-
		if !strings.HasPrefix(dirName, prefix) {
			continue
		}

		// Extract stream name (everything after projectName-)
		streamName := strings.TrimPrefix(dirName, prefix)
		if streamName == "" {
			continue
		}

		// Read stream metadata
		meta, err := s.ReadStreamMeta(projectName, streamName)
		if err != nil {
			// Log warning and skip corrupted stream (NFR13 resilience)
			log.Printf("WARNING: Skipping corrupted stream %s-%s: %v", projectName, streamName, err)
			continue
		}

		streams = append(streams, meta)
	}

	// Sort by UpdatedAt descending (most recent first)
	sort.Slice(streams, func(i, j int) bool {
		return streams[i].UpdatedAt > streams[j].UpdatedAt
	})

	return streams, nil
}
