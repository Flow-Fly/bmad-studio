package services

import (
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/storage"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupStreamArtifactService creates a temp central store, stream store, and artifact service.
func setupStreamArtifactService(t *testing.T) (*StreamArtifactService, *storage.StreamStore, string) {
	t.Helper()
	rootDir := resolveDir(t, t.TempDir())
	store := storage.NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := storage.NewStreamStore(store)
	svc := NewStreamArtifactService(streamStore)
	return svc, streamStore, rootDir
}

// createTestStream creates a stream directory with a stream.json and returns the dir path.
func createTestStream(t *testing.T, streamStore *storage.StreamStore, projectName, streamName string) string {
	t.Helper()
	dir, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Write minimal stream.json
	err = os.WriteFile(filepath.Join(dir, "stream.json"), []byte(`{"name":"`+streamName+`"}`), 0644)
	require.NoError(t, err)

	return dir
}

// writeTestFile creates a file with content in the given directory, creating parent dirs as needed.
func writeTestFile(t *testing.T, dir, name, content string) {
	t.Helper()
	path := filepath.Join(dir, name)
	err := os.MkdirAll(filepath.Dir(path), 0755)
	require.NoError(t, err)
	err = os.WriteFile(path, []byte(content), 0644)
	require.NoError(t, err)
}

func TestListArtifacts_FlatFiles(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "brainstorm.md", "# Brainstorm")
	writeTestFile(t, streamDir, "prd.md", "# PRD")
	writeTestFile(t, streamDir, "architecture.md", "# Arch")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)
	require.Len(t, artifacts, 3)

	// All should be files
	for _, a := range artifacts {
		assert.Equal(t, "file", a.Type, "expected type 'file' for %s", a.Filename)
	}

	// Verify alphabetical order
	expected := []string{"architecture.md", "brainstorm.md", "prd.md"}
	for i, name := range expected {
		assert.Equal(t, name, artifacts[i].Filename, "position %d", i)
	}

	// Verify phases
	phases := map[string]string{
		"brainstorm.md":   "analysis",
		"prd.md":          "planning",
		"architecture.md": "solutioning",
	}
	for _, a := range artifacts {
		assert.Equal(t, phases[a.Filename], a.Phase, "phase for %s", a.Filename)
	}

	// Verify size and modifiedAt are populated
	for _, a := range artifacts {
		assert.NotZero(t, a.Size, "size for %s", a.Filename)
		assert.False(t, a.ModifiedAt.IsZero(), "modifiedAt for %s", a.Filename)
	}
}

func TestListArtifacts_ShardedFolder(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# PRD")
	writeTestFile(t, streamDir, "prd/index.md", "# PRD Index")
	writeTestFile(t, streamDir, "prd/executive-summary.md", "# Summary")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)
	require.Len(t, artifacts, 2)

	// Directory should come first
	assert.Equal(t, "prd", artifacts[0].Filename)
	assert.Equal(t, "directory", artifacts[0].Type)
	assert.Equal(t, int64(0), artifacts[0].Size, "directory size should be 0")

	// File second
	assert.Equal(t, "prd.md", artifacts[1].Filename)
	assert.Equal(t, "file", artifacts[1].Type)

	// Both should have planning phase
	for _, a := range artifacts {
		assert.Equal(t, "planning", a.Phase, "phase for %s", a.Filename)
	}
}

func TestListArtifacts_StreamJsonExcluded(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# PRD")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)

	for _, a := range artifacts {
		assert.NotEqual(t, "stream.json", a.Filename, "stream.json should be excluded")
	}
}

func TestListArtifacts_TmpFilesExcluded(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# PRD")
	writeTestFile(t, streamDir, "prd.md.tmp", "temp data")
	writeTestFile(t, streamDir, "something.swp", "swap data")
	writeTestFile(t, streamDir, "backup.md~", "backup")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)
	require.Len(t, artifacts, 1)
	assert.Equal(t, "prd.md", artifacts[0].Filename)
}

func TestListArtifacts_EmptyStream(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	createTestStream(t, streamStore, "myapp", "feature")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)
	require.Len(t, artifacts, 0)
}

func TestReadArtifact_FlatFile(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# Product Requirements\n\nSome content here.")

	content, err := svc.ReadArtifact("myapp", "feature", "prd.md")
	require.NoError(t, err)
	assert.Equal(t, "# Product Requirements\n\nSome content here.", content)
}

func TestReadArtifact_NestedFile(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd/executive-summary.md", "# Executive Summary\n\nDetails here.")

	content, err := svc.ReadArtifact("myapp", "feature", "prd/executive-summary.md")
	require.NoError(t, err)
	assert.Equal(t, "# Executive Summary\n\nDetails here.", content)
}

func TestReadArtifact_NotFound(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	createTestStream(t, streamStore, "myapp", "feature")

	_, err := svc.ReadArtifact("myapp", "feature", "nonexistent.md")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "artifact not found")
}

