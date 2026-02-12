package services

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

// ProjectService handles project registration and management
type ProjectService struct {
	registryStore *storage.RegistryStore
	projectStore  *storage.ProjectStore
}

// NewProjectService creates a new ProjectService
func NewProjectService(registryStore *storage.RegistryStore, projectStore *storage.ProjectStore) *ProjectService {
	return &ProjectService{
		registryStore: registryStore,
		projectStore:  projectStore,
	}
}

// Register registers a new project with the BMAD Studio central store.
// It validates the path, checks for git repository, creates project store directory,
// writes project.json, and updates registry.json.
// Returns the new registry entry or error if the project is already registered.
func (s *ProjectService) Register(repoPath string) (*types.RegistryEntry, error) {
	// 1. Resolve absolute path
	absPath, err := filepath.Abs(repoPath)
	if err != nil {
		return nil, fmt.Errorf("resolve absolute path: %w", err)
	}

	// 2. Validate path exists and is a directory
	stat, err := os.Stat(absPath)
	if err != nil {
		return nil, fmt.Errorf("validate path: %w", err)
	}
	if !stat.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", absPath)
	}

	// 3. Validate .git exists (git repo check)
	gitPath := filepath.Join(absPath, ".git")
	if _, err := os.Stat(gitPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("path is not a git repository: %s", absPath)
	}

	// 4. Derive project name from path basename
	projectName := filepath.Base(absPath)

	// 5. Check registry for duplicate repoPath
	if _, found := s.registryStore.FindByRepoPath(absPath); found {
		return nil, fmt.Errorf("project already registered: %s", absPath)
	}

	// 6. Create project store directory
	storePath, err := s.projectStore.CreateProjectDir(projectName)
	if err != nil {
		return nil, fmt.Errorf("create project directory: %w", err)
	}

	// 7. Write project.json with ProjectMeta
	meta := types.ProjectMeta{
		Name:      projectName,
		RepoPath:  absPath,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Settings:  map[string]any{}, // Empty settings object
	}
	if err := s.projectStore.WriteProjectMeta(projectName, meta); err != nil {
		return nil, fmt.Errorf("write project metadata: %w", err)
	}

	// 8. Add entry to registry.json
	entry := types.RegistryEntry{
		Name:      projectName,
		RepoPath:  absPath,
		StorePath: storePath,
	}
	if err := s.registryStore.AddProject(entry); err != nil {
		return nil, fmt.Errorf("add to registry: %w", err)
	}

	// 9. Return the new RegistryEntry
	return &entry, nil
}

// Unregister removes a project from the registry.
// The project store directory is NOT deleted (user must manually clean up).
// Returns error if the project is not found.
func (s *ProjectService) Unregister(projectName string) error {
	// 1. Check project exists in registry (via RemoveProject, which validates)
	// 2. Remove from registry.json
	if err := s.registryStore.RemoveProject(projectName); err != nil {
		return err
	}

	// 3. Do NOT delete project store directory (per AC #3)
	return nil
}

// List returns all registered projects from the registry.
func (s *ProjectService) List() ([]types.RegistryEntry, error) {
	registry, err := s.registryStore.Load()
	if err != nil {
		return nil, fmt.Errorf("load registry: %w", err)
	}

	return registry.Projects, nil
}

// Get reads and returns the project metadata for a specific project.
// Returns error if the project doesn't exist or the metadata is corrupt.
func (s *ProjectService) Get(projectName string) (*types.ProjectMeta, error) {
	meta, err := s.projectStore.ReadProjectMeta(projectName)
	if err != nil {
		return nil, err
	}

	return meta, nil
}
