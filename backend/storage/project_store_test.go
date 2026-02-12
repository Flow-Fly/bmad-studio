package storage

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"bmad-studio/backend/types"
)

func TestNewProjectStore(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)

	projectStore := NewProjectStore(centralStore)
	if projectStore == nil {
		t.Fatal("NewProjectStore() returned nil")
	}
}

func TestProjectStore_CreateProjectDir(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory
	projectName := "my-app"
	storePath, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("CreateProjectDir() error = %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "projects", projectName)
	if storePath != expectedPath {
		t.Errorf("CreateProjectDir() returned path %s, expected %s", storePath, expectedPath)
	}

	// Verify directory exists
	stat, err := os.Stat(storePath)
	if err != nil {
		t.Fatalf("Project directory does not exist: %v", err)
	}
	if !stat.IsDir() {
		t.Error("Project path is not a directory")
	}
}

func TestProjectStore_CreateProjectDir_AlreadyExists(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory first time
	projectName := "my-app"
	storePath1, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("First CreateProjectDir() error = %v", err)
	}

	// Create again (should succeed idempotently)
	storePath2, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("Second CreateProjectDir() error = %v", err)
	}

	if storePath1 != storePath2 {
		t.Errorf("CreateProjectDir() returned different paths: %s vs %s", storePath1, storePath2)
	}
}

func TestProjectStore_WriteProjectMeta(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory first
	projectName := "my-app"
	_, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("CreateProjectDir() error = %v", err)
	}

	// Write project metadata
	meta := types.ProjectMeta{
		Name:      projectName,
		RepoPath:  "/path/to/my-app",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Settings:  map[string]any{"key": "value"},
	}

	err = projectStore.WriteProjectMeta(projectName, meta)
	if err != nil {
		t.Fatalf("WriteProjectMeta() error = %v", err)
	}

	// Verify file exists
	projectPath := filepath.Join(tmpDir, "projects", projectName, "project.json")
	if _, err := os.Stat(projectPath); os.IsNotExist(err) {
		t.Fatal("project.json does not exist")
	}
}

func TestProjectStore_ReadProjectMeta(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory and write metadata
	projectName := "my-app"
	_, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("CreateProjectDir() error = %v", err)
	}

	writtenMeta := types.ProjectMeta{
		Name:      projectName,
		RepoPath:  "/path/to/my-app",
		CreatedAt: "2026-02-12T10:30:00Z",
		Settings:  map[string]any{"key": "value"},
	}
	err = projectStore.WriteProjectMeta(projectName, writtenMeta)
	if err != nil {
		t.Fatalf("WriteProjectMeta() error = %v", err)
	}

	// Read metadata back
	readMeta, err := projectStore.ReadProjectMeta(projectName)
	if err != nil {
		t.Fatalf("ReadProjectMeta() error = %v", err)
	}

	// Verify fields
	if readMeta.Name != writtenMeta.Name {
		t.Errorf("Name mismatch: got %s, want %s", readMeta.Name, writtenMeta.Name)
	}
	if readMeta.RepoPath != writtenMeta.RepoPath {
		t.Errorf("RepoPath mismatch: got %s, want %s", readMeta.RepoPath, writtenMeta.RepoPath)
	}
	if readMeta.CreatedAt != writtenMeta.CreatedAt {
		t.Errorf("CreatedAt mismatch: got %s, want %s", readMeta.CreatedAt, writtenMeta.CreatedAt)
	}
	if readMeta.Settings["key"] != "value" {
		t.Errorf("Settings mismatch: got %v", readMeta.Settings)
	}
}

func TestProjectStore_ReadProjectMeta_NotFound(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Try to read non-existent project
	_, err := projectStore.ReadProjectMeta("nonexistent")
	if err == nil {
		t.Fatal("ReadProjectMeta() should fail for non-existent project")
	}
	if !os.IsNotExist(err) {
		t.Errorf("Expected os.IsNotExist error, got: %v", err)
	}
}

func TestProjectStore_ReadProjectMeta_Corruption(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory and write corrupt JSON
	projectName := "my-app"
	projectDir := filepath.Join(tmpDir, "projects", projectName)
	os.MkdirAll(projectDir, 0755)

	corruptFile := filepath.Join(projectDir, "project.json")
	os.WriteFile(corruptFile, []byte("{invalid json}"), 0644)

	// Read should fail with corruption error
	_, err := projectStore.ReadProjectMeta(projectName)
	if err == nil {
		t.Fatal("ReadProjectMeta() should fail for corrupt JSON")
	}
}

func TestProjectStore_WriteProjectMeta_AtomicWrite(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	centralStore := NewCentralStoreWithPath(tmpDir)
	if err := centralStore.Init(); err != nil {
		t.Fatalf("Failed to init central store: %v", err)
	}

	projectStore := NewProjectStore(centralStore)

	// Create project directory
	projectName := "my-app"
	_, err := projectStore.CreateProjectDir(projectName)
	if err != nil {
		t.Fatalf("CreateProjectDir() error = %v", err)
	}

	// Write initial metadata
	meta1 := types.ProjectMeta{
		Name:      projectName,
		RepoPath:  "/path/to/my-app",
		CreatedAt: "2026-02-12T10:30:00Z",
		Settings:  map[string]any{"version": 1},
	}
	if err := projectStore.WriteProjectMeta(projectName, meta1); err != nil {
		t.Fatalf("First WriteProjectMeta() error = %v", err)
	}

	// Write updated metadata (atomic overwrite)
	meta2 := types.ProjectMeta{
		Name:      projectName,
		RepoPath:  "/path/to/my-app",
		CreatedAt: "2026-02-12T10:30:00Z",
		Settings:  map[string]any{"version": 2},
	}
	if err := projectStore.WriteProjectMeta(projectName, meta2); err != nil {
		t.Fatalf("Second WriteProjectMeta() error = %v", err)
	}

	// Verify updated content
	readMeta, _ := projectStore.ReadProjectMeta(projectName)
	if readMeta.Settings["version"] != float64(2) { // JSON numbers decode as float64
		t.Errorf("Expected version 2, got %v", readMeta.Settings["version"])
	}

	// Verify .tmp file was cleaned up
	projectPath := filepath.Join(tmpDir, "projects", projectName, "project.json")
	tmpFile := projectPath + ".tmp"
	if _, err := os.Stat(tmpFile); !os.IsNotExist(err) {
		t.Error("WriteProjectMeta() left .tmp file behind")
	}
}
