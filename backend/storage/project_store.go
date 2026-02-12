package storage

import (
	"fmt"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

// ProjectStore manages per-project metadata storage in ~/.bmad-studio/projects/{name}/
type ProjectStore struct {
	store *CentralStore
}

// NewProjectStore creates a ProjectStore that uses the given CentralStore
func NewProjectStore(store *CentralStore) *ProjectStore {
	return &ProjectStore{store: store}
}

// CreateProjectDir creates the project directory at ~/.bmad-studio/projects/{projectName}/
// Returns the full path to the created directory.
// If the directory already exists, returns the path without error (idempotent).
func (p *ProjectStore) CreateProjectDir(projectName string) (string, error) {
	projectDir := filepath.Join(p.store.rootDir, "projects", projectName)

	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", fmt.Errorf("create project directory: %w", err)
	}

	// Fsync parent directory to ensure directory metadata reaches disk
	projectsDir := filepath.Join(p.store.rootDir, "projects")
	if err := syncDir(projectsDir); err != nil {
		return "", fmt.Errorf("fsync projects directory: %w", err)
	}

	return projectDir, nil
}

// WriteProjectMeta writes project metadata to project.json using atomic write.
// The project directory must already exist (call CreateProjectDir first).
func (p *ProjectStore) WriteProjectMeta(projectName string, meta types.ProjectMeta) error {
	projectPath := filepath.Join(p.store.rootDir, "projects", projectName, "project.json")

	if err := WriteJSON(projectPath, meta); err != nil {
		return fmt.Errorf("write project metadata: %w", err)
	}

	return nil
}

// ReadProjectMeta reads project metadata from project.json.
// Returns error if the file doesn't exist or contains invalid JSON.
// Callers should check os.IsNotExist(err) to distinguish missing files from corruption.
func (p *ProjectStore) ReadProjectMeta(projectName string) (*types.ProjectMeta, error) {
	projectPath := filepath.Join(p.store.rootDir, "projects", projectName, "project.json")

	var meta types.ProjectMeta
	if err := ReadJSON(projectPath, &meta); err != nil {
		return nil, err
	}

	return &meta, nil
}
