# Story 0.2: Parse Workflow Path Definitions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **the Go sidecar to parse BMAD's workflow path definitions**,
so that **the UI can render the phase graph with correct structure and dependencies**.

## Acceptance Criteria

1. **Given** path definition files exist in `_bmad/bmm/workflows/workflow-status/paths/`, **When** the project is loaded, **Then** all path files are parsed (method-greenfield.yaml, method-brownfield.yaml, etc.), and the selected track is determined from `bmm-workflow-status.yaml`.

2. **Given** a parsed path definition, **When** `GET /api/v1/bmad/phases` is called, **Then** the response includes:
   - Phase list with numbers, names, and required/optional status
   - Workflows within each phase with: id, name, agent, command, required/optional status
   - Dependency relationships between workflows

3. **Given** a workflow definition includes `if_has_ui: true` or similar conditions, **When** the phase graph is computed, **Then** conditional workflows are marked with their condition type.

## Tasks / Subtasks

- [x] Task 1: Define workflow path types (AC: #1, #2, #3)
  - [x] 1.1 Create `backend/types/workflow_path.go` with types for parsed path definitions
  - [x] 1.2 Define `PathDefinition` struct with fields: `method_name`, `track`, `field_type`, `description`, `phases`
  - [x] 1.3 Define `Phase` struct with fields: `phase` (number), `name`, `required`, `optional`, `note`, `workflows`
  - [x] 1.4 Define `Workflow` struct with fields: `id`, `exec`, `workflow`, `required`, `optional`, `conditional`, `agent`, `command`, `output`, `note`, `included_by`
  - [x] 1.5 Add JSON tags using `snake_case` convention and YAML tags for deserialization

- [x] Task 2: Define phase response types (AC: #2)
  - [x] 2.1 Create `PhaseResponse` struct for API output (may differ from internal `Phase` for API clarity)
  - [x] 2.2 Create `WorkflowResponse` struct for API output including computed fields like `condition_type`
  - [x] 2.3 Ensure response types use `snake_case` JSON tags

- [x] Task 3: Create workflow path service (AC: #1, #2, #3)
  - [x] 3.1 Create `backend/services/workflow_path_service.go` with `WorkflowPathService` struct
  - [x] 3.2 Implement `NewWorkflowPathService(configService *BMadConfigService)` constructor (depends on config for project root)
  - [x] 3.3 Implement `LoadPaths() error` to scan `_bmad/bmm/workflows/workflow-status/paths/*.yaml`
  - [x] 3.4 Implement `GetSelectedTrack() string` to read track from `bmm-workflow-status.yaml` (or return default "method-greenfield")
  - [x] 3.5 Implement `GetPhases() []PhaseResponse` to return parsed phases for the selected track
  - [x] 3.6 Implement `resolveWorkflowVariables(workflow *Workflow, projectRoot string)` to replace `{project-root}` in `exec` and `workflow` paths
  - [x] 3.7 Handle conditional workflows: detect `conditional` field (e.g., `if_has_ui`) and set `condition_type` in response

- [x] Task 4: Load workflow status file (AC: #1)
  - [x] 4.1 Create `backend/types/workflow_status.go` with `WorkflowStatus` struct for `bmm-workflow-status.yaml`
  - [x] 4.2 Implement loading of `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` in service
  - [x] 4.3 Extract `track` field to determine which path definition file to use
  - [x] 4.4 If status file doesn't exist, default to "method-greenfield" track

- [x] Task 5: Create phases handler (AC: #2)
  - [x] 5.1 Add `GetPhases(w http.ResponseWriter, r *http.Request)` method to `BMadHandler`
  - [x] 5.2 Handler calls `WorkflowPathService.GetPhases()` and returns JSON
  - [x] 5.3 Return appropriate error if paths not loaded (using existing error patterns)

- [x] Task 6: Register routes (AC: #2)
  - [x] 6.1 Add `GET /api/v1/bmad/phases` endpoint in `router.go`
  - [x] 6.2 Update `NewRouterWithServices` to accept `WorkflowPathService` dependency
  - [x] 6.3 Wire up handler to service

- [x] Task 7: Write unit tests (AC: #1, #2, #3)
  - [x] 7.1 Create `backend/services/workflow_path_service_test.go`
  - [x] 7.2 Test: valid path files parse correctly with all phases and workflows
  - [x] 7.3 Test: `{project-root}` placeholders resolve in workflow paths
  - [x] 7.4 Test: conditional workflows have `condition_type` populated
  - [x] 7.5 Test: missing path directory returns appropriate error
  - [x] 7.6 Test: invalid YAML returns structured error
  - [x] 7.7 Test: default track is "method-greenfield" when status file missing
  - [x] 7.8 Create `backend/api/handlers/bmad_phases_test.go`
  - [x] 7.9 Test: `GET /api/v1/bmad/phases` returns 200 with valid phase structure
  - [x] 7.10 Test: `GET /api/v1/bmad/phases` returns error when service not loaded

## Dev Notes

### Architecture Patterns & Constraints

- **Router:** chi/v5 (v5.2.4) - use existing pattern in `router.go`
- **Handler pattern:** Follow existing `BMadHandler` style - struct methods taking `(w http.ResponseWriter, r *http.Request)`
- **Response formatting:** Use `response.WriteJSON(w, statusCode, data)` for success, `response.WriteError(w, statusCode, code, message)` for errors
- **Error codes:** Use snake_case strings (e.g., `"path_files_not_found"`, `"invalid_path_definition"`) consistent with existing codes
- **JSON field convention:** All JSON tags must use `snake_case` (e.g., `json:"method_name"`)
- **Go file naming:** `snake_case.go` (e.g., `workflow_path_service.go`)
- **Go exports:** `PascalCase` for exported types/functions

### Path Definition File Structure

The files to parse are located at: `{projectRoot}/_bmad/bmm/workflows/workflow-status/paths/`

Available files:
- `method-greenfield.yaml` - Full greenfield development track
- `method-brownfield.yaml` - Existing codebase track
- `enterprise-greenfield.yaml` - Enterprise greenfield track
- `enterprise-brownfield.yaml` - Enterprise brownfield track

Example path definition structure (from `method-greenfield.yaml`):
```yaml
method_name: "BMad Method"
track: "bmad-method"
field_type: "greenfield"
description: "Complete product and system design methodology for greenfield projects"

phases:
  - phase: 1
    name: "Analysis (Optional)"
    optional: true
    note: "User-selected during workflow-init"
    workflows:
      - id: "brainstorm-project"
        exec: "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"
        optional: true
        agent: "analyst"
        command: "/bmad:bmm:workflows:brainstorming"
        included_by: "user_choice"
        note: "Uses core brainstorming workflow with project context template"

  - phase: 2
    name: "Planning"
    required: true
    workflows:
      - id: "prd"
        exec: "{project-root}/_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md"
        required: true
        agent: "pm"
        command: "/bmad:bmm:workflows:create-prd"
        output: "Product Requirements Document with FRs and NFRs"

      - id: "create-ux-design"
        conditional: "if_has_ui"  # <-- This is the condition type
        exec: "{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-ux-design/workflow.md"
        agent: "ux-designer"
        command: "/bmad:bmm:workflows:create-ux-design"
        note: "Determined after PRD - user/agent decides if needed"
```

### Workflow Status File Location

The track selection comes from: `{projectRoot}/_bmad-output/planning-artifacts/bmm-workflow-status.yaml`

This file contains:
```yaml
track: method-greenfield  # Determines which path definition to load
# ... other workflow completion status ...
```

If this file doesn't exist, default to `method-greenfield` track.

### Variable Resolution Logic

Same pattern as Story 0.1. Replace all `{project-root}` in `exec` and `workflow` fields with absolute project root path using `strings.ReplaceAll`.

### API Response Format

`GET /api/v1/bmad/phases` should return:
```json
{
  "method_name": "BMad Method",
  "track": "bmad-method",
  "field_type": "greenfield",
  "description": "Complete product and system design methodology for greenfield projects",
  "phases": [
    {
      "phase": 1,
      "name": "Analysis (Optional)",
      "required": false,
      "optional": true,
      "note": "User-selected during workflow-init",
      "workflows": [
        {
          "id": "brainstorm-project",
          "exec": "/absolute/path/to/workflow.md",
          "required": false,
          "optional": true,
          "conditional": null,
          "condition_type": null,
          "agent": "analyst",
          "command": "/bmad:bmm:workflows:brainstorming",
          "output": null,
          "note": "Uses core brainstorming workflow"
        }
      ]
    },
    {
      "phase": 2,
      "name": "Planning",
      "required": true,
      "optional": false,
      "workflows": [
        {
          "id": "prd",
          "exec": "/absolute/path/to/workflow.md",
          "required": true,
          "optional": false,
          "agent": "pm",
          "command": "/bmad:bmm:workflows:create-prd",
          "output": "Product Requirements Document with FRs and NFRs"
        },
        {
          "id": "create-ux-design",
          "exec": "/absolute/path/to/workflow.md",
          "required": false,
          "optional": false,
          "conditional": "if_has_ui",
          "condition_type": "if_has_ui",
          "agent": "ux-designer",
          "command": "/bmad:bmm:workflows:create-ux-design"
        }
      ]
    }
  ]
}
```

### Service Dependency Pattern

Follow the established pattern from Story 0.1:
```go
type WorkflowPathService struct {
    mu            sync.RWMutex
    configService *BMadConfigService  // Dependency: needs project root
    pathDefs      map[string]*PathDefinition  // Keyed by track name
    selectedTrack string
}

func NewWorkflowPathService(configService *BMadConfigService) *WorkflowPathService { ... }
func (s *WorkflowPathService) LoadPaths() error { ... }
func (s *WorkflowPathService) GetPhases() (*PhasesResponse, error) { ... }
```

### File Scanning Pattern

Use `filepath.Glob` to find all YAML files:
```go
pathFiles, err := filepath.Glob(filepath.Join(pathsDir, "*.yaml"))
```

### Error Codes for This Service

| Error Code | Condition |
|------------|-----------|
| `path_files_not_found` | `_bmad/bmm/workflows/workflow-status/paths/` directory doesn't exist or contains no YAML files |
| `invalid_path_definition` | YAML parsing fails for a path definition file |
| `track_not_found` | Selected track doesn't match any loaded path definition |
| `config_not_loaded` | BMadConfigService has no config (can't determine project root) |

### Project Structure Notes

- New files: `types/workflow_path.go`, `types/workflow_status.go`, `services/workflow_path_service.go` + test files
- Modify: `api/handlers/bmad.go` (add GetPhases method), `api/router.go` (add phases route)
- Follow existing type definition patterns from `types/bmad.go`

### Previous Story Intelligence (Story 0.1)

**Patterns Established:**
- Service struct with `sync.RWMutex` for thread-safe access
- `NewXxxService()` constructor pattern
- `LoadXxx()` method for loading, `GetXxx()` for retrieval
- `BMadConfigError` custom error type with `Code` and `Message` fields
- Router accepts services via `NewRouterWithServices()` function
- Tests use `os.MkdirTemp` for fixture directories

**Files Created in 0.1:**
- `backend/types/bmad.go` - BMadConfig struct with YAML/JSON tags
- `backend/services/bmad_config.go` - Config service with mutex, Load/Get methods
- `backend/api/handlers/bmad.go` - BMadHandler with GetConfig endpoint

**Key Learnings:**
- Added `sync.RWMutex` for thread-safe config access after code review
- Structured errors with `Code` field enable consistent API error responses
- Service holds reference to parsed data, handlers just call service methods

### Testing Notes

- Use Go's standard `testing` package
- Create test fixture YAML files using `os.MkdirTemp` and `os.WriteFile`
- Follow table-driven test pattern for multiple scenarios
- Use existing test helpers from `tests/testutil/helpers.go` for handler tests
- Run tests: `cd backend && go test ./...`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Go Backend Structure, API Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 - Story 0.2 acceptance criteria]
- [Source: _bmad-output/project-context.md - Technology stack rules, Go naming conventions]
- [Source: _bmad/bmm/workflows/workflow-status/paths/method-greenfield.yaml - Path definition structure]
- [Source: backend/services/bmad_config.go - Established service pattern with mutex]
- [Source: backend/types/bmad.go - Type definition pattern with JSON/YAML tags]
- [Source: backend/api/handlers/bmad.go - Handler pattern reference]
- [Source: backend/api/response/errors.go - Error code definitions and format]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created `PathDefinition`, `Phase`, `Workflow` structs for YAML parsing with appropriate snake_case JSON/YAML tags
- Created `PhaseResponse`, `WorkflowResponse`, `PhasesResponse` API response types with nullable pointer fields for optional values
- Created `WorkflowStatus` type for parsing bmm-workflow-status.yaml
- Implemented `WorkflowPathService` with thread-safe mutex pattern matching Story 0.1
- Service loads all path definition YAML files from `_bmad/bmm/workflows/workflow-status/paths/`
- Track selection reads from `bmm-workflow-status.yaml`, defaults to "bmad-method"
- Implemented `{project-root}` variable resolution in exec and workflow paths
- Conditional workflows populate both `conditional` and `condition_type` fields in response
- Created comprehensive unit tests covering all acceptance criteria scenarios
- Updated `BMadHandler` constructor to accept `WorkflowPathService` as second parameter
- Added `GET /api/v1/bmad/phases` endpoint to router
- All 12 service tests + 5 handler tests pass (2 new tests added during code review)

### Change Log

- 2026-01-28: Initial implementation of workflow path parsing (Story 0.2)
- 2026-01-28: Code review fixes applied (see Senior Developer Review below)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-28
**Outcome:** Approved with fixes applied

**Issues Found and Fixed:**

1. **[HIGH] Default track mismatch** - Changed default track from "method-greenfield" to "bmad-method" to match actual path definition files (`workflow_path_service.go:129,135,139`)

2. **[HIGH] Missing `included_by` in API response** - Added `IncludedBy *string` to `WorkflowResponse` and transfer logic in `toResponse()` (`types/workflow_path.go:59`, `workflow_path_service.go:229-231`)

3. **[MEDIUM] Missing `purpose` field** - Added `Purpose` field to `Workflow` struct and `WorkflowResponse` to capture brownfield workflow purposes (`types/workflow_path.go:36,60`, `workflow_path_service.go:233-235`)

4. **[MEDIUM] Missing test for `workflow` field** - Added `TestLoadPaths_WorkflowFieldMapsToExec` and `TestLoadPaths_IncludedByAndPurposeFieldsTransferred` tests (`workflow_path_service_test.go`)

**Test Results:** All 12 service tests + 5 handler tests pass

### File List

**New files:**
- backend/types/workflow_path.go
- backend/types/workflow_status.go
- backend/services/workflow_path_service.go
- backend/services/workflow_path_service_test.go
- backend/api/handlers/bmad_phases_test.go

**Modified files:**
- backend/api/handlers/bmad.go (added GetPhases method, updated constructor)
- backend/api/handlers/bmad_test.go (updated constructor calls)
- backend/api/router.go (added phases route, updated NewRouterWithServices signature)

