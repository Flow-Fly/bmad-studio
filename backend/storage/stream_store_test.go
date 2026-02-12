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
