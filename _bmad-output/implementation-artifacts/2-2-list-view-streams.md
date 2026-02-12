# Story 2.2: List & View Streams

Status: ready-for-dev

## Story

As a developer,
I want to view all streams for my project with their current phase and status,
So that I can see what's in flight and where each feature stands.

## Acceptance Criteria

1. **Given** a registered project with active streams **When** the user requests the stream list **Then** the system scans all `{project}-*` sibling directories, reads each `stream.json`, and returns the list sorted by `updatedAt` descending

2. **Given** a specific stream **When** the user requests stream detail **Then** the system returns the full `stream.json` content including derived phase state

3. **Given** a project with no streams **When** the user requests the stream list **Then** the system returns an empty array

4. **Given** a stream directory exists but `stream.json` is corrupted **When** the system scans streams **Then** it skips the corrupted stream, includes remaining streams, and logs a warning (NFR13)

## Tasks / Subtasks

- [ ] Task 1: Add ListStreams method to `StreamStore` (AC: #1, #3, #4)
  - [ ] 1.1: `ListProjectStreams(projectName string) ([]*types.StreamMeta, error)` — scans all `{projectName}-*` directories in `projects/`, reads each `stream.json`, returns sorted list
  - [ ] 1.2: Directory scanning: use `filepath.Glob` or `os.ReadDir` to find matching stream directories
  - [ ] 1.3: For each match, extract stream name (everything after `{projectName}-` prefix), call `ReadStreamMeta(projectName, streamName)`
  - [ ] 1.4: Handle corrupted `stream.json` gracefully — log warning, skip that stream, continue with others (NFR13)
  - [ ] 1.5: Sort results by `UpdatedAt` descending (most recently updated first)
  - [ ] 1.6: Return empty array (not nil) if no streams found

- [ ] Task 2: Add List and Get methods to `StreamService` (AC: #1, #2, #3, #4)
  - [ ] 2.1: `List(projectName string) ([]*types.StreamMeta, error)` — delegates to `streamStore.ListProjectStreams`, verifies project exists first
  - [ ] 2.2: `Get(projectName, streamName string) (*types.StreamMeta, error)` — delegates to `streamStore.ReadStreamMeta`, returns error if stream not found
  - [ ] 2.3: Project existence check: call `registryStore.FindByName(projectName)` before listing/getting
  - [ ] 2.4: For `Get`, include derived phase state (placeholder for now — phase derivation is Epic 3, so return empty string for `phase` field until then)

- [ ] Task 3: Write unit tests for `StreamStore.ListProjectStreams` (AC: #1, #3, #4)
  - [ ] 3.1: Test empty project (no streams) returns empty array
  - [ ] 3.2: Test single stream is found and returned
  - [ ] 3.3: Test multiple streams are returned sorted by `updatedAt` descending
  - [ ] 3.4: Test streams with different project names are NOT included (only `{projectName}-*` matches)
  - [ ] 3.5: Test corrupted `stream.json` is skipped without failing entire list operation
  - [ ] 3.6: Test sorting order — create 3 streams with different timestamps, verify order
  - [ ] 3.7: Use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility

- [ ] Task 4: Write unit tests for `StreamService.List` and `StreamService.Get` (AC: #1, #2, #3, #4)
  - [ ] 4.1: Test `List` returns all streams for a project
  - [ ] 4.2: Test `List` returns empty array for project with no streams
  - [ ] 4.3: Test `List` returns error if project not found in registry
  - [ ] 4.4: Test `Get` returns stream metadata for existing stream
  - [ ] 4.5: Test `Get` returns error if stream not found
  - [ ] 4.6: Test `Get` returns error if project not found in registry
  - [ ] 4.7: Test list results are sorted by `updatedAt` descending

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON fields use `camelCase` (already enforced in `StreamMeta` type from Story 2.1)
- **Error handling:** Always return `(result, error)` — never panic
- **Empty array convention:** Return `[]*types.StreamMeta{}` (empty slice, not `nil`) when no streams found
- **Sorting:** Sort by `updatedAt` descending — most recent first. Parse ISO 8601 timestamps for comparison.
- **Resilience (NFR13):** Corrupted `stream.json` should not crash list operation — skip corrupted entry, log warning, continue

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/types/stream.go`** — `StreamMeta` type already defined with all fields (from Story 2.1)
- **`backend/storage/stream_store.go`** — `StreamStore` struct, `ReadStreamMeta()`, `streamDir()` helper already exist
- **`backend/services/stream_service.go`** — `StreamService` struct with `Create()` method and project verification pattern
- **`backend/storage/registry.go`** — `RegistryStore.FindByName(name)` for project existence check

### Central Store Directory Scan Pattern

**Goal:** Find all stream directories for a given project.

**Layout example:**
```
~/.bmad-studio/projects/
├── my-app/                          # Main project (has project.json)
├── my-app-payment-integration/      # Stream (has stream.json)
├── my-app-auth-refactor/            # Stream (has stream.json)
└── other-project-feature/           # Different project's stream
```

**Scan logic:**
1. Get project root: `filepath.Join(store.rootDir, "projects")`
2. Read directory entries with `os.ReadDir(projectsDir)`
3. For each entry that is a directory:
   - Check if name starts with `{projectName}-`
   - Extract stream name: everything after `{projectName}-`
   - Read `stream.json` using `ReadStreamMeta(projectName, streamName)`
   - Handle `ReadJSON` errors gracefully (skip corrupted, log warning)
4. Sort results by `UpdatedAt` descending
5. Return slice

**Alternative using Glob:**
```go
pattern := filepath.Join(s.store.rootDir, "projects", projectName+"-*")
matches, err := filepath.Glob(pattern)
```
Then filter for directories and extract stream names.

### Sorting by UpdatedAt

`UpdatedAt` is an ISO 8601 string (`"2026-02-12T10:30:00Z"`). Options:

**Option A — String comparison (works for ISO 8601):**
```go
sort.Slice(streams, func(i, j int) bool {
    return streams[i].UpdatedAt > streams[j].UpdatedAt // Descending
})
```

**Option B — Parse to time.Time (more robust):**
```go
sort.Slice(streams, func(i, j int) bool {
    ti, _ := time.Parse(time.RFC3339, streams[i].UpdatedAt)
    tj, _ := time.Parse(time.RFC3339, streams[j].UpdatedAt)
    return ti.After(tj) // Descending
})
```

Option A is simpler and works because ISO 8601 is lexicographically sortable. Use Option B if you want explicit time handling.

### Resilience (NFR13) — Handling Corrupted stream.json

**Requirement:** If `stream.json` is corrupted (malformed JSON, missing file, etc.), skip that stream and continue listing others. Do NOT fail the entire operation.

**Implementation:**
```go
for _, entry := range entries {
    // Extract stream name...
    meta, err := s.ReadStreamMeta(projectName, streamName)
    if err != nil {
        // Log warning, skip this stream
        log.Printf("WARNING: Skipping corrupted stream %s-%s: %v", projectName, streamName, err)
        continue
    }
    streams = append(streams, meta)
}
```

**Testing:** Create a stream directory with an invalid `stream.json` (e.g., `echo "invalid json" > stream.json`), verify it's skipped without error.

### Phase Derivation Placeholder

**Important:** Phase derivation is implemented in **Epic 3** (artifact detection + phase state). For now, `StreamMeta.Phase` will be empty string (omitted in JSON via `omitempty`).

When Epic 3 is done, the watcher service will update `stream.json` with the derived phase whenever artifacts change. For Story 2.2, just return the `stream.json` content as-is — no special phase logic needed.

### What NOT to Build

- Do NOT implement stream archiving — that is Story 2.3
- Do NOT implement REST API endpoints — that is Story 2.4
- Do NOT implement phase derivation — that is Epic 3
- Do NOT implement metadata updates — that is Story 2.4
- Do NOT modify `main.go` or router — that is Story 2.4
- Do NOT add filtering (by status, by date range, etc.) — MVP is simple list all + get one

### Testing Notes

- **Temp directories:** Always resolve with `filepath.EvalSymlinks(t.TempDir())` on macOS
- **Setup helper for tests:**
  ```go
  func createTestStream(t *testing.T, store *StreamStore, projectName, streamName, updatedAt string) {
      t.Helper()
      meta := types.StreamMeta{
          Name:      streamName,
          Project:   projectName,
          Status:    types.StreamStatusActive,
          Type:      types.StreamTypeFull,
          CreatedAt: "2026-02-12T10:00:00Z",
          UpdatedAt: updatedAt,
      }
      store.CreateStreamDir(projectName, streamName)
      store.WriteStreamMeta(projectName, streamName, meta)
  }
  ```
- **Sorting verification:** Create 3 streams with timestamps `T1 < T2 < T3`, verify result order is `[T3, T2, T1]`
- **Corrupted stream.json test:**
  ```go
  // Create valid stream directory but write invalid JSON
  streamDir := filepath.Join(store.RootDir(), "projects", "my-app-bad")
  os.MkdirAll(streamDir, 0755)
  os.WriteFile(filepath.Join(streamDir, "stream.json"), []byte("invalid json"), 0644)

  // List should skip this one and continue
  streams, err := store.ListProjectStreams("my-app")
  require.NoError(t, err)
  // Verify corrupted stream is NOT in the list
  ```

### Project Structure Notes

Files to modify:
| File | Changes |
|------|---------|
| `backend/storage/stream_store.go` | Add `ListProjectStreams()` method |
| `backend/services/stream_service.go` | Add `List()` and `Get()` methods |

Files to create:
| File | Purpose |
|------|---------|
| Tests already exist from Story 2.1 — add new test cases |

Files NOT to modify:
- `backend/types/stream.go` — `StreamMeta` already complete
- `backend/api/handlers/` — handlers are Story 2.4
- `backend/api/router.go` — routing is Story 2.4
- `backend/main.go` — wiring is Story 2.4

### Previous Story Intelligence

**From Story 2.1 (Create Stream):**
- `StreamStore` established with `CreateStreamDir`, `WriteStreamMeta`, `ReadStreamMeta`, `StreamDirExists`
- `StreamService` established with `Create` method and project verification via `registryStore.FindByName`
- Stream naming convention: `{projectName}-{streamName}` as directory name and `streamID`
- `StreamMeta` type with `camelCase` JSON tags and `omitempty` for nullable fields
- Atomic JSON writes using `WriteJSON` helper
- macOS temp dir symlink resolution pattern in tests

**Key patterns to follow:**
- Project verification before any stream operation
- Error wrapping with context (`fmt.Errorf("operation failed: %w", err)`)
- Use existing helpers (`ReadJSON`, `WriteJSON`, `syncDir`)
- Test pattern: `resolveDir(t, t.TempDir())` for test setup

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-stream-lifecycle-management.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Central Store Layout]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Error Handling]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: _bmad-output/implementation-artifacts/2-1-create-stream.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_To be filled by dev agent_
