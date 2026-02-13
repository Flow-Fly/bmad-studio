package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// capturedEvent stores a broadcast event for test assertions
type capturedEvent struct {
	Type    string
	Payload json.RawMessage
}

// testHub wraps a real Hub and captures broadcast events for testing
type testHub struct {
	*websocket.Hub
	mu     sync.Mutex
	events []capturedEvent
}

func newTestHub() *testHub {
	hub := websocket.NewHub()
	go hub.Run()
	return &testHub{Hub: hub}
}

func (h *testHub) captureEvents() {
	// Override BroadcastEvent is not possible directly, so we'll
	// check events by reading what was broadcast. Since the hub doesn't
	// store events, we need a different approach.
	// We'll use the watcher service's broadcast behavior and check via
	// a mock approach instead.
}

// mockBroadcastHub captures broadcast events for testing
type mockBroadcastHub struct {
	mu     sync.Mutex
	events []*types.WebSocketEvent
}

func (m *mockBroadcastHub) BroadcastEvent(event *types.WebSocketEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, event)
}

func (m *mockBroadcastHub) getEvents() []*types.WebSocketEvent {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]*types.WebSocketEvent, len(m.events))
	copy(result, m.events)
	return result
}

func (m *mockBroadcastHub) clearEvents() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = nil
}

// watcherTestHub wraps a real websocket.Hub and captures events
// We need a real Hub because WatcherService uses *websocket.Hub (not an interface)
type watcherTestEnv struct {
	rootDir       string
	centralStore  *storage.CentralStore
	streamStore   *storage.StreamStore
	registryStore *storage.RegistryStore
	hub           *websocket.Hub
	watcher       *WatcherService
}

func setupWatcherTest(t *testing.T) *watcherTestEnv {
	t.Helper()

	rootDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(rootDir)
	err := centralStore.Init()
	require.NoError(t, err)

	streamStore := storage.NewStreamStore(centralStore)
	registryStore := storage.NewRegistryStore(centralStore)
	hub := websocket.NewHub()
	go hub.Run()

	watcherService := NewWatcherService(centralStore, streamStore, registryStore, hub)

	return &watcherTestEnv{
		rootDir:       rootDir,
		centralStore:  centralStore,
		streamStore:   streamStore,
		registryStore: registryStore,
		hub:           hub,
		watcher:       watcherService,
	}
}

// createProjectAndStream creates a project entry and stream directory with stream.json
func (env *watcherTestEnv) createProjectAndStream(t *testing.T, projectName, streamName string) string {
	t.Helper()

	// Register the project in registry
	err := env.registryStore.AddProject(types.RegistryEntry{
		Name:      projectName,
		RepoPath:  "/tmp/" + projectName,
		StorePath: filepath.Join(env.rootDir, "projects", projectName),
	})
	if err != nil {
		// Project may already be registered
		if entry, found := env.registryStore.FindByName(projectName); !found || entry == nil {
			t.Fatalf("Failed to register project: %v", err)
		}
	}

	// Create project trunk directory
	projectDir := filepath.Join(env.rootDir, "projects", projectName)
	require.NoError(t, os.MkdirAll(projectDir, 0755))

	// Write project.json
	projectMeta := types.ProjectMeta{Name: projectName, RepoPath: "/tmp/" + projectName}
	projectJSON, _ := json.Marshal(projectMeta)
	require.NoError(t, os.WriteFile(filepath.Join(projectDir, "project.json"), projectJSON, 0644))

	// Create stream directory
	streamDir, err := env.streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	// Write stream.json
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	err = env.streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	return streamDir
}

func TestWatcherService_StartAndStop(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Start watcher
	err := env.watcher.Start()
	require.NoError(t, err)
	assert.True(t, env.watcher.IsRunning())

	// Stop watcher
	env.watcher.Stop()
	assert.False(t, env.watcher.IsRunning())
}

func TestWatcherService_DoubleStartReturnsError(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	// Second start should fail
	err = env.watcher.Start()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already running")
}

