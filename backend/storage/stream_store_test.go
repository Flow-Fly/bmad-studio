package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStreamStore_CreateStreamDir(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)

	projectName := "test-project"
	streamName := "feature-1"

	// Test creating stream directory
	streamDir, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	expectedDir := filepath.Join(rootDir, "projects", projectName+"-"+streamName)
	assert.Equal(t, expectedDir, streamDir)

	// Verify directory exists
	info, err := os.Stat(streamDir)
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestStreamStore_CreateStreamDir_DuplicateError(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)

	projectName := "test-project"
	streamName := "feature-1"

	// Create once successfully
	_, err = streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Attempt to create duplicate should fail
	_, err = streamStore.CreateStreamDir(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestStreamStore_WriteAndReadStreamMeta(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)

	projectName := "test-project"
	streamName := "feature-1"

	// Create stream directory
	_, err = streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Create stream metadata
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: "2026-02-12T10:30:00Z",
		UpdatedAt: "2026-02-12T10:30:00Z",
	}

	// Write metadata
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	// Read metadata back
	readMeta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, readMeta)

	// Verify all fields match
	assert.Equal(t, meta.Name, readMeta.Name)
	assert.Equal(t, meta.Project, readMeta.Project)
	assert.Equal(t, meta.Status, readMeta.Status)
	assert.Equal(t, meta.Type, readMeta.Type)
	assert.Equal(t, meta.CreatedAt, readMeta.CreatedAt)
	assert.Equal(t, meta.UpdatedAt, readMeta.UpdatedAt)
}

func TestStreamStore_StreamDirExists(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)

	projectName := "test-project"
	streamName := "feature-1"

	// Should not exist initially
	exists := streamStore.StreamDirExists(projectName, streamName)
	assert.False(t, exists)

	// Create stream directory
	_, err = streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Should exist now
	exists = streamStore.StreamDirExists(projectName, streamName)
	assert.True(t, exists)
}

func TestStreamMeta_JSONSerialization_UsesCamelCase(t *testing.T) {
	meta := types.StreamMeta{
		Name:      "payment-integration",
		Project:   "my-app",
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		Phase:     "",
		Branch:    "",
		Worktree:  "",
		CreatedAt: "2026-02-12T10:30:00Z",
		UpdatedAt: "2026-02-12T10:30:00Z",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(meta)
	require.NoError(t, err)

	// Parse back as map to verify field names
	var jsonMap map[string]interface{}
	err = json.Unmarshal(jsonBytes, &jsonMap)
	require.NoError(t, err)

	// Verify camelCase field names exist
	assert.Contains(t, jsonMap, "name")
	assert.Contains(t, jsonMap, "project")
	assert.Contains(t, jsonMap, "status")
	assert.Contains(t, jsonMap, "type")
	assert.Contains(t, jsonMap, "createdAt")
	assert.Contains(t, jsonMap, "updatedAt")

	// Verify omitempty works - empty fields should not be present
	assert.NotContains(t, jsonMap, "phase")
	assert.NotContains(t, jsonMap, "branch")
	assert.NotContains(t, jsonMap, "worktree")

	// Verify no snake_case fields
	assert.NotContains(t, jsonMap, "created_at")
	assert.NotContains(t, jsonMap, "updated_at")
}

// Test helper: creates a test stream with specified timestamps
func createTestStream(t *testing.T, streamStore *StreamStore, projectName, streamName, updatedAt string) {
	t.Helper()

	// Create directory
	_, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Write metadata with specific UpdatedAt
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: updatedAt,
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)
}

func TestStreamStore_ListProjectStreams_EmptyProject(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)
	projectName := "test-project"

	// List streams for project with no streams
	streams, err := streamStore.ListProjectStreams(projectName)
	require.NoError(t, err)
	require.NotNil(t, streams)
	assert.Len(t, streams, 0)
	assert.Equal(t, []*types.StreamMeta{}, streams) // Empty slice, not nil
}

func TestStreamStore_ListProjectStreams_SingleStream(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)
	projectName := "test-project"

	// Create one stream
	createTestStream(t, streamStore, projectName, "feature-1", "2026-02-12T11:00:00Z")

	// List streams
	streams, err := streamStore.ListProjectStreams(projectName)
	require.NoError(t, err)
	require.Len(t, streams, 1)
	assert.Equal(t, "feature-1", streams[0].Name)
	assert.Equal(t, projectName, streams[0].Project)
}

