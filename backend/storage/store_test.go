package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewCentralStore(t *testing.T) {
	// NewCentralStore should resolve ~/.bmad-studio/
	store, err := NewCentralStore()
	if err != nil {
		t.Fatalf("NewCentralStore() error = %v", err)
	}

	if store == nil {
		t.Fatal("NewCentralStore() returned nil")
	}

	// Verify rootDir is set to home dir + .bmad-studio
	homeDir, _ := os.UserHomeDir()
	expectedPath := filepath.Join(homeDir, ".bmad-studio")
	if store.rootDir != expectedPath {
		t.Errorf("NewCentralStore() rootDir = %s, want %s", store.rootDir, expectedPath)
	}
}

func TestNewCentralStoreWithPath(t *testing.T) {
	testPath := "/custom/test/path"
	store := NewCentralStoreWithPath(testPath)

	if store == nil {
		t.Fatal("NewCentralStoreWithPath() returned nil")
	}

	if store.rootDir != testPath {
		t.Errorf("NewCentralStoreWithPath() rootDir = %s, want %s", store.rootDir, testPath)
	}
}

func TestCentralStore_Init_FirstRun(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)

	// First init should create directory structure and default files
	err := store.Init()
	if err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	// Verify directory structure
	if _, err := os.Stat(tmpDir); os.IsNotExist(err) {
		t.Errorf("Init() did not create root directory: %s", tmpDir)
	}

	projectsDir := filepath.Join(tmpDir, "projects")
	if _, err := os.Stat(projectsDir); os.IsNotExist(err) {
		t.Errorf("Init() did not create projects directory: %s", projectsDir)
	}

	// Verify registry.json was created with empty projects array
	registryPath := filepath.Join(tmpDir, "registry.json")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		t.Errorf("Init() did not create registry.json")
	}

	// Verify config.json was created with defaults
	configPath := filepath.Join(tmpDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		t.Errorf("Init() did not create config.json")
	}
}

func TestCentralStore_Init_Idempotent(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)

	// First init
	if err := store.Init(); err != nil {
		t.Fatalf("First Init() error = %v", err)
	}

	// Write custom content to registry
	registryPath := filepath.Join(tmpDir, "registry.json")
	customContent := `{"projects": [{"name": "test-project"}]}`
	if err := os.WriteFile(registryPath, []byte(customContent), 0644); err != nil {
		t.Fatalf("Failed to write custom registry: %v", err)
	}

	// Second init should NOT overwrite existing files
	if err := store.Init(); err != nil {
		t.Fatalf("Second Init() error = %v", err)
	}

	// Verify custom content preserved
	content, err := os.ReadFile(registryPath)
	if err != nil {
		t.Fatalf("Failed to read registry after second init: %v", err)
	}

	if string(content) != customContent {
		t.Errorf("Init() overwrote existing registry.json:\ngot: %s\nwant: %s", content, customContent)
	}
}

func TestCentralStore_Init_CorruptJSON(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)

	// Create directory and corrupt registry
	os.MkdirAll(tmpDir, 0755)
	registryPath := filepath.Join(tmpDir, "registry.json")
	os.WriteFile(registryPath, []byte("{invalid json}"), 0644)

	// Init should log warning but not fail
	err := store.Init()
	if err != nil {
		t.Errorf("Init() should not fail on corrupt JSON, got error: %v", err)
	}
}

func TestCentralStore_Validate_ExistingStore(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)

	// Initialize store first
	if err := store.Init(); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	// Validate should pass for properly initialized store
	err := store.Validate()
	if err != nil {
		t.Errorf("Validate() error = %v, expected nil", err)
	}
}

func TestCentralStore_Validate_MissingDirectory(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	nonexistentPath := filepath.Join(tmpDir, "nonexistent")
	store := NewCentralStoreWithPath(nonexistentPath)

	// Validate should fail if directory doesn't exist
	err := store.Validate()
	if err == nil {
		t.Error("Validate() should fail for nonexistent directory")
	}
}

func TestCentralStore_Validate_MissingFiles(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)

	// Create directory but no files
	os.MkdirAll(tmpDir, 0755)

	// Validate should fail if required files missing
	err := store.Validate()
	if err == nil {
		t.Error("Validate() should fail when registry.json or config.json missing")
	}
}
