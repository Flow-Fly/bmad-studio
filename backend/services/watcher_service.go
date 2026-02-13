package services

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/fsnotify/fsnotify"
)

const (
	// watcherDebounceInterval is the time to wait before processing file changes
	watcherDebounceInterval = 100 * time.Millisecond
)

// watchInfo holds mapping data for a watched stream directory
type watchInfo struct {
	projectName string
	streamName  string
}

// watcherDebounceEntry tracks pending file change processing for the watcher
type watcherDebounceEntry struct {
	timer     *time.Timer
	lastOp    fsnotify.Op
	hadDelete bool // tracks if a delete occurred in this debounce window
}

// WatcherService watches central-store stream directories for artifact file changes.
// It watches ~/.bmad-studio/projects/{project}-{stream}/ directories for all registered
// projects and broadcasts artifact:created/updated/deleted events via WebSocket.
type WatcherService struct {
	mu            sync.RWMutex
	hub           *websocket.Hub
	centralStore  *storage.CentralStore
	streamStore   *storage.StreamStore
	registryStore *storage.RegistryStore
	watcher       *fsnotify.Watcher
	watchedDirs   map[string]watchInfo // path -> watchInfo
	debounceMap   map[string]*watcherDebounceEntry
	debounceMu    sync.Mutex
	done          chan struct{}
	running       bool
}

// NewWatcherService creates a new WatcherService
func NewWatcherService(
	centralStore *storage.CentralStore,
	streamStore *storage.StreamStore,
	registryStore *storage.RegistryStore,
	hub *websocket.Hub,
) *WatcherService {
	return &WatcherService{
		centralStore: centralStore,
		streamStore:  streamStore,
		registryStore: registryStore,
		hub:          hub,
		watchedDirs:  make(map[string]watchInfo),
		debounceMap:  make(map[string]*watcherDebounceEntry),
	}
}

// Start initializes the watcher and begins watching all active stream directories
func (w *WatcherService) Start() error {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return &FileWatcherServiceError{
			Code:    ErrCodeWatcherStartFailed,
			Message: "Watcher service is already running",
		}
	}
	w.running = true
	w.mu.Unlock()

	// Create fsnotify watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		w.mu.Lock()
		w.running = false
		w.mu.Unlock()
		return &FileWatcherServiceError{
			Code:    ErrCodeWatcherCreateFailed,
			Message: "Failed to create file watcher: " + err.Error(),
		}
	}

	w.mu.Lock()
	w.watcher = watcher
	w.done = make(chan struct{})
	w.mu.Unlock()

	// Enumerate all registered projects and their streams
	if err := w.addAllStreamWatches(); err != nil {
		log.Printf("Warning: Failed to add initial stream watches: %v", err)
	}

	// Start event processing goroutine
	go w.processEvents()

	log.Println("Watcher service started for central store stream directories")
	return nil
}

// Stop gracefully shuts down the watcher service
func (w *WatcherService) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	w.watchedDirs = make(map[string]watchInfo)
	w.mu.Unlock()

	close(w.done)

	w.mu.RLock()
	watcher := w.watcher
	w.mu.RUnlock()

	if watcher != nil {
		watcher.Close()
	}

	// Cancel all pending debounce timers
	w.debounceMu.Lock()
	for path, entry := range w.debounceMap {
		if entry.timer != nil {
			entry.timer.Stop()
		}
		delete(w.debounceMap, path)
	}
	w.debounceMu.Unlock()

	log.Println("Watcher service stopped")
}

// IsRunning returns whether the watcher service is currently running
func (w *WatcherService) IsRunning() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.running
}

// AddStreamWatch adds a watch for a new stream directory.
// Called when a new stream is created after the watcher is already running.
func (w *WatcherService) AddStreamWatch(projectName, streamName string) {
	w.mu.RLock()
	running := w.running
	watcher := w.watcher
	w.mu.RUnlock()

	if !running || watcher == nil {
		return
	}

	streamDir := w.streamDir(projectName, streamName)

	// Check if directory exists
	if _, err := os.Stat(streamDir); os.IsNotExist(err) {
		log.Printf("Warning: Stream directory does not exist, cannot add watch: %s", streamDir)
		return
	}

	if err := watcher.Add(streamDir); err != nil {
		log.Printf("Warning: Failed to watch stream directory %s: %v", streamDir, err)
		return
	}

	w.mu.Lock()
	w.watchedDirs[streamDir] = watchInfo{
		projectName: projectName,
		streamName:  streamName,
	}
	w.mu.Unlock()

	log.Printf("Added watch for stream: %s-%s at %s", projectName, streamName, streamDir)

	// Scan for pre-existing artifacts (race condition: files created before watch established)
	w.scanStreamDirectory(streamDir, projectName, streamName)
}

