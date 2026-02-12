package services_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bmad-studio/backend/types"
)

// setupFileServiceTest creates a temporary project directory with _bmad-output files.
func setupFileServiceTest(t *testing.T) (string, func()) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "file-service-test-*")
	if err != nil {
		t.Fatal(err)
	}

	bmadOutput := filepath.Join(tmpDir, "_bmad-output")
	os.MkdirAll(filepath.Join(bmadOutput, "planning-artifacts"), 0755)
	os.MkdirAll(filepath.Join(bmadOutput, "implementation-artifacts"), 0755)

	// Create some test files
	os.WriteFile(filepath.Join(bmadOutput, "planning-artifacts", "prd.md"), []byte("# PRD Content"), 0644)
	os.WriteFile(filepath.Join(bmadOutput, "implementation-artifacts", "sprint-status.yaml"), []byte("status: ok"), 0644)
	os.WriteFile(filepath.Join(bmadOutput, "readme.md"), []byte("# Readme"), 0644)

	return tmpDir, func() {
		os.RemoveAll(tmpDir)
	}
}

// listTestFiles lists files under _bmad-output for testing
func listTestFiles(projectRoot string) ([]types.FileEntry, error) {
	bmadOutput := filepath.Join(projectRoot, "_bmad-output")
	var entries []types.FileEntry

	err := filepath.Walk(bmadOutput, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
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
		return nil, err
	}

	if entries == nil {
		entries = []types.FileEntry{}
	}

	return entries, nil
}

// readTestFile reads a file from _bmad-output with path traversal prevention
func readTestFile(projectRoot, relativePath string) (string, error) {
	clean := filepath.Clean(relativePath)
	if strings.Contains(clean, "..") {
		return "", os.ErrPermission
	}

	bmadOutput := filepath.Join(projectRoot, "_bmad-output")
	fullPath := filepath.Join(bmadOutput, clean)

	absOutput, _ := filepath.Abs(bmadOutput)
	absFull, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absFull, absOutput+string(filepath.Separator)) && absFull != absOutput {
		return "", os.ErrPermission
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func TestListProjectFiles(t *testing.T) {
	tmpDir, cleanup := setupFileServiceTest(t)
	defer cleanup()

	files, err := listTestFiles(tmpDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(files) != 3 {
		t.Errorf("expected 3 files, got %d", len(files))
	}

	names := make(map[string]bool)
	for _, f := range files {
		names[f.Name] = true
	}

	if !names["prd.md"] {
		t.Error("expected prd.md in file list")
	}
	if !names["sprint-status.yaml"] {
		t.Error("expected sprint-status.yaml in file list")
	}
	if !names["readme.md"] {
		t.Error("expected readme.md in file list")
	}
}

func TestListProjectFilesEmptyDir(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "file-service-empty-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	os.MkdirAll(filepath.Join(tmpDir, "_bmad-output"), 0755)

	files, err := listTestFiles(tmpDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(files) != 0 {
		t.Errorf("expected 0 files, got %d", len(files))
	}
}

func TestReadProjectFile(t *testing.T) {
	tmpDir, cleanup := setupFileServiceTest(t)
	defer cleanup()

	content, err := readTestFile(tmpDir, "readme.md")
	if err != nil {
		t.Fatal(err)
	}

	if content != "# Readme" {
		t.Errorf("expected '# Readme', got '%s'", content)
	}
}

func TestReadProjectFileNested(t *testing.T) {
	tmpDir, cleanup := setupFileServiceTest(t)
	defer cleanup()

	content, err := readTestFile(tmpDir, "planning-artifacts/prd.md")
	if err != nil {
		t.Fatal(err)
	}

	if content != "# PRD Content" {
		t.Errorf("expected '# PRD Content', got '%s'", content)
	}
}

func TestReadProjectFileNotFound(t *testing.T) {
	tmpDir, cleanup := setupFileServiceTest(t)
	defer cleanup()

	_, err := readTestFile(tmpDir, "nonexistent.md")
	if err == nil {
		t.Error("expected error for missing file")
	}
}

func TestReadProjectFilePathTraversal(t *testing.T) {
	tmpDir, cleanup := setupFileServiceTest(t)
	defer cleanup()

	tests := []string{
		"../../../etc/passwd",
		"../../secret.txt",
		"../outside.txt",
	}

	for _, path := range tests {
		_, err := readTestFile(tmpDir, path)
		if err == nil {
			t.Errorf("expected error for path traversal: %s", path)
		}
	}
}
