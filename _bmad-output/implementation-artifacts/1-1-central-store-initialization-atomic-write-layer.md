# Story 1.1: Central Store Initialization & Atomic Write Layer

Status: done

## Story

As a developer,
I want the system to create and manage a reliable central store at `~/.bmad-studio/`,
So that all my project data persists safely across sessions without corruption.

## Acceptance Criteria

1. **Given** the application starts for the first time **When** the central store directory does not exist **Then** the system creates `~/.bmad-studio/` with `registry.json` (empty projects array) and `config.json` (default settings)

2. **Given** any JSON metadata file needs to be written **When** the atomic write helper is called **Then** content is written to a `.tmp` file, fsynced, then renamed to the target path (atomic on POSIX) **And** a crash at any point leaves either the old or new file -- never corrupt

3. **Given** the central store already exists **When** the application starts **Then** the system validates the directory structure without overwriting existing files

4. **Given** a corrupted JSON file exists in the central store **When** the system reads the file on startup **Then** the system logs a warning and continues with defaults rather than crashing (NFR13)

## Tasks / Subtasks

- [x] Task 1: Create `backend/storage/json_writer.go` -- atomic JSON write helper (AC: #2)
  - [x] 1.1: Implement `WriteJSON(path string, data any) error` -- write-to-tmp, fsync, rename
  - [x] 1.2: Implement `ReadJSON(path string, target any) error` -- read with corruption tolerance (AC: #4)
  - [x] 1.3: Pretty-print JSON output (`json.MarshalIndent` with 2-space indent)

- [x] Task 2: Create `backend/storage/store.go` -- central store initialization (AC: #1, #3)
  - [x] 2.1: Implement `CentralStore` struct holding `rootDir` path (`~/.bmad-studio/`)
  - [x] 2.2: Implement `NewCentralStore() (*CentralStore, error)` -- resolves `~/.bmad-studio/`
  - [x] 2.3: Implement `NewCentralStoreWithPath(path string) *CentralStore` -- for testing
  - [x] 2.4: Implement `Init() error` -- creates directory structure, writes default files if missing
  - [x] 2.5: Implement `Validate() error` -- checks existing structure without overwriting

- [x] Task 3: Refactor `backend/storage/config_store.go` to use `json_writer.go` and `CentralStore` (AC: #2, #4)
  - [x] 3.1: Replace `os.WriteFile` in `saveLocked` with `WriteJSON` (atomic write)
  - [x] 3.2: Replace `os.ReadFile` + `json.Unmarshal` in `loadLocked` with `ReadJSON` (corruption tolerance)
  - [x] 3.3: Accept `CentralStore` reference so config path is derived from store root

- [x] Task 4: Create `backend/storage/registry.go` -- project registry (AC: #1)
  - [x] 4.1: Define `Registry` struct with `Projects` array
  - [x] 4.2: Implement `NewRegistryStore(store *CentralStore) *RegistryStore`
  - [x] 4.3: Implement `Load() (Registry, error)` -- reads `registry.json` with corruption fallback
  - [x] 4.4: Implement `Save(r Registry) error` -- writes via `WriteJSON`

- [x] Task 5: Create/update `backend/types/project.go` -- new type definitions (AC: #1)
  - [x] 5.1: Define `Registry` struct: `Projects []RegistryEntry`
  - [x] 5.2: Define `RegistryEntry` struct: `Name`, `RepoPath`, `StorePath` (all `camelCase` JSON tags)
  - [x] 5.3: Define `ProjectMeta` struct: `Name`, `RepoPath`, `CreatedAt`, `Settings map[string]any`

- [x] Task 6: Write tests (all ACs)
  - [x] 6.1: `backend/storage/json_writer_test.go` -- atomic write, fsync, rename, corruption recovery
  - [x] 6.2: `backend/storage/store_test.go` -- init creates dirs/files, re-init preserves, validate
  - [x] 6.3: `backend/storage/registry_test.go` -- load/save registry, corruption fallback
  - [x] 6.4: Update `backend/storage/config_store_test.go` -- verify atomic writes

- [x] Task 7: Wire `CentralStore.Init()` into `backend/main.go` startup (AC: #1, #3)
  - [x] 7.1: Create `CentralStore` before other stores
  - [x] 7.2: Call `Init()` on startup
  - [x] 7.3: Pass store to `ConfigStore` and `RegistryStore` constructors

## Dev Notes

### Architecture Constraints

- **Atomic JSON writes everywhere** -- all JSON metadata files must use write-to-tmp-then-rename pattern. Never `os.WriteFile` directly to target path.
- **Corruption tolerance** -- on read failure, log warning and return defaults. Never crash on bad JSON.
- **`camelCase` JSON tags** -- project-context mandates `camelCase` for ALL JSON. The existing `config_store.go` uses `snake_case` tags in `types/api.go` (`created_at`, `updated_at`, `project_id`, etc.) -- this is a known legacy inconsistency. New types MUST use `camelCase`. Do NOT change existing types in this story (that's a separate refactor).
- **Pretty-printed JSON** -- use `json.MarshalIndent(data, "", "  ")` for human-readable, git-friendly output.
- **fsync before rename** -- after writing `.tmp` file, call `f.Sync()` before `os.Rename()`. This ensures data reaches disk before the atomic rename.

### Existing Code to Reuse/Extend

- **`backend/storage/config_store.go`** -- already handles `~/.bmad-studio/config.json` with mutex locking, Load/Save/Update pattern. Refactor to use the new `WriteJSON` helper instead of direct `os.WriteFile`.
- **`backend/types/api.go`** -- has existing `Settings`, `ProviderSettings`, `ProjectEntry` types. The `config_store.go` test file at `backend/storage/config_store_test.go` validates Load/Save/Update.
- **`backend/types/common.go`** -- has `Timestamp` type for dates.

### What NOT to Build

- Do NOT implement project registration/unregistration logic -- that's Story 1.2.
- Do NOT implement REST API endpoints -- that's Story 1.3.
- Do NOT implement WebSocket broadcasting -- that's Story 1.4.
- Do NOT create stream-related types or storage -- that's Epic 2.
- Do NOT set up the file watcher -- that's Epic 3.

### Implementation Patterns

**Atomic Write Pattern:**
```go
func WriteJSON(path string, data any) error {
    content, err := json.MarshalIndent(data, "", "  ")
    if err != nil {
        return fmt.Errorf("marshal JSON: %w", err)
    }
    content = append(content, '\n') // trailing newline

    tmp := path + ".tmp"
    f, err := os.Create(tmp)
    if err != nil {
        return fmt.Errorf("create temp file: %w", err)
    }
    defer func() {
        // Clean up tmp on failure
        if f != nil {
            f.Close()
            os.Remove(tmp)
        }
    }()

    if _, err := f.Write(content); err != nil {
        return fmt.Errorf("write temp file: %w", err)
    }
    if err := f.Sync(); err != nil {
        return fmt.Errorf("fsync temp file: %w", err)
    }
    if err := f.Close(); err != nil {
        return fmt.Errorf("close temp file: %w", err)
    }
    f = nil // prevent deferred cleanup

    if err := os.Rename(tmp, path); err != nil {
        return fmt.Errorf("rename temp to target: %w", err)
    }
    return nil
}
```

**Corruption-Tolerant Read Pattern:**
```go
func ReadJSON(path string, target any) error {
    data, err := os.ReadFile(path)
    if err != nil {
        return err // caller handles os.IsNotExist
    }
    if err := json.Unmarshal(data, target); err != nil {
        return fmt.Errorf("corrupt JSON in %s: %w", filepath.Base(path), err)
    }
    return nil
}
```

**CentralStore Init Pattern:**
```go
func (s *CentralStore) Init() error {
    // 1. Create ~/.bmad-studio/ and ~/.bmad-studio/projects/
    // 2. If registry.json doesn't exist: WriteJSON with empty Registry{Projects: []RegistryEntry{}}
    // 3. If config.json doesn't exist: WriteJSON with default Settings
    // 4. If files exist: validate they parse (log warning if corrupt, don't overwrite)
}
```

### Central Store Directory Layout

```
~/.bmad-studio/
  registry.json          # { "projects": [] }
  config.json            # Global settings (default provider, etc.)
  projects/              # Created empty; Story 1.2 populates
```

### Testing Notes

- **macOS temp dir symlinks:** Always resolve test directories with `filepath.EvalSymlinks(t.TempDir())` before creating test fixtures. macOS `/var/folders/...` resolves to `/private/var/folders/...`.
- **Table-driven tests:** Use Go idiomatic `tests := []struct{...}` pattern.
- **Test json_writer atomicity:** Write a file, verify content, overwrite, verify new content. Test that `.tmp` file is cleaned up on success.
- **Test corruption recovery:** Write invalid JSON to a file, verify ReadJSON returns error and callers fall back to defaults.
- **Test Init idempotency:** Call `Init()` twice -- second call must not overwrite existing files.

### File Locations

| File | Purpose |
|------|---------|
| `backend/storage/json_writer.go` | Atomic WriteJSON + ReadJSON helpers |
| `backend/storage/json_writer_test.go` | Tests for atomic write/read |
| `backend/storage/store.go` | CentralStore struct, Init, Validate |
| `backend/storage/store_test.go` | Tests for store initialization |
| `backend/storage/registry.go` | RegistryStore -- load/save registry.json |
| `backend/storage/registry_test.go` | Tests for registry store |
| `backend/storage/config_store.go` | Refactored to use WriteJSON |
| `backend/storage/config_store_test.go` | Updated tests |
| `backend/types/project.go` | Registry, RegistryEntry, ProjectMeta types |
| `backend/main.go` | Wire CentralStore.Init() at startup |

### Project Structure Notes

- All new Go files follow `snake_case.go` naming convention.
- Storage layer files live in `backend/storage/`.
- Type definitions live in `backend/types/`.
- Test files are colocated with source files in `backend/storage/` (Go convention).
- Architecture specifies `tests/backend/storage/` for test files but existing tests in `backend/storage/config_store_test.go` are colocated -- follow the existing pattern.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-central-store-project-registry-backend-foundation.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Central Store Layout]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Atomic JSON Writes]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Central Store File Operations]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/project-context.md#Atomic JSON Writes]
- [Source: _bmad-output/project-context.md#Central Store Layout]
- [Source: _bmad-output/project-context.md#Go (Backend)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A

### Completion Notes List

**Implementation Complete (2026-02-12)**

All acceptance criteria satisfied:
- AC #1: Central store directory structure (`~/.bmad-studio/`) created with `registry.json` (empty projects array) and `config.json` (default settings)
- AC #2: Atomic JSON writes implemented via write-to-tmp, fsync, rename pattern
- AC #3: Re-initialization preserves existing files (idempotent Init)
- AC #4: Corruption tolerance implemented - logs warnings and falls back to defaults

**Technical Approach:**
- Followed TDD red-green-refactor cycle for all tasks
- Created atomic write helper (`WriteJSON`) with fsync before rename
- Created corruption-tolerant read helper (`ReadJSON`)
- Refactored existing `ConfigStore` to use atomic writes
- All tests pass (38 tests across 4 test files)
- Backend compiles successfully

**Key Decisions:**
- Used `camelCase` JSON tags for new types (Registry, RegistryEntry, ProjectMeta) per project-context requirements
- Existing `config_store.go` types retained `snake_case` tags (legacy, separate refactor)
- macOS temp dir symlink handling in tests (`filepath.EvalSymlinks`)
- Pretty-printed JSON with 2-space indent for human-readable output
- Corruption handling: log warning + return defaults (never crash)

### File List

**New Files:**
- `backend/storage/json_writer.go` - Atomic WriteJSON/ReadJSON helpers
- `backend/storage/json_writer_test.go` - Tests for atomic write/read
- `backend/storage/store.go` - CentralStore initialization and validation
- `backend/storage/store_test.go` - Tests for store initialization
- `backend/storage/registry.go` - RegistryStore load/save
- `backend/storage/registry_test.go` - Tests for registry store
- `backend/types/project.go` - Registry, RegistryEntry, ProjectMeta types

**Modified Files:**
- `backend/storage/config_store.go` - Refactored to use WriteJSON/ReadJSON and CentralStore
- `backend/storage/config_store_test.go` - Added atomic write test
- `backend/main.go` - Wired CentralStore.Init() at startup