// RemoveStreamWatch removes the watch for an archived stream directory.
// Called when a stream is archived.
func (w *WatcherService) RemoveStreamWatch(projectName, streamName string) {
	w.mu.RLock()
	running := w.running
	watcher := w.watcher
	w.mu.RUnlock()

	if !running || watcher == nil {
		return
	}

	streamDir := w.streamDir(projectName, streamName)

	// Remove fsnotify watch (ignore errors - directory may already be moved/deleted)
	_ = watcher.Remove(streamDir)

	w.mu.Lock()
	delete(w.watchedDirs, streamDir)
	w.mu.Unlock()

	log.Printf("Removed watch for stream: %s-%s", projectName, streamName)
}

// streamDir returns the path to a stream directory within the central store
func (w *WatcherService) streamDir(projectName, streamName string) string {
	return filepath.Join(w.centralStore.RootDir(), "projects", projectName+"-"+streamName)
}

// addAllStreamWatches reads all registered projects and adds watches for their active streams
func (w *WatcherService) addAllStreamWatches() error {
	registry, err := w.registryStore.Load()
	if err != nil {
		return err
	}

	for _, project := range registry.Projects {
		streams, err := w.streamStore.ListProjectStreams(project.Name)
		if err != nil {
			log.Printf("Warning: Failed to list streams for project %s: %v", project.Name, err)
			continue
		}

		for _, stream := range streams {
			if stream.Status != types.StreamStatusActive {
				continue
			}

			streamDir := w.streamDir(project.Name, stream.Name)

			// Check if directory exists
			if _, err := os.Stat(streamDir); os.IsNotExist(err) {
				log.Printf("Warning: Stream directory does not exist: %s", streamDir)
				continue
			}

			w.mu.RLock()
			watcher := w.watcher
			w.mu.RUnlock()

			if watcher == nil {
				return nil
			}

			if err := watcher.Add(streamDir); err != nil {
				log.Printf("Warning: Failed to watch stream directory %s: %v", streamDir, err)
				continue
			}

			w.mu.Lock()
			w.watchedDirs[streamDir] = watchInfo{
				projectName: project.Name,
				streamName:  stream.Name,
			}
			w.mu.Unlock()

			log.Printf("Watching stream: %s-%s at %s", project.Name, stream.Name, streamDir)
		}
	}

	return nil
}

// processEvents handles file system events
func (w *WatcherService) processEvents() {
	for {
		w.mu.RLock()
		watcher := w.watcher
		w.mu.RUnlock()

		if watcher == nil {
			return
		}

		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			w.handleEvent(event)

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("Watcher service error: %v", err)

		case <-w.done:
			return
		}
	}
}

// resolveStreamInfo resolves the project/stream info for a file path by checking
// the file's directory and parent directories against the watched dirs map.
// Returns the watchInfo and the relative filename (may include subdirectory prefix like "epics/file.md").
func (w *WatcherService) resolveStreamInfo(path string) (watchInfo, string, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	dir := filepath.Dir(path)
	filename := filepath.Base(path)

	// Check direct parent first
	if info, ok := w.watchedDirs[dir]; ok {
		return info, filename, true
	}

	// Walk up to find the watched stream directory (handles subdirs like epics/)
	parentDir := filepath.Dir(dir)
	subdir := filepath.Base(dir)
	if info, ok := w.watchedDirs[parentDir]; ok {
		return info, subdir + "/" + filename, true
	}

	return watchInfo{}, "", false
}

// handleEvent processes a single file system event with debouncing
func (w *WatcherService) handleEvent(event fsnotify.Event) {
	path := filepath.Clean(event.Name)

	// Skip stream.json metadata
	if filepath.Base(path) == "stream.json" {
		return
	}

	// Skip temporary/swap files
	base := filepath.Base(path)
	if strings.HasSuffix(base, ".tmp") || strings.HasSuffix(base, ".swp") || strings.HasSuffix(base, "~") {
		return
	}

	// Skip hidden files
	if strings.HasPrefix(base, ".") {
		return
	}

	// Handle directory remove/rename — check if it's a tracked stream dir
	if event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename) {
		w.mu.RLock()
		_, isStreamDir := w.watchedDirs[path]
		w.mu.RUnlock()
		if isStreamDir {
			w.mu.Lock()
			delete(w.watchedDirs, path)
			w.mu.Unlock()
			return
		}
	}

	// Handle directory creation within stream dirs (e.g., epics/ subfolder)
	if event.Has(fsnotify.Create) {
		fi, err := os.Stat(path)
		if err == nil && fi.IsDir() {
			w.mu.RLock()
			watcher := w.watcher
			w.mu.RUnlock()

			if watcher != nil {
				if err := watcher.Add(path); err != nil {
					log.Printf("Warning: Failed to watch subdirectory %s: %v", path, err)
				}
			}
			return
		}
	}

	// Resolve which stream this event belongs to
	info, relFilename, tracked := w.resolveStreamInfo(path)
	if !tracked {
		return
	}

	// Per-file debouncing
	w.debounceMu.Lock()
	defer w.debounceMu.Unlock()

	// Track whether a delete occurred in this debounce window
	hadDelete := event.Has(fsnotify.Remove) || event.Has(fsnotify.Rename)

	// Cancel existing timer for this path, preserving delete tracking
	if entry, exists := w.debounceMap[path]; exists {
		entry.timer.Stop()
		if entry.hadDelete {
			hadDelete = true
		}
	}

	// Create new timer
	currentOp := event.Op
	currentHadDelete := hadDelete
	currentInfo := info
	currentPath := path
	currentRelFilename := relFilename
	w.debounceMap[path] = &watcherDebounceEntry{
		timer: time.AfterFunc(watcherDebounceInterval, func() {
			phase := DerivePhase(currentRelFilename)

			if currentHadDelete && currentOp.Has(fsnotify.Create) {
				// Delete then recreate in same window
				w.broadcastArtifactEvent(types.EventTypeArtifactDeleted, currentInfo.projectName, currentInfo.streamName, currentRelFilename, phase)
				w.broadcastArtifactEvent(types.EventTypeArtifactCreated, currentInfo.projectName, currentInfo.streamName, currentRelFilename, phase)
			} else if currentOp.Has(fsnotify.Remove) || currentOp.Has(fsnotify.Rename) {
				w.broadcastArtifactEvent(types.EventTypeArtifactDeleted, currentInfo.projectName, currentInfo.streamName, currentRelFilename, phase)
			} else if currentOp.Has(fsnotify.Create) {
				w.broadcastArtifactEvent(types.EventTypeArtifactCreated, currentInfo.projectName, currentInfo.streamName, currentRelFilename, phase)
			} else if currentOp.Has(fsnotify.Write) {
				w.broadcastArtifactEvent(types.EventTypeArtifactUpdated, currentInfo.projectName, currentInfo.streamName, currentRelFilename, phase)
			}

			w.debounceMu.Lock()
			delete(w.debounceMap, currentPath)
			w.debounceMu.Unlock()
		}),
		lastOp:    event.Op,
		hadDelete: currentHadDelete,
	}
}