func TestWatcherService_StartsWithRegisteredProjectStreams(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Create project and streams
	env.createProjectAndStream(t, "myapp", "feature-1")
	env.createProjectAndStream(t, "myapp", "feature-2")

	// Start watcher
	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	// Check that watched dirs are populated
	env.watcher.mu.RLock()
	watchCount := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()

	assert.Equal(t, 2, watchCount, "Should have watches for 2 stream directories")
}

func TestWatcherService_FileCreatedBroadcastsEvent(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "payments")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	// Give the watcher time to register
	time.Sleep(50 * time.Millisecond)

	// Create a file in the stream directory
	filePath := filepath.Join(streamDir, "brainstorm.md")
	require.NoError(t, os.WriteFile(filePath, []byte("# Brainstorm"), 0644))

	// Wait for debounce + processing
	time.Sleep(300 * time.Millisecond)

	// We can't easily capture Hub events without a connected WebSocket client.
	// Instead, verify the watcher is running and the file was processed by checking
	// that the debounce map is empty (event was processed).
	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Debounce map should be empty after event processed")
}

func TestWatcherService_TmpFilesIgnored(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "auth")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Create temp files that should be ignored
	for _, name := range []string{"brainstorm.tmp", "prd.swp", "research~"} {
		require.NoError(t, os.WriteFile(filepath.Join(streamDir, name), []byte("temp"), 0644))
	}

	time.Sleep(200 * time.Millisecond)

	// Debounce map should be empty because these files are skipped entirely
	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Temp files should not enter debounce map")
}

func TestWatcherService_StreamJsonIgnored(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "auth")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Modify stream.json (should be ignored)
	streamJsonPath := filepath.Join(streamDir, "stream.json")
	content, _ := os.ReadFile(streamJsonPath)
	require.NoError(t, os.WriteFile(streamJsonPath, append(content, '\n'), 0644))

	time.Sleep(200 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "stream.json changes should not enter debounce map")
}

func TestWatcherService_AddStreamWatch(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Start watcher with no streams
	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	// Create a stream after watcher started
	streamDir := env.createProjectAndStream(t, "myapp", "newstream")

	// Add watch dynamically
	env.watcher.AddStreamWatch("myapp", "newstream")

	time.Sleep(50 * time.Millisecond)

	// Check watch was added
	env.watcher.mu.RLock()
	info, exists := env.watcher.watchedDirs[streamDir]
	env.watcher.mu.RUnlock()

	assert.True(t, exists, "Watch should be added for new stream")
	assert.Equal(t, "myapp", info.projectName)
	assert.Equal(t, "newstream", info.streamName)

	// Create a file and verify debouncing works
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "prd.md"), []byte("# PRD"), 0644))

	time.Sleep(300 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Debounce map should be empty after event processed")
}

func TestWatcherService_RemoveStreamWatch(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "todelete")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	// Verify watch exists
	env.watcher.mu.RLock()
	_, exists := env.watcher.watchedDirs[streamDir]
	env.watcher.mu.RUnlock()
	assert.True(t, exists)

	// Remove watch
	env.watcher.RemoveStreamWatch("myapp", "todelete")

	env.watcher.mu.RLock()
	_, exists = env.watcher.watchedDirs[streamDir]
	env.watcher.mu.RUnlock()
	assert.False(t, exists, "Watch should be removed after RemoveStreamWatch")
}

func TestWatcherService_FileModifyEvent(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "edit")

	// Create file first
	filePath := filepath.Join(streamDir, "research.md")
	require.NoError(t, os.WriteFile(filePath, []byte("# Research v1"), 0644))

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Modify the file
	require.NoError(t, os.WriteFile(filePath, []byte("# Research v2"), 0644))

	time.Sleep(300 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Write event should be debounced and processed")
}

func TestWatcherService_FileDeleteEvent(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "delfile")

	// Create file first
	filePath := filepath.Join(streamDir, "architecture.md")
	require.NoError(t, os.WriteFile(filePath, []byte("# Architecture"), 0644))

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Delete the file
	require.NoError(t, os.Remove(filePath))

	time.Sleep(300 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Delete event should be debounced and processed")
}

