package services

import (
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/storage"
)

// resolveDir resolves symlinks in the directory path (for macOS compatibility)
func resolveDir(t *testing.T, dir string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil {
		t.Fatalf("Failed to resolve symlinks for %s: %v", dir, err)
	}
	return resolved
}

// createMockGitRepo creates a .git directory to simulate a git repository
func createMockGitRepo(t *testing.T, dir string) {
	t.Helper()
	gitDir := filepath.Join(dir, ".git")
	if err := os.MkdirAll(gitDir, 0755); err != nil {
		t.Fatalf("Failed to create .git directory: %v", err)
	}
}

func TestNewProjectService(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)

	service := NewProjectService(registryStore, projectStore)
	if service == nil {
		t.Fatal("NewProjectService() returned nil")
	}
}

func TestProjectService_Register_HappyPath(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Create a mock git repository
	repoDir := filepath.Join(tmpDir, "test-repos", "my-app")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatalf("Failed to create repo dir: %v", err)
	}
	createMockGitRepo(t, repoDir)

	// Register the project
	entry, err := service.Register(repoDir)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Verify entry fields
	if entry.Name != "my-app" {
		t.Errorf("Expected name 'my-app', got %s", entry.Name)
	}
	if entry.RepoPath != repoDir {
		t.Errorf("Expected repoPath %s, got %s", repoDir, entry.RepoPath)
	}

	expectedStorePath := filepath.Join(tmpDir, "projects", "my-app")
	if entry.StorePath != expectedStorePath {
		t.Errorf("Expected storePath %s, got %s", expectedStorePath, entry.StorePath)
	}

	// Verify registry was updated
	registry, _ := registryStore.Load()
	if len(registry.Projects) != 1 {
		t.Fatalf("Expected 1 project in registry, got %d", len(registry.Projects))
	}

	// Verify project store directory was created
	if _, err := os.Stat(expectedStorePath); os.IsNotExist(err) {
		t.Error("Project store directory was not created")
	}

	// Verify project.json exists
	projectJSONPath := filepath.Join(expectedStorePath, "project.json")
	if _, err := os.Stat(projectJSONPath); os.IsNotExist(err) {
		t.Error("project.json was not created")
	}

	// Read and verify project.json content
	meta, err := projectStore.ReadProjectMeta("my-app")
	if err != nil {
		t.Fatalf("Failed to read project.json: %v", err)
	}
	if meta.Name != "my-app" {
		t.Errorf("ProjectMeta.Name = %s, want 'my-app'", meta.Name)
	}
	if meta.RepoPath != repoDir {
		t.Errorf("ProjectMeta.RepoPath = %s, want %s", meta.RepoPath, repoDir)
	}
	if meta.CreatedAt == "" {
		t.Error("ProjectMeta.CreatedAt is empty")
	}
	// Settings can be nil or empty map (both are valid for empty settings)
}

func TestProjectService_Register_Duplicate(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Create a mock git repository
	repoDir := filepath.Join(tmpDir, "test-repos", "my-app")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatalf("Failed to create repo dir: %v", err)
	}
	createMockGitRepo(t, repoDir)

	// Register the project first time
	_, err := service.Register(repoDir)
	if err != nil {
		t.Fatalf("First Register() error = %v", err)
	}

	// Try to register again
	_, err = service.Register(repoDir)
	if err == nil {
		t.Fatal("Register() should fail for duplicate repo path")
	}
	if err.Error() != "project already registered: "+repoDir {
		t.Errorf("Expected duplicate error, got: %v", err)
	}
}

func TestProjectService_Register_InvalidPath(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Try to register non-existent path
	_, err := service.Register("/nonexistent/path")
	if err == nil {
		t.Fatal("Register() should fail for non-existent path")
	}
}

func TestProjectService_Register_NotGitRepo(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Create a directory but no .git
	repoDir := filepath.Join(tmpDir, "test-repos", "not-git")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatalf("Failed to create dir: %v", err)
	}

	// Try to register (should fail - not a git repo)
	_, err := service.Register(repoDir)
	if err == nil {
		t.Fatal("Register() should fail for non-git directory")
	}
	if err.Error() != "path is not a git repository: "+repoDir {
		t.Errorf("Expected git repo error, got: %v", err)
	}
}

func TestProjectService_Unregister(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Create and register a project
	repoDir := filepath.Join(tmpDir, "test-repos", "my-app")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatalf("Failed to create repo dir: %v", err)
	}
	createMockGitRepo(t, repoDir)

	_, err := service.Register(repoDir)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	storePath := filepath.Join(tmpDir, "projects", "my-app")

	// Unregister the project
	err = service.Unregister("my-app")
	if err != nil {
		t.Fatalf("Unregister() error = %v", err)
	}

	// Verify it's removed from registry
	registry, _ := registryStore.Load()
	if len(registry.Projects) != 0 {
		t.Errorf("Expected 0 projects in registry after unregister, got %d", len(registry.Projects))
	}

	// Verify project store directory still exists (per AC #3)
	if _, err := os.Stat(storePath); os.IsNotExist(err) {
		t.Error("Unregister() should NOT delete project store directory")
	}
}

func TestProjectService_Unregister_NotFound(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Try to unregister non-existent project
	err := service.Unregister("nonexistent")
	if err == nil {
		t.Fatal("Unregister() should fail for non-existent project")
	}
	if err.Error() != "project not found: nonexistent" {
		t.Errorf("Expected 'project not found' error, got: %v", err)
	}
}

func TestProjectService_List(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// List empty registry
	projects, err := service.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects, got %d", len(projects))
	}

	// Register two projects
	for i, name := range []string{"app1", "app2"} {
		repoDir := filepath.Join(tmpDir, "test-repos", name)
		if err := os.MkdirAll(repoDir, 0755); err != nil {
			t.Fatalf("Failed to create repo dir %d: %v", i, err)
		}
		createMockGitRepo(t, repoDir)

		_, err := service.Register(repoDir)
		if err != nil {
			t.Fatalf("Register() error for %s: %v", name, err)
		}
	}

	// List should return both
	projects, err = service.List()
	if err != nil {
		t.Fatalf("List() error after registrations: %v", err)
	}
	if len(projects) != 2 {
		t.Errorf("Expected 2 projects, got %d", len(projects))
	}
}

func TestProjectService_Get(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Register a project
	repoDir := filepath.Join(tmpDir, "test-repos", "my-app")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatalf("Failed to create repo dir: %v", err)
	}
	createMockGitRepo(t, repoDir)

	_, err := service.Register(repoDir)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	// Get the project
	meta, err := service.Get("my-app")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	// Verify metadata
	if meta.Name != "my-app" {
		t.Errorf("Expected name 'my-app', got %s", meta.Name)
	}
	if meta.RepoPath != repoDir {
		t.Errorf("Expected repoPath %s, got %s", repoDir, meta.RepoPath)
	}
	if meta.CreatedAt == "" {
		t.Error("CreatedAt is empty")
	}
}

func TestProjectService_Get_NotFound(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	service := NewProjectService(registryStore, projectStore)

	// Try to get non-existent project
	_, err := service.Get("nonexistent")
	if err == nil {
		t.Fatal("Get() should fail for non-existent project")
	}
	if !os.IsNotExist(err) {
		t.Errorf("Expected os.IsNotExist error, got: %v", err)
	}
}
