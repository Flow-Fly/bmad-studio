# Story 0.1: Parse BMAD Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **the Go sidecar to parse BMAD's configuration files**,
so that **all BMAD paths and settings are available to the application**.

## Acceptance Criteria

1. **Given** a project with `_bmad/bmm/config.yaml`, **When** the project is loaded, **Then** the configuration is parsed and stored in memory, variable placeholders (`{project-root}`) are resolved to absolute paths, and `GET /api/v1/bmad/config` returns the parsed configuration as JSON.

2. **Given** a project without `_bmad/bmm/config.yaml`, **When** the project is loaded, **Then** an error is returned indicating BMAD is not installed, with the error suggesting running `npx bmad-method install`.

3. **Given** the configuration contains paths like `{project-root}/_bmad-output`, **When** paths are resolved, **Then** all path values are absolute filesystem paths.

## Tasks / Subtasks

- [x] Task 1: Define BMAD config types (AC: #1, #3)
  - [x] 1.1 Create `backend/types/bmad.go` with `BMadConfig` struct matching config.yaml fields
  - [x] 1.2 Add JSON tags using `snake_case` convention and YAML tags for deserialization
  - [x] 1.3 Include fields: `project_name`, `user_skill_level`, `planning_artifacts`, `implementation_artifacts`, `project_knowledge`, `user_name`, `communication_language`, `document_output_language`, `output_folder`, `tea_use_mcp_enhancements`, `tea_use_playwright_utils`
  - [x] 1.4 Add `ProjectRoot` field (computed, not from YAML) for the resolved absolute project root path

- [x] Task 2: Create config parser service (AC: #1, #2, #3)
  - [x] 2.1 Create `backend/services/bmad_config.go` with `BMadConfigService` struct
  - [x] 2.2 Implement `LoadConfig(projectRoot string) (*types.BMadConfig, error)` function
  - [x] 2.3 Read `_bmad/bmm/config.yaml` from project root using `os.ReadFile`
  - [x] 2.4 Parse YAML using `gopkg.in/yaml.v3` (add dependency via `go get`)
  - [x] 2.5 Implement `resolveVariables(config *BMadConfig, projectRoot string)` to replace `{project-root}` placeholders in all path fields with the absolute project root path
  - [x] 2.6 Return structured error with code `BMAD_NOT_INSTALLED` if config.yaml is missing
  - [x] 2.7 Return structured error with code `INVALID_CONFIG` if YAML parsing fails

- [x] Task 3: Create BMAD handler (AC: #1, #2)
  - [x] 3.1 Create `backend/api/handlers/bmad.go` with `BMadHandler` struct holding a reference to `BMadConfigService`
  - [x] 3.2 Implement `GetConfig(w http.ResponseWriter, r *http.Request)` handler
  - [x] 3.3 Handler returns parsed config as JSON using `response.WriteJSON`
  - [x] 3.4 Handler returns appropriate error response if config not loaded (using existing error patterns from `response/errors.go`)

- [x] Task 4: Register routes (AC: #1)
  - [x] 4.1 Add `/api/v1/bmad` route group in `backend/api/router.go`
  - [x] 4.2 Register `GET /api/v1/bmad/config` endpoint pointing to `BMadHandler.GetConfig`
  - [x] 4.3 Initialize `BMadConfigService` and `BMadHandler` in router setup (for now, with a hardcoded or configurable project root path)

- [x] Task 5: Write unit tests (AC: #1, #2, #3)
  - [x] 5.1 Create `backend/services/bmad_config_test.go`
  - [x] 5.2 Test: valid config.yaml parses correctly with all fields populated
  - [x] 5.3 Test: `{project-root}` placeholders resolve to absolute paths
  - [x] 5.4 Test: missing config.yaml returns `BMAD_NOT_INSTALLED` error
  - [x] 5.5 Test: malformed YAML returns `INVALID_CONFIG` error
  - [x] 5.6 Test: multiple `{project-root}` references in a single path resolve correctly
  - [x] 5.7 Create `backend/api/handlers/bmad_test.go`
  - [x] 5.8 Test: `GET /api/v1/bmad/config` returns 200 with valid JSON config
  - [x] 5.9 Test: `GET /api/v1/bmad/config` returns error when config not loaded

## Dev Notes

### Architecture Patterns & Constraints

- **Router:** chi/v5 (v5.2.4) - use `r.Route("/api/v1/bmad", func(r chi.Router) { ... })` pattern consistent with existing route groups
- **Handler pattern:** Follow existing handler style in `backend/api/handlers/health.go` - plain functions or struct methods taking `(w http.ResponseWriter, r *http.Request)`
- **Response formatting:** Use `response.WriteJSON(w, statusCode, data)` for success, `response.WriteError(w, statusCode, code, message)` for errors
- **Error codes:** Use snake_case strings (e.g., `"bmad_not_installed"`, `"invalid_config"`) consistent with existing codes in `response/errors.go`
- **JSON field convention:** All JSON tags must use `snake_case` (e.g., `json:"project_name"`)
- **Go file naming:** `snake_case.go` (e.g., `bmad_config.go`, not `bmadConfig.go`)
- **Go exports:** `PascalCase` for exported types/functions (e.g., `BMadConfig`, `LoadConfig`)

### Key Library

- **gopkg.in/yaml.v3** - Standard Go YAML parsing library. Add via: `cd backend && go get gopkg.in/yaml.v3`
- Use struct tags: `yaml:"field_name"` alongside `json:"field_name"`

### Config File Location

The target file to parse is always at: `{projectRoot}/_bmad/bmm/config.yaml`

Example config.yaml content:
```yaml
project_name: bmad-studio
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
tea_use_mcp_enhancements: false
tea_use_playwright_utils: false
user_name: Flow
communication_language: English
document_output_language: English
output_folder: "{project-root}/_bmad-output"
```

### Variable Resolution Logic

Replace all occurrences of `{project-root}` in string fields with the absolute filesystem path of the project root. Use `strings.ReplaceAll` on each path-type field. After resolution, all path values should pass `filepath.IsAbs()`.

### Service Layer Pattern

The `services/` directory is currently empty (`.gitkeep` only). This is the first service being created. The pattern to establish:
- Service struct holds dependencies (for now, just the parsed config)
- Service methods contain business logic, no HTTP concerns
- Handlers call services, services never import from `api/`

### Dependency Injection Approach

For now, simple constructor injection:
```go
// Service
type BMadConfigService struct {
    config *types.BMadConfig
}

func NewBMadConfigService() *BMadConfigService { ... }
func (s *BMadConfigService) LoadConfig(projectRoot string) error { ... }
func (s *BMadConfigService) GetConfig() *types.BMadConfig { ... }

// Handler
type BMadHandler struct {
    configService *BMadConfigService
}

func NewBMadHandler(cs *BMadConfigService) *BMadHandler { ... }
```

### Project Structure Notes

- New files to create: `types/bmad.go`, `services/bmad_config.go`, `api/handlers/bmad.go` + test files
- Modify: `api/router.go` (add bmad route group)
- The `.gitkeep` in `services/` can be removed once `bmad_config.go` is added
- All new code goes in existing directory structure - no new directories needed

### Error Response Format

Follow existing pattern from `response/errors.go`:
```json
{
  "error": {
    "code": "bmad_not_installed",
    "message": "BMAD configuration not found at _bmad/bmm/config.yaml. Run 'npx bmad-method install' to set up BMAD."
  }
}
```

### Testing Notes

- Use Go's standard `testing` package
- Create test fixture YAML files in test functions using `os.MkdirTemp` and `os.WriteFile`
- Follow table-driven test pattern for multiple scenarios
- Use existing test helpers from `tests/testutil/helpers.go` for handler tests
- Run tests: `cd backend && go test ./...`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Go Backend Structure, API Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 - Story 0.1 acceptance criteria]
- [Source: _bmad-output/project-context.md - Technology stack rules, Go naming conventions]
- [Source: backend/api/router.go - Existing route registration pattern]
- [Source: backend/api/handlers/health.go - Handler pattern reference]
- [Source: backend/api/response/errors.go - Error code definitions and format]
- [Source: backend/types/api.go - Existing type definition patterns]
- [Source: _bmad/bmm/config.yaml - Target config file structure]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered.

### Completion Notes List

- Created `BMadConfig` struct in `backend/types/bmad.go` with all 11 config fields plus computed `ProjectRoot` field
- Created `BMadConfigService` in `backend/services/bmad_config.go` with `NewBMadConfigService()`, `LoadConfig()`, and `GetConfig()` methods
- Implemented `BMadConfigError` custom error type with `Code` and `Message` fields for structured error handling
- Implemented `resolveVariables()` helper to replace all `{project-root}` placeholders in path fields
- Created `BMadHandler` in `backend/api/handlers/bmad.go` with `GetConfig` endpoint handler
- Extended router with `NewRouterWithServices()` function that accepts `BMadConfigService` and registers `/api/v1/bmad/config` route
- Original `NewRouter()` preserved for backwards compatibility
- Added `gopkg.in/yaml.v3 v3.0.1` dependency
- Created 6 unit tests in `bmad_config_test.go` covering valid config, path resolution, missing file error, malformed YAML error, multiple placeholder resolution
- Created 2 handler tests in `bmad_test.go` covering successful config return and error when not loaded
- Removed `.gitkeep` files from `services/` and `types/` directories (now have real content)
- All existing tests continue to pass (no regressions)

### File List

**New Files:**
- backend/types/bmad.go
- backend/services/bmad_config.go
- backend/services/bmad_config_test.go
- backend/api/handlers/bmad.go
- backend/api/handlers/bmad_test.go

**Modified Files:**
- backend/api/router.go (added NewRouterWithServices, bmad route group)
- backend/go.mod (added yaml.v3 dependency)
- backend/go.sum (updated with yaml.v3)

**Deleted Files:**
- backend/services/.gitkeep
- backend/types/.gitkeep

### Change Log

- 2026-01-28: Implemented Story 0.1 - Parse BMAD Configuration. Added BMadConfig type, BMadConfigService for parsing config.yaml with {project-root} variable resolution, BMadHandler with GET /api/v1/bmad/config endpoint, and comprehensive unit tests. All acceptance criteria satisfied.
- 2026-01-28: Code review fix - Added sync.RWMutex to BMadConfigService for thread-safe config access during runtime reloads.