// broadcastArtifactEvent broadcasts an artifact stream event via WebSocket
func (w *WatcherService) broadcastArtifactEvent(eventType, projectName, streamName, filename, phase string) {
	streamID := projectName + "-" + streamName

	var event *types.WebSocketEvent
	switch eventType {
	case types.EventTypeArtifactCreated:
		event = types.NewArtifactStreamCreatedEvent(projectName, streamID, filename, phase)
	case types.EventTypeArtifactUpdated:
		event = types.NewArtifactStreamUpdatedEvent(projectName, streamID, filename, phase)
	case types.EventTypeArtifactDeleted:
		event = types.NewArtifactStreamDeletedEvent(projectName, streamID, filename, phase)
	default:
		return
	}

	w.hub.BroadcastEvent(event)
	log.Printf("Broadcast %s for %s/%s: %s (phase: %s)", eventType, projectName, streamName, filename, phase)
}

// scanStreamDirectory scans a stream directory for pre-existing artifact files
func (w *WatcherService) scanStreamDirectory(dirPath, projectName, streamName string) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		log.Printf("Warning: Failed to scan stream directory %s: %v", dirPath, err)
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()

		// Skip stream.json, hidden, temp files
		if name == "stream.json" || strings.HasPrefix(name, ".") ||
			strings.HasSuffix(name, ".tmp") || strings.HasSuffix(name, ".swp") || strings.HasSuffix(name, "~") {
			continue
		}

		filePath := filepath.Join(dirPath, name)

		w.debounceMu.Lock()
		if _, exists := w.debounceMap[filePath]; !exists {
			currentName := name
			currentProject := projectName
			currentStream := streamName
			w.debounceMap[filePath] = &watcherDebounceEntry{
				timer: time.AfterFunc(watcherDebounceInterval, func() {
					phase := DerivePhase(currentName)
					w.broadcastArtifactEvent(types.EventTypeArtifactCreated, currentProject, currentStream, currentName, phase)
					w.debounceMu.Lock()
					delete(w.debounceMap, filepath.Join(dirPath, currentName))
					w.debounceMu.Unlock()
				}),
				lastOp: fsnotify.Create,
			}
		}
		w.debounceMu.Unlock()
	}
}

// DerivePhase determines which BMAD phase a file belongs to based on its filename.
// The filename may include a subdirectory prefix (e.g., "epics/epic-1.md").
// Returns the phase name or empty string if no pattern matches.
func DerivePhase(filename string) string {
	lower := strings.ToLower(filename)

	// Implementation phase: files inside epics/ folder (check first since it uses path prefix)
	if strings.HasPrefix(lower, "epics/") {
		return "implementation"
	}

	// Get just the base name for pattern matching
	baseLower := strings.ToLower(filepath.Base(filename))

	// Analysis phase: brainstorm*, research*
	if strings.HasPrefix(baseLower, "brainstorm") || strings.HasPrefix(baseLower, "research") {
		return "analysis"
	}

	// Planning phase: prd.md or prd*
	if strings.HasPrefix(baseLower, "prd") {
		return "planning"
	}

	// Solutioning phase: architecture*
	if strings.HasPrefix(baseLower, "architecture") {
		return "solutioning"
	}

	return ""
}
