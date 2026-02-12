package storage

import (
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/types"
)

func TestNewRegistryStore(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	// Initialize central store first
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)
	if registryStore == nil {
		t.Fatal("NewRegistryStore() returned nil")
	}
}

func TestRegistryStore_Load(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	// Initialize central store
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Load empty registry
	registry, err := registryStore.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if registry.Projects == nil {
		t.Error("Load() returned registry with nil Projects")
	}

	if len(registry.Projects) != 0 {
		t.Errorf("Load() returned %d projects, expected 0", len(registry.Projects))
	}
}

func TestRegistryStore_Load_Corruption(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	// Create directory and corrupt registry
	os.MkdirAll(tmpDir, 0755)
	registryPath := filepath.Join(tmpDir, "registry.json")
	os.WriteFile(registryPath, []byte("{invalid json}"), 0644)

	registryStore := NewRegistryStore(centralStore)

	// Load should return empty registry with fallback on corruption
	registry, err := registryStore.Load()
	if err != nil {
		t.Fatalf("Load() should not fail on corruption: %v", err)
	}

	if len(registry.Projects) != 0 {
		t.Errorf("Load() with corruption should return empty registry, got %d projects", len(registry.Projects))
	}
}

func TestRegistryStore_Save(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	// Initialize central store
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Create test registry
	registry := types.Registry{
		Projects: []types.RegistryEntry{
			{
				Name:      "test-project",
				RepoPath:  "/path/to/repo",
				StorePath: "/path/to/store",
			},
		},
	}

	// Save registry
	err := registryStore.Save(registry)
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	// Load and verify
	loaded, err := registryStore.Load()
	if err != nil {
		t.Fatalf("Load() after Save() error = %v", err)
	}

	if len(loaded.Projects) != 1 {
		t.Fatalf("Load() returned %d projects, expected 1", len(loaded.Projects))
	}

	if loaded.Projects[0].Name != "test-project" {
		t.Errorf("Load() returned project name %s, expected test-project", loaded.Projects[0].Name)
	}

	if loaded.Projects[0].RepoPath != "/path/to/repo" {
		t.Errorf("Load() returned repo path %s, expected /path/to/repo", loaded.Projects[0].RepoPath)
	}
}

func TestRegistryStore_Save_AtomicWrite(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	// Initialize central store
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Save initial registry
	initial := types.Registry{
		Projects: []types.RegistryEntry{
			{Name: "project1", RepoPath: "/path1", StorePath: "/store1"},
		},
	}
	if err := registryStore.Save(initial); err != nil {
		t.Fatalf("Initial Save() error = %v", err)
	}

	// Save updated registry (atomic overwrite)
	updated := types.Registry{
		Projects: []types.RegistryEntry{
			{Name: "project1", RepoPath: "/path1", StorePath: "/store1"},
			{Name: "project2", RepoPath: "/path2", StorePath: "/store2"},
		},
	}
	if err := registryStore.Save(updated); err != nil {
		t.Fatalf("Updated Save() error = %v", err)
	}

	// Verify updated content
	loaded, _ := registryStore.Load()
	if len(loaded.Projects) != 2 {
		t.Errorf("After atomic overwrite: got %d projects, expected 2", len(loaded.Projects))
	}

	// Verify .tmp file was cleaned up
	registryPath := filepath.Join(tmpDir, "registry.json")
	tmpFile := registryPath + ".tmp"
	if _, err := os.Stat(tmpFile); !os.IsNotExist(err) {
		t.Error("Save() left .tmp file behind")
	}
}

func TestRegistryStore_AddProject(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	entry := types.RegistryEntry{
		Name:      "my-app",
		RepoPath:  "/path/to/my-app",
		StorePath: filepath.Join(tmpDir, "projects", "my-app"),
	}

	// Add project
	err := registryStore.AddProject(entry)
	if err != nil {
		t.Fatalf("AddProject() error = %v", err)
	}

	// Verify it was added
	registry, _ := registryStore.Load()
	if len(registry.Projects) != 1 {
		t.Fatalf("Expected 1 project, got %d", len(registry.Projects))
	}
	if registry.Projects[0].Name != "my-app" {
		t.Errorf("Expected name 'my-app', got %s", registry.Projects[0].Name)
	}
}

