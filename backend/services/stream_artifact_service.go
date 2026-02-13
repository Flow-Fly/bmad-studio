package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

// metadataExclusions lists files to exclude from artifact listings.
var metadataExclusions = map[string]bool{
	"stream.json": true,
}

// StreamArtifactService provides artifact listing and content reading for streams.
type StreamArtifactService struct {
	streamStore *storage.StreamStore
}

// NewStreamArtifactService creates a new StreamArtifactService.
func NewStreamArtifactService(streamStore *storage.StreamStore) *StreamArtifactService {
	return &StreamArtifactService{streamStore: streamStore}
}

// ListArtifacts returns all artifacts in the given stream directory, excluding
// metadata files. Directories are listed first, then files, alphabetically within each group.
func (s *StreamArtifactService) ListArtifacts(projectName, streamName string) ([]types.StreamArtifactInfo, error) {
	streamDir := s.streamStore.StreamDir(projectName, streamName)

	entries, err := os.ReadDir(streamDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
		}
		return nil, fmt.Errorf("failed to read stream directory: %w", err)
	}

	var artifacts []types.StreamArtifactInfo

	for _, entry := range entries {
		name := entry.Name()

		if isExcluded(name) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue // skip entries we can't stat
		}

		entryType := "file"
		if entry.IsDir() {
			entryType = "directory"
		}

		// For directories, append "/" to match DerivePhase patterns like "epics/"
		phaseName := name
		if entry.IsDir() {
			phaseName = name + "/"
		}
		phase := DerivePhase(phaseName)

		artifact := types.StreamArtifactInfo{
			Filename:   name,
			Phase:      phase,
			Type:       entryType,
			ModifiedAt: info.ModTime().UTC(),
			Size:       info.Size(),
		}

		if entry.IsDir() {
			artifact.Size = 0 // directories report 0 size per spec
		}

		artifacts = append(artifacts, artifact)
	}

	// Sort: directories first, then files; alphabetical within each group
	sort.Slice(artifacts, func(i, j int) bool {
		if artifacts[i].Type != artifacts[j].Type {
			return artifacts[i].Type == "directory"
		}
		return artifacts[i].Filename < artifacts[j].Filename
	})

	if artifacts == nil {
		artifacts = []types.StreamArtifactInfo{}
	}

	return artifacts, nil
}

// ReadArtifact reads the content of an artifact file within a stream directory.
// Supports both flat files (e.g., prd.md) and nested files (e.g., prd/executive-summary.md).
// Returns "not found" error when file doesn't exist.
func (s *StreamArtifactService) ReadArtifact(projectName, streamName, artifactPath string) (string, error) {
	streamDir := s.streamStore.StreamDir(projectName, streamName)

	// Verify stream directory exists
	if _, err := os.Stat(streamDir); os.IsNotExist(err) {
		return "", fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	fullPath, err := validateArtifactPath(streamDir, artifactPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("artifact not found: %s", artifactPath)
		}
		return "", fmt.Errorf("failed to stat artifact: %w", err)
	}

	if info.IsDir() {
		return "", fmt.Errorf("artifact not found: %s is a directory", artifactPath)
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read artifact: %w", err)
	}

	return string(content), nil
}

// isExcluded checks whether a filename should be excluded from artifact listings.
func isExcluded(name string) bool {
	if metadataExclusions[name] {
		return true
	}
	if strings.HasSuffix(name, ".tmp") {
		return true
	}
	if strings.HasSuffix(name, ".swp") {
		return true
	}
	if strings.HasSuffix(name, "~") {
		return true
	}
	return false
}

// validateArtifactPath validates and resolves an artifact path within a stream directory.
// Prevents path traversal attacks.
func validateArtifactPath(streamDir, artifactPath string) (string, error) {
	cleaned := filepath.Clean(artifactPath)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") {
		return "", fmt.Errorf("invalid artifact path")
	}
	fullPath := filepath.Join(streamDir, cleaned)
	if !strings.HasPrefix(fullPath, streamDir+string(filepath.Separator)) && fullPath != streamDir {
		return "", fmt.Errorf("invalid artifact path")
	}
	return fullPath, nil
}
