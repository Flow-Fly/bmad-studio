# Story 0.6: Watch for File Changes

Status: done

## TL;DR - Quick Reference

**Create these files:**
- `backend/services/file_watcher_service.go` - Service with fsnotify, debouncing, event emission
- `backend/api/websocket/hub.go` - WebSocket hub for event broadcasting
- `backend/api/websocket/client.go` - WebSocket client connection handling
- `backend/api/handlers/websocket.go` - WebSocket upgrade handler
- `backend/services/file_watcher_service_test.go` - Unit tests
- `backend/tests/api/websocket_test.go` - WebSocket integration tests

**Modify these files:**
- `backend/api/router.go` - Add WebSocket route `/ws` and 6th parameter (fileWatcherService)
- `backend/services/artifact_service.go` - Add file watcher callback integration (optional)

**Critical patterns:**
- Use `github.com/fsnotify/fsnotify` v1.7.0 for file watching
- Debounce events at 100ms to batch rapid changes
- WebSocket events: `artifact:created`, `artifact:updated`, `artifact:deleted`, `workflow:status-changed`
- Hub pattern: single goroutine broadcasts to all connected clients
- Watch `_bmad-output/` recursively

**Gotchas:**
- fsnotify requires manual recursive watching (new directories)
- Debouncing must be per-file, not global
- Handle watcher.Errors channel to avoid goroutine leak
- WebSocket ping/pong for connection health
- Graceful shutdown: close watcher, then hub, then clients

---

## Story

As a **developer**,
I want **the artifact registry to update when files change**,
so that **the UI stays current without manual refresh**.

## Acceptance Criteria

1. **Given** a project is loaded, **When** the file watcher starts, **Then** `_bmad-output/` is watched recursively using fsnotify.

2. **Given** a file is created in `_bmad-output/`, **When** the watcher detects it, **Then** the file is indexed and added to the registry, **And** a WebSocket event `artifact:created` is emitted with artifact metadata.

3. **Given** a file is modified in `_bmad-output/`, **When** the watcher detects it, **Then** the file's frontmatter is re-parsed, **And** the registry is updated, **And** a WebSocket event `artifact:updated` is emitted.

4. **Given** a file is deleted from `_bmad-output/`, **When** the watcher detects it, **Then** the artifact is removed from the registry, **And** a WebSocket event `artifact:deleted` is emitted.

5. **Given** rapid file changes occur (e.g., during workflow execution), **When** changes are detected, **Then** updates are debounced (100ms) to avoid excessive updates.

6. **Given** status files (`bmm-workflow-status.yaml`, `sprint-status.yaml`) change, **When** detected, **Then** workflow status is re-computed, **And** a WebSocket event `workflow:status-changed` is emitted.

## Tasks / Subtasks

