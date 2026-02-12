# Story 2.4: Stream REST Endpoints

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want stream operations exposed through the REST API,
So that the frontend can manage streams for any registered project.

## Acceptance Criteria

1. **Given** a `POST /projects/:id/streams` request with `{ "name": "payment-integration" }` **When** the project exists and name is valid **Then** the system creates the stream and returns stream details with 201 status

2. **Given** a `GET /projects/:id/streams` request **When** the project has streams **Then** the system returns all active streams (excludes archived) for that project

3. **Given** a `GET /projects/:id/streams/:sid` request **When** the stream exists **Then** the system returns full stream detail including phase state

4. **Given** a `PUT /projects/:id/streams/:sid` request with metadata updates **When** the stream exists **Then** the system updates `stream.json` and broadcasts `stream:updated`

5. **Given** a `POST /projects/:id/streams/:sid/archive` request with `{ "outcome": "merged" }` **When** the stream is active **Then** the system archives the stream and returns 200

## Tasks / Subtasks

- [ ] Task 1: Create `StreamsHandler` in `backend/api/handlers/` (AC: #1, #2, #3, #4, #5)
  - [ ] 1.1: Create `streams_handler.go` with `StreamsHandler` struct holding `*services.StreamService`
  - [ ] 1.2: Add `NewStreamsHandler(streamService *services.StreamService) *StreamsHandler` constructor
  - [ ] 1.3: Add `CreateStream(w http.ResponseWriter, r *http.Request)` handler (AC: #1)
  - [ ] 1.4: Add `ListStreams(w http.ResponseWriter, r *http.Request)` handler (AC: #2)
  - [ ] 1.5: Add `GetStream(w http.ResponseWriter, r *http.Request)` handler (AC: #3)
  - [ ] 1.6: Add `UpdateStream(w http.ResponseWriter, r *http.Request)` handler (AC: #4)
  - [ ] 1.7: Add `ArchiveStream(w http.ResponseWriter, r *http.Request)` handler (AC: #5)

- [ ] Task 2: Implement `CreateStream` handler (AC: #1)
  - [ ] 2.1: Extract `id` from URL params using `chi.URLParam(r, "id")` as `projectName`
  - [ ] 2.2: Parse JSON body into struct with `Name` field (use `json.Decoder`)
  - [ ] 2.3: Validate request body — return 400 if invalid JSON or missing `name` field
  - [ ] 2.4: Call `streamService.Create(projectName, name)`
  - [ ] 2.5: If project not found → return 404 with error JSON
  - [ ] 2.6: If stream name invalid → return 400 with error JSON
  - [ ] 2.7: If stream already exists → return 409 with error JSON
  - [ ] 2.8: If success → return 201 with stream metadata JSON (camelCase fields)
  - [ ] 2.9: Use existing error response helper if available, otherwise implement inline

- [ ] Task 3: Implement `ListStreams` handler (AC: #2)
  - [ ] 3.1: Extract `id` from URL params as `projectName`
  - [ ] 3.2: Call `streamService.List(projectName)`
  - [ ] 3.3: If project not found → return 404 with error JSON
  - [ ] 3.4: If success → return 200 with array of stream metadata (empty array if no streams)
  - [ ] 3.5: Response automatically excludes archived streams (service layer handles this)

- [ ] Task 4: Implement `GetStream` handler (AC: #3)
  - [ ] 4.1: Extract `id` from URL params as `projectName`
  - [ ] 4.2: Extract `sid` from URL params as `streamID`
  - [ ] 4.3: Parse `streamID` to extract `streamName` (format: `{projectName}-{streamName}`)
  - [ ] 4.4: Validate `streamID` starts with `projectName-` prefix, return 400 if invalid
  - [ ] 4.5: Call `streamService.Get(projectName, streamName)`
  - [ ] 4.6: If project not found → return 404 with error JSON
  - [ ] 4.7: If stream not found → return 404 with error JSON
  - [ ] 4.8: If success → return 200 with stream metadata JSON

- [ ] Task 5: Implement `UpdateStream` handler (AC: #4)
  - [ ] 5.1: Extract `id` and `sid` from URL params
  - [ ] 5.2: Parse `streamID` to extract `streamName`
  - [ ] 5.3: Parse JSON body (flexible — accept any metadata updates like `branch`, `worktree`, etc.)
  - [ ] 5.4: Add `UpdateMetadata(projectName, streamName string, updates map[string]interface{}) (*types.StreamMeta, error)` method to `StreamService`
  - [ ] 5.5: Read existing `stream.json`, apply updates, write back atomically
  - [ ] 5.6: Update `updatedAt` timestamp
  - [ ] 5.7: Broadcast `stream:updated` event with `StreamUpdatedPayload{ProjectID, StreamID, Changes}`
  - [ ] 5.8: Return 200 with updated metadata
  - [ ] 5.9: Add `StreamUpdatedPayload` and `NewStreamUpdatedEvent` to `backend/types/websocket.go`

- [ ] Task 6: Implement `ArchiveStream` handler (AC: #5)
  - [ ] 6.1: Extract `id` and `sid` from URL params
  - [ ] 6.2: Parse `streamID` to extract `streamName`
  - [ ] 6.3: Parse JSON body into struct with `Outcome` field
  - [ ] 6.4: Validate outcome is `"merged"` or `"abandoned"`, return 400 if invalid
  - [ ] 6.5: Call `streamService.Archive(projectName, streamName, outcome)`
  - [ ] 6.6: If project/stream not found → return 404
  - [ ] 6.7: If already archived → return 409 with error JSON
  - [ ] 6.8: If success → return 200 with archived metadata
  - [ ] 6.9: Service layer handles WebSocket broadcast

- [ ] Task 7: Wire stream endpoints to router in `backend/api/router.go` (AC: #1, #2, #3, #4, #5)
  - [ ] 7.1: Add `Stream *services.StreamService` field to `RouterServices` struct
  - [ ] 7.2: In `/projects/{id}` route block, add conditional stream routes:
  - [ ] 7.3: `if svc.Stream != nil { streamsHandler := handlers.NewStreamsHandler(svc.Stream); ... }`
  - [ ] 7.4: Register `POST /projects/{id}/streams` → `streamsHandler.CreateStream`
  - [ ] 7.5: Register `GET /projects/{id}/streams` → `streamsHandler.ListStreams`
  - [ ] 7.6: Register `GET /projects/{id}/streams/{sid}` → `streamsHandler.GetStream`
  - [ ] 7.7: Register `PUT /projects/{id}/streams/{sid}` → `streamsHandler.UpdateStream`
  - [ ] 7.8: Register `POST /projects/{id}/streams/{sid}/archive` → `streamsHandler.ArchiveStream`

- [ ] Task 8: Wire StreamService to main.go (AC: all)
  - [ ] 8.1: In `backend/main.go`, create `StreamStore` after `RegistryStore` initialization
  - [ ] 8.2: Create `StreamService` with `streamStore`, `registryStore`, `hub` dependencies
  - [ ] 8.3: Pass `StreamService` to router via `RouterServices.Stream` field
  - [ ] 8.4: Ensure services are wired AFTER hub initialization so broadcast works

- [ ] Task 9: Write integration tests for stream endpoints (AC: #1, #2, #3, #4, #5)
  - [ ] 9.1: Create test server with wired StreamService and test stores
  - [ ] 9.2: Test `POST /projects/:id/streams` — success (201), duplicate (409), invalid name (400), project not found (404)
  - [ ] 9.3: Test `GET /projects/:id/streams` — empty list, single stream, multiple streams sorted, project not found (404)
  - [ ] 9.4: Test `GET /projects/:id/streams/:sid` — success (200), not found (404), invalid streamID (400)
  - [ ] 9.5: Test `PUT /projects/:id/streams/:sid` — update metadata, verify `updatedAt` changed, verify broadcast
  - [ ] 9.6: Test `POST /projects/:id/streams/:sid/archive` — success (200), invalid outcome (400), already archived (409)
  - [ ] 9.7: Verify archived streams excluded from list endpoint
  - [ ] 9.8: Verify all responses use camelCase JSON fields

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON request/response fields MUST use `camelCase` — no `snake_case`, no exceptions
- **Error responses:** `{ "error": { "code": "...", "message": "..." } }` format (follow existing handler pattern)
- **Success responses:** Direct payload, no wrapper — `{ "name": "...", "project": "...", ... }`
- **Null fields:** Omit from JSON via `omitempty` in Go struct tags — never send explicit `null`
- **HTTP status codes:**
  - 200 OK — successful read/update/archive
  - 201 Created — successful stream creation
  - 400 Bad Request — invalid input (malformed JSON, invalid name, invalid outcome)
  - 404 Not Found — project or stream doesn't exist
  - 409 Conflict — duplicate stream name, already archived
  - 500 Internal Server Error — unexpected server errors
- **URL parameters:** `chi.URLParam(r, "id")` for project ID, `chi.URLParam(r, "sid")` for stream ID
- **StreamID format:** Always `{projectName}-{streamName}` for consistency with storage layer
- **WebSocket events:** Broadcasts handled by service layer — handlers don't call hub directly

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/services/stream_service.go`** — `StreamService` with `Create()`, `List()`, `Get()`, `Archive()` methods already implemented
- **`backend/storage/stream_store.go`** — `StreamStore` with all storage operations complete
- **`backend/types/stream.go`** — `StreamMeta`, `StreamStatus`, `StreamType`, `StreamOutcome` types complete
- **`backend/types/websocket.go`** — `StreamCreatedPayload`, `StreamArchivedPayload`, event constructors exist. ADD `StreamUpdatedPayload` for Task 5.
- **`backend/api/router.go`** — Router structure, middleware, existing handlers. ADD stream routes.
- **`backend/api/handlers/projects_handler.go`** — Pattern for handler struct, constructor, error responses (if exists, otherwise create pattern)

### REST API Endpoint Specification

| Method | Endpoint | Request Body | Success Response | Error Responses |
|--------|----------|--------------|------------------|-----------------|
| `POST` | `/projects/:id/streams` | `{ "name": "feature-name" }` | 201: `{ "name": "...", "project": "...", "status": "active", ... }` | 400 (invalid name), 404 (project not found), 409 (duplicate) |
| `GET` | `/projects/:id/streams` | — | 200: `[ { "name": "...", ... }, ... ]` | 404 (project not found) |
| `GET` | `/projects/:id/streams/:sid` | — | 200: `{ "name": "...", ... }` | 400 (invalid streamID), 404 (project/stream not found) |
| `PUT` | `/projects/:id/streams/:sid` | `{ "branch": "...", "worktree": "..." }` (flexible) | 200: `{ "name": "...", "updatedAt": "..." }` | 400 (invalid JSON), 404 (project/stream not found) |
| `POST` | `/projects/:id/streams/:sid/archive` | `{ "outcome": "merged" }` or `{ "outcome": "abandoned" }` | 200: `{ "name": "...", "status": "archived", "outcome": "..." }` | 400 (invalid outcome), 404 (not found), 409 (already archived) |

**URL Parameter Details:**
- `:id` = `projectName` (e.g., `my-app`)
- `:sid` = `streamID` in format `{projectName}-{streamName}` (e.g., `my-app-payment-integration`)

**StreamID Parsing Pattern:**
```go
// Extract streamID from URL
streamID := chi.URLParam(r, "sid")

// Parse to extract streamName
prefix := projectName + "-"
if !strings.HasPrefix(streamID, prefix) {
    // Return 400: invalid streamID format
}
streamName := strings.TrimPrefix(streamID, prefix)
```

### Handler Implementation Pattern

**Follow existing handler pattern from `projects_handler.go` (if exists) or use this structure:**

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "bmad-studio/backend/services"
    "github.com/go-chi/chi/v5"
)

type StreamsHandler struct {
    streamService *services.StreamService
}

func NewStreamsHandler(streamService *services.StreamService) *StreamsHandler {
    return &StreamsHandler{streamService: streamService}
}

func (h *StreamsHandler) CreateStream(w http.ResponseWriter, r *http.Request) {
    projectName := chi.URLParam(r, "id")

    var req struct {
        Name string `json:"name"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON")
        return
    }

    meta, err := h.streamService.Create(projectName, req.Name)
    if err != nil {
        // Map service errors to HTTP status codes
        respondError(w, statusCodeFromError(err), "...", err.Error())
        return
    }

    respondJSON(w, http.StatusCreated, meta)
}

// ... other handlers
```

**Error Response Helper:**
```go
func respondError(w http.ResponseWriter, statusCode int, code, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": map[string]string{
            "code":    code,
            "message": message,
        },
    })
}

func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(data)
}
```

**Error Mapping Pattern:**
```go
func statusCodeFromError(err error) int {
    errMsg := err.Error()
    if strings.Contains(errMsg, "not found") {
        return http.StatusNotFound
    }
    if strings.Contains(errMsg, "already exists") || strings.Contains(errMsg, "already archived") {
        return http.StatusConflict
    }
    if strings.Contains(errMsg, "invalid") {
        return http.StatusBadRequest
    }
    return http.StatusInternalServerError
}
```

### UpdateMetadata Service Method

**NEW method to add to `StreamService`:**

```go
// UpdateMetadata updates stream metadata fields
func (s *StreamService) UpdateMetadata(projectName, streamName string, updates map[string]interface{}) (*types.StreamMeta, error) {
    // Verify project exists
    entry, found := s.registryStore.FindByName(projectName)
    if !found || entry == nil {
        return nil, fmt.Errorf("project not found: %s", projectName)
    }

    // Read existing metadata
    meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
    if err != nil {
        return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
    }

    // Apply updates (validate allowed fields: branch, worktree, phase)
    if branch, ok := updates["branch"].(string); ok {
        meta.Branch = branch
    }
    if worktree, ok := updates["worktree"].(string); ok {
        meta.Worktree = worktree
    }
    // Do NOT allow updating: name, project, status, outcome, createdAt

    // Update timestamp
    meta.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

    // Write back atomically
    if err := s.streamStore.WriteStreamMeta(projectName, streamName, *meta); err != nil {
        return nil, fmt.Errorf("failed to update stream metadata: %w", err)
    }

    // Broadcast stream:updated event
    streamID := projectName + "-" + streamName
    event := types.NewStreamUpdatedEvent(projectName, streamID, updates)
    s.hub.BroadcastEvent(event)

    return meta, nil
}
```

### StreamUpdatedPayload (Add to websocket.go)

```go
// StreamUpdatedPayload is the payload for stream:updated events
type StreamUpdatedPayload struct {
    ProjectID string                 `json:"projectId"`
    StreamID  string                 `json:"streamId"`
    Changes   map[string]interface{} `json:"changes"`
}

const EventTypeStreamUpdated = "stream:updated"

func NewStreamUpdatedEvent(projectID, streamID string, changes map[string]interface{}) *WebSocketEvent {
    return &WebSocketEvent{
        Type: EventTypeStreamUpdated,
        Payload: StreamUpdatedPayload{
            ProjectID: projectID,
            StreamID:  streamID,
            Changes:   changes,
        },
    }
}
```

### Router Wiring (Add to router.go)

**In `RouterServices` struct:**
```go
type RouterServices struct {
    // ... existing fields
    Stream         *services.StreamService // Add this
}
```

**In `/projects/{id}` route block (after project detail endpoints):**
```go
// Streams resource (nested under project)
if svc.Stream != nil {
    streamsHandler := handlers.NewStreamsHandler(svc.Stream)
    r.Route("/streams", func(r chi.Router) {
        r.Post("/", streamsHandler.CreateStream)
        r.Get("/", streamsHandler.ListStreams)
        r.Route("/{sid}", func(r chi.Router) {
            r.Get("/", streamsHandler.GetStream)
            r.Put("/", streamsHandler.UpdateStream)
            r.Post("/archive", streamsHandler.ArchiveStream)
        })
    })
}
```

### Main.go Wiring

**Add after registry/store initialization:**
```go
// Initialize central store
centralStore := storage.NewCentralStore(centralStorePath)

// Initialize registry
registryStore := storage.NewRegistryStore(centralStore)

// Initialize stream store
streamStore := storage.NewStreamStore(centralStore)

// ... (after hub initialization)

// Initialize stream service
streamService := services.NewStreamService(streamStore, registryStore, hub)

// Create router with services
router := api.NewRouterWithServices(api.RouterServices{
    // ... existing services
    Stream: streamService,
})
```

### What NOT to Build

- Do NOT implement frontend integration — that is Epic 4 and Epic 10
- Do NOT implement worktree integration in endpoints — that is Epic 5
- Do NOT implement phase derivation in handlers — backend watcher handles this (Epic 3)
- Do NOT add authentication/authorization — out of scope for MVP
- Do NOT add pagination for list endpoint — MVP returns all active streams (archives excluded)
- Do NOT add filtering/searching — MVP is simple CRUD
- Do NOT implement stream deletion — only archiving is supported

### Testing Notes

- **Integration test setup:** Create test server with chi router, wire real services with test stores
- **Use `httptest.NewServer`** for spinning up test HTTP server
- **Test pattern:**
  ```go
  func TestStreamsHandler_CreateStream(t *testing.T) {
      // Setup test stores and services
      rootDir := resolveDir(t, t.TempDir())
      centralStore := storage.NewCentralStore(rootDir)
      registryStore := storage.NewRegistryStore(centralStore)
      streamStore := storage.NewStreamStore(centralStore)
      mockHub := &MockBroadcaster{}
      streamService := services.NewStreamService(streamStore, registryStore, mockHub)

      // Create handler and router
      handler := handlers.NewStreamsHandler(streamService)
      router := chi.NewRouter()
      router.Post("/projects/{id}/streams", handler.CreateStream)

      // Register test project
      registryStore.Register(types.RegistryEntry{Name: "test-app", Path: "/tmp/test"})

      // Make request
      body := `{"name":"feature-x"}`
      req := httptest.NewRequest("POST", "/projects/test-app/streams", strings.NewReader(body))
      w := httptest.NewRecorder()
      router.ServeHTTP(w, req)

      // Assert response
      require.Equal(t, http.StatusCreated, w.Code)
      var resp types.StreamMeta
      json.Unmarshal(w.Body.Bytes(), &resp)
      require.Equal(t, "feature-x", resp.Name)
      require.Equal(t, "test-app", resp.Project)
  }
  ```
- **Test error cases:** Project not found, duplicate name, invalid JSON, invalid streamID format
- **Verify broadcasts:** Mock hub should capture all broadcast calls, verify event types and payloads
- **Verify camelCase:** All JSON responses must use camelCase field names (unmarshal and check struct tags)

### Project Structure Notes

Files to create:
| File | Purpose |
|------|---------|
| `backend/api/handlers/streams_handler.go` | Stream CRUD handlers |
| `backend/api/handlers/streams_handler_test.go` | Integration tests for stream endpoints |

Files to modify:
| File | Changes |
|------|---------|
| `backend/api/router.go` | Add Stream field to RouterServices, wire stream routes |
| `backend/main.go` | Initialize StreamStore, StreamService, wire to router |
| `backend/services/stream_service.go` | Add `UpdateMetadata()` method |
| `backend/types/websocket.go` | Add `StreamUpdatedPayload`, `EventTypeStreamUpdated`, `NewStreamUpdatedEvent` |

Files NOT to modify:
- `backend/types/stream.go` — StreamMeta complete from previous stories
- `backend/storage/stream_store.go` — All storage operations complete
- Frontend files — UI integration is Epic 4 and Epic 10

### Previous Story Intelligence

**From Story 2.1 (Create Stream):**
- `StreamService.Create()` established — validates name, checks project exists, creates directory, writes metadata, broadcasts event
- StreamID format: `{projectName}-{streamName}`
- WebSocket broadcast pattern: create event after successful state change

**From Story 2.2 (List & View Streams):**
- `StreamService.List()` returns all active streams sorted by `updatedAt` descending
- `StreamService.Get()` returns single stream metadata
- Empty array (not nil) returned when no streams found
- Project verification before all operations

**From Story 2.3 (Archive Stream):**
- `StreamService.Archive()` validates outcome, updates metadata, moves directory, broadcasts event
- Archived streams excluded from list (different path: `projects/archive/`)
- Outcome validation: must be "merged" or "abandoned"

**Key patterns established:**
- Service methods always verify project exists via `registryStore.FindByName()`
- Service methods return `(*types.StreamMeta, error)` for mutations
- Service methods broadcast WebSocket events after successful state changes
- Error messages include context for debugging
- All JSON uses camelCase field names
- Atomic JSON writes for metadata updates

### Git Intelligence from Recent Commits

**Commit `2cb2b5b` (Story 2-3):**
- Modified: `stream_service.go`, `stream_store.go`, test files, type files
- Pattern: Store handles filesystem operations, service handles business logic + broadcasts
- No main.go or router changes (those are deferred to Story 2-4)

**Commit `eceabc5` (Story 2-2):**
- Added List/Get methods to service and store
- Comprehensive test coverage for all acceptance criteria
- Followed existing patterns from Story 2-1

**Commit `f9ea790` (Story 2-1):**
- Established StreamService, StreamStore, StreamMeta types
- WebSocket integration pattern
- Test helpers for stream creation

**Implementation approach for Story 2-4:**
- Create handlers layer (NEW)
- Add UpdateMetadata to service (extension)
- Wire to router and main.go (integration)
- Comprehensive endpoint tests

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-stream-lifecycle-management.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#REST API Conventions]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Conventions]
- [Source: _bmad-output/project-context.md#REST API Conventions]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: backend/api/router.go#Projects Resource]
- [Source: backend/services/stream_service.go]
- [Source: _bmad-output/implementation-artifacts/2-1-create-stream.md#Dev Notes]
- [Source: _bmad-output/implementation-artifacts/2-2-list-view-streams.md#Dev Notes]
- [Source: _bmad-output/implementation-artifacts/2-3-archive-stream.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
