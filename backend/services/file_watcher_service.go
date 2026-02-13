package services

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/types"

	"github.com/fsnotify/fsnotify"
)

const (
	// debounceInterval is the time to wait before processing file changes
	debounceInterval = 100 * time.Millisecond
)

// FileWatcherServiceError represents a structured error from the file watcher service
type FileWatcherServiceError struct {
	Code    string
	Message string
}

func (e *FileWatcherServiceError) Error() string {
	return e.Message
}

// Error codes for file watcher service
const (
	ErrCodeWatcherCreateFailed = "watcher_create_failed"
	ErrCodeWatcherStartFailed  = "watcher_start_failed"
	ErrCodeWatcherAddFailed    = "watcher_add_failed"
)

// debounceEntry tracks pending file change processing
type debounceEntry struct {
	timer     *time.Timer
	lastOp    fsnotify.Op
	hadDelete bool // tracks if a delete occurred in this debounce window
}

// Deprecated: FileWatcherService is replaced by WatcherService for central store (Story 3.1).
// FileWatcherService watches the output folder for file changes
type FileWatcherService struct {
	mu                    sync.RWMutex
	hub                   *websocket.Hub
	configService         *BMadConfigService
	artifactService       *ArtifactService
	workflowStatusService *WorkflowStatusService
	watcher               *fsnotify.Watcher
	debounceMap           map[string]*debounceEntry
	debounceMu            sync.Mutex
	done                  chan struct{}
	running               bool
	watchedDirs           map[string]bool
}

// NewFileWatcherService creates a new FileWatcherService instance
func NewFileWatcherService(
	hub *websocket.Hub,
	configService *BMadConfigService,
	artifactService *ArtifactService,
	workflowStatusService *WorkflowStatusService,
) *FileWatcherService {
	return &FileWatcherService{
		hub:                   hub,
		configService:         configService,
		artifactService:       artifactService,
		workflowStatusService: workflowStatusService,
		debounceMap:           make(map[string]*debounceEntry),
		done:                  make(chan struct{}),
		watchedDirs:           make(map[string]bool),
	}
}

// Start initializes the file watcher and begins watching the output folder
func (s *FileWatcherService) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return &FileWatcherServiceError{
			Code:    ErrCodeWatcherStartFailed,
			Message: "File watcher is already running",
		}
	}
	s.running = true
	s.mu.Unlock()

	config := s.configService.GetConfig()
	if config == nil {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
		return &FileWatcherServiceError{
			Code:    ErrCodeWatcherStartFailed,
			Message: "BMadConfigService has no config loaded",
		}
	}

	// Create fsnotify watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
		return &FileWatcherServiceError{
			Code:    ErrCodeWatcherCreateFailed,
			Message: "Failed to create file watcher: " + err.Error(),
		}
	}

	s.mu.Lock()
	s.watcher = watcher
	s.done = make(chan struct{})
	s.mu.Unlock()

	// Add output folder recursively
	outputFolder := config.OutputFolder
	if err := s.addWatchRecursive(outputFolder); err != nil {
		log.Printf("Warning: Failed to add initial watch paths: %v", err)
	}

	// Start event processing goroutine
	go s.processEvents()

	log.Printf("File watcher started for: %s", outputFolder)
	return nil
}

// Stop gracefully shuts down the file watcher
func (s *FileWatcherService) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	s.watchedDirs = make(map[string]bool)
	s.mu.Unlock()

	close(s.done)

	s.mu.RLock()
	watcher := s.watcher
	s.mu.RUnlock()

	if watcher != nil {
		watcher.Close()
	}

	// Cancel all pending debounce timers
	s.debounceMu.Lock()
	for path, entry := range s.debounceMap {
		if entry.timer != nil {
			entry.timer.Stop()
		}
		delete(s.debounceMap, path)
	}
	s.debounceMu.Unlock()

	log.Println("File watcher stopped")
}

// IsRunning returns whether the file watcher is currently running
func (s *FileWatcherService) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// addWatchRecursive adds a path and all subdirectories to the watcher
func (s *FileWatcherService) addWatchRecursive(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("Warning: Error accessing %s: %v", path, err)
			return nil // Continue on error
		}
		if info.IsDir() {
			// Skip hidden directories
			if strings.HasPrefix(info.Name(), ".") && path != root {
				return filepath.SkipDir
			}

			s.mu.RLock()
			watcher := s.watcher
			s.mu.RUnlock()

			if watcher != nil {
				if err := watcher.Add(path); err != nil {
					log.Printf("Warning: Failed to watch %s: %v", path, err)
				} else {
					s.mu.Lock()
					s.watchedDirs[path] = true
					s.mu.Unlock()
				}
			}
		}
		return nil
	})
}