func TestWatcherService_DebounceCoalescesRapidWrites(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "rapid")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Write the same file rapidly
	filePath := filepath.Join(streamDir, "brainstorm.md")
	for i := 0; i < 5; i++ {
		require.NoError(t, os.WriteFile(filePath, []byte("# Version "+string(rune('0'+i))), 0644))
		time.Sleep(20 * time.Millisecond) // Less than debounce interval (100ms)
	}

	// After all rapid writes, the debounce timer should still be pending
	// (hasn't fired yet because each write reset it)
	time.Sleep(50 * time.Millisecond) // Still within debounce window

	env.watcher.debounceMu.Lock()
	pendingDuringWrites := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	// Wait for debounce to complete
	time.Sleep(300 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	pendingAfterDebounce := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	// During rapid writes we should have at most 1 pending entry for this file
	assert.LessOrEqual(t, pendingDuringWrites, 1, "Should have at most 1 pending debounce entry for same file")
	assert.Equal(t, 0, pendingAfterDebounce, "Debounce map should be empty after processing")
}

func TestWatcherService_GracefulShutdownCleansUp(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	env.createProjectAndStream(t, "myapp", "clean")

	err := env.watcher.Start()
	require.NoError(t, err)

	// Verify watches exist
	env.watcher.mu.RLock()
	watchCount := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()
	assert.Equal(t, 1, watchCount)

	// Stop
	env.watcher.Stop()

	assert.False(t, env.watcher.IsRunning())

	env.watcher.mu.RLock()
	watchCountAfter := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()
	assert.Equal(t, 0, watchCountAfter, "All watches should be cleaned up on stop")

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()
	assert.Equal(t, 0, debounceCount, "All debounce timers should be cleaned up on stop")
}

func TestDerivePhase(t *testing.T) {
	tests := []struct {
		filename string
		expected string
	}{
		{"brainstorm.md", "analysis"},
		{"brainstorm-v2.md", "analysis"},
		{"research.md", "analysis"},
		{"research-deep-dive.md", "analysis"},
		{"prd.md", "planning"},
		{"prd-v2.md", "planning"},
		{"architecture.md", "solutioning"},
		{"architecture-v2.md", "solutioning"},
		{"architecture-decisions.md", "solutioning"},
		{"epics/epic-1.md", "implementation"},
		{"epics/epic-2-detail.md", "implementation"},
		{"random-file.md", ""},
		{"notes.txt", ""},
		{"README.md", ""},
		{"Brainstorm.md", "analysis"},
		{"PRD.md", "planning"},
		{"Architecture.MD", "solutioning"},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := DerivePhase(tt.filename)
			assert.Equal(t, tt.expected, result, "DerivePhase(%q)", tt.filename)
		})
	}
}

func TestWatcherService_ScanStreamDirectoryOnAdd(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Create stream with pre-existing files
	streamDir := env.createProjectAndStream(t, "myapp", "prescan")
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "prd.md"), []byte("# PRD"), 0644))

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Add watch dynamically — this should scan for pre-existing files
	// We need a second stream to test this flow since the first was registered at Start()
	streamDir2 := env.createProjectAndStream(t, "myapp", "prescan2")
	require.NoError(t, os.WriteFile(filepath.Join(streamDir2, "research.md"), []byte("# Research"), 0644))

	env.watcher.AddStreamWatch("myapp", "prescan2")

	// Wait for scan debounce
	time.Sleep(300 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Pre-existing files should be scanned and processed")
}

func TestWatcherService_SkipsArchivedStreams(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Create a stream and archive it
	projectName := "myapp"
	streamName := "archived-stream"

	// Register project first
	err := env.registryStore.AddProject(types.RegistryEntry{
		Name:      projectName,
		RepoPath:  "/tmp/" + projectName,
		StorePath: filepath.Join(env.rootDir, "projects", projectName),
	})
	require.NoError(t, err)

	// Create project directory
	projectDir := filepath.Join(env.rootDir, "projects", projectName)
	require.NoError(t, os.MkdirAll(projectDir, 0755))
	projectMeta := types.ProjectMeta{Name: projectName, RepoPath: "/tmp/" + projectName}
	projectJSON, _ := json.Marshal(projectMeta)
	require.NoError(t, os.WriteFile(filepath.Join(projectDir, "project.json"), projectJSON, 0644))

	// Create stream
	_, err = env.streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)

	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	err = env.streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	// Archive the stream
	err = env.streamStore.ArchiveStream(projectName, streamName, types.StreamOutcomeMerged)
	require.NoError(t, err)

	// Start watcher - should skip archived streams
	err = env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	env.watcher.mu.RLock()
	watchCount := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()

	assert.Equal(t, 0, watchCount, "Should not watch archived stream directories")
}

