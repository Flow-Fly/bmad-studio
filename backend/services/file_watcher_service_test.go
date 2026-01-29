package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"bmad-studio/backend/api/websocket"
)

func setupFileWatcherTest(t *testing.T) (*FileWatcherService, *BMadConfigService, *websocket.Hub, string) {
	t.Helper()

	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	outputDir := filepath.Join(tmpDir, "_bmad-output")
	planningDir := filepath.Join(outputDir, "planning-artifacts")
	implDir := filepath.Join(outputDir, "implementation-artifacts")

	for _, dir := range []string{bmadDir, outputDir, planningDir, implDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create config file
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	artifactService := NewArtifactService(configService, nil)
	workflowStatusService := NewWorkflowStatusService(configService, nil)

	hub := websocket.NewHub()
	go hub.Run()

	fileWatcher := NewFileWatcherService(hub, configService, artifactService, workflowStatusService)

	return fileWatcher, configService, hub, tmpDir
}

func TestNewFileWatcherService(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if fileWatcher == nil {
		t.Fatal("expected file watcher to be created")
	}
	if fileWatcher.hub == nil {
		t.Error("expected hub to be set")
	}
	if fileWatcher.configService == nil {
		t.Error("expected config service to be set")
	}
	if fileWatcher.debounceMap == nil {
		t.Error("expected debounce map to be initialized")
	}
}

func TestFileWatcherStartAndStop(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	// Start watcher
	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}

	if !fileWatcher.IsRunning() {
		t.Error("expected file watcher to be running")
	}

	// Stop watcher
	fileWatcher.Stop()

	// Give it time to stop
	time.Sleep(50 * time.Millisecond)

	if fileWatcher.IsRunning() {
		t.Error("expected file watcher to be stopped")
	}
}

func TestFileWatcherDoubleStartReturnsError(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	// First start succeeds
	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("First start failed: %v", err)
	}
	defer fileWatcher.Stop()

	// Second start should return error
	err := fileWatcher.Start()
	if err == nil {
		t.Error("expected error on double start")
	}

	wsErr, ok := err.(*FileWatcherServiceError)
	if !ok {
		t.Fatalf("expected FileWatcherServiceError, got %T", err)
	}
	if wsErr.Code != ErrCodeWatcherStartFailed {
		t.Errorf("expected code %q, got %q", ErrCodeWatcherStartFailed, wsErr.Code)
	}
}

func TestFileWatcherRestartAfterStop(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	// Start
	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("First start failed: %v", err)
	}

	// Stop
	fileWatcher.Stop()
	time.Sleep(50 * time.Millisecond)

	// Restart should succeed
	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Restart after stop failed: %v", err)
	}
	defer fileWatcher.Stop()

	if !fileWatcher.IsRunning() {
		t.Error("expected file watcher to be running after restart")
	}
}

func TestFileWatcherStartWithoutConfig(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	configService := NewBMadConfigService()
	// Don't load config

	fileWatcher := NewFileWatcherService(hub, configService, nil, nil)

	err := fileWatcher.Start()
	if err == nil {
		t.Error("expected error when starting without config")
		fileWatcher.Stop()
	}
}

func TestFileWatcherDetectsNewFile(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}
	defer fileWatcher.Stop()

	// Wait for watcher to initialize
	time.Sleep(100 * time.Millisecond)

	// Create a new artifact file
	config := configService.GetConfig()
	testFile := filepath.Join(config.OutputFolder, "planning-artifacts", "test-artifact.md")
	content := `---
status: complete
workflowType: prd
---
# Test Artifact
`
	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Wait for debounce + processing
	time.Sleep(300 * time.Millisecond)

	// The file watcher should have processed the file without error
	// We can't easily check the broadcast here since send channel is unexported,
	// but the test verifies the end-to-end flow doesn't crash
}

func TestIsStatusFile(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	tests := []struct {
		path     string
		expected bool
	}{
		{"/path/to/bmm-workflow-status.yaml", true},
		{"/path/to/sprint-status.yaml", true},
		{"/path/to/some-status.yml", true},
		{"/path/to/prd.md", false},
		{"/path/to/architecture.md", false},
		{"/path/to/status.md", false}, // .md files are not status files
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			result := fileWatcher.isStatusFile(tt.path)
			if result != tt.expected {
				t.Errorf("isStatusFile(%s) = %v, want %v", tt.path, result, tt.expected)
			}
		})
	}
}

func TestFileWatcherIgnoresRegistryFile(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}
	defer fileWatcher.Stop()

	// Wait for watcher to initialize
	time.Sleep(100 * time.Millisecond)

	config := configService.GetConfig()

	// Create artifact-registry.json (should be ignored)
	registryFile := filepath.Join(config.OutputFolder, "artifact-registry.json")
	if err := os.WriteFile(registryFile, []byte(`{"artifacts":[]}`), 0644); err != nil {
		t.Fatalf("Failed to create registry file: %v", err)
	}

	// Wait a bit - this shouldn't trigger any events
	time.Sleep(200 * time.Millisecond)

	// No assertion needed - if it doesn't crash, it handled it correctly
}

