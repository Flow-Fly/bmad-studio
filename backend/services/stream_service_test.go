package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockHub records broadcast events for testing
type mockHub struct {
	events []*types.WebSocketEvent
}

func (m *mockHub) BroadcastEvent(event *types.WebSocketEvent) {
	m.events = append(m.events, event)
}

func setupStreamService(t *testing.T) (*StreamService, *storage.CentralStore, *mockHub, string) {
	t.Helper()

	rootDir := resolveDir(t, t.TempDir())
	store := storage.NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := storage.NewStreamStore(store)
	registryStore := storage.NewRegistryStore(store)
	hub := &mockHub{events: make([]*types.WebSocketEvent, 0)}

	streamService := NewStreamService(streamStore, registryStore, hub)

	return streamService, store, hub, rootDir
}

func TestStreamService_Create_Success(t *testing.T) {
	streamService, store, hub, rootDir := setupStreamService(t)

	// Register a project first
	projectName := "test-project"
	projectPath := filepath.Join(rootDir, "test-project-repo")
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)

	registryStore := storage.NewRegistryStore(store)
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: projectPath,
	})
	require.NoError(t, err)

	// Create stream
	streamName := "feature-1"
	meta, err := streamService.Create(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, meta)

	// Verify metadata fields
	assert.Equal(t, streamName, meta.Name)
	assert.Equal(t, projectName, meta.Project)
	assert.Equal(t, types.StreamStatusActive, meta.Status)
	assert.Equal(t, types.StreamTypeFull, meta.Type)
	assert.NotEmpty(t, meta.CreatedAt)
	assert.NotEmpty(t, meta.UpdatedAt)
	assert.Equal(t, meta.CreatedAt, meta.UpdatedAt)

	// Verify stream directory exists
	streamStore := storage.NewStreamStore(store)
	exists := streamStore.StreamDirExists(projectName, streamName)
	assert.True(t, exists)

	// Verify stream.json was written
	readMeta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	assert.Equal(t, meta.Name, readMeta.Name)

	// Verify WebSocket event was broadcast
	require.Len(t, hub.events, 1)
	event := hub.events[0]
	assert.Equal(t, types.EventTypeStreamCreated, event.Type)

	// Verify payload structure
	payloadBytes, err := json.Marshal(event.Payload)
	require.NoError(t, err)

	var payload types.StreamCreatedPayload
	err = json.Unmarshal(payloadBytes, &payload)
	require.NoError(t, err)

	assert.Equal(t, projectName, payload.ProjectID)
	assert.Equal(t, projectName+"-"+streamName, payload.StreamID)
	assert.Equal(t, streamName, payload.Name)
}

func TestStreamService_Create_DuplicateStreamName(t *testing.T) {
	streamService, store, _, rootDir := setupStreamService(t)

	// Register a project
	projectName := "test-project"
	projectPath := filepath.Join(rootDir, "test-project-repo")
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)

	registryStore := storage.NewRegistryStore(store)
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: projectPath,
	})
	require.NoError(t, err)

	// Create stream
	streamName := "feature-1"
	_, err = streamService.Create(projectName, streamName)
	require.NoError(t, err)

	// Attempt to create duplicate
	_, err = streamService.Create(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestStreamService_Create_InvalidStreamName(t *testing.T) {
	streamService, store, _, rootDir := setupStreamService(t)

	// Register a project
	projectName := "test-project"
	projectPath := filepath.Join(rootDir, "test-project-repo")
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)

	registryStore := storage.NewRegistryStore(store)
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: projectPath,
	})
	require.NoError(t, err)

	// Table-driven test for invalid names
	tests := []struct {
		name        string
		streamName  string
		description string
	}{
		{"empty", "", "empty name"},
		{"starts-with-hyphen", "-bad", "starts with hyphen"},
		{"starts-with-underscore", "_bad", "starts with underscore"},
		{"contains-spaces", "with spaces", "contains spaces"},
		{"special-chars", "special!chars", "contains special characters"},
		{"contains-at", "feature@v1", "contains @ character"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := streamService.Create(projectName, tt.streamName)
			require.Error(t, err, "expected error for: %s", tt.description)
			assert.Contains(t, err.Error(), "invalid stream name")
		})
	}
}

func TestStreamService_Create_ProjectNotFound(t *testing.T) {
	streamService, _, _, _ := setupStreamService(t)

	// Attempt to create stream for non-existent project
	_, err := streamService.Create("nonexistent-project", "feature-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "project not found")
}

func TestStreamService_Create_ValidStreamNames(t *testing.T) {
	streamService, store, _, rootDir := setupStreamService(t)

	// Register a project
	projectName := "test-project"
	projectPath := filepath.Join(rootDir, "test-project-repo")
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)

	registryStore := storage.NewRegistryStore(store)
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: projectPath,
	})
	require.NoError(t, err)

	// Table-driven test for valid names
	tests := []struct {
		name       string
		streamName string
	}{
		{"alphanumeric", "feature1"},
		{"with-hyphens", "payment-integration"},
		{"with-underscores", "auth_refactor"},
		{"mixed", "feature-v2_final"},
		{"starts-with-letter", "a123"},
		{"starts-with-number", "1feature"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta, err := streamService.Create(projectName, tt.streamName)
			require.NoError(t, err, "expected valid name: %s", tt.streamName)
			assert.Equal(t, tt.streamName, meta.Name)
		})
	}
}

func TestStreamService_Create_StreamJSONPersistsCorrectly(t *testing.T) {
	streamService, store, _, rootDir := setupStreamService(t)

	// Register a project
	projectName := "test-project"
	projectPath := filepath.Join(rootDir, "test-project-repo")
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)

	registryStore := storage.NewRegistryStore(store)
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: projectPath,
	})
	require.NoError(t, err)

	// Create stream
	streamName := "payment-integration"
	meta, err := streamService.Create(projectName, streamName)
	require.NoError(t, err)

	// Read stream.json directly from disk
	streamDir := filepath.Join(store.RootDir(), "projects", projectName+"-"+streamName)
	streamJSONPath := filepath.Join(streamDir, "stream.json")

	data, err := os.ReadFile(streamJSONPath)
	require.NoError(t, err)

	// Parse and verify
	var diskMeta types.StreamMeta
	err = json.Unmarshal(data, &diskMeta)
	require.NoError(t, err)

	assert.Equal(t, meta.Name, diskMeta.Name)
	assert.Equal(t, meta.Project, diskMeta.Project)
	assert.Equal(t, meta.Status, diskMeta.Status)
	assert.Equal(t, meta.Type, diskMeta.Type)
	assert.Equal(t, meta.CreatedAt, diskMeta.CreatedAt)
	assert.Equal(t, meta.UpdatedAt, diskMeta.UpdatedAt)
}
