# Story 2.3: Archive Stream

Status: ready-for-dev

## Story

As a developer,
I want to archive a stream as completed or abandoned,
So that finished work moves out of my active view while preserving its artifacts.

## Acceptance Criteria

1. **Given** an active stream **When** the user archives with outcome `"merged"` **Then** the system moves the stream directory from `projects/{project}-{stream}/` to `projects/archive/{project}-{stream}/` **And** updates `stream.json` with `status: "archived"`, `outcome: "merged"`, and `updatedAt`

2. **Given** an active stream **When** the user archives with outcome `"abandoned"` **Then** the system moves the stream directory to `archive/` and sets `outcome: "abandoned"`

3. **Given** a stream is archived **When** the WebSocket hub receives the event **Then** a `stream:archived` event is broadcast with `{ "projectId", "streamId", "outcome" }`

4. **Given** the archive directory does not exist **When** the first stream is archived **Then** the system creates `projects/archive/` before moving the stream

## Tasks / Subtasks

- [ ] Task 1: Add `Outcome` field to `StreamMeta` type in `backend/types/stream.go` (AC: #1, #2)
  - [ ] 1.1: Add `Outcome` field to `StreamMeta` struct with JSON tag `json:"outcome,omitempty"` (nullable, only present when archived)
  - [ ] 1.2: Define `StreamOutcome` type alias (`string`) and constants: `StreamOutcomeMerged = "merged"`, `StreamOutcomeAbandoned = "abandoned"`

- [ ] Task 2: Add archive methods to `StreamStore` in `backend/storage/stream_store.go` (AC: #1, #2, #4)
  - [ ] 2.1: `ArchiveStream(projectName, streamName string, outcome types.StreamOutcome) error` — moves stream directory to archive, updates metadata
  - [ ] 2.2: Create archive directory `projects/archive/` if it doesn't exist (AC: #4)
  - [ ] 2.3: Source path: `{rootDir}/projects/{projectName}-{streamName}/`
  - [ ] 2.4: Dest path: `{rootDir}/projects/archive/{projectName}-{streamName}/`
  - [ ] 2.5: Read existing `stream.json` from source
  - [ ] 2.6: Update metadata: set `status` to `"archived"`, `outcome` to given value, `updatedAt` to current ISO 8601 timestamp
  - [ ] 2.7: Write updated `stream.json` to source before moving (atomic update)
  - [ ] 2.8: Move directory using `os.Rename(src, dest)` (atomic on same filesystem)
  - [ ] 2.9: Fsync archive parent directory after move
  - [ ] 2.10: Return error if stream doesn't exist, already archived, or move fails

- [ ] Task 3: Add `Archive` method to `StreamService` in `backend/services/stream_service.go` (AC: #1, #2, #3)
  - [ ] 3.1: `Archive(projectName, streamName, outcome string) (*types.StreamMeta, error)` method
  - [ ] 3.2: Validate outcome: must be `"merged"` or `"abandoned"` (return error otherwise)
  - [ ] 3.3: Verify project exists via `registryStore.FindByName(projectName)`
  - [ ] 3.4: Verify stream exists and is active (read `stream.json`, check status is not already `"archived"`)
  - [ ] 3.5: Delegate to `streamStore.ArchiveStream(projectName, streamName, outcome)`
  - [ ] 3.6: Broadcast `stream:archived` event via hub using `types.NewStreamArchivedEvent(projectName, streamID, outcome)` where `streamID = projectName + "-" + streamName`
  - [ ] 3.7: Read and return the archived `StreamMeta` from new location

- [ ] Task 4: Add `StreamArchivedPayload` and event constructor to `backend/types/websocket.go` (AC: #3)
  - [ ] 4.1: Define `StreamArchivedPayload` struct with fields: `ProjectID string`, `StreamID string`, `Outcome string` (all camelCase JSON tags)
  - [ ] 4.2: Add `EventTypeStreamArchived = "stream:archived"` constant
  - [ ] 4.3: Add `NewStreamArchivedEvent(projectID, streamID, outcome string) *WebSocketEvent` constructor

- [ ] Task 5: Update `ListProjectStreams` to exclude archived streams (AC: implicit — list should only show active)
  - [ ] 5.1: Modify `backend/storage/stream_store.go` `ListProjectStreams` to skip directories under `projects/archive/`
  - [ ] 5.2: Only scan `projects/{projectName}-*` (NOT `projects/archive/{projectName}-*`)
  - [ ] 5.3: Ensure archived streams don't appear in list results

- [ ] Task 6: Write unit tests for `StreamStore.ArchiveStream` in `backend/storage/stream_store_test.go` (AC: #1, #2, #4)
  - [ ] 6.1: Test archive with `"merged"` outcome — verify directory moved, metadata updated
  - [ ] 6.2: Test archive with `"abandoned"` outcome — verify directory moved, metadata updated
  - [ ] 6.3: Test archive creates `archive/` directory if it doesn't exist
  - [ ] 6.4: Test archive returns error if stream doesn't exist
  - [ ] 6.5: Test archive returns error if stream is already archived (idempotency check)
  - [ ] 6.6: Test archived stream metadata includes `outcome` field with correct value
  - [ ] 6.7: Test archived stream has `status: "archived"`
  - [ ] 6.8: Test `updatedAt` is updated to current timestamp
  - [ ] 6.9: Use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility

- [ ] Task 7: Write unit tests for `StreamService.Archive` in `backend/services/stream_service_test.go` (AC: #1, #2, #3)
  - [ ] 7.1: Test successful archive with `"merged"` outcome
  - [ ] 7.2: Test successful archive with `"abandoned"` outcome
  - [ ] 7.3: Test invalid outcome (e.g., `"cancelled"`) returns validation error
  - [ ] 7.4: Test project not found returns error
  - [ ] 7.5: Test stream not found returns error
  - [ ] 7.6: Test archiving already archived stream returns error
  - [ ] 7.7: Test `stream:archived` WebSocket event is broadcast with correct payload
  - [ ] 7.8: Test archived stream is excluded from `List()` results

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON fields MUST use `camelCase`. New `outcome` field: `json:"outcome,omitempty"`
- **Atomic directory move:** Use `os.Rename(src, dest)` which is atomic on the same filesystem. The archive directory is always under the same root as projects.
- **Metadata update before move:** Update `stream.json` with new status/outcome BEFORE moving directory to ensure metadata consistency if move fails.
- **Archive directory creation:** Use `os.MkdirAll` with `0755` permissions, then fsync parent.
- **Error handling:** Always return `(result, error)` — never panic.
- **Dates:** ISO 8601 format — `time.Now().UTC().Format(time.RFC3339)`.
- **WebSocket events:** Event names use `namespace:kebab-case`. Follow existing pattern from `stream:created`.

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/types/stream.go`** — `StreamMeta`, `StreamStatus`, `StreamType` already defined. ADD `Outcome` field and `StreamOutcome` type.
- **`backend/storage/stream_store.go`** — `StreamStore` with `ReadStreamMeta()`, `WriteStreamMeta()`, `streamDir()` helper. ADD `ArchiveStream()` method.
- **`backend/services/stream_service.go`** — `StreamService` with `Create()`, `List()`, `Get()`. ADD `Archive()` method.
- **`backend/types/websocket.go`** — `StreamCreatedPayload`, `NewStreamCreatedEvent` pattern. ADD `StreamArchivedPayload` and `NewStreamArchivedEvent`.
- **`backend/storage/store.go`** — `syncDir(path)` helper for fsyncing directories after filesystem changes.
- **`backend/storage/json_writer.go`** — `WriteJSON(path, data)` and `ReadJSON(path, target)` for atomic metadata updates.
- **`backend/storage/registry.go`** — `RegistryStore.FindByName(name)` for project verification.

### Central Store Directory Layout After Archive

**Before archive:**
```
~/.bmad-studio/projects/
├── my-app/
│   └── project.json
├── my-app-payment-integration/
│   └── stream.json  (status: "active")
└── my-app-auth-refactor/
    └── stream.json  (status: "active")
```

**After archiving `payment-integration` with outcome `"merged"`:**
```
~/.bmad-studio/projects/
├── my-app/
│   └── project.json
├── my-app-auth-refactor/
│   └── stream.json  (status: "active")
└── archive/
    └── my-app-payment-integration/
        └── stream.json  (status: "archived", outcome: "merged")
```

**Key rules:**
- Archive directory is `projects/archive/`
- Archived stream directory name stays the same: `{projectName}-{streamName}`
- Full destination path: `~/.bmad-studio/projects/archive/{projectName}-{streamName}/`
- Stream artifacts (future — Epic 3+) move with the directory

### stream.json Structure After Archive

**Active stream:**
```json
{
  "name": "payment-integration",
  "project": "my-app",
  "status": "active",
  "type": "full",
  "createdAt": "2026-02-12T10:00:00Z",
  "updatedAt": "2026-02-12T10:00:00Z"
}
```

**Archived stream with `"merged"` outcome:**
```json
{
  "name": "payment-integration",
  "project": "my-app",
  "status": "archived",
  "type": "full",
  "outcome": "merged",
  "createdAt": "2026-02-12T10:00:00Z",
  "updatedAt": "2026-02-12T15:30:00Z"
}
```

**Changes when archiving:**
- `status`: `"active"` → `"archived"`
- `outcome`: added with value `"merged"` or `"abandoned"`
- `updatedAt`: updated to current timestamp
- All other fields remain unchanged

### Archive Implementation Pattern

**Step-by-step process:**
1. Validate outcome is `"merged"` or `"abandoned"`
2. Verify project exists in registry
3. Read existing `stream.json` from source location
4. Verify stream is not already archived (check `status` field)
5. Create archive directory if it doesn't exist (`os.MkdirAll`, then `syncDir`)
6. Update metadata: set `status = "archived"`, `outcome = <value>`, `updatedAt = <now>`
7. Write updated `stream.json` back to source directory (atomic via `WriteJSON`)
8. Move directory: `os.Rename(src, dest)`
9. Fsync archive parent directory
10. Broadcast `stream:archived` event
11. Return archived metadata (read from new location to verify)

**Error handling:**
- If stream doesn't exist → `"stream not found"`
- If already archived → `"stream already archived"`
- If outcome invalid → `"invalid outcome: must be 'merged' or 'abandoned'"`
- If project not found → `"project not found"`
- If move fails → wrap OS error with context

### Outcome Validation

**Valid outcomes:**
- `"merged"` — stream feature was completed and merged into main branch
- `"abandoned"` — stream feature was cancelled or abandoned without merging

**Implementation:**
```go
func (s *StreamService) Archive(projectName, streamName, outcome string) (*types.StreamMeta, error) {
    // Validate outcome
    if outcome != string(types.StreamOutcomeMerged) && outcome != string(types.StreamOutcomeAbandoned) {
        return nil, fmt.Errorf("invalid outcome: must be 'merged' or 'abandoned', got '%s'", outcome)
    }
    // ...
}
```

### WebSocket Event Payload

**Event type:** `stream:archived`

**Payload structure:**
```json
{
  "projectId": "my-app",
  "streamId": "my-app-payment-integration",
  "outcome": "merged"
}
```

**Constructor pattern (follow existing `NewStreamCreatedEvent`):**
```go
func NewStreamArchivedEvent(projectID, streamID, outcome string) *WebSocketEvent {
    return &WebSocketEvent{
        Type: EventTypeStreamArchived,
        Payload: StreamArchivedPayload{
            ProjectID: projectID,
            StreamID:  streamID,
            Outcome:   outcome,
        },
    }
}
```

### ListProjectStreams Exclusion Logic

**Current behavior (Story 2.2):**
- Scans `projects/` directory for `{projectName}-*` matches
- Reads `stream.json` from each match
- Returns sorted list

**New behavior (Story 2.3):**
- MUST exclude archived streams from list results
- Archived streams are under `projects/archive/` (different path)
- List scan should only match `projects/{projectName}-*` (NOT recursive into `archive/`)

**Implementation:** Current implementation using `os.ReadDir(projectsDir)` already excludes `archive/` subdirectory because it only scans top-level entries. Verify this in tests — archived stream should NOT appear in list.

### What NOT to Build

- Do NOT implement REST API endpoints for archive — that is Story 2.4
- Do NOT implement worktree cleanup on archive — that is Epic 5 (Story 5.3)
- Do NOT implement UI for archive action — that is Epic 10
- Do NOT implement branch deletion or Git operations — that is Epic 5
- Do NOT implement filtering archived streams in list view — MVP excludes them entirely
- Do NOT add "unarchive" or "restore" functionality — out of scope for MVP
- Do NOT modify `main.go` or router — that is Story 2.4

### Testing Notes

- **Temp directories:** Always resolve with `filepath.EvalSymlinks(t.TempDir())` on macOS
- **Setup helper for archive tests:**
  ```go
  func createActiveStream(t *testing.T, store *StreamStore, projectName, streamName string) {
      t.Helper()
      meta := types.StreamMeta{
          Name:      streamName,
          Project:   projectName,
          Status:    types.StreamStatusActive,
          Type:      types.StreamTypeFull,
          CreatedAt: "2026-02-12T10:00:00Z",
          UpdatedAt: "2026-02-12T10:00:00Z",
      }
      store.CreateStreamDir(projectName, streamName)
      store.WriteStreamMeta(projectName, streamName, meta)
  }
  ```
- **Verify archive directory creation:** Test first archive creates `archive/` directory
- **Verify metadata changes:** After archive, read `stream.json` from archive location and verify all fields
- **Verify move operation:** Check source directory no longer exists, destination exists
- **Test idempotency:** Archiving an already archived stream should return error
- **Test list exclusion:** Create stream, archive it, verify it doesn't appear in `List()` results
- **Mock hub for broadcast testing:** Verify `stream:archived` event is sent with correct payload

### Project Structure Notes

Files to modify:
| File | Changes |
|------|---------|
| `backend/types/stream.go` | Add `Outcome` field to `StreamMeta`, add `StreamOutcome` type and constants |
| `backend/types/websocket.go` | Add `StreamArchivedPayload`, `EventTypeStreamArchived`, `NewStreamArchivedEvent` |
| `backend/storage/stream_store.go` | Add `ArchiveStream()` method |
| `backend/services/stream_service.go` | Add `Archive()` method |
| `backend/storage/stream_store_test.go` | Add archive tests |
| `backend/services/stream_service_test.go` | Add archive tests |

Files NOT to modify:
- `backend/api/handlers/` — handlers are Story 2.4
- `backend/api/router.go` — routing is Story 2.4
- `backend/main.go` — wiring is Story 2.4
- Frontend files — UI integration is Epic 10

### Previous Story Intelligence

**From Story 2.1 (Create Stream):**
- `StreamStore` pattern established: struct with `store *CentralStore`, directory creation + metadata read/write
- `StreamService` pattern: validates inputs, verifies project exists, delegates to store, broadcasts events
- Stream directory naming: `{projectName}-{streamName}`
- StreamID for events: `{projectName}-{streamName}`
- Atomic JSON writes using `WriteJSON` helper
- Fsync pattern for crash safety: create dir, write metadata, fsync parent
- Mock hub pattern for testing broadcasts

**From Story 2.2 (List & View Streams):**
- `ListProjectStreams` scans `projects/` directory for `{projectName}-*` matches
- Resilience: corrupted `stream.json` files are skipped with warning log
- Empty array (not nil) returned when no streams found
- Sorting by `updatedAt` descending (ISO 8601 string comparison)
- Project verification before all operations via `registryStore.FindByName()`

**Key patterns to follow:**
- Always verify project exists before stream operations
- Use existing helpers (`WriteJSON`, `ReadJSON`, `syncDir`)
- Error wrapping with context (`fmt.Errorf("archive failed: %w", err)`)
- Test pattern: `resolveDir(t, t.TempDir())` for test setup
- Broadcast events after successful state changes
- Return updated metadata after mutations

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-stream-lifecycle-management.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Central Store Layout]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Central Store File Operations]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Conventions]
- [Source: _bmad-output/project-context.md#Atomic JSON Writes]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: _bmad-output/implementation-artifacts/2-1-create-stream.md#Dev Notes]
- [Source: _bmad-output/implementation-artifacts/2-2-list-view-streams.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_Expected files to be created/modified:_
- backend/types/stream.go (modified)
- backend/types/websocket.go (modified)
- backend/storage/stream_store.go (modified)
- backend/storage/stream_store_test.go (modified)
- backend/services/stream_service.go (modified)
- backend/services/stream_service_test.go (modified)
