# Story 0.4: Read Workflow Status Files

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **the Go sidecar to read BMAD's workflow status files**,
so that **the UI shows accurate phase completion state**.

## Acceptance Criteria

1. **Given** `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` exists, **When** parsed, **Then** workflow completion is determined:
   - Value is file path → workflow complete, artifact at path
   - Value is `required` → must complete, not started
   - Value is `optional` → can be skipped
   - Value is `skipped` → explicitly skipped
   - Value is `recommended` → suggested but optional

2. **Given** `_bmad-output/implementation-artifacts/sprint-status.yaml` exists, **When** parsed, **Then** story status is determined:
   - `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`

3. **Given** status files are parsed, **When** `GET /api/v1/bmad/status` is called, **Then** the response includes:
   - Current phase (first phase with incomplete required workflows)
   - Next workflow (first incomplete required workflow)
   - Recommended agent for next workflow
   - Completion percentage per phase

4. **Given** no status files exist, **When** status is queried, **Then** default state is returned (all workflows not started), **And** status files are NOT auto-created (BMAD creates them via workflow).

## Tasks / Subtasks

- [x] Task 1: Define workflow status types (AC: #1, #2, #3)
  - [x] 1.1 Extend `backend/types/workflow_status.go` with full status type definitions
  - [x] 1.2 Define `WorkflowStatusFile` struct matching bmm-workflow-status.yaml structure:
    - `Generated`, `Project`, `ProjectType`, `SelectedTrack`, `FieldType`, `WorkflowPath` fields
    - `WorkflowStatus` map[string]string for workflow_status section
  - [x] 1.3 Define `SprintStatusFile` struct matching sprint-status.yaml structure:
    - `Generated`, `Project`, `ProjectKey`, `TrackingSystem`, `StoryLocation` fields
    - `DevelopmentStatus` map[string]string for development_status section
  - [x] 1.4 Define enum-like constants for status values: `StatusRequired`, `StatusOptional`, `StatusSkipped`, `StatusRecommended`
  - [x] 1.5 Define story status constants: `StoryBacklog`, `StoryReadyForDev`, `StoryInProgress`, `StoryReview`, `StoryDone`
  - [x] 1.6 Define `WorkflowCompletion` struct for computed workflow state:
    - `WorkflowID`, `Status`, `ArtifactPath`, `IsComplete`, `IsRequired`

- [x] Task 2: Define status response types (AC: #3)
  - [x] 2.1 Define `StatusResponse` struct for API output with fields:
    - `CurrentPhase` (int)
    - `CurrentPhaseName` (string)
    - `NextWorkflowID` (*string - nil if none)
    - `NextWorkflowAgent` (*string)
    - `PhaseCompletion` ([]PhaseCompletionStatus)
    - `WorkflowStatuses` (map[string]WorkflowCompletionStatus)
    - `StoryStatuses` (map[string]string) - only if sprint-status exists
  - [x] 2.2 Define `PhaseCompletionStatus` struct:
    - `PhaseNum`, `Name`, `CompletedCount`, `TotalRequired`, `PercentComplete`
  - [x] 2.3 Define `WorkflowCompletionStatus` struct:
    - `WorkflowID`, `Status`, `ArtifactPath`, `IsComplete`, `IsRequired`, `IsOptional`
  - [x] 2.4 Ensure all response types use `snake_case` JSON tags

- [x] Task 3: Create workflow status service (AC: #1, #2, #3, #4)
  - [x] 3.1 Create `backend/services/workflow_status_service.go` with `WorkflowStatusService` struct
  - [x] 3.2 Implement `NewWorkflowStatusService(configService *BMadConfigService, pathService *WorkflowPathService)` constructor
  - [x] 3.3 Implement `LoadStatus() error` to read both status files from config paths
  - [x] 3.4 Implement `parseWorkflowStatus(path string) (*WorkflowStatusFile, error)` to parse bmm-workflow-status.yaml
  - [x] 3.5 Implement `parseSprintStatus(path string) (*SprintStatusFile, error)` to parse sprint-status.yaml
  - [x] 3.6 Implement `isComplete(statusValue string) bool` helper:
    - Returns true if value is a file path (contains "/" or ends with ".md"/".yaml")
    - Returns false for "required", "optional", "recommended", "skipped"
  - [x] 3.7 Implement `computeCurrentPhase(phases []PhaseResponse, workflowStatuses map[string]string) int`:
    - Returns first phase number with incomplete required workflow
    - Returns last phase + 1 if all complete
  - [x] 3.8 Implement `computeNextWorkflow(phases []PhaseResponse, workflowStatuses map[string]string) (*string, *string)`:
    - Returns (workflowID, agentID) for first incomplete required workflow
    - Returns (nil, nil) if all complete
  - [x] 3.9 Implement `computePhaseCompletion(phases []PhaseResponse, workflowStatuses map[string]string) []PhaseCompletionStatus`
  - [x] 3.10 Implement `GetStatus() (*StatusResponse, error)` to return computed status
  - [x] 3.11 Handle case where no status files exist - return default state with all workflows "not_started"
  - [x] 3.12 Add `sync.RWMutex` for thread-safe access

- [x] Task 4: Create status handler (AC: #3)
  - [x] 4.1 Add `GetStatus(w http.ResponseWriter, r *http.Request)` method to `BMadHandler`
  - [x] 4.2 Handler calls `WorkflowStatusService.GetStatus()` and returns JSON
  - [x] 4.3 Return appropriate error if service not available (using existing error patterns)
  - [x] 4.4 Handle missing status files gracefully (return default state, not error)

- [x] Task 5: Register routes (AC: #3)
  - [x] 5.1 Add `GET /api/v1/bmad/status` endpoint in `router.go`
  - [x] 5.2 Update `NewRouterWithServices` to accept `WorkflowStatusService` as fourth parameter
  - [x] 5.3 Update `BMadHandler` constructor to accept `WorkflowStatusService`
  - [x] 5.4 Wire up handler to service

- [x] Task 6: Write unit tests (AC: #1, #2, #3, #4)
  - [x] 6.1 Create `backend/services/workflow_status_service_test.go`
  - [x] 6.2 Test: valid bmm-workflow-status.yaml parses correctly
  - [x] 6.3 Test: workflow status values interpreted correctly (file path = complete, required = incomplete)
  - [x] 6.4 Test: valid sprint-status.yaml parses correctly with all story statuses
  - [x] 6.5 Test: current phase computed correctly (first with incomplete required)
  - [x] 6.6 Test: next workflow computed correctly with agent reference
  - [x] 6.7 Test: phase completion percentages calculated correctly
  - [x] 6.8 Test: missing bmm-workflow-status.yaml returns default state
  - [x] 6.9 Test: missing sprint-status.yaml omits story statuses from response
  - [x] 6.10 Test: invalid YAML returns structured error
  - [x] 6.11 Create `backend/tests/api/bmad_status_test.go`
  - [x] 6.12 Test: `GET /api/v1/bmad/status` returns 200 with valid status
  - [x] 6.13 Test: `GET /api/v1/bmad/status` returns default state when no files exist

## Dev Notes

### Architecture Patterns & Constraints

- **Router:** chi/v5 (v5.2.4) - use existing pattern in `router.go`
- **Handler pattern:** Follow existing `BMadHandler` style - struct methods taking `(w http.ResponseWriter, r *http.Request)`
- **Response formatting:** Use `response.WriteJSON(w, statusCode, data)` for success, `response.WriteError(w, statusCode, code, message)` for errors
- **Error codes:** Use snake_case strings (e.g., `"status_not_loaded"`, `"invalid_status_file"`) consistent with existing codes
- **JSON field convention:** All JSON tags must use `snake_case` (e.g., `json:"current_phase"`)
- **Go file naming:** `snake_case.go` (e.g., `workflow_status_service.go`)
- **Go exports:** `PascalCase` for exported types/functions

### Status File Structures

**bmm-workflow-status.yaml** (located at `{planning_artifacts}/bmm-workflow-status.yaml`):
```yaml
generated: "2026-01-27"
project: "bmad-studio"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  # Phase 1: Analysis (Optional)
  brainstorm-project: "_bmad-output/planning-artifacts/brainstorming/..."  # complete
  research: skipped
  product-brief: "_bmad-output/planning-artifacts/product-brief.md"  # complete

  # Phase 2: Planning
  prd: "_bmad-output/planning-artifacts/prd.md"  # complete
  create-ux-design: "_bmad-output/planning-artifacts/ux-design/index.md"  # complete

  # Phase 3: Solutioning
  create-architecture: "_bmad-output/planning-artifacts/architecture.md"  # complete
  create-epics-and-stories: required  # NOT complete
  test-design: optional
  implementation-readiness: required  # NOT complete
```

**sprint-status.yaml** (located at `{implementation_artifacts}/sprint-status.yaml`):
```yaml
generated: 2026-01-27
project: bmad-studio
project_key: bmad-studio
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-0: in-progress
  0-1-parse-bmad-configuration: done
  0-2-parse-workflow-path-definitions: done
  0-3-parse-agent-definitions: done
  0-4-read-workflow-status-files: backlog  # This story!
  epic-0-retrospective: optional
```

### Status Value Interpretation Logic

```go
func isWorkflowComplete(value string) bool {
    // Complete if value looks like a file path
    if strings.Contains(value, "/") || strings.HasSuffix(value, ".md") || strings.HasSuffix(value, ".yaml") {
        return true
    }
    // Not complete for status keywords
    switch value {
    case "required", "optional", "recommended", "conditional":
        return false
    case "skipped":
        return true  // Skipped counts as "complete" for progress tracking
    default:
        return false
    }
}

func isWorkflowRequired(workflow WorkflowResponse) bool {
    return workflow.Required && !workflow.Optional && workflow.Conditional == nil
}
```

### Current Phase Computation Logic

```go
func computeCurrentPhase(phases []PhaseResponse, statuses map[string]string) int {
    for _, phase := range phases {
        for _, wf := range phase.Workflows {
            if isWorkflowRequired(wf) {
                status, exists := statuses[wf.ID]
                if !exists || !isWorkflowComplete(status) {
                    return phase.PhaseNum
                }
            }
        }
    }
    // All complete - return phase after last
    if len(phases) > 0 {
        return phases[len(phases)-1].PhaseNum + 1
    }
    return 1
}
```

### Service Dependency Pattern

The service needs both ConfigService (for paths) and WorkflowPathService (for phase/workflow definitions):

```go
type WorkflowStatusService struct {
    mu              sync.RWMutex
    configService   *BMadConfigService
    pathService     *WorkflowPathService
    workflowStatus  *WorkflowStatusFile   // Parsed bmm-workflow-status.yaml
    sprintStatus    *SprintStatusFile     // Parsed sprint-status.yaml (may be nil)
}

func NewWorkflowStatusService(cs *BMadConfigService, ps *WorkflowPathService) *WorkflowStatusService {
    return &WorkflowStatusService{
        configService: cs,
        pathService:   ps,
    }
}
```

### File Path Resolution

Use paths from BMadConfig:
```go
config := s.configService.GetConfig()
workflowStatusPath := filepath.Join(config.PlanningArtifacts, "bmm-workflow-status.yaml")
sprintStatusPath := filepath.Join(config.ImplementationArtifacts, "sprint-status.yaml")
```

### API Response Format

`GET /api/v1/bmad/status` should return:
```json
{
  "current_phase": 3,
  "current_phase_name": "Solutioning",
  "next_workflow_id": "create-epics-and-stories",
  "next_workflow_agent": "pm",
  "phase_completion": [
    {
      "phase_num": 1,
      "name": "Analysis",
      "completed_count": 2,
      "total_required": 0,
      "percent_complete": 100
    },
    {
      "phase_num": 2,
      "name": "Planning",
      "completed_count": 2,
      "total_required": 2,
      "percent_complete": 100
    },
    {
      "phase_num": 3,
      "name": "Solutioning",
      "completed_count": 1,
      "total_required": 3,
      "percent_complete": 33
    }
  ],
  "workflow_statuses": {
    "brainstorm-project": {
      "workflow_id": "brainstorm-project",
      "status": "complete",
      "artifact_path": "_bmad-output/planning-artifacts/brainstorming/...",
      "is_complete": true,
      "is_required": false,
      "is_optional": true
    },
    "prd": {
      "workflow_id": "prd",
      "status": "complete",
      "artifact_path": "_bmad-output/planning-artifacts/prd.md",
      "is_complete": true,
      "is_required": true,
      "is_optional": false
    },
    "create-epics-and-stories": {
      "workflow_id": "create-epics-and-stories",
      "status": "required",
      "artifact_path": null,
      "is_complete": false,
      "is_required": true,
      "is_optional": false
    }
  },
  "story_statuses": {
    "0-1-parse-bmad-configuration": "done",
    "0-2-parse-workflow-path-definitions": "done",
    "0-3-parse-agent-definitions": "done",
    "0-4-read-workflow-status-files": "backlog"
  }
}
```

### Default State (No Status Files)

When bmm-workflow-status.yaml doesn't exist:
```json
{
  "current_phase": 1,
  "current_phase_name": "Analysis",
  "next_workflow_id": "brainstorm-project",
  "next_workflow_agent": "analyst",
  "phase_completion": [
    {"phase_num": 1, "name": "Analysis", "completed_count": 0, "total_required": 1, "percent_complete": 0}
  ],
  "workflow_statuses": {
    "brainstorm-project": {
      "workflow_id": "brainstorm-project",
      "status": "not_started",
      "artifact_path": null,
      "is_complete": false,
      "is_required": true,
      "is_optional": false
    }
  }
}
```

### Error Codes for This Service

| Error Code | Condition |
|------------|-----------|
| `config_not_loaded` | BMadConfigService has no config (can't determine paths) |
| `paths_not_loaded` | WorkflowPathService has no phase data |
| `invalid_status_file` | YAML parsing fails for status file |

### Previous Story Intelligence (Stories 0.1, 0.2, 0.3)

**Patterns Established:**
- Service struct with `sync.RWMutex` for thread-safe access
- `NewXxxService()` constructor pattern with service dependencies
- `LoadXxx()` method for loading, `GetXxx()` for retrieval
- Custom error type with `Code` and `Message` fields
- Router accepts services via `NewRouterWithServices()` function with incremental parameters
- Tests use `os.MkdirTemp` for fixture directories
- Use pointer types (`*string`) in response structs for optional fields
- Sort arrays for deterministic API responses
- Handle malformed files gracefully with logging, continue processing valid data

**Key Learnings from Code Reviews (0.1, 0.2, 0.3):**
1. Add `sync.RWMutex` for thread-safe access (0.1)
2. Use `sort.Strings()` for deterministic array ordering (0.3)
3. Continue processing on errors - log and skip invalid entries (0.3)
4. Use `filepath.Clean()` for cross-platform path handling (0.3)
5. Validate for empty/missing required fields (0.3)
6. Handle CRLF line endings in parsing (0.3)

**Files Modified in Previous Stories:**
- `backend/api/router.go` - Update `NewRouterWithServices` to add new service parameter
- `backend/api/handlers/bmad.go` - Update constructor, add new handler method

### Project Structure Notes

**New files:**
- `backend/services/workflow_status_service.go`
- `backend/services/workflow_status_service_test.go`
- `backend/tests/api/bmad_status_test.go`

**Modified files:**
- `backend/types/workflow_status.go` (extend with full status types)
- `backend/api/handlers/bmad.go` (add GetStatus method, update constructor)
- `backend/api/router.go` (add status route, update NewRouterWithServices signature)

### Testing Notes

- Use Go's standard `testing` package
- Create test fixture status files using `os.MkdirTemp` and `os.WriteFile`
- Follow table-driven test pattern for multiple scenarios
- Run tests: `cd backend && go test ./...`
- Test edge cases:
  - Missing workflow_status section
  - Empty development_status section
  - Status file with comments (should be ignored by YAML parser)
  - Unknown status values (treat as incomplete)

### Integration with Existing Services

This service depends on two existing services:
1. **BMadConfigService** - for `PlanningArtifacts` and `ImplementationArtifacts` paths
2. **WorkflowPathService** - for phase/workflow definitions to compute completion

The service combines static workflow definitions (from path files) with dynamic status (from status files) to compute the overall project state.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Go Backend Structure, API Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 - Story 0.4 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/bmm-workflow-status.yaml - Actual status file structure]
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml - Sprint status structure]
- [Source: backend/services/bmad_config.go - Service pattern with mutex and dependencies]
- [Source: backend/services/workflow_path_service.go - Service pattern, error handling]
- [Source: backend/types/workflow_path.go - Phase/Workflow type definitions]
- [Source: backend/api/handlers/bmad.go - Handler pattern reference]
- [Source: 0-3-parse-agent-definitions.md - Previous story patterns and code review fixes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without significant debugging issues.

### Completion Notes List

- Implemented all type definitions in `backend/types/workflow_status.go`:
  - Status value constants (`StatusRequired`, `StatusOptional`, `StatusSkipped`, etc.)
  - Story status constants (`StoryBacklog`, `StoryReadyForDev`, etc.)
  - `WorkflowStatusFile` struct for bmm-workflow-status.yaml parsing
  - `SprintStatusFile` struct for sprint-status.yaml parsing
  - `StatusResponse` struct for API response with all required fields
  - `PhaseCompletionStatus` and `WorkflowCompletionStatus` structs

- Created `WorkflowStatusService` with full functionality:
  - Thread-safe access using `sync.RWMutex`
  - Parses both bmm-workflow-status.yaml and sprint-status.yaml
  - Computes current phase, next workflow, and phase completion percentages
  - Handles missing status files gracefully (returns default state)
  - Properly interprets workflow status values (file paths = complete, keywords = incomplete)

- Updated handler and router:
  - Added `GetStatus` method to `BMadHandler`
  - Updated `NewRouterWithServices` to accept 4th parameter (WorkflowStatusService)
  - Added `GET /api/v1/bmad/status` route

- Comprehensive test coverage:
  - Service tests: parsing, status interpretation, phase computation, missing files, invalid YAML
  - API tests: successful response, default state, service unavailable errors
  - Updated existing handler tests to pass nil for new parameter

### File List

**New files:**
- backend/services/workflow_status_service.go
- backend/services/workflow_status_service_test.go
- backend/tests/api/bmad_status_test.go

**Modified files:**
- backend/types/workflow_status.go
- backend/api/handlers/bmad.go
- backend/api/router.go
- backend/api/handlers/bmad_test.go
- backend/api/handlers/bmad_phases_test.go
- backend/tests/api/bmad_agents_test.go

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-28 | Initial implementation - workflow status service, handler, route, and comprehensive tests | Claude Opus 4.5 |
| 2026-01-28 | Code review fixes: (1) Move GetPhases() call outside RLock for better concurrency, (2) Use strings.ContainsAny for cross-platform path detection (Unix/Windows) | Claude Opus 4.5 |
| 2026-01-28 | Adversarial code review fixes: (1) Fixed IsRequired inconsistency - now uses isWorkflowRequired() helper, (2) Extracted looksLikeFilePath() helper to eliminate DRY violation, (3) Removed unused WorkflowCompletion type, (4) Added Windows path detection test, (5) Added concurrent access test, (6) Added conditional workflow exclusion test | Claude Opus 4.5 |
