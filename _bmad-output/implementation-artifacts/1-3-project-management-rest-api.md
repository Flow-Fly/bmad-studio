# Story 1.3: Project Management REST API

Status: review

## Story

As a developer,
I want to manage projects through a REST API,
So that the frontend can register, list, view, and unregister projects.

## Acceptance Criteria

1. **Given** the Go sidecar starts on port 3008 **When** the HTTP server initializes **Then** it serves REST endpoints with CORS middleware (allowing `localhost:3007`) and JSON error format `{ "error": { "code": "...", "message": "..." } }`

2. **Given** a `POST /projects` request with `{ "repoPath": "/path/to/project" }` **When** the path is valid and not already registered **Then** the system registers the project and returns the project details with 201 status **And** all JSON responses use `camelCase` field names

3. **Given** a `GET /projects` request **When** there are registered projects **Then** the system returns the full list from `registry.json`

4. **Given** a `GET /projects/:id` request **When** the project exists **Then** the system returns project details from `project.json`

5. **Given** a `DELETE /projects/:id` request **When** the project is registered **Then** the system unregisters the project and returns 200 status

6. **Given** a `GET /settings` or `PUT /settings` request **When** the request is valid **Then** the system reads or updates `config.json` with global settings

## Tasks / Subtasks

- [x] Task 1: Rewrite `backend/api/handlers/projects.go` -- implement project REST handlers (AC: #2, #3, #4, #5)
  - [x] 1.1: Create `NewProjectsHandler(svc *services.ProjectService) *ProjectsHandler` struct
  - [x] 1.2: Implement `RegisterProject` handler -- `POST /projects` accepting `{ "repoPath": "..." }`, calls `ProjectService.Register()`, returns 201 + `RegistryEntry` JSON
  - [x] 1.3: Implement `ListProjects` handler -- `GET /projects`, calls `ProjectService.List()`, returns 200 + array of `RegistryEntry`
  - [x] 1.4: Implement `GetProject` handler -- `GET /projects/{id}`, reads `:id` via `chi.URLParam`, calls `ProjectService.Get(id)`, returns 200 + `ProjectMeta` JSON
  - [x] 1.5: Implement `UnregisterProject` handler -- `DELETE /projects/{id}`, calls `ProjectService.Unregister(id)`, returns 200 + `{ "message": "..." }`
  - [x] 1.6: Error mapping for each handler: 400 for invalid input, 404 for not found, 409 for already registered, 500 for internal errors

- [x] Task 2: Update `backend/api/router.go` -- wire new project handlers to routes (AC: #1, #2, #3, #4, #5)
  - [x] 2.1: Replace placeholder `ListProjects`, `CreateProject`, `GetProject` handlers with `ProjectsHandler` methods
  - [x] 2.2: Add `DELETE /{id}` route for unregister
  - [x] 2.3: Remove the `UpdateProject` placeholder (not in scope for this story)
  - [x] 2.4: Keep the existing `POST /projects/open` route (ProjectManager.OpenProject) alongside new routes

- [x] Task 3: Verify settings endpoints already work (AC: #6)
  - [x] 3.1: Confirm `GET /settings` and `PUT /settings` are already wired in router.go via `SettingsHandler`
  - [x] 3.2: No new code needed -- these endpoints already exist and work correctly

- [x] Task 4: Write handler tests (all ACs)
  - [x] 4.1: `backend/api/handlers/projects_test.go` -- test RegisterProject (happy path, duplicate repoPath, missing body, non-existent path)
  - [x] 4.2: Test ListProjects (empty list, populated list)
  - [x] 4.3: Test GetProject (exists, not found)
  - [x] 4.4: Test UnregisterProject (exists, not found)
  - [x] 4.5: Test error format matches `{ "error": { "code": "...", "message": "..." } }`

- [x] Task 5: Integration smoke test -- router test (AC: #1)
  - [x] 5.1: Add or extend `backend/api/router_test.go` to verify `/projects` routes resolve correctly
  - [x] 5.2: Verify CORS middleware is active (already configured in `middleware/cors.go`)

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON response fields MUST use `camelCase`. The `RegistryEntry` and `ProjectMeta` types in `backend/types/project.go` already use correct `camelCase` tags (`json:"repoPath"`, `json:"storePath"`, `json:"createdAt"`). Use these types directly as response bodies.
- **Error format:** Use the existing `response.WriteError(w, code, message, httpStatus)` helper from `backend/api/response/errors.go`. Standard error response: `{ "error": { "code": "not_found", "message": "Project not found" } }`.
- **Success responses:** Return payload directly with `response.WriteJSON(w, statusCode, data)` -- no wrapper object.
- **Null fields:** Use `omitempty` on optional Go struct tags (already done in `ProjectMeta.Settings`).
- **Body size limit:** Use `http.MaxBytesReader(w, r.Body, 4096)` on POST handlers (follow `OpenProject` handler pattern).
- **Route params:** Extract with `chi.URLParam(r, "id")` -- the `:id` param is the project name (string, not UUID).

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/services/project_service.go`** -- `ProjectService` with `Register(repoPath)`, `Unregister(projectName)`, `List()`, `Get(projectName)`. ALL business logic is already implemented. Handlers only need to parse HTTP requests, call service methods, and format responses.
- **`backend/api/response/errors.go`** -- `WriteError`, `WriteNotFound`, `WriteInvalidRequest`, `WriteInternalError`, `WriteNotImplemented` helpers.
- **`backend/api/response/json.go`** -- `WriteJSON(w, status, data)` helper.
- **`backend/api/handlers/projects.go`** -- has placeholder handlers (`ListProjects`, `CreateProject`, `GetProject`, `UpdateProject`) returning 501. Also has `ProjectHandler` + `OpenProject` for the legacy project-open endpoint. Replace placeholders; keep `OpenProject`.
- **`backend/api/router.go`** -- `RouterServices` already has `Project *services.ProjectService` field, already passed from `main.go`.
- **`backend/api/handlers/settings.go`** -- Settings endpoints (`GET /settings`, `PUT /settings`) are already implemented and wired. No changes needed for AC #6.
- **`backend/api/middleware/cors.go`** -- CORS already allows `localhost:3007`. No changes needed for AC #1.

### Error Mapping Strategy

Map `ProjectService` error strings to HTTP status codes in handlers:

| Service Error Contains | HTTP Status | Error Code |
|------------------------|-------------|------------|
| `"already registered"` | 409 Conflict | `already_exists` |
| `"not a git repository"` | 400 Bad Request | `invalid_request` |
| `"not a directory"` | 400 Bad Request | `invalid_request` |
| `"validate path"` / `os.IsNotExist` | 400 Bad Request | `invalid_request` |
| `"not found"` | 404 Not Found | `not_found` |
| Any other error | 500 Internal Server Error | `internal_error` |

Add an `ErrCodeAlreadyExists` constant to `backend/api/response/errors.go`:
```go
const ErrCodeAlreadyExists = "already_exists"
```

### What NOT to Build

- Do NOT implement `PUT /projects/:id` (project update) -- not in acceptance criteria for this story.
- Do NOT implement WebSocket event broadcasting on project changes -- that's Story 1.4.
- Do NOT implement stream-related endpoints -- that's Epic 2.
- Do NOT change the existing `POST /projects/open` endpoint (ProjectManager) -- it handles BMAD config loading, which is separate from project registration.
- Do NOT modify `ProjectService` or storage layer -- all business logic is already complete from Story 1.2.

### Implementation Patterns

**Handler Pattern (follow SettingsHandler as reference):**
```go
type ProjectsHandler struct {
    service *services.ProjectService
}

func NewProjectsHandler(svc *services.ProjectService) *ProjectsHandler {
    return &ProjectsHandler{service: svc}
}

func (h *ProjectsHandler) RegisterProject(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 4096)
    var req struct {
        RepoPath string `json:"repoPath"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        response.WriteInvalidRequest(w, "Invalid request body")
        return
    }
    if req.RepoPath == "" {
        response.WriteInvalidRequest(w, "repoPath is required")
        return
    }

    entry, err := h.service.Register(req.RepoPath)
    if err != nil {
        // Map error to HTTP status (see error mapping table)
        ...
        return
    }

    response.WriteJSON(w, http.StatusCreated, entry)
}
```

**Router Wiring Pattern:**
```go
// In router.go, inside /projects route group:
if svc.Project != nil {
    projectsHandler := handlers.NewProjectsHandler(svc.Project)
    r.Get("/", projectsHandler.ListProjects)
    r.Post("/", projectsHandler.RegisterProject)

    r.Route("/{id}", func(r chi.Router) {
        r.Get("/", projectsHandler.GetProject)
        r.Delete("/", projectsHandler.UnregisterProject)
    })
}
```

### Testing Notes

- **Handler tests:** Use `httptest.NewRecorder()` + `httptest.NewRequest()` pattern.
- **Chi URL params:** Use `chi.NewRouteContext()` to inject URL params in tests:
  ```go
  rctx := chi.NewRouteContext()
  rctx.URLParams.Add("id", "my-project")
  r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
  ```
- **Mock ProjectService:** Create a minimal mock or use the real `ProjectService` with a temp-directory `CentralStore` for integration-style tests.
- **macOS temp dir symlinks:** If using real storage, resolve test directories with `filepath.EvalSymlinks(t.TempDir())`.
- **Table-driven tests:** Use Go idiomatic `tests := []struct{...}` pattern.
- **Verify JSON field casing:** Assert response bodies contain `"repoPath"` not `"repo_path"`, `"storePath"` not `"store_path"`, `"createdAt"` not `"created_at"`.

### File Locations

| File | Purpose |
|------|---------|
| `backend/api/handlers/projects.go` | REWRITE: Replace placeholder handlers with ProjectsHandler using ProjectService |
| `backend/api/handlers/projects_test.go` | NEW: Handler tests for all project endpoints |
| `backend/api/router.go` | MODIFY: Wire ProjectsHandler routes, remove placeholder functions |
| `backend/api/response/errors.go` | MODIFY: Add `ErrCodeAlreadyExists` constant |
| `backend/api/router_test.go` | EXTEND: Add route resolution checks for project endpoints |

### Project Structure Notes

- All handler files follow Go `snake_case.go` naming in `backend/api/handlers/`.
- Response helpers are in `backend/api/response/` package.
- The `ProjectsHandler` struct name uses plural "Projects" to match the REST resource name.
- Test files are colocated with source files (matching existing pattern).

### Previous Story Intelligence

**From Story 1.1 (Central Store):**
- `CentralStore`, `RegistryStore`, `WriteJSON`/`ReadJSON`, atomic write pattern all established
- JSON uses `camelCase` tags on new types; legacy `api.go` types still use `snake_case` (separate refactor)
- Tests use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility

**From Story 1.2 (Project Registration):**
- `ProjectService` fully implements `Register`, `Unregister`, `List`, `Get`
- `RegistryStore` has `AddProject`, `RemoveProject`, `FindByRepoPath`, `FindByName` with mutex
- `ProjectStore` has `CreateProjectDir`, `WriteProjectMeta`, `ReadProjectMeta`
- Router already has `Project *services.ProjectService` in `RouterServices`
- `main.go` already creates and passes `ProjectService` to router
- Error strings from `ProjectService`: `"already registered"`, `"not a git repository"`, `"not a directory"`, `"not found"`

**From Git History:**
- Story 1.2 commit: `feat: add project registration with store directory management`
- `backend/api/router.go` was modified to add `Project` field to `RouterServices`
- All recent stories follow TDD red-green-refactor

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-central-store-project-registry-backend-foundation.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#REST Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#API & Communication]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#API Conventions]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/project-context.md#REST API Conventions]
- [Source: _bmad-output/project-context.md#Go (Backend)]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: _bmad-output/implementation-artifacts/1-1-central-store-initialization-atomic-write-layer.md]
- [Source: _bmad-output/implementation-artifacts/1-2-project-registration-store-directory-setup.md]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

None

### Completion Notes List

- Implemented ProjectsHandler with adapter pattern to support both concrete ProjectService and test mocks
- All handlers use camelCase JSON tags as per project conventions
- Error mapping follows Dev Notes specification exactly (409 for already_exists, 400 for validation, 404 for not_found, 500 for internal)
- Added ErrCodeAlreadyExists constant to response/errors.go
- Router wiring consolidates both ProjectsHandler routes (GET/POST/DELETE) and legacy OpenProject route
- Comprehensive test coverage: 39 test cases across handler unit tests, error format validation, and router integration tests
- All tests pass successfully

### File List

- backend/api/handlers/projects.go (MODIFIED - rewritten with ProjectsHandler implementation)
- backend/api/handlers/projects_test.go (NEW - comprehensive handler tests)
- backend/api/response/errors.go (MODIFIED - added ErrCodeAlreadyExists)
- backend/api/router.go (MODIFIED - wired ProjectsHandler routes)
- backend/api/router_test.go (MODIFIED - added route resolution tests)