// processEvents handles file system events
func (s *FileWatcherService) processEvents() {
	for {
		s.mu.RLock()
		watcher := s.watcher
		s.mu.RUnlock()

		if watcher == nil {
			return
		}

		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			s.handleEvent(event)

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("File watcher error: %v", err)

		case <-s.done:
			return
		}
	}
}

// handleEvent processes a single file system event with debouncing
func (s *FileWatcherService) handleEvent(event fsnotify.Event) {
	path := filepath.Clean(event.Name)

	// Skip artifact-registry.json (our output)
	if strings.HasSuffix(path, "artifact-registry.json") {
		return
	}

	// Skip temporary/swap files
	if strings.HasSuffix(path, ".tmp") || strings.HasSuffix(path, ".swp") || strings.HasSuffix(path, "~") {
		return
	}

	// Handle directory events
	if event.Has(fsnotify.Create) {
		info, err := os.Stat(path)
		if err == nil && info.IsDir() {
			s.mu.RLock()
			watcher := s.watcher
			s.mu.RUnlock()

			if watcher != nil {
				if err := watcher.Add(path); err != nil {
					log.Printf("Warning: Failed to watch new directory %s: %v", path, err)
				} else {
					s.mu.Lock()
					s.watchedDirs[path] = true
					s.mu.Unlock()
					log.Printf("Now watching new directory: %s", path)
				}
				// Scan directory for files that may have been created before watch was established
				s.scanDirectoryForExistingFiles(path)
			}
			return
		}
	}

	// Handle directory deletion/rename - remove all child artifacts
	if event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename) {
		s.mu.RLock()
		isWatchedDir := s.watchedDirs[path]
		s.mu.RUnlock()
		if isWatchedDir {
			s.mu.Lock()
			delete(s.watchedDirs, path)
			s.mu.Unlock()
			s.handleDirectoryDelete(path)
			return
		}
	}

	// Only process .md and .yaml/.yml files
	ext := strings.ToLower(filepath.Ext(path))
	if ext != ".md" && ext != ".yaml" && ext != ".yml" {
		return
	}

	// Per-file debouncing
	s.debounceMu.Lock()
	defer s.debounceMu.Unlock()

	// Track whether a delete occurred in this debounce window
	hadDelete := event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename)

	// Cancel existing timer for this path, preserving delete tracking
	if entry, exists := s.debounceMap[path]; exists {
		entry.timer.Stop()
		if entry.hadDelete {
			hadDelete = true
		}
	}

	// Create new timer
	currentOp := event.Op
	currentHadDelete := hadDelete
	s.debounceMap[path] = &debounceEntry{
		timer: time.AfterFunc(debounceInterval, func() {
			// If file was deleted then recreated in same window, process both
			if currentHadDelete && currentOp.Has(fsnotify.Create) {
				s.processFileChange(path, fsnotify.Remove)
				s.processFileChange(path, fsnotify.Create)
			} else {
				s.processFileChange(path, currentOp)
			}
			s.debounceMu.Lock()
			delete(s.debounceMap, path)
			s.debounceMu.Unlock()
		}),
		lastOp:    event.Op,
		hadDelete: currentHadDelete,
	}
}

// processFileChange handles a debounced file change
func (s *FileWatcherService) processFileChange(path string, op fsnotify.Op) {
	log.Printf("Processing file change: %s (op: %v)", path, op)

	if s.isStatusFile(path) {
		s.handleStatusFileChange(path)
		return
	}

	// Only process .md files for artifact operations
	if !strings.HasSuffix(path, ".md") {
		return
	}

	switch {
	case op.Has(fsnotify.Remove) || op.Has(fsnotify.Rename):
		s.handleDelete(path)
	case op.Has(fsnotify.Create):
		s.handleCreate(path)
		s.handleStatusFileChange(path)
	case op.Has(fsnotify.Write):
		s.handleModify(path)
	}
}

// isStatusFile checks if the path is a workflow/sprint status file
func (s *FileWatcherService) isStatusFile(path string) bool {
	filename := filepath.Base(path)
	return strings.HasSuffix(filename, "status.yaml") ||
		strings.HasSuffix(filename, "status.yml")
}