func TestReadArtifact_PathTraversal(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	createTestStream(t, streamStore, "myapp", "feature")

	traversalPaths := []string{
		"../../../etc/passwd",
		"../../other-stream/secret.md",
		"../stream.json",
		"..",
	}

	for _, path := range traversalPaths {
		_, err := svc.ReadArtifact("myapp", "feature", path)
		require.Error(t, err, "expected error for path traversal %q", path)
		assert.Contains(t, err.Error(), "invalid artifact path", "for path %q", path)
	}
}

func TestListArtifacts_NonExistentStream(t *testing.T) {
	svc, _, _ := setupStreamArtifactService(t)

	_, err := svc.ListArtifacts("myapp", "nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "stream not found")
}

func TestListArtifacts_SortOrder(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# PRD")
	writeTestFile(t, streamDir, "brainstorm.md", "# Brainstorm")
	writeTestFile(t, streamDir, "epics/epic-1.md", "# Epic 1")
	writeTestFile(t, streamDir, "prd/index.md", "# PRD Index")

	artifacts, err := svc.ListArtifacts("myapp", "feature")
	require.NoError(t, err)
	require.Len(t, artifacts, 4)

	// Directories first, alphabetically
	assert.Equal(t, "epics", artifacts[0].Filename)
	assert.Equal(t, "directory", artifacts[0].Type)
	assert.Equal(t, "implementation", artifacts[0].Phase)

	assert.Equal(t, "prd", artifacts[1].Filename)
	assert.Equal(t, "directory", artifacts[1].Type)

	// Then files, alphabetically
	assert.Equal(t, "brainstorm.md", artifacts[2].Filename)
	assert.Equal(t, "file", artifacts[2].Type)

	assert.Equal(t, "prd.md", artifacts[3].Filename)
	assert.Equal(t, "file", artifacts[3].Type)
}

func TestListDirectoryContents_Basic(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd/index.md", "# PRD Index")
	writeTestFile(t, streamDir, "prd/executive-summary.md", "# Summary")
	writeTestFile(t, streamDir, "prd/functional-requirements.md", "# Functional")

	artifacts, err := svc.ListDirectoryContents("myapp", "feature", "prd")
	require.NoError(t, err)
	require.Len(t, artifacts, 3)

	// All should be files, sorted alphabetically
	expected := []string{"executive-summary.md", "functional-requirements.md", "index.md"}
	for i, name := range expected {
		assert.Equal(t, name, artifacts[i].Filename, "position %d", i)
		assert.Equal(t, "file", artifacts[i].Type)
		assert.Equal(t, "planning", artifacts[i].Phase, "phase for %s", artifacts[i].Filename)
	}
}

func TestListDirectoryContents_ExcludesTmpFiles(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd/index.md", "# PRD Index")
	writeTestFile(t, streamDir, "prd/temp.md.tmp", "temp")
	writeTestFile(t, streamDir, "prd/.backup.swp", "swap")

	artifacts, err := svc.ListDirectoryContents("myapp", "feature", "prd")
	require.NoError(t, err)
	require.Len(t, artifacts, 1)
	assert.Equal(t, "index.md", artifacts[0].Filename)
}

func TestListDirectoryContents_NotADirectory(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	writeTestFile(t, streamDir, "prd.md", "# PRD")

	_, err := svc.ListDirectoryContents("myapp", "feature", "prd.md")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not a directory")
}

func TestListDirectoryContents_NotFound(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	createTestStream(t, streamStore, "myapp", "feature")

	_, err := svc.ListDirectoryContents("myapp", "feature", "nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "directory not found")
}

func TestListDirectoryContents_PathTraversal(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	createTestStream(t, streamStore, "myapp", "feature")

	traversalPaths := []string{
		"../../../etc",
		"../../other-stream",
		"..",
	}

	for _, path := range traversalPaths {
		_, err := svc.ListDirectoryContents("myapp", "feature", path)
		require.Error(t, err, "expected error for path traversal %q", path)
		assert.Contains(t, err.Error(), "invalid artifact path", "for path %q", path)
	}
}

func TestListDirectoryContents_NonExistentStream(t *testing.T) {
	svc, _, _ := setupStreamArtifactService(t)

	_, err := svc.ListDirectoryContents("myapp", "nonexistent", "prd")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "stream not found")
}

func TestListDirectoryContents_EmptyDirectory(t *testing.T) {
	svc, streamStore, _ := setupStreamArtifactService(t)
	streamDir := createTestStream(t, streamStore, "myapp", "feature")

	// Create empty directory
	err := os.MkdirAll(filepath.Join(streamDir, "empty-dir"), 0755)
	require.NoError(t, err)

	artifacts, err := svc.ListDirectoryContents("myapp", "feature", "empty-dir")
	require.NoError(t, err)
	require.Len(t, artifacts, 0)
}