- [x] Task 1: Define WebSocket event types (AC: #2, #3, #4, #6)
  - [x] 1.1 Create `backend/types/websocket.go` with event type constants
  - [x] 1.2 Define `WebSocketEvent` struct with `Type`, `Payload`, `Timestamp`
  - [x] 1.3 Define `ArtifactEventPayload` for artifact events
  - [x] 1.4 Define `WorkflowStatusEventPayload` for status events

- [x] Task 2: Implement WebSocket hub (AC: #2, #3, #4, #6)
  - [x] 2.1 Create `backend/api/websocket/hub.go`
  - [x] 2.2 Implement `Hub` struct with `clients`, `broadcast`, `register`, `unregister` channels
  - [x] 2.3 Implement `NewHub()` constructor
  - [x] 2.4 Implement `Run()` goroutine for event loop
  - [x] 2.5 Implement `Broadcast(event)` method
  - [x] 2.6 Implement `Stop()` for graceful shutdown

- [x] Task 3: Implement WebSocket client (AC: #2, #3, #4)
  - [x] 3.1 Create `backend/api/websocket/client.go`
  - [x] 3.2 Implement `Client` struct with `hub`, `conn`, `send` channel
  - [x] 3.3 Implement `readPump()` goroutine (ping/pong handling)
  - [x] 3.4 Implement `writePump()` goroutine (send messages from channel)
  - [x] 3.5 Implement `NewClient(hub, conn)` constructor

- [x] Task 4: Implement WebSocket handler (AC: #2, #3, #4)
  - [x] 4.1 Create `backend/api/handlers/websocket.go`
  - [x] 4.2 Implement `WebSocketHandler` struct with `hub`
  - [x] 4.3 Implement `HandleWebSocket(w, r)` with gorilla/websocket upgrader
  - [x] 4.4 Configure upgrader with CheckOrigin for localhost

- [x] Task 5: Implement file watcher service (AC: #1, #5)
  - [x] 5.1 Create `backend/services/file_watcher_service.go`
  - [x] 5.2 Implement `FileWatcherService` struct with fsnotify.Watcher, Hub, debounce map
  - [x] 5.3 Implement `NewFileWatcherService(hub, configService, artifactService, workflowStatusService)`
  - [x] 5.4 Implement `Start() error` - initialize watcher, add paths
  - [x] 5.5 Implement `Stop()` - close watcher gracefully
  - [x] 5.6 Implement `addWatchRecursive(path string) error`
  - [x] 5.7 Implement `handleEvent(event fsnotify.Event)` with debouncing
  - [x] 5.8 Implement `processFileChange(path string, op fsnotify.Op)`
  - [x] 5.9 Implement per-file debounce timer management

- [x] Task 6: Implement event handlers (AC: #2, #3, #4, #6)
  - [x] 6.1 Implement `handleCreate(path string)` - index artifact, emit event
  - [x] 6.2 Implement `handleModify(path string)` - re-index artifact, emit event
  - [x] 6.3 Implement `handleDelete(path string)` - remove from registry, emit event
  - [x] 6.4 Implement `handleStatusFileChange(path string)` - reload status, emit event
  - [x] 6.5 Implement `isStatusFile(path string) bool` helper

- [x] Task 7: Register routes and wire up (AC: all)
  - [x] 7.1 Update `NewRouterWithServices` signature: add `hub *websocket.Hub` as 6th param
  - [x] 7.2 Add WebSocket route: `GET /ws` → WebSocketHandler.HandleWebSocket
  - [x] 7.3 Update `main.go` to create Hub, FileWatcherService, start both
  - [x] 7.4 Update existing tests to pass nil for new parameter

- [x] Task 8: Add artifact service callbacks (AC: #2, #3, #4)
  - [x] 8.1 Add `ProcessSingleArtifact(path string) (*types.ArtifactResponse, error)` to ArtifactService
  - [x] 8.2 Add `RemoveArtifact(path string) (*types.ArtifactResponse, error)` to ArtifactService
  - [x] 8.3 Add `GetArtifactByPath(path string) (*types.ArtifactResponse, error)` to ArtifactService

- [x] Task 9: Write tests (AC: all)
  - [x] 9.1 Create `backend/services/file_watcher_service_test.go`
  - [x] 9.2 Test: watcher starts successfully
  - [x] 9.3 Test: file creation emits artifact:created event
  - [x] 9.4 Test: file modification emits artifact:updated event
  - [x] 9.5 Test: file deletion emits artifact:deleted event
  - [x] 9.6 Test: rapid changes are debounced (only one event per 100ms window)
  - [x] 9.7 Test: status file change emits workflow:status-changed event
  - [x] 9.8 Test: new subdirectory is auto-watched
  - [x] 9.9 Test: graceful shutdown
  - [x] 9.10 Create `backend/tests/api/websocket_test.go`
  - [x] 9.11 Test: WebSocket connection upgrades successfully
  - [x] 9.12 Test: client receives broadcasted events
  - [x] 9.13 Test: multiple clients receive same event
  - [x] 9.14 Test: client disconnection is handled cleanly

## Senior Developer Review (AI)

**Reviewer:** Gemini (via gemini CLI)
**Date:** 2026-01-29
**Issues Found:** 3 High, 2 Medium, 2 Low
**Issues Fixed:** 5 (all HIGH + MEDIUM)

### Findings and Resolutions

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | HIGH | `Start()` not idempotent - double-call leaks watcher+goroutine | Added running guard; returns error if already started. Reinit `done` channel on start. |
| 2 | HIGH | `RemoveArtifact` path-derived ID mismatch (FALSE POSITIVE) | IDs are always path-derived, not frontmatter-based. No fix needed. |
| 3 | HIGH | Directory deletion leaves child artifacts as zombies | Added `handleDirectoryDelete()` - iterates registry, removes all artifacts under deleted dir path. |
| 4 | MEDIUM | Debounce race: delete+create loses the delete event | Track `hadDelete` flag across debounce window. When delete+create detected, process both operations. |
| 5 | MEDIUM | New directory watch race - files created before watch established | Added `scanDirectoryForExistingFiles()` - scans new dir after `watcher.Add` for pre-existing `.md` files. |
| 6 | LOW | Hub broadcast buffer (256) can overflow silently | Accepted risk - 256 is adequate for normal use. Overflow is logged. |
| 7 | LOW | Manual recursive watching is OS-dependent | Accepted risk - fsnotify abstracts OS differences; manual recursion is standard pattern. |

### Tests Added for Fixes
- `TestFileWatcherDoubleStartReturnsError` - Verifies idempotent start guard
- `TestFileWatcherRestartAfterStop` - Verifies stop-then-start works
- `TestFileWatcherHandlesDirectoryDeletion` - Verifies all child artifacts removed on dir delete

## Dev Notes

### Architecture Constraints

| Constraint | Value |
|------------|-------|
| File watching library | fsnotify v1.7.0 |
| WebSocket library | gorilla/websocket v1.5.x |
| Debounce interval | 100ms |
| WebSocket endpoint | `/ws` |
| Event format | JSON with `type`, `payload`, `timestamp` fields |

### WebSocket Event Format

```json
{
  "type": "artifact:created",
  "payload": {
    "id": "planning-artifacts-prd",
    "name": "Product Requirements Document",
    "type": "prd",
    "path": "_bmad-output/planning-artifacts/prd.md",
    "status": "complete"
  },
  "timestamp": "2026-01-28T10:30:00Z"
}
```

### Event Types

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `artifact:created` | New .md file in _bmad-output/ | ArtifactResponse |
| `artifact:updated` | .md file modified | ArtifactResponse |
| `artifact:deleted` | .md file deleted | `{id, path}` |
| `workflow:status-changed` | *status.yaml modified | WorkflowStatus |
| `connection:status` | Connection state change | `{status}` |

### File Watcher Patterns

**Recursive watching (fsnotify doesn't do this automatically):**
```go
func (s *FileWatcherService) addWatchRecursive(root string) error {
    return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil // Continue on error
        }
        if info.IsDir() {
            if err := s.watcher.Add(path); err != nil {
                log.Printf("Warning: Failed to watch %s: %v", path, err)
            }
        }
        return nil
    })
}
```

**Per-file debouncing:**
```go
type debounceEntry struct {
    timer  *time.Timer
    lastOp fsnotify.Op
}

func (s *FileWatcherService) handleEvent(event fsnotify.Event) {
    s.debounceMu.Lock()
    defer s.debounceMu.Unlock()

    // Cancel existing timer for this path
    if entry, exists := s.debounceMap[event.Name]; exists {
        entry.timer.Stop()
    }

    // Create new timer
    s.debounceMap[event.Name] = &debounceEntry{
        timer: time.AfterFunc(100*time.Millisecond, func() {
            s.processFileChange(event.Name, event.Op)
            s.debounceMu.Lock()
            delete(s.debounceMap, event.Name)
            s.debounceMu.Unlock()
        }),
        lastOp: event.Op,
    }
}
```

### WebSocket Hub Pattern

```go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
    done       chan struct{}
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
        case message := <-h.broadcast:
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
        case <-h.done:
            return
        }
    }
}
```

### Files to Watch

```
_bmad-output/
├── planning-artifacts/
│   ├── *.md                    # Artifact files
│   ├── */                      # Sharded artifact directories
│   │   └── *.md
│   └── bmm-workflow-status.yaml # Status file
├── implementation-artifacts/
│   ├── *.md                    # Story files
│   └── sprint-status.yaml      # Status file
├── project-context.md          # Artifact
└── artifact-registry.json      # SKIP (our output)
```

### Status File Detection

```go
func isStatusFile(path string) bool {
    filename := filepath.Base(path)
    return strings.HasSuffix(filename, "status.yaml") ||
           strings.HasSuffix(filename, "status.yml")
}
```

### Integration with Existing Services

The FileWatcherService needs access to:
1. **Hub** - for broadcasting WebSocket events
2. **BMadConfigService** - for output folder path
3. **ArtifactService** - for re-indexing artifacts
4. **WorkflowStatusService** - for reloading status on status file change

### Graceful Shutdown Sequence

1. Stop accepting new WebSocket connections
2. Stop file watcher (closes fsnotify)
3. Stop hub (drains broadcast queue, closes clients)
4. Wait for all client goroutines to finish

### Previous Story Patterns to Follow

From stories 0.1-0.5:
- `sync.RWMutex` for thread safety
- `NewXxxService(deps)` constructor
- Custom error type with `Code`/`Message`
- `t.TempDir()` for test fixtures
- Log and continue on errors (fault-tolerant)
- `filepath.Clean()` for cross-platform paths
- Move expensive ops outside locks

### Test Strategy

**Unit tests:** Use mock Hub, mock ArtifactService
**Integration tests:** Use real fsnotify with temp directory
**WebSocket tests:** Use gorilla/websocket test utilities

### Dependencies to Add

```go
// go.mod additions
require (
    github.com/fsnotify/fsnotify v1.7.0
    github.com/gorilla/websocket v1.5.3
)
```

### Project Structure Notes

New files align with existing structure:
```
backend/
├── api/
│   ├── handlers/
│   │   └── websocket.go          # NEW: WebSocket upgrade handler
│   └── websocket/                # NEW: WebSocket package
│       ├── hub.go
│       └── client.go
├── services/
│   └── file_watcher_service.go   # NEW: File watcher
└── types/
    └── websocket.go              # NEW: Event types
```

### References

- [Source: backend/services/artifact_service.go - ArtifactService for registry updates]
- [Source: backend/services/workflow_status_service.go - WorkflowStatusService for status reload]
- [Source: backend/api/router.go - Router pattern for adding new routes]
- [Source: epics.md - Story 0.6 acceptance criteria]
- [Source: architecture.md - WebSocket protocol definition]
- [Source: project-context.md - WebSocket event format]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None - implementation completed without significant debugging issues.

### Completion Notes List

- Implemented WebSocket hub/client pattern following gorilla/websocket best practices
- File watcher uses fsnotify v1.7.0 with per-file debouncing (100ms)
- Added recursive directory watching with auto-detection of new subdirectories
- Graceful shutdown implemented for both file watcher and WebSocket hub
- All existing tests updated to pass new hub parameter
- Comprehensive test coverage for file watcher and WebSocket functionality

### File List

**New Files:**
- `backend/types/websocket.go` - WebSocket event types and payloads
- `backend/types/websocket_test.go` - WebSocket type tests
- `backend/api/websocket/hub.go` - WebSocket hub for broadcasting
- `backend/api/websocket/hub_test.go` - Hub tests
- `backend/api/websocket/client.go` - WebSocket client connection handler
- `backend/api/handlers/websocket.go` - WebSocket upgrade handler
- `backend/services/file_watcher_service.go` - File watcher service
- `backend/services/file_watcher_service_test.go` - File watcher tests
- `backend/tests/api/websocket_test.go` - WebSocket integration tests

**Modified Files:**
- `backend/go.mod` - Added fsnotify v1.7.0, gorilla/websocket v1.5.3
- `backend/go.sum` - Updated checksums for new dependencies
- `backend/api/router.go` - Added hub parameter and /ws route
- `backend/services/artifact_service.go` - Added ProcessSingleArtifact, RemoveArtifact, GetArtifactByPath methods
- `backend/services/workflow_status_service.go` - Added Reload method
- `backend/main.go` - Full rewrite with service initialization and graceful shutdown
- `backend/tests/api/artifacts_test.go` - Updated for new router signature
- `backend/tests/api/bmad_agents_test.go` - Updated for new router signature
- `backend/tests/api/bmad_status_test.go` - Updated for new router signature

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-28 | Story created by create-story workflow | Claude Opus 4.5 |
| 2026-01-28 | Implemented file watcher with WebSocket broadcasting, all tests pass | Claude Opus 4.5 |
| 2026-01-29 | Code review by Gemini: 7 issues found, 5 fixed (3 HIGH + 2 MEDIUM), 2 LOW accepted | Gemini + Claude Opus 4.5 |
| 2026-01-29 | Code review #2: 9 issues found (3H/3M/3L), 6 fixed (H1: Start race, H2: hub lock upgrade, H3: WS message concat, M1: go.sum in file list, M2: dir tracking, M3: port 3007 origin) | Claude Opus 4.5 |