func TestRegistryStore_AddProject_Duplicate(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	entry := types.RegistryEntry{
		Name:      "my-app",
		RepoPath:  "/path/to/my-app",
		StorePath: filepath.Join(tmpDir, "projects", "my-app"),
	}

	// Add project first time
	if err := registryStore.AddProject(entry); err != nil {
		t.Fatalf("First AddProject() error = %v", err)
	}

	// Try to add again with same repoPath
	err := registryStore.AddProject(entry)
	if err == nil {
		t.Fatal("AddProject() should fail for duplicate repoPath")
	}
	if err.Error() != "project already registered: /path/to/my-app" {
		t.Errorf("Expected duplicate error message, got: %v", err)
	}

	// Verify only one entry exists
	registry, _ := registryStore.Load()
	if len(registry.Projects) != 1 {
		t.Errorf("Expected 1 project after duplicate attempt, got %d", len(registry.Projects))
	}
}

func TestRegistryStore_RemoveProject(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Add a project first
	entry := types.RegistryEntry{
		Name:      "my-app",
		RepoPath:  "/path/to/my-app",
		StorePath: filepath.Join(tmpDir, "projects", "my-app"),
	}
	if err := registryStore.AddProject(entry); err != nil {
		t.Fatalf("AddProject() error = %v", err)
	}

	// Remove it
	err := registryStore.RemoveProject("my-app")
	if err != nil {
		t.Fatalf("RemoveProject() error = %v", err)
	}

	// Verify it's gone
	registry, _ := registryStore.Load()
	if len(registry.Projects) != 0 {
		t.Errorf("Expected 0 projects after removal, got %d", len(registry.Projects))
	}
}

func TestRegistryStore_RemoveProject_NotFound(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Try to remove non-existent project
	err := registryStore.RemoveProject("nonexistent")
	if err == nil {
		t.Fatal("RemoveProject() should fail for non-existent project")
	}
	if err.Error() != "project not found: nonexistent" {
		t.Errorf("Expected 'project not found' error, got: %v", err)
	}
}

func TestRegistryStore_FindByRepoPath(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Add some projects
	entries := []types.RegistryEntry{
		{Name: "app1", RepoPath: "/path/to/app1", StorePath: "/store/app1"},
		{Name: "app2", RepoPath: "/path/to/app2", StorePath: "/store/app2"},
	}
	for _, e := range entries {
		if err := registryStore.AddProject(e); err != nil {
			t.Fatalf("AddProject() error = %v", err)
		}
	}

	// Find existing project
	entry, found := registryStore.FindByRepoPath("/path/to/app1")
	if !found {
		t.Fatal("FindByRepoPath() should find existing project")
	}
	if entry.Name != "app1" {
		t.Errorf("Expected name 'app1', got %s", entry.Name)
	}

	// Find non-existent project
	_, found = registryStore.FindByRepoPath("/nonexistent")
	if found {
		t.Error("FindByRepoPath() should not find non-existent project")
	}
}

func TestRegistryStore_FindByName(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	registryStore := NewRegistryStore(centralStore)

	// Add some projects
	entries := []types.RegistryEntry{
		{Name: "app1", RepoPath: "/path/to/app1", StorePath: "/store/app1"},
		{Name: "app2", RepoPath: "/path/to/app2", StorePath: "/store/app2"},
	}
	for _, e := range entries {
		if err := registryStore.AddProject(e); err != nil {
			t.Fatalf("AddProject() error = %v", err)
		}
	}

	// Find existing project
	entry, found := registryStore.FindByName("app1")
	if !found {
		t.Fatal("FindByName() should find existing project")
	}
	if entry.RepoPath != "/path/to/app1" {
		t.Errorf("Expected repoPath '/path/to/app1', got %s", entry.RepoPath)
	}

	// Find non-existent project
	_, found = registryStore.FindByName("nonexistent")
	if found {
		t.Error("FindByName() should not find non-existent project")
	}
}
