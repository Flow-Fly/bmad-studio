# Story 0.5: Build Artifact Registry

Status: done

## TL;DR - Quick Reference

**Create these files:**
- `backend/types/artifact.go` - Type definitions
- `backend/services/artifact_service.go` - Service with LoadArtifacts/GetArtifacts
- `backend/api/handlers/artifacts.go` - Handler for routes
- `backend/services/artifact_service_test.go` - Service tests
- `backend/tests/api/artifacts_test.go` - API tests

**Modify these files:**
- `backend/api/router.go` - Add 5th parameter, register `/api/v1/bmad/artifacts` routes

**Critical patterns:**
- Route: `/api/v1/bmad/artifacts` (under bmad group, NOT `/api/v1/artifacts`)
- Registry: `{OutputFolder}/artifact-registry.json` (local, not ~/bmad-studio)
- stepsCompleted: Handle BOTH `[]string` AND `[]int` formats
- Reuse frontmatter parsing from `agent_service.go`

**Gotchas:**
- product-brief*.md and *validation*.md need their own types
- Sharded artifacts use `index.md` as primary, others as children
- Skip `*status.yaml` files (not artifacts)

---

## Story

As a **developer**,
I want **an artifact registry that indexes all documents in `_bmad-output/`**,
so that **the UI can display artifacts with their metadata and the LLM never guesses paths**.

## Acceptance Criteria

1. **Given** `_bmad-output/` contains markdown files, **When** the project is loaded, **Then** all `.md` files are scanned and indexed.

2. **Given** a markdown file with YAML frontmatter, **When** indexed, **Then** the following are extracted:
   - `status`: in-progress or complete
   - `stepsCompleted`: array of completed workflow steps (strings OR integers)
   - `completedAt`: completion date
   - `inputDocuments`: array of source documents
   - `workflowType`: which workflow created this

3. **Given** files are indexed, **Then** artifacts are classified using multi-layer strategy:
   1. Frontmatter `workflowType` field (highest priority)
   2. Filename patterns (fallback)
   3. Cross-reference with `bmm-workflow-status.yaml` paths

4. **Given** a sharded artifact (e.g., `ux-design-specification/`), **When** indexed, **Then** the index file is the primary artifact, **And** shards are listed as children.

5. **Given** the registry is built, **When** `GET /api/v1/bmad/artifacts` is called, **Then** the response includes all artifacts with:
   - `id`, `name`, `type`, `path`, `status`, `completed_at`
   - `phase`, `phase_name` (which BMAD phase this belongs to)
   - `workflow_id` (which workflow produced it)

6. **Given** the registry is built, **Then** it is persisted to `{OutputFolder}/artifact-registry.json`.

## Tasks / Subtasks