func TestStreamStore_ListProjectStreams_MultipleSortedByUpdatedAt(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)
	projectName := "test-project"

	// Create streams with different UpdatedAt timestamps (T1 < T2 < T3)
	createTestStream(t, streamStore, projectName, "feature-1", "2026-02-12T10:00:00Z") // T1
	createTestStream(t, streamStore, projectName, "feature-2", "2026-02-12T12:00:00Z") // T3 (most recent)
	createTestStream(t, streamStore, projectName, "feature-3", "2026-02-12T11:00:00Z") // T2

	// List streams - should be sorted descending (T3, T2, T1)
	streams, err := streamStore.ListProjectStreams(projectName)
	require.NoError(t, err)
	require.Len(t, streams, 3)

	// Verify descending order by UpdatedAt
	assert.Equal(t, "feature-2", streams[0].Name) // Most recent (12:00)
	assert.Equal(t, "feature-3", streams[1].Name) // Middle (11:00)
	assert.Equal(t, "feature-1", streams[2].Name) // Oldest (10:00)
}

func TestStreamStore_ListProjectStreams_FiltersByProjectName(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)

	// Create streams for different projects
	createTestStream(t, streamStore, "project-a", "feature-1", "2026-02-12T10:00:00Z")
	createTestStream(t, streamStore, "project-a", "feature-2", "2026-02-12T11:00:00Z")
	createTestStream(t, streamStore, "project-b", "feature-1", "2026-02-12T12:00:00Z")

	// List project-a streams - should only include project-a
	streams, err := streamStore.ListProjectStreams("project-a")
	require.NoError(t, err)
	require.Len(t, streams, 2)
	assert.Equal(t, "feature-2", streams[0].Name)
	assert.Equal(t, "feature-1", streams[1].Name)

	// List project-b streams - should only include project-b
	streams, err = streamStore.ListProjectStreams("project-b")
	require.NoError(t, err)
	require.Len(t, streams, 1)
	assert.Equal(t, "feature-1", streams[0].Name)
}

func TestStreamStore_ListProjectStreams_SkipsCorruptedJSON(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)
	projectName := "test-project"

	// Create valid streams
	createTestStream(t, streamStore, projectName, "feature-1", "2026-02-12T10:00:00Z")
	createTestStream(t, streamStore, projectName, "feature-2", "2026-02-12T12:00:00Z")

	// Create corrupted stream directory with invalid stream.json
	corruptedDir := filepath.Join(rootDir, "projects", projectName+"-corrupted")
	err = os.MkdirAll(corruptedDir, 0755)
	require.NoError(t, err)
	corruptedJSONPath := filepath.Join(corruptedDir, "stream.json")
	err = os.WriteFile(corruptedJSONPath, []byte("invalid json content"), 0644)
	require.NoError(t, err)

	// List should skip corrupted stream and return only valid ones
	streams, err := streamStore.ListProjectStreams(projectName)
	require.NoError(t, err)
	require.Len(t, streams, 2)
	assert.Equal(t, "feature-2", streams[0].Name)
	assert.Equal(t, "feature-1", streams[1].Name)
}

func TestStreamStore_ListProjectStreams_VerifySortingOrder(t *testing.T) {
	rootDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := NewStreamStore(store)
	projectName := "test-project"

	// Create 3 streams with distinct timestamps
	createTestStream(t, streamStore, projectName, "oldest", "2026-02-10T10:00:00Z")
	createTestStream(t, streamStore, projectName, "newest", "2026-02-12T10:00:00Z")
	createTestStream(t, streamStore, projectName, "middle", "2026-02-11T10:00:00Z")

	// List and verify order
	streams, err := streamStore.ListProjectStreams(projectName)
	require.NoError(t, err)
	require.Len(t, streams, 3)

	// Order should be: newest, middle, oldest
	assert.Equal(t, "newest", streams[0].Name)
	assert.Equal(t, "middle", streams[1].Name)
	assert.Equal(t, "oldest", streams[2].Name)
}
