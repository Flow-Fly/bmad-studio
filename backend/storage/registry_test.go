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