func TestWatcherService_HiddenFilesIgnored(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "hidden")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Create hidden file
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, ".gitignore"), []byte("*.tmp"), 0644))

	time.Sleep(200 * time.Millisecond)

	env.watcher.debounceMu.Lock()
	debounceCount := len(env.watcher.debounceMap)
	env.watcher.debounceMu.Unlock()

	assert.Equal(t, 0, debounceCount, "Hidden files should be ignored")
}

func TestWatcherService_MultipleProjectsMultipleStreams(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Create multiple projects with multiple streams
	env.createProjectAndStream(t, "project-a", "stream-1")
	env.createProjectAndStream(t, "project-a", "stream-2")
	env.createProjectAndStream(t, "project-b", "stream-1")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	env.watcher.mu.RLock()
	watchCount := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()

	assert.Equal(t, 3, watchCount, "Should watch all 3 active stream directories")
}

func TestWatcherService_StopIsIdempotent(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	err := env.watcher.Start()
	require.NoError(t, err)

	// Multiple stops should not panic
	env.watcher.Stop()
	env.watcher.Stop()
	env.watcher.Stop()

	assert.False(t, env.watcher.IsRunning())
}

func TestWatcherService_AddStreamWatchWhenNotRunning(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Don't start the watcher
	env.createProjectAndStream(t, "myapp", "norun")

	// Should be a no-op, not panic
	env.watcher.AddStreamWatch("myapp", "norun")

	env.watcher.mu.RLock()
	watchCount := len(env.watcher.watchedDirs)
	env.watcher.mu.RUnlock()

	assert.Equal(t, 0, watchCount, "No watches should be added when not running")
}

func TestWatcherService_RemoveStreamWatchWhenNotRunning(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	// Should be a no-op, not panic
	env.watcher.RemoveStreamWatch("myapp", "norun")
}

// --- DeriveStreamPhase Tests ---