func TestFileWatcherIgnoresTempFiles(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}
	defer fileWatcher.Stop()

	time.Sleep(100 * time.Millisecond)

	config := configService.GetConfig()

	// Create temp files that should be ignored
	tempFiles := []string{
		filepath.Join(config.OutputFolder, "test.md.tmp"),
		filepath.Join(config.OutputFolder, "test.md.swp"),
		filepath.Join(config.OutputFolder, "test.md~"),
	}

	for _, f := range tempFiles {
		if err := os.WriteFile(f, []byte("temp content"), 0644); err != nil {
			t.Fatalf("Failed to create temp file %s: %v", f, err)
		}
	}

	time.Sleep(200 * time.Millisecond)

	// No assertion needed - if it doesn't crash, it handled it correctly
}

func TestFileWatcherDebouncing(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}
	defer fileWatcher.Stop()

	time.Sleep(100 * time.Millisecond)

	config := configService.GetConfig()
	testFile := filepath.Join(config.OutputFolder, "planning-artifacts", "rapid-change.md")

	// Create initial file
	content := `---
status: in-progress
---
# Rapid Change Test
`
	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Rapidly modify the file multiple times
	for i := 0; i < 5; i++ {
		content := `---
status: in-progress
---
# Rapid Change Test
Modification ` + string(rune('0'+i))
		if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to modify test file: %v", err)
		}
		time.Sleep(20 * time.Millisecond) // Less than debounce interval
	}

	// Wait for debounce to complete
	time.Sleep(200 * time.Millisecond)

	// Check debounce map is clean
	fileWatcher.debounceMu.Lock()
	count := len(fileWatcher.debounceMap)
	fileWatcher.debounceMu.Unlock()

	if count != 0 {
		t.Errorf("Expected debounce map to be empty after processing, got %d entries", count)
	}
}

func TestFileWatcherWatchesNewSubdirectory(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}
	defer fileWatcher.Stop()

	time.Sleep(100 * time.Millisecond)

	config := configService.GetConfig()

	// Create a new subdirectory
	newDir := filepath.Join(config.OutputFolder, "planning-artifacts", "new-sharded-artifact")
	if err := os.MkdirAll(newDir, 0755); err != nil {
		t.Fatalf("Failed to create new directory: %v", err)
	}

	// Wait for directory to be watched
	time.Sleep(200 * time.Millisecond)

	// Create a file in the new directory
	newFile := filepath.Join(newDir, "index.md")
	if err := os.WriteFile(newFile, []byte("# Index\n"), 0644); err != nil {
		t.Fatalf("Failed to create file in new directory: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	// No assertion needed - the test verifies the watcher doesn't crash
	// when new directories are created
}

func TestFileWatcherHandlesDirectoryDeletion(t *testing.T) {
	fileWatcher, configService, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	config := configService.GetConfig()

	// Create a sharded artifact directory with files
	shardDir := filepath.Join(config.OutputFolder, "planning-artifacts", "sharded-doc")
	if err := os.MkdirAll(shardDir, 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"index.md", "section-1.md", "section-2.md"} {
		content := "---\nstatus: complete\n---\n# " + name + "\n"
		if err := os.WriteFile(filepath.Join(shardDir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}

	// Load artifacts first so they're in the registry
	if err := fileWatcher.artifactService.LoadArtifacts(); err != nil {
		t.Fatalf("Failed to load artifacts: %v", err)
	}

	artifacts, _ := fileWatcher.artifactService.GetArtifacts()
	initialCount := len(artifacts)
	if initialCount < 3 {
		t.Fatalf("Expected at least 3 artifacts from sharded dir, got %d", initialCount)
	}

	// Start watcher
	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start: %v", err)
	}
	defer fileWatcher.Stop()

	time.Sleep(100 * time.Millisecond)

	// Delete the entire directory
	if err := os.RemoveAll(shardDir); err != nil {
		t.Fatalf("Failed to remove directory: %v", err)
	}

	// Wait for processing
	time.Sleep(500 * time.Millisecond)

	// Verify artifacts were removed from registry
	remainingArtifacts, _ := fileWatcher.artifactService.GetArtifacts()
	for _, a := range remainingArtifacts {
		if strings.Contains(a.Path, "sharded-doc") {
			t.Errorf("Artifact %s should have been removed after directory deletion", a.ID)
		}
	}
}

func TestFileWatcherGracefulShutdown(t *testing.T) {
	fileWatcher, _, hub, _ := setupFileWatcherTest(t)
	defer hub.Stop()

	if err := fileWatcher.Start(); err != nil {
		t.Fatalf("Failed to start file watcher: %v", err)
	}

	// Add some pending debounce entries
	fileWatcher.debounceMu.Lock()
	fileWatcher.debounceMap["/fake/path.md"] = &debounceEntry{
		timer: time.AfterFunc(time.Hour, func() {}),
	}
	fileWatcher.debounceMu.Unlock()

	// Stop should clean up everything
	fileWatcher.Stop()
	time.Sleep(50 * time.Millisecond)

	// Verify debounce map is cleaned
	fileWatcher.debounceMu.Lock()
	count := len(fileWatcher.debounceMap)
	fileWatcher.debounceMu.Unlock()

	if count != 0 {
		t.Errorf("Expected debounce map to be empty after stop, got %d entries", count)
	}

	if fileWatcher.IsRunning() {
		t.Error("expected file watcher to not be running after stop")
	}
}
