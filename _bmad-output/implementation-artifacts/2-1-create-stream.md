# Story 2.1: Create Stream

Status: review

## Story

As a developer,
I want to create a new stream within my project,
So that I can track a feature/idea through the BMAD pipeline with its own artifact space.

## Acceptance Criteria

1. **Given** a registered project **When** the user creates a stream with a name (e.g., "payment-integration") **Then** the system creates `~/.bmad-studio/projects/{project}-{stream}/` directory **And** writes a `stream.json` with `name`, `project`, `status: "active"`, `type: "full"`, `phase: null`, `branch: null`, `worktree: null`, `createdAt`, `updatedAt` **And** persists immediately via atomic JSON write (NFR11)

2. **Given** a stream name that already exists for the project **When** the user attempts to create a duplicate **Then** the system returns an error indicating the name is taken

3. **Given** a stream name with special characters **When** the user creates the stream **Then** the system validates the name contains only alphanumeric characters, hyphens, and underscores

4. **Given** a stream is successfully created **When** the WebSocket hub receives the event **Then** a `stream:created` event is broadcast with `{ "projectId", "streamId", "name" }`

## Tasks / Subtasks

- [x] Task 1: Create `StreamMeta` type in `backend/types/stream.go` (AC: #1)
  - [x] 1.1: Define `StreamMeta` struct with fields: `Name`, `Project`, `Status`, `Type`, `Phase`, `Branch`, `Worktree`, `CreatedAt`, `UpdatedAt`
  - [x] 1.2: All JSON tags MUST use `camelCase`: `json:"name"`, `json:"project"`, `json:"status"`, `json:"type"`, `json:"phase,omitempty"`, `json:"branch,omitempty"`, `json:"worktree,omitempty"`, `json:"createdAt"`, `json:"updatedAt"`
  - [x] 1.3: Define `StreamStatus` type alias (`string`) and constants: `StreamStatusActive = "active"`, `StreamStatusArchived = "archived"`
  - [x] 1.4: Define `StreamType` type alias (`string`) and constant: `StreamTypeFull = "full"`

- [x] Task 2: Create `StreamStore` in `backend/storage/stream_store.go` (AC: #1, #2)
  - [x] 2.1: Define `StreamStore` struct with `store *CentralStore` field (same pattern as `ProjectStore`)
  - [x] 2.2: `NewStreamStore(store *CentralStore) *StreamStore` constructor
  - [x] 2.3: `CreateStreamDir(projectName, streamName string) (string, error)` — creates `projects/{projectName}-{streamName}/` directory, fsyncs parent, returns full path. Returns error if directory already exists (duplicate detection)
  - [x] 2.4: `WriteStreamMeta(projectName, streamName string, meta types.StreamMeta) error` — writes `stream.json` using `WriteJSON` (atomic)
  - [x] 2.5: `ReadStreamMeta(projectName, streamName string) (*types.StreamMeta, error)` — reads `stream.json` using `ReadJSON`
  - [x] 2.6: `StreamDirExists(projectName, streamName string) bool` — checks if stream directory exists (for duplicate validation)
  - [x] 2.7: Helper `streamDir(projectName, streamName string) string` — returns `filepath.Join(store.rootDir, "projects", projectName+"-"+streamName)`

- [x] Task 3: Create `StreamService` in `backend/services/stream_service.go` (AC: #1, #2, #3, #4)
  - [x] 3.1: Define `StreamService` struct with `streamStore *storage.StreamStore`, `registryStore *storage.RegistryStore`, `hub` (WebSocket hub interface for broadcasting)
  - [x] 3.2: `NewStreamService(streamStore, registryStore, hub) *StreamService` constructor
  - [x] 3.3: `Create(projectName, streamName string) (*types.StreamMeta, error)` method:
    - Validate stream name: regex `^[a-zA-Z0-9][a-zA-Z0-9_-]*$` (alphanumeric, hyphens, underscores; must start with alphanumeric)
    - Verify project exists in registry via `registryStore.FindByName(projectName)`
    - Check for duplicate via `streamStore.StreamDirExists(projectName, streamName)`
    - Create stream directory via `streamStore.CreateStreamDir(projectName, streamName)`
    - Build `StreamMeta`: `Status: "active"`, `Type: "full"`, `Phase: ""` (null in JSON via omitempty), `CreatedAt`/`UpdatedAt`: ISO 8601 `time.Now().UTC().Format(time.RFC3339)`
    - Write `stream.json` via `streamStore.WriteStreamMeta`
    - Broadcast `stream:created` event via hub using `types.NewStreamCreatedEvent(projectName, streamID, streamName)` where `streamID = projectName + "-" + streamName`
    - Return the created `StreamMeta`

- [x] Task 4: Write unit tests for `StreamStore` in `backend/storage/stream_store_test.go` (AC: #1, #2)
  - [x] 4.1: Test `CreateStreamDir` creates directory at correct path
  - [x] 4.2: Test `CreateStreamDir` returns error for duplicate directory
  - [x] 4.3: Test `WriteStreamMeta` and `ReadStreamMeta` round-trip
  - [x] 4.4: Test `StreamDirExists` returns true/false correctly
  - [x] 4.5: Test JSON serialization uses `camelCase` tags (marshal and verify field names)
  - [x] 4.6: Use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility in all tests

- [x] Task 5: Write unit tests for `StreamService` in `backend/services/stream_service_test.go` (AC: #1, #2, #3, #4)
  - [x] 5.1: Test successful stream creation — returns valid `StreamMeta` with all fields set
  - [x] 5.2: Test duplicate stream name returns error
  - [x] 5.3: Test invalid stream name (special chars, empty, starts with hyphen) returns validation error
  - [x] 5.4: Test project not found in registry returns error
  - [x] 5.5: Test `stream:created` WebSocket event is broadcast after successful creation
  - [x] 5.6: Test created `stream.json` persists correctly on disk (read back and verify)
  - [x] 5.7: Use table-driven tests where appropriate (name validation cases)

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON fields MUST use `camelCase`. Go struct tags: `json:"projectId"`, `json:"streamId"`, `json:"createdAt"`. No `snake_case`. No exceptions.
- **Atomic JSON writes:** All `stream.json` writes MUST use the existing `storage.WriteJSON` helper (write-to-tmp-then-rename pattern). Never write directly to the target file.
- **Error handling:** Always return `(result, error)` — never panic.
- **Dates:** ISO 8601 format — `time.Now().UTC().Format(time.RFC3339)`.
- **WebSocket events:** Event names use `namespace:kebab-case`. Stream event types and payloads already exist in `backend/types/websocket.go` (added in Story 1.4).
- **File naming:** Go files use `snake_case.go` naming.

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/storage/json_writer.go`** — `WriteJSON(path, data)` and `ReadJSON(path, target)`. Atomic write with fsync + rename. Use these for all `stream.json` operations.
- **`backend/storage/store.go`** — `CentralStore` with `RootDir()`, `Init()`, `NewCentralStoreWithPath(path)` (for testing). `syncDir(path)` helper for fsyncing directories after creation.
- **`backend/storage/project_store.go`** — Pattern to follow: `ProjectStore` struct with `store *CentralStore`, `CreateProjectDir`, `WriteProjectMeta`, `ReadProjectMeta`. Mirror this exact pattern for `StreamStore`.
- **`backend/storage/registry.go`** — `RegistryStore` with `FindByName(name)`, `FindByRepoPath(path)`, `Load()`, `Save()`, `AddProject()`, `RemoveProject()`. Use `FindByName` to verify project exists before creating a stream.
- **`backend/types/websocket.go`** — `StreamCreatedPayload`, `NewStreamCreatedEvent(projectID, streamID, name)`, `EventTypeStreamCreated`. All stream event types already defined. Do NOT recreate them.
- **`backend/api/websocket/hub.go`** — Hub with `BroadcastEvent(*WebSocketEvent)`. Import as `"bmad-studio/backend/api/websocket"`. The hub interface for services should accept a broadcast function or the hub itself.

### Central Store Directory Layout for Streams

```
~/.bmad-studio/
├── registry.json
├── config.json
└── projects/
    ├── my-app/                          # Main project (has project.json)
    │   └── project.json
    ├── my-app-payment-integration/      # Stream directory (has stream.json)
    │   └── stream.json
    └── my-app-auth-refactor/            # Another stream
        └── stream.json
```

**Key rules:**
- Stream directory name = `{projectName}-{streamName}` (flat sibling under `projects/`)
- Stream directories contain `stream.json` (NOT `project.json`)
- The `streamId` used in WebSocket events and API = `{projectName}-{streamName}`

### stream.json Structure

```json
{
  "name": "payment-integration",
  "project": "my-app",
  "status": "active",
  "type": "full",
  "createdAt": "2026-02-12T10:30:00Z",
  "updatedAt": "2026-02-12T10:30:00Z"
}
```

- `phase`, `branch`, `worktree` are nullable — use `omitempty` in Go so they are omitted when empty/null rather than sending `null`
- `status`: `"active"` or `"archived"` (only `"active"` for create)
- `type`: `"full"` (MVP — only type supported)

### Stream Name Validation Rules

- Must match: `^[a-zA-Z0-9][a-zA-Z0-9_-]*$`
- Allowed: alphanumeric, hyphens (`-`), underscores (`_`)
- Must start with an alphanumeric character
- Cannot be empty
- Examples valid: `payment-integration`, `auth_refactor`, `feature1`
- Examples invalid: `-bad`, `_bad`, `with spaces`, `special!chars`, ``

### Hub Integration Pattern

The `StreamService` needs to broadcast events. Use one of these patterns:

**Option A — Hub interface (preferred for testability):**
```go
// Broadcaster is the interface for broadcasting WebSocket events
type Broadcaster interface {
    BroadcastEvent(event *types.WebSocketEvent)
}

type StreamService struct {
    streamStore   *storage.StreamStore
    registryStore *storage.RegistryStore
    hub           Broadcaster
}
```

**Option B — Function injection:**
```go
type StreamService struct {
    streamStore   *storage.StreamStore
    registryStore *storage.RegistryStore
    broadcast     func(event *types.WebSocketEvent)
}
```

Option A is preferred because it mirrors the patterns used in the codebase and makes testing straightforward with a mock hub.

### What NOT to Build

- Do NOT implement stream listing, viewing, or filtering — that is Story 2.2
- Do NOT implement stream archiving — that is Story 2.3
- Do NOT implement REST API endpoints for streams — that is Story 2.4
- Do NOT implement phase derivation — that is Epic 3
- Do NOT implement worktree creation — that is Epic 5
- Do NOT modify `main.go` wiring — that is Story 2.4 scope (REST endpoints)
- Do NOT modify the router — that is Story 2.4 scope
- Do NOT modify the WebSocket hub or event types — they are already complete from Story 1.4

### Testing Notes

- **Temp directories:** Always resolve with `filepath.EvalSymlinks(t.TempDir())` on macOS. Example:
  ```go
  func resolveDir(t *testing.T, dir string) string {
      t.Helper()
      resolved, err := filepath.EvalSymlinks(dir)
      require.NoError(t, err)
      return resolved
  }
  ```
- **Table-driven tests:** Use Go's idiomatic pattern for name validation cases.
- **Mock hub for broadcast testing:** Create a simple mock that records broadcast calls:
  ```go
  type mockHub struct {
      events []*types.WebSocketEvent
  }
  func (m *mockHub) BroadcastEvent(event *types.WebSocketEvent) {
      m.events = append(m.events, event)
  }
  ```
- **JSON verification:** Marshal `StreamMeta` and verify field names are `camelCase` in the output.
- **Test file locations:** `backend/storage/stream_store_test.go` and `backend/services/stream_service_test.go` (colocated with source).

### Project Structure Notes

Files to create:
| File | Purpose |
|------|---------|
| `backend/types/stream.go` | `StreamMeta`, `StreamStatus`, `StreamType` types |
| `backend/storage/stream_store.go` | Stream directory + `stream.json` read/write |
| `backend/storage/stream_store_test.go` | StreamStore unit tests |
| `backend/services/stream_service.go` | Stream creation logic + validation + hub broadcast |
| `backend/services/stream_service_test.go` | StreamService unit tests |

Files NOT to modify:
- `backend/types/websocket.go` — stream event types already exist
- `backend/api/router.go` — REST endpoints are Story 2.4
- `backend/main.go` — wiring is Story 2.4
- `backend/api/handlers/` — handlers are Story 2.4

### Previous Story Intelligence

**From Story 1.1 (Central Store):**
- Established `CentralStore`, `RegistryStore`, `WriteJSON`/`ReadJSON`, atomic write pattern
- Tests use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility
- `syncDir()` helper available for fsyncing directories after creation

**From Story 1.2 (Project Registration):**
- `ProjectService` with `Register`, `Unregister`, `List`, `Get`
- `ProjectStore` pattern: struct with `store *CentralStore`, methods for dir creation and metadata read/write
- `RegistryStore.FindByName(name)` — use this to verify project exists before stream creation

**From Story 1.3 (REST API):**
- All project REST endpoints implemented with `ProjectsHandler`
- Error mapping established (409 conflict, 400 bad request, 404 not found, 500 internal)
- `response.WriteJSON`, `response.WriteError`, `response.WriteInvalidRequest` helpers
- Router wiring pattern: service → handler → router registration

**From Story 1.4 (WebSocket Event Hub):**
- All stream event types already defined: `StreamCreatedPayload`, `NewStreamCreatedEvent`, etc.
- Hub infrastructure complete: `BroadcastEvent()`, `SendToClient()`, `Register()`, `Unregister()`
- `connection:status` sent on connect — client receives it as first message
- JSON tags on stream payloads verified as `camelCase`

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-stream-lifecycle-management.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Central Store Layout]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Stream Metadata]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Central Store File Operations]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Conventions]
- [Source: _bmad-output/project-context.md#Atomic JSON Writes]
- [Source: _bmad-output/project-context.md#Central Store Layout]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: _bmad-output/implementation-artifacts/1-4-websocket-event-hub.md]
- [Source: _bmad-output/implementation-artifacts/1-2-project-registration-store-directory-setup.md]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

None - implementation completed without debugging issues.

### Completion Notes List

- Implemented StreamMeta type with camelCase JSON tags and omitempty for nullable fields
- Created StreamStore following ProjectStore pattern with atomic JSON writes and fsync for crash safety
- Implemented StreamService with name validation regex, project verification, and WebSocket event broadcasting
- All tests pass (100% coverage for StreamStore and StreamService)
- Used Broadcaster interface for hub integration (testable with mock)
- Applied macOS temp directory symlink resolution in all tests
- Table-driven tests for stream name validation cases
- Verified camelCase JSON serialization in dedicated test

### File List

- backend/types/stream.go
- backend/storage/stream_store.go
- backend/storage/stream_store_test.go
- backend/services/stream_service.go
- backend/services/stream_service_test.go
- backend/go.mod

## Change Log

- 2026-02-12: Story implementation completed - StreamMeta types, StreamStore, StreamService with full test coverage
