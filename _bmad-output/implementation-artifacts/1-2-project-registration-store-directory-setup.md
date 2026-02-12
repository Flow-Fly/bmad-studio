# Story 1.2: Project Registration & Store Directory Setup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to register my project folder with BMAD Studio,
So that the system creates a project store and tracks it in the registry.

## Acceptance Criteria

1. **Given** a valid project folder path containing a git repository **When** the user registers the project **Then** the system creates `~/.bmad-studio/projects/{project-name}/` with a `project.json` containing `name`, `repoPath`, `createdAt`, and `settings` **And** adds the project to `registry.json` with `name`, `repoPath`, and `storePath`

2. **Given** a project is already registered **When** the user attempts to register the same repo path **Then** the system returns an error indicating the project is already registered

3. **Given** a registered project **When** the user unregisters the project **Then** the project entry is removed from `registry.json` **And** the project store directory is NOT deleted (user must manually clean up)

4. **Given** the registry contains multiple projects **When** the system lists projects **Then** all registered projects are returned with their `name`, `repoPath`, and `storePath`

## Tasks / Subtasks

- [x] Task 1: Create `backend/services/project_service.go` -- project registration service (AC: #1, #2, #3, #4)
  - [x] 1.1: Define `ProjectService` struct holding `*storage.RegistryStore` and `*storage.ProjectStore`
  - [x] 1.2: Implement `NewProjectService(registryStore *storage.RegistryStore, projectStore *storage.ProjectStore) *ProjectService`
  - [x] 1.3: Implement `Register(repoPath string) (*types.RegistryEntry, error)` -- validates path, checks git repo, checks for duplicates, creates project store dir, writes `project.json`, updates `registry.json`
  - [x] 1.4: Implement `Unregister(projectName string) error` -- removes entry from `registry.json`, does NOT delete project store directory
  - [x] 1.5: Implement `List() ([]types.RegistryEntry, error)` -- returns all registered projects
  - [x] 1.6: Implement `Get(projectName string) (*types.ProjectMeta, error)` -- reads `project.json` for a specific project

- [x] Task 2: Extend `backend/storage/registry.go` -- add registry mutation helpers (AC: #1, #2, #3)
  - [x] 2.1: Implement `AddProject(entry types.RegistryEntry) error` -- loads registry, checks for duplicate `repoPath`, appends entry, saves atomically
  - [x] 2.2: Implement `RemoveProject(projectName string) error` -- loads registry, removes matching entry, saves atomically
  - [x] 2.3: Implement `FindByRepoPath(repoPath string) (*types.RegistryEntry, bool)` -- loads registry, searches by repoPath
  - [x] 2.4: Implement `FindByName(name string) (*types.RegistryEntry, bool)` -- loads registry, searches by name

- [x] Task 3: Create `backend/storage/project_store.go` -- per-project metadata storage (AC: #1)
  - [x] 3.1: Define `ProjectStore` struct holding `*CentralStore`
  - [x] 3.2: Implement `NewProjectStore(store *CentralStore) *ProjectStore`
  - [x] 3.3: Implement `CreateProjectDir(projectName string) (string, error)` -- creates `~/.bmad-studio/projects/{projectName}/`, returns the full path
  - [x] 3.4: Implement `WriteProjectMeta(projectName string, meta types.ProjectMeta) error` -- writes `project.json` via `WriteJSON`
  - [x] 3.5: Implement `ReadProjectMeta(projectName string) (*types.ProjectMeta, error)` -- reads `project.json` via `ReadJSON`

- [x] Task 4: Write tests (all ACs)
  - [x] 4.1: `backend/storage/registry_test.go` -- add tests for AddProject, RemoveProject, FindByRepoPath, FindByName, duplicate detection
  - [x] 4.2: `backend/storage/project_store_test.go` -- test CreateProjectDir, WriteProjectMeta, ReadProjectMeta, corruption fallback
  - [x] 4.3: `backend/services/project_service_test.go` -- test Register (happy path + duplicate + invalid path + non-git), Unregister, List, Get

- [x] Task 5: Wire `ProjectService` into `backend/main.go` (AC: #1)
  - [x] 5.1: Create `ProjectStore` and `ProjectService` after `CentralStore` and `RegistryStore`
  - [x] 5.2: Replace the unused `_ = storage.NewRegistryStore(centralStore)` line with actual assignment
  - [x] 5.3: Pass `ProjectService` to router services (prepared for Story 1.3 REST endpoints)

## Dev Notes

### Architecture Constraints

- **Atomic JSON writes everywhere** -- all JSON metadata files (`project.json`, `registry.json`) must use the existing `WriteJSON` helper from `backend/storage/json_writer.go`. Never use `os.WriteFile` directly.
- **Corruption tolerance** -- on read failure, log warning and return defaults. Never crash on bad JSON. Follow the same pattern established in `RegistryStore.Load()`.
- **`camelCase` JSON tags** -- all new Go structs MUST use `camelCase` JSON tags (e.g., `json:"repoPath"`, `json:"createdAt"`). The existing types in `backend/types/project.go` already follow this pattern.
- **Pretty-printed JSON** -- `WriteJSON` already handles `json.MarshalIndent(data, "", "  ")` with trailing newline.
- **fsync before rename** -- already handled by `WriteJSON`.
- **ISO 8601 dates** -- use `time.Now().UTC().Format(time.RFC3339)` for `createdAt` timestamps.
- **Error returns, never panic** -- all Go functions return `(result, error)`.

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/storage/json_writer.go`** -- `WriteJSON(path, data)` and `ReadJSON(path, target)`. Use these for ALL file I/O.
- **`backend/storage/store.go`** -- `CentralStore` struct with `RootDir()` method. The `projects/` subdirectory already exists after `Init()`.
- **`backend/storage/registry.go`** -- `RegistryStore` with `Load()` and `Save()` methods. Extend this file with mutation helpers.
- **`backend/types/project.go`** -- `Registry`, `RegistryEntry`, `ProjectMeta` types are ALREADY DEFINED. Do NOT redefine them.
- **`backend/types/registry.go`** -- `NewRegistry()` helper. Already exists.

### Git Repository Validation

The `Register` function must verify the repo path contains a git repository. Use a simple check:

```go
// Check for .git directory or file (supports worktrees where .git is a file)
gitPath := filepath.Join(repoPath, ".git")
if _, err := os.Stat(gitPath); os.IsNotExist(err) {
    return nil, fmt.Errorf("path is not a git repository: %s", repoPath)
}
```

Do NOT shell out to `git` for validation -- a simple `.git` existence check is sufficient for MVP.

### Project Name Derivation

The project name is derived from the repo path's base directory name:

```go
projectName := filepath.Base(repoPath)
```

This matches the pattern in `ProjectManager.LoadProject()` (line 113 of `backend/services/project_manager.go`).

### Store Path Convention

The store path uses the project name as a subdirectory under `projects/`:

```go
storePath := filepath.Join(centralStore.RootDir(), "projects", projectName)
```

The architecture specifies flat siblings under `projects/` (e.g., `projects/my-app/`, `projects/my-app-payment-integration/`). For this story, only the project directory matters. Streams are Epic 2.

### Concurrency Safety

The `RegistryStore` mutation methods (`AddProject`, `RemoveProject`) must be safe for concurrent use. Options:
1. **Simple approach (recommended for MVP):** Add a `sync.Mutex` to `RegistryStore`. Lock before load-modify-save sequences.
2. The `ConfigStore` already uses this pattern -- see `backend/storage/config_store.go` for the mutex pattern.

### What NOT to Build

- Do NOT implement REST API endpoints for projects -- that's Story 1.3.
- Do NOT implement WebSocket event broadcasting -- that's Story 1.4.
- Do NOT create stream-related types or storage -- that's Epic 2.
- Do NOT implement the file watcher -- that's Epic 3.
- Do NOT create the `.bmad-studio` marker file in project roots -- the architecture mentions this but it's not required by this story's acceptance criteria.
- Do NOT modify the existing `ProjectManager` service -- it handles runtime BMAD config loading, which is separate from project registration.

### Implementation Patterns

**Register Flow:**
```go
func (s *ProjectService) Register(repoPath string) (*types.RegistryEntry, error) {
    // 1. Resolve absolute path
    absPath, err := filepath.Abs(repoPath)
    // 2. Validate path exists and is a directory
    // 3. Validate .git exists (git repo check)
    // 4. Derive project name from path basename
    // 5. Check registry for duplicate repoPath
    // 6. Create project store directory: ~/.bmad-studio/projects/{name}/
    // 7. Write project.json with ProjectMeta{Name, RepoPath, CreatedAt, Settings}
    // 8. Add entry to registry.json via RegistryStore.AddProject()
    // 9. Return the new RegistryEntry
}
```

**Unregister Flow:**
```go
func (s *ProjectService) Unregister(projectName string) error {
    // 1. Check project exists in registry
    // 2. Remove from registry.json via RegistryStore.RemoveProject()
    // 3. Do NOT delete project store directory (per AC #3)
}
```

### Testing Notes

- **macOS temp dir symlinks:** Always resolve test directories with `filepath.EvalSymlinks(t.TempDir())` before creating test fixtures. macOS `/var/folders/...` resolves to `/private/var/folders/...`.
- **Table-driven tests:** Use Go idiomatic `tests := []struct{...}` pattern.
- **Mock git repos in tests:** Create a `.git` directory inside the temp dir to simulate a git repository.
- **Test duplicate detection:** Register same path twice, verify error on second attempt.
- **Test unregister preserves directory:** After unregister, verify the project store directory still exists.
- **Test concurrent registration:** If using mutex, verify concurrent Register calls don't corrupt the registry.
- **Test file locations:** Tests for storage layer go in `backend/storage/` (colocated, matching existing pattern from Story 1-1). Tests for service go in `backend/services/`.

### Central Store Directory Layout (After This Story)

```
~/.bmad-studio/
  registry.json          # { "projects": [{ "name": "my-app", "repoPath": "/path/to/my-app", "storePath": "~/.bmad-studio/projects/my-app" }] }
  config.json            # Global settings (unchanged)
  projects/              # Created by Story 1.1
    my-app/              # NEW: Created by Register()
      project.json       # { "name": "my-app", "repoPath": "/path/to/my-app", "createdAt": "2026-02-12T10:30:00Z", "settings": {} }
```

### File Locations

| File | Purpose |
|------|---------|
| `backend/services/project_service.go` | NEW: ProjectService -- Register, Unregister, List, Get |
| `backend/services/project_service_test.go` | NEW: Tests for ProjectService |
| `backend/storage/project_store.go` | NEW: ProjectStore -- CreateProjectDir, WriteProjectMeta, ReadProjectMeta |
| `backend/storage/project_store_test.go` | NEW: Tests for ProjectStore |
| `backend/storage/registry.go` | EXTEND: Add AddProject, RemoveProject, FindByRepoPath, FindByName + mutex |
| `backend/storage/registry_test.go` | EXTEND: Add tests for new mutation methods |
| `backend/types/project.go` | EXISTING: Registry, RegistryEntry, ProjectMeta (no changes needed) |
| `backend/main.go` | MODIFY: Wire ProjectService, replace unused RegistryStore assignment |

### Project Structure Notes

- All new Go files follow `snake_case.go` naming convention.
- Storage layer files live in `backend/storage/`.
- Service files live in `backend/services/`.
- Type definitions live in `backend/types/`.
- Test files are colocated with source files (matching existing pattern from Story 1-1).

### Previous Story (1-1) Intelligence

**Key patterns established:**
- `CentralStore` creates `~/.bmad-studio/` and `~/.bmad-studio/projects/` on `Init()`.
- `RegistryStore` uses `Load()`/`Save()` pattern with corruption tolerance.
- All JSON uses `WriteJSON`/`ReadJSON` from `json_writer.go`.
- `NewRegistry()` helper returns `Registry{Projects: []RegistryEntry{}}` -- ensures non-nil slice.
- The `_ = storage.NewRegistryStore(centralStore)` line in `main.go` (line 99) was explicitly left as a placeholder for this story.
- Tests use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility.
- Tests use `NewCentralStoreWithPath(path)` constructor for test isolation.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-central-store-project-registry-backend-foundation.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Central Store Layout]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Project Registry]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Conventions]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Central Store File Operations]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/project-context.md#Go (Backend)]
- [Source: _bmad-output/project-context.md#Atomic JSON Writes]
- [Source: _bmad-output/project-context.md#Central Store Layout]
- [Source: _bmad-output/implementation-artifacts/1-1-central-store-initialization-atomic-write-layer.md]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - All tests passed on first run after implementation

### Completion Notes List

- ✅ Implemented ProjectService with Register, Unregister, List, and Get methods
- ✅ Extended RegistryStore with AddProject, RemoveProject, FindByRepoPath, FindByName + mutex for thread safety
- ✅ Created ProjectStore for managing per-project directories and metadata
- ✅ All tests passing: 11 registry tests, 7 project store tests, 9 project service tests
- ✅ Wired ProjectService into main.go and router (prepared for Story 1.3 REST endpoints)
- ✅ Followed TDD red-green-refactor cycle throughout implementation
- ✅ All JSON uses atomic write pattern via WriteJSON
- ✅ Git repository validation using simple .git directory check
- ✅ Mutex pattern matches existing ConfigStore implementation
- ✅ macOS temp dir symlink resolution in tests

### File List

- `backend/services/project_service.go` (NEW)
- `backend/services/project_service_test.go` (NEW)
- `backend/storage/project_store.go` (NEW)
- `backend/storage/project_store_test.go` (NEW)
- `backend/storage/registry.go` (MODIFIED - added mutex, AddProject, RemoveProject, FindByRepoPath, FindByName)
- `backend/storage/registry_test.go` (MODIFIED - added tests for new methods)
- `backend/main.go` (MODIFIED - wired ProjectService)
- `backend/api/router.go` (MODIFIED - added Project field to RouterServices)