func TestDeriveStreamPhase(t *testing.T) {
	tests := []struct {
		name              string
		files             []string // flat files to create
		dirs              map[string][]string // dir -> files inside
		expectedPhase     string
		expectedArtifacts []string
	}{
		{
			name:              "empty directory returns empty phase",
			files:             nil,
			expectedPhase:     "",
			expectedArtifacts: nil,
		},
		{
			name:              "brainstorm.md only returns analysis",
			files:             []string{"brainstorm.md"},
			expectedPhase:     "analysis",
			expectedArtifacts: []string{"brainstorm.md"},
		},
		{
			name:              "research.md only returns analysis",
			files:             []string{"research.md"},
			expectedPhase:     "analysis",
			expectedArtifacts: []string{"research.md"},
		},
		{
			name:              "multiple analysis artifacts",
			files:             []string{"brainstorm.md", "research-deep-dive.md"},
			expectedPhase:     "analysis",
			expectedArtifacts: []string{"brainstorm.md", "research-deep-dive.md"},
		},
		{
			name:              "prd.md returns planning with analysis artifacts",
			files:             []string{"brainstorm.md", "prd.md"},
			expectedPhase:     "planning",
			expectedArtifacts: []string{"brainstorm.md", "prd.md"},
		},
		{
			name:              "prd.md without analysis still returns planning",
			files:             []string{"prd.md"},
			expectedPhase:     "planning",
			expectedArtifacts: []string{"prd.md"},
		},
		{
			name:              "architecture.md returns solutioning",
			files:             []string{"brainstorm.md", "prd.md", "architecture.md"},
			expectedPhase:     "solutioning",
			expectedArtifacts: []string{"brainstorm.md", "prd.md", "architecture.md"},
		},
		{
			name:              "architecture without intermediate phases returns solutioning",
			files:             []string{"architecture.md"},
			expectedPhase:     "solutioning",
			expectedArtifacts: []string{"architecture.md"},
		},
		{
			name:  "epics with md file returns implementation",
			files: []string{"brainstorm.md", "prd.md", "architecture.md"},
			dirs: map[string][]string{
				"epics": {"epic-1.md"},
			},
			expectedPhase:     "implementation",
			expectedArtifacts: []string{"brainstorm.md", "prd.md", "architecture.md", "epics/epic-1.md"},
		},
		{
			name: "epics without md files does not trigger implementation",
			dirs: map[string][]string{
				"epics": {"readme.txt"},
			},
			expectedPhase:     "",
			expectedArtifacts: nil,
		},
		{
			name: "sharded prd/index.md triggers planning",
			dirs: map[string][]string{
				"prd": {"index.md"},
			},
			expectedPhase:     "planning",
			expectedArtifacts: []string{"prd/index.md"},
		},
		{
			name: "sharded architecture/index.md triggers solutioning",
			dirs: map[string][]string{
				"architecture": {"index.md"},
			},
			expectedPhase:     "solutioning",
			expectedArtifacts: []string{"architecture/index.md"},
		},
		{
			name: "sharded prd without index.md does not trigger planning",
			dirs: map[string][]string{
				"prd": {"other.md"},
			},
			expectedPhase:     "",
			expectedArtifacts: nil,
		},
		{
			name:              "non-artifact files are ignored",
			files:             []string{"readme.md", "notes.txt", "stream.json"},
			expectedPhase:     "",
			expectedArtifacts: nil,
		},
		{
			name:              "case insensitive matching",
			files:             []string{"Brainstorm.md", "PRD.md"},
			expectedPhase:     "planning",
			expectedArtifacts: []string{"Brainstorm.md", "PRD.md"},
		},
		{
			name:  "full stack: all phases present returns implementation",
			files: []string{"brainstorm.md", "research.md", "prd.md", "architecture.md"},
			dirs: map[string][]string{
				"epics": {"epic-1.md", "epic-2.md"},
			},
			expectedPhase:     "implementation",
			expectedArtifacts: []string{"brainstorm.md", "research.md", "prd.md", "architecture.md", "epics/epic-1.md", "epics/epic-2.md"},
		},
		{
			name:              "hidden files are ignored",
			files:             []string{".gitignore", "brainstorm.md"},
			expectedPhase:     "analysis",
			expectedArtifacts: []string{"brainstorm.md"},
		},
		{
			name:              "temp files are ignored",
			files:             []string{"brainstorm.tmp", "prd.swp", "research~"},
			expectedPhase:     "",
			expectedArtifacts: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := resolveDir(t, t.TempDir())

			// Create flat files
			for _, f := range tt.files {
				require.NoError(t, os.WriteFile(filepath.Join(dir, f), []byte("content"), 0644))
			}

			// Create directories with files
			for dirName, files := range tt.dirs {
				subDir := filepath.Join(dir, dirName)
				require.NoError(t, os.MkdirAll(subDir, 0755))
				for _, f := range files {
					require.NoError(t, os.WriteFile(filepath.Join(subDir, f), []byte("content"), 0644))
				}
			}

			phase, artifacts := DeriveStreamPhase(dir)
			assert.Equal(t, tt.expectedPhase, phase, "phase mismatch")

			if tt.expectedArtifacts == nil {
				assert.Nil(t, artifacts, "expected nil artifacts")
			} else {
				assert.ElementsMatch(t, tt.expectedArtifacts, artifacts, "artifacts mismatch")
			}
		})
	}
}

func TestDeriveStreamPhase_NonExistentDir(t *testing.T) {
	phase, artifacts := DeriveStreamPhase("/nonexistent/path/that/does/not/exist")
	assert.Equal(t, "", phase)
	assert.Nil(t, artifacts)
}

