# Story 1.2: Go Backend Foundation

Status: review

## Story

As a **developer**,
I want **a Go HTTP server with basic infrastructure**,
So that **the frontend can communicate with backend services**.

## Acceptance Criteria

1. **Given** the Go backend is running, **When** a GET request is made to `/health`, **Then** the server returns 200 OK with `{"status": "ok"}`

2. **Given** the Go backend is running, **When** a request is made from localhost:3007, **Then** CORS is configured to allow the request

3. **Given** the Go backend is running, **When** inspecting the router structure, **Then** it is structured for adding resource endpoints following RESTful patterns

4. **Given** an API error occurs, **When** the error response is returned, **Then** it follows the format `{"error": {"code": "...", "message": "..."}}`

5. **Given** the API design, **When** endpoints are created, **Then** REST endpoints follow patterns: `/projects`, `/projects/:id`, `/sessions`, `/settings`, `/providers`

6. **Given** JSON responses, **When** serialized, **Then** JSON fields use snake_case and dates use ISO 8601 format

## Tasks / Subtasks

- [x] Task 1: Enhance Router Infrastructure (AC: #1, #3, #5)
  - [x] 1.1: Update `backend/api/router.go` with proper route grouping structure for future endpoints
  - [x] 1.2: Add route placeholders with comments for `/projects`, `/sessions`, `/settings`, `/providers`
  - [x] 1.3: Ensure `/health` endpoint maintains `{"status": "ok"}` response
  - [x] 1.4: Add API version prefix structure `/api/v1/` for resource endpoints

- [x] Task 2: Implement Error Response Handler (AC: #4)
  - [x] 2.1: Create `backend/api/response/errors.go` with standardized error response structure (moved to response package to avoid import cycle)
  - [x] 2.2: Define error response type: `type ErrorResponse struct { Error ErrorDetail }`
  - [x] 2.3: Define error detail type: `type ErrorDetail struct { Code string, Message string }`
  - [x] 2.4: Create helper functions: `WriteError(w, code, message, httpStatus)`
  - [x] 2.5: Create common error codes: `invalid_request`, `not_found`, `internal_error`, `validation_error`

- [x] Task 3: Enhance CORS Configuration (AC: #2)
  - [x] 3.1: Verify CORS middleware in `backend/api/middleware/cors.go` allows localhost:3007
  - [x] 3.2: Ensure CORS allows required methods: GET, POST, PUT, DELETE, OPTIONS
  - [x] 3.3: Ensure CORS allows required headers: Content-Type, Authorization
  - [x] 3.4: Add CORS support for credentials if needed for future auth

- [x] Task 4: Create Base Types and JSON Conventions (AC: #6)
  - [x] 4.1: Create `backend/types/common.go` with shared types
  - [x] 4.2: Implement `Timestamp` type with ISO 8601 JSON marshaling
  - [x] 4.3: Add JSON struct tags with snake_case convention
  - [x] 4.4: Create `backend/types/api.go` for API request/response base types

- [x] Task 5: Create Handler Scaffolding (AC: #3, #5)
  - [x] 5.1: Create `backend/api/handlers/health.go` (extract from router)
  - [x] 5.2: Create `backend/api/handlers/projects.go` with placeholder handlers
  - [x] 5.3: Create `backend/api/handlers/sessions.go` with placeholder handlers
  - [x] 5.4: Create `backend/api/handlers/settings.go` with placeholder handlers
  - [x] 5.5: Create `backend/api/handlers/providers.go` with placeholder handlers

- [x] Task 6: Testing Infrastructure (AC: #1, #4)
  - [x] 6.1: Update `backend/api/router_test.go` with comprehensive health endpoint tests
  - [x] 6.2: Add tests for error response format validation
  - [x] 6.3: Add tests for CORS headers presence
  - [x] 6.4: Create test helper utilities in `backend/tests/testutil/` (adjusted path from story spec)

## Dev Notes

### Critical Architecture Patterns

**This story establishes the backend infrastructure patterns that ALL future stories must follow.**

#### API Conventions (MUST FOLLOW)

From Architecture doc and project-context.md:

| Convention | Pattern | Example |
|------------|---------|---------|
| **Endpoints** | Plural nouns, lowercase | `/projects`, `/sessions` |
| **Route params** | `:id` format | `/projects/:id` |
| **JSON fields** | `snake_case` | `json:"project_id"` |
| **Dates** | ISO 8601 | `"2026-01-27T10:30:00Z"` |
| **Error responses** | Structured object | `{"error": {"code": "...", "message": "..."}}` |
| **Success responses** | Direct payload | No wrapper object |

#### Error Response Contract

```go
// ErrorResponse is the standard API error format
type ErrorResponse struct {
    Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

// Example usage:
// {"error": {"code": "not_found", "message": "Project not found"}}
```

#### Standard Error Codes

| Code | HTTP Status | Use Case |
|------|-------------|----------|
| `invalid_request` | 400 | Malformed request body or params |
| `validation_error` | 422 | Valid JSON but fails business rules |
| `not_found` | 404 | Resource doesn't exist |
| `internal_error` | 500 | Unexpected server error |
| `unauthorized` | 401 | Missing or invalid auth (future) |

#### REST Endpoint Structure (Scaffolding)

```
/health                    GET     Health check (existing)
/api/v1/projects          GET     List projects
/api/v1/projects          POST    Create project
/api/v1/projects/:id      GET     Get project
/api/v1/projects/:id      PUT     Update project
/api/v1/projects/:id/sessions  GET   List project sessions
/api/v1/sessions          GET     List all sessions
/api/v1/sessions/:id      GET     Get session with messages
/api/v1/settings          GET     Get global settings
/api/v1/settings          PUT     Update settings
/api/v1/providers         GET     List configured providers
/api/v1/providers         POST    Add/configure provider
```

### Go Naming Conventions (MUST FOLLOW)

| Area | Convention | Example |
|------|------------|---------|
| **Files** | `snake_case.go` | `project_service.go` |
| **Exports** | `PascalCase` | `type Project struct`, `func GetProject()` |
| **JSON tags** | `snake_case` | `json:"project_id"` |
| **Error handling** | Return `(result, error)` | Never panic |

### Chi Router Patterns

Chi is the standard router for this project (installed in Story 1.1).

```go
// Route grouping pattern
r.Route("/api/v1", func(r chi.Router) {
    r.Route("/projects", func(r chi.Router) {
        r.Get("/", handlers.ListProjects)
        r.Post("/", handlers.CreateProject)
        r.Route("/{id}", func(r chi.Router) {
            r.Get("/", handlers.GetProject)
            r.Put("/", handlers.UpdateProject)
        })
    })
})
```

### ISO 8601 Timestamp Handling

```go
// Custom timestamp type for consistent JSON formatting
type Timestamp time.Time

func (t Timestamp) MarshalJSON() ([]byte, error) {
    return json.Marshal(time.Time(t).Format(time.RFC3339))
}

func (t *Timestamp) UnmarshalJSON(data []byte) error {
    var s string
    if err := json.Unmarshal(data, &s); err != nil {
        return err
    }
    parsed, err := time.Parse(time.RFC3339, s)
    if err != nil {
        return err
    }
    *t = Timestamp(parsed)
    return nil
}
```

### Project Structure Notes

**Files to Create/Modify:**

```
backend/
├── main.go                    # No changes needed
├── api/
│   ├── router.go              # MODIFY: Add route groups
│   ├── router_test.go         # MODIFY: Add more tests
│   ├── errors.go              # CREATE: Error response handling
│   ├── handlers/
│   │   ├── health.go          # CREATE: Extract health handler
│   │   ├── projects.go        # CREATE: Placeholder
│   │   ├── sessions.go        # CREATE: Placeholder
│   │   ├── settings.go        # CREATE: Placeholder
│   │   └── providers.go       # CREATE: Placeholder
│   └── middleware/
│       └── cors.go            # VERIFY: CORS configuration
├── types/
│   ├── common.go              # CREATE: Shared types
│   └── api.go                 # CREATE: API types
└── tests/
    └── testutil/              # CREATE: Test helpers
```

### Previous Story Intelligence

**From Story 1.1 (Project Scaffolding):**

- Chi router already installed and configured
- `/health` endpoint already working with `{"status": "ok"}`
- CORS middleware already in place for localhost:3007
- Directory structure created: `api/handlers/`, `api/middleware/`, `services/`, `providers/`, `storage/`, `types/`
- Tests passing: 2 router tests exist
- All naming conventions established

**Learnings to Apply:**
- `lucide-lit` package doesn't exist (frontend issue - not relevant here)
- Tauri CLI interactive mode doesn't work in non-TTY (not relevant here)
- Keep files minimal and focused - avoid feature creep

### Git Intelligence

**Recent Commits:**
- `097f47e feat: initialize bmad-studio project scaffolding` - Story 1.1 complete

**Patterns Established:**
- Feature branch: `feature/1-1-project-scaffolding`
- Commit message format: `feat:` prefix for features
- All scaffolding complete, ready to build on

### Placeholder Handler Pattern

All placeholder handlers must return 501 Not Implemented with proper error format:

```go
// Placeholder handler pattern - use for all unimplemented endpoints
func ListProjects(w http.ResponseWriter, r *http.Request) {
    WriteError(w, "not_implemented", "This endpoint is not yet implemented", http.StatusNotImplemented)
}
```

This ensures:
- Consistent error format across all placeholders
- Clear signal to frontend that endpoint exists but isn't ready
- Easy to find and implement later (search for `not_implemented`)

### Future: WebSocket Support

**Note:** WebSocket support for real-time streaming comes in **Epic 3 (Story 3.1)**. This story only sets up REST infrastructure. The router structure should accommodate future WebSocket upgrade at `/ws` or `/chat` endpoint, but do not implement it now.

### Anti-Patterns to Avoid

- **DO NOT** create actual implementations for placeholder handlers - use the pattern above
- **DO NOT** use Go panic - always return errors
- **DO NOT** wrap successful API responses - return payload directly
- **DO NOT** use any JSON field names that aren't snake_case
- **DO NOT** add database connections or storage - that's for later stories
- **DO NOT** add actual provider implementations - that's Story 1.3+

### Dependencies

**Story 1.1 must be complete** - This story builds on the scaffolding created in 1.1.

**No external dependencies to add** - Chi router and CORS middleware already installed.

### Testing Strategy

1. **Unit tests** for error response helpers
2. **Integration tests** for router endpoints
3. **Table-driven tests** following Go idioms
4. Use `httptest` package for HTTP testing

```go
// Example test pattern
func TestHealthEndpoint(t *testing.T) {
    r := NewRouter()
    ts := httptest.NewServer(r)
    defer ts.Close()

    resp, err := http.Get(ts.URL + "/health")
    // assertions...
}
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-Consistency-Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2-Go-Backend-Foundation]
- [Source: _bmad-output/planning-artifacts/prd.md#Technical-Architecture]
- [Source: _bmad-output/project-context.md#Language-Specific-Rules]
- [Source: _bmad-output/project-context.md#Framework-Specific-Rules]
- [Source: _bmad-output/implementation-artifacts/1-1-project-scaffolding.md] (Previous story learnings)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Encountered Go import cycle when initially placing errors.go in api/ package (handlers importing api, api importing handlers). Resolved by creating separate `api/response` package for error helpers.
- Test path adjusted from `tests/backend/testutil/` to `backend/tests/testutil/` to maintain proper Go module structure within backend directory.

### Completion Notes List

- **Task 1:** Router infrastructure enhanced with Chi route grouping. All resource endpoints scaffolded under `/api/v1/` prefix. Health endpoint remains at root `/health`.
- **Task 2:** Error response package created with standardized format `{"error": {"code": "...", "message": "..."}}`. All standard error codes implemented.
- **Task 3:** CORS configuration verified - already supports localhost:3007, all required methods, headers, and credentials.
- **Task 4:** Timestamp type with ISO 8601 marshaling created. All API types use snake_case JSON tags.
- **Task 5:** Handler scaffolding complete with placeholder handlers returning 501 Not Implemented.
- **Task 6:** Comprehensive test suite added with 20+ tests covering health, CORS, error format, and placeholder endpoints. All tests passing.

### Change Log
| Date | Change | Reason |
|------|--------|--------|
| 2026-01-28 | Story created | Generated by create-story workflow |
| 2026-01-28 | All tasks implemented | Red-green-refactor cycle complete, all tests passing |
| 2026-01-28 | Code review fixes | Consolidated HealthResponse to handlers package, created shared WriteJSON helper |

### File List

**Created:**
- `backend/api/response/errors.go` - Standardized error response handlers
- `backend/api/response/errors_test.go` - Error helper unit tests
- `backend/api/response/json.go` - Shared JSON response helper
- `backend/api/handlers/health.go` - Health check handler (extracted from router)
- `backend/api/handlers/projects.go` - Project placeholder handlers
- `backend/api/handlers/sessions.go` - Session placeholder handlers
- `backend/api/handlers/settings.go` - Settings placeholder handlers
- `backend/api/handlers/providers.go` - Provider placeholder handlers
- `backend/types/common.go` - Timestamp type with ISO 8601 marshaling
- `backend/types/common_test.go` - Timestamp and JSON tag tests
- `backend/types/api.go` - API request/response base types
- `backend/tests/testutil/helpers.go` - Test helper utilities

**Modified:**
- `backend/api/router.go` - Added API v1 route groups with handler imports
- `backend/api/router_test.go` - Added comprehensive tests for routes, CORS, and error format

**Deleted:**
- `backend/api/handlers/.gitkeep` - Removed placeholder file

