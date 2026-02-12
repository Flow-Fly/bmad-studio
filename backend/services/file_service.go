package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"bmad-studio/backend/types"
)

// FileService provides file listing and reading for project files.
type FileService struct {
	projectManager *ProjectManager
}

// NewFileService creates a new FileService with the given ProjectManager.
func NewFileService(pm *ProjectManager) *FileService {
	return &FileService{projectManager: pm}
}

// ListProjectFiles returns all files under the project's _bmad-output/ directory.
func (s *FileService) ListProjectFiles() ([]types.FileEntry, error) {
	projectRoot := s.projectManager.ProjectRoot()
	if projectRoot == "" {
		return nil, fmt.Errorf("no project loaded")
	}

	bmadOutput := filepath.Join(projectRoot, "_bmad-output")
	var entries []types.FileEntry

	err := filepath.Walk(bmadOutput, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if info.IsDir() {
			return nil
		}
		rel, relErr := filepath.Rel(bmadOutput, path)
		if relErr != nil {
			return nil
		}
		entries = append(entries, types.FileEntry{
			Path: rel,
			Name: info.Name(),
			Size: info.Size(),
		})
		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("walk _bmad-output: %w", err)
	}

	if entries == nil {
		entries = []types.FileEntry{}
	}

	return entries, nil
}

// ReadProjectFile reads a file from the project's _bmad-output/ directory.
// It validates the path to prevent directory traversal attacks.
func (s *FileService) ReadProjectFile(relativePath string) (string, error) {
	projectRoot := s.projectManager.ProjectRoot()
	if projectRoot == "" {
		return "", fmt.Errorf("no project loaded")
	}

	// Path traversal prevention
	clean := filepath.Clean(relativePath)
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("invalid path: directory traversal not allowed")
	}

	bmadOutput := filepath.Join(projectRoot, "_bmad-output")
	fullPath := filepath.Join(bmadOutput, clean)

	// Verify the resolved path is still under _bmad-output
	absOutput, err := filepath.Abs(bmadOutput)
	if err != nil {
		return "", fmt.Errorf("resolve output path: %w", err)
	}
	absFull, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("resolve file path: %w", err)
	}
	if !strings.HasPrefix(absFull, absOutput+string(filepath.Separator)) && absFull != absOutput {
		return "", fmt.Errorf("invalid path: outside _bmad-output directory")
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("file not found: %s", relativePath)
		}
		return "", fmt.Errorf("read file: %w", err)
	}

	return string(data), nil
}