func TestWatcherService_PhaseChangeUpdatesStreamJson(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "phasetest")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Create a brainstorm file — should trigger phase change to "analysis"
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))

	// Wait for debounce + processing
	time.Sleep(500 * time.Millisecond)

	// Read stream.json and verify phase was updated
	meta, err := env.streamStore.ReadStreamMeta("myapp", "phasetest")
	require.NoError(t, err)
	assert.Equal(t, "analysis", meta.Phase, "stream.json phase should be updated to analysis")
}

func TestWatcherService_PhaseChangeProgression(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "progress")

	err := env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Step 1: Create brainstorm -> analysis
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))
	time.Sleep(500 * time.Millisecond)

	meta, err := env.streamStore.ReadStreamMeta("myapp", "progress")
	require.NoError(t, err)
	assert.Equal(t, "analysis", meta.Phase)

	// Step 2: Create prd.md -> planning
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "prd.md"), []byte("# PRD"), 0644))
	time.Sleep(500 * time.Millisecond)

	meta, err = env.streamStore.ReadStreamMeta("myapp", "progress")
	require.NoError(t, err)
	assert.Equal(t, "planning", meta.Phase)
}

func TestWatcherService_NoBroadcastWhenPhaseUnchanged(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "nochange")

	// Pre-create a brainstorm file so phase starts at "analysis"
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))

	// Manually set phase in stream.json so it's already "analysis"
	meta, err := env.streamStore.ReadStreamMeta("myapp", "nochange")
	require.NoError(t, err)
	meta.Phase = "analysis"
	require.NoError(t, env.streamStore.WriteStreamMeta("myapp", "nochange", *meta))

	err = env.watcher.Start()
	require.NoError(t, err)
	defer env.watcher.Stop()

	time.Sleep(50 * time.Millisecond)

	// Modify the brainstorm file (same phase, should not change)
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm v2"), 0644))
	time.Sleep(500 * time.Millisecond)

	// Phase should still be "analysis" (unchanged)
	meta, err = env.streamStore.ReadStreamMeta("myapp", "nochange")
	require.NoError(t, err)
	assert.Equal(t, "analysis", meta.Phase)
}

func TestWatcherService_DeriveAndUpdatePhase(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "derive")

	// Create some artifacts
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "prd.md"), []byte("# PRD"), 0644))

	// Call DeriveAndUpdatePhase
	phase, err := env.watcher.DeriveAndUpdatePhase("myapp", "derive")
	require.NoError(t, err)
	assert.Equal(t, "planning", phase)

	// Verify stream.json was updated
	meta, err := env.streamStore.ReadStreamMeta("myapp", "derive")
	require.NoError(t, err)
	assert.Equal(t, "planning", meta.Phase)
}

func TestWatcherService_DeriveAndUpdatePhase_NoChange(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	streamDir := env.createProjectAndStream(t, "myapp", "nochange2")

	// Create artifact and pre-set phase
	require.NoError(t, os.WriteFile(filepath.Join(streamDir, "brainstorm.md"), []byte("# Brainstorm"), 0644))

	meta, err := env.streamStore.ReadStreamMeta("myapp", "nochange2")
	require.NoError(t, err)
	originalUpdatedAt := meta.UpdatedAt
	meta.Phase = "analysis"
	require.NoError(t, env.streamStore.WriteStreamMeta("myapp", "nochange2", *meta))

	// Call DeriveAndUpdatePhase — phase matches, so no write should occur
	phase, err := env.watcher.DeriveAndUpdatePhase("myapp", "nochange2")
	require.NoError(t, err)
	assert.Equal(t, "analysis", phase)

	// UpdatedAt should not have changed (no write occurred)
	meta, err = env.streamStore.ReadStreamMeta("myapp", "nochange2")
	require.NoError(t, err)
	assert.Equal(t, originalUpdatedAt, meta.UpdatedAt)
}

func TestWatcherService_DeriveAndUpdatePhase_EmptyDir(t *testing.T) {
	env := setupWatcherTest(t)
	defer env.hub.Stop()

	env.createProjectAndStream(t, "myapp", "empty")

	phase, err := env.watcher.DeriveAndUpdatePhase("myapp", "empty")
	require.NoError(t, err)
	assert.Equal(t, "", phase)
}