- [x] Task 1: Define artifact types (AC: #2, #3, #5)
  - [x] 1.1 Create `backend/types/artifact.go`
  - [x] 1.2 Define `ArtifactFrontmatter` struct
  - [x] 1.3 Define `ArtifactType` constants
  - [x] 1.4 Define `Artifact` internal struct
  - [x] 1.5 Define `ArtifactResponse` struct with JSON tags (snake_case)
  - [x] 1.6 Define `ArtifactsResponse` wrapper: `Artifacts []ArtifactResponse`

- [x] Task 2: Define artifact classification logic (AC: #3)
  - [x] 2.1 Define `classifyByFilename(path string) string`
  - [x] 2.2 Define `classifyByFrontmatter(fm *ArtifactFrontmatter) string`
  - [x] 2.3 Define `classifyArtifact(path string, fm *ArtifactFrontmatter) string`
  - [x] 2.4 Define `getPhaseInfo(artifactType string) (int, string)`

- [x] Task 3: Create artifact service (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Create `backend/services/artifact_service.go`
  - [x] 3.2 Implement `NewArtifactService(cs, wss)`
  - [x] 3.3 Implement `LoadArtifacts() error`
  - [x] 3.4 Implement `processArtifact(path, projectRoot string) (*types.Artifact, error)`
  - [x] 3.5 Implement `processShardedArtifact(dirPath, projectRoot string) (*types.Artifact, error)`
  - [x] 3.6 Implement `parseFrontmatter(filePath string) (*types.ArtifactFrontmatter, error)`
  - [x] 3.7 Implement `normalizeStepsCompleted(raw interface{}) []string`
  - [x] 3.8 Implement `extractName(path string, fm *ArtifactFrontmatter, content []byte) string`
  - [x] 3.9 Implement `generateArtifactID(relativePath string) string`
  - [x] 3.10 Implement `crossReferenceWithWorkflowStatus(artifacts map[string]*types.Artifact)`
  - [x] 3.11 Implement `GetArtifacts() ([]types.ArtifactResponse, error)`
  - [x] 3.12 Implement `GetArtifact(id string) (*types.ArtifactResponse, error)`
  - [x] 3.13 Define `ArtifactServiceError` with codes

- [x] Task 4: Implement registry persistence (AC: #6)
  - [x] 4.1 Implement `getRegistryPath() string`
  - [x] 4.2 Implement `SaveRegistry() error`
  - [x] 4.3 Implement `LoadRegistry() error`

- [x] Task 5: Create artifact handler (AC: #5)
  - [x] 5.1 Create `backend/api/handlers/artifacts.go`
  - [x] 5.2 Implement `ArtifactHandler` struct with `artifactService`
  - [x] 5.3 Implement `NewArtifactHandler(as *services.ArtifactService)`
  - [x] 5.4 Implement `GetArtifacts(w, r)` → 200 with ArtifactsResponse
  - [x] 5.5 Implement `GetArtifact(w, r)`: 200 with ArtifactResponse or 404

- [x] Task 6: Register routes (AC: #5)
  - [x] 6.1 Update `NewRouterWithServices` signature: add `artifactService *services.ArtifactService` as 5th param
  - [x] 6.2 Inside bmad route group, add artifact routes
  - [x] 6.3 Update all existing tests to pass nil for new parameter

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1 Create `backend/services/artifact_service_test.go`
  - [x] 7.2 Test: LoadArtifacts scans recursively
  - [x] 7.3 Test: frontmatter with stepsCompleted as []string
  - [x] 7.4 Test: frontmatter with stepsCompleted as []int (Architecture format)
  - [x] 7.5 Test: classification by filename patterns (all types)
  - [x] 7.6 Test: classification by workflowType frontmatter
  - [x] 7.7 Test: sharded artifact detection and parent-child linking
  - [x] 7.8 Test: missing frontmatter handled gracefully
  - [x] 7.9 Test: invalid YAML logged and skipped
  - [x] 7.10 Test: GetArtifacts returns sorted list
  - [x] 7.11 Test: GetArtifact returns correct artifact
  - [x] 7.12 Test: GetArtifact returns error for unknown ID
  - [x] 7.13 Test: registry persistence round-trip
  - [x] 7.14 Test: concurrent access safety (parallel GetArtifacts)
  - [x] 7.15 Test: crossReferenceWithWorkflowStatus sets WorkflowID
  - [x] 7.16 Create `backend/tests/api/artifacts_test.go`
  - [x] 7.17 Test: `GET /api/v1/bmad/artifacts` returns 200
  - [x] 7.18 Test: `GET /api/v1/bmad/artifacts/{id}` returns 200 for valid ID
  - [x] 7.19 Test: `GET /api/v1/bmad/artifacts/{id}` returns 404 for invalid ID
  - [x] 7.20 Test: empty artifact list returns `{"artifacts": []}`

## Dev Notes

### Architecture Constraints

| Constraint | Value |
|------------|-------|
| Router | chi/v5 (v5.2.4) |
| YAML parsing | `gopkg.in/yaml.v3` |
| Route base | `/api/v1/bmad/artifacts` (inside bmad group) |
| JSON fields | snake_case |
| Go files | snake_case.go |
| Error codes | snake_case strings |

### Artifact Directory Structure

```
_bmad-output/
├── project-context.md                    # ProjectContext
├── automation-summary.md                 # Other
├── artifact-registry.json                # Registry (output of this story)
├── planning-artifacts/
│   ├── product-brief-bmad-studio.md      # ProductBrief
│   ├── prd.md                            # PRD
│   ├── prd-validation-report.md          # ValidationReport
│   ├── architecture.md                   # Architecture
│   ├── epics.md                          # Epics
│   ├── bmm-workflow-status.yaml          # SKIP (status file)
│   ├── research/                         # Sharded
│   │   ├── index.md                      # Primary (Research)
│   │   └── *.md                          # Children
│   └── ux-design-specification/          # Sharded
│       ├── index.md                      # Primary (UXDesign)
│       └── *.md                          # Children
└── implementation-artifacts/
    ├── sprint-status.yaml                # SKIP (status file)
    ├── 0-1-parse-bmad-configuration.md   # Stories
    └── 0-5-build-artifact-registry.md    # Stories (this story!)
```

### Frontmatter Variations

**Type 1 - String steps (PRD, UX):**
```yaml
stepsCompleted:
  - step-01-init
  - step-02-discovery
workflowType: 'prd'
status: 'complete'
```

**Type 2 - Integer steps (Architecture):**
```yaml
stepsCompleted: [1, 2, 3, 4, 5]
workflowType: 'architecture'
status: complete
```

**Type 3 - No frontmatter (Stories):**
```markdown
# Story 0.5: Build Artifact Registry
Status: ready-for-dev
...
```

### Cross-Reference Logic

```go
func (s *ArtifactService) crossReferenceWithWorkflowStatus(artifacts map[string]*types.Artifact) {
    if s.workflowStatusService == nil {
        return
    }

    status, err := s.workflowStatusService.GetStatus()
    if err != nil || status == nil {
        return
    }

    for workflowID, wfStatus := range status.WorkflowStatuses {
        if !wfStatus.IsComplete || wfStatus.ArtifactPath == nil {
            continue
        }

        // Normalize path: strip _bmad-output/ prefix
        artifactPath := strings.TrimPrefix(*wfStatus.ArtifactPath, "_bmad-output/")

        // Find matching artifact by path
        for _, artifact := range artifacts {
            if strings.HasSuffix(artifact.Path, artifactPath) {
                artifact.WorkflowID = &workflowID
                break
            }
        }
    }
}
```

### API Response Format

**GET /api/v1/bmad/artifacts:**
```json
{
  "artifacts": [
    {
      "id": "planning-artifacts-prd",
      "name": "Product Requirements Document",
      "type": "prd",
      "path": "_bmad-output/planning-artifacts/prd.md",
      "status": "complete",
      "completed_at": "2026-01-27",
      "phase": 2,
      "phase_name": "Planning",
      "workflow_id": "prd",
      "steps_completed": ["step-01-init", "step-02-discovery"],
      "input_documents": ["_bmad-output/planning-artifacts/product-brief.md"],
      "is_sharded": false,
      "children": null,
      "parent_id": null,
      "modified_at": 1706400000,
      "file_size": 45678
    }
  ]
}
```

### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `config_not_loaded` | 503 | ConfigService has no config |
| `artifacts_not_loaded` | 503 | LoadArtifacts() not called |
| `artifact_not_found` | 404 | Unknown artifact ID |

### Previous Story Patterns to Follow

From stories 0.1-0.4:
- `sync.RWMutex` for thread safety
- `NewXxxService(deps)` constructor
- `LoadXxx()` then `GetXxx()` pattern
- Custom error type with `Code`/`Message`
- `t.TempDir()` for test fixtures
- `sort.Strings()` for deterministic output
- Log and continue on parse errors
- `filepath.Clean()` for cross-platform paths
- Move expensive ops outside locks (0.4)
- Extract helpers to avoid DRY violations (0.4)

### Files to Modify (Test Updates)

Add nil for 5th parameter in:
- `backend/api/handlers/bmad_test.go`
- `backend/api/handlers/bmad_phases_test.go`
- `backend/tests/api/bmad_agents_test.go`
- `backend/tests/api/bmad_status_test.go`

### References

- [Source: backend/services/agent_service.go:223-263 - Frontmatter parsing pattern]
- [Source: backend/api/router.go:63-72 - BMAD route group pattern]
- [Source: backend/types/bmad.go - BMadConfig with OutputFolder field]
- [Source: 0-4-read-workflow-status-files.md - Service patterns, concurrent access]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All tests pass: `go test ./... -count=1`

### Completion Notes List

- Implemented artifact registry service with full frontmatter parsing
- Supports both string and integer stepsCompleted formats
- Classification uses multi-layer strategy: frontmatter > filename patterns
- Sharded artifact support with parent-child relationships
- Registry persisted to `{OutputFolder}/artifact-registry.json` with atomic writes
- Cross-references with workflow status to set WorkflowID
- Thread-safe with sync.RWMutex
- Fault-tolerant: logs and continues on parse errors
- 30+ unit tests covering all acceptance criteria
- 5 API integration tests

**Post-Review Fixes (2026-01-28):**
- Children of sharded artifacts are now queryable as separate artifacts
- ParentID is now properly set on child artifacts
- Added bounds check in parseFrontmatter for files < 3 bytes
- Added path traversal protection in LoadRegistry
- Replaced deprecated `strings.Title` with custom `toTitleCase` helper

### File List

**New Files:**
- `backend/types/artifact.go` - Type definitions for artifacts
- `backend/services/artifact_service.go` - Service implementation
- `backend/api/handlers/artifacts.go` - HTTP handlers
- `backend/services/artifact_service_test.go` - Service unit tests
- `backend/tests/api/artifacts_test.go` - API integration tests

**Modified Files:**
- `backend/api/router.go` - Added 5th parameter and artifact routes
- `backend/tests/api/bmad_agents_test.go` - Updated router calls with nil
- `backend/tests/api/bmad_status_test.go` - Updated router calls with nil

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-28 | Implemented artifact registry service, types, handlers, routes, and tests | Claude Opus 4.5 |
| 2026-01-28 | Fixed: sharded children queryable, ParentID set, frontmatter bounds check, path traversal protection, deprecated strings.Title | Claude Opus 4.5 |