// handleCreate handles a new .md file being created
func (s *FileWatcherService) handleCreate(path string) {
	artifact, err := s.artifactService.ProcessSingleArtifact(path)
	if err != nil {
		log.Printf("Warning: Failed to process new artifact %s: %v", path, err)
		return
	}

	if artifact != nil {
		s.hub.BroadcastEvent(types.NewArtifactCreatedEvent(artifact))
		log.Printf("Broadcast artifact:created for %s", artifact.ID)
	}
}

// handleModify handles a .md file being modified
func (s *FileWatcherService) handleModify(path string) {
	artifact, err := s.artifactService.ProcessSingleArtifact(path)
	if err != nil {
		log.Printf("Warning: Failed to re-process artifact %s: %v", path, err)
		return
	}

	if artifact != nil {
		s.hub.BroadcastEvent(types.NewArtifactUpdatedEvent(artifact))
		log.Printf("Broadcast artifact:updated for %s", artifact.ID)
	}
}

// handleDelete handles a .md file being deleted
func (s *FileWatcherService) handleDelete(path string) {
	artifact, err := s.artifactService.RemoveArtifact(path)
	if err != nil {
		log.Printf("Warning: Failed to remove artifact %s: %v", path, err)
		return
	}

	if artifact != nil {
		s.hub.BroadcastEvent(types.NewArtifactDeletedEvent(artifact.ID, artifact.Path))
		log.Printf("Broadcast artifact:deleted for %s", artifact.ID)
	}
}

// handleDirectoryDelete handles a directory being deleted or renamed
// Removes all artifacts whose paths are under the deleted directory
func (s *FileWatcherService) handleDirectoryDelete(dirPath string) {
	config := s.configService.GetConfig()
	if config == nil {
		return
	}

	// Calculate relative path prefix
	relativeDirPath, err := filepath.Rel(config.ProjectRoot, dirPath)
	if err != nil {
		relativeDirPath = dirPath
	}
	relativeDirPath = filepath.ToSlash(relativeDirPath)

	// Find and remove all artifacts under this directory
	artifacts, err2 := s.artifactService.GetArtifacts()
	if err2 != nil {
		log.Printf("Warning: Failed to get artifacts for directory delete: %v", err2)
		return
	}
	for _, artifact := range artifacts {
		if strings.HasPrefix(artifact.Path, relativeDirPath+"/") {
			removed, err := s.artifactService.RemoveArtifact(filepath.Join(config.ProjectRoot, artifact.Path))
			if err != nil {
				log.Printf("Warning: Failed to remove artifact %s during directory delete: %v", artifact.ID, err)
				continue
			}
			if removed != nil {
				event := types.NewArtifactDeletedEvent(removed.ID, removed.Path)
				s.hub.BroadcastEvent(event)
				log.Printf("Broadcast artifact:deleted for %s (directory removed)", removed.ID)
			}
		}
	}
}

// scanDirectoryForExistingFiles scans a newly watched directory for files
// that may have been created before the watch was established
func (s *FileWatcherService) scanDirectoryForExistingFiles(dirPath string) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		log.Printf("Warning: Failed to scan new directory %s: %v", dirPath, err)
		return
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		filePath := filepath.Join(dirPath, entry.Name())

		s.debounceMu.Lock()
		if _, exists := s.debounceMap[filePath]; !exists {
			s.debounceMap[filePath] = &debounceEntry{
				timer: time.AfterFunc(debounceInterval, func() {
					s.processFileChange(filePath, fsnotify.Create)
					s.debounceMu.Lock()
					delete(s.debounceMap, filePath)
					s.debounceMu.Unlock()
				}),
				lastOp: fsnotify.Create,
			}
		}
		s.debounceMu.Unlock()
	}
}

// handleStatusFileChange reloads workflow status and broadcasts the change
func (s *FileWatcherService) handleStatusFileChange(path string) {
	if err := s.workflowStatusService.Reload(); err != nil {
		log.Printf("Warning: Failed to reload workflow status: %v", err)
		return
	}

	status, err := s.workflowStatusService.GetStatus()
	if err != nil {
		log.Printf("Warning: Failed to get workflow status: %v", err)
		return
	}

	s.hub.BroadcastEvent(types.NewWorkflowStatusChangedEvent(status.WorkflowStatuses))
	log.Printf("Broadcast workflow:status-changed")
}
