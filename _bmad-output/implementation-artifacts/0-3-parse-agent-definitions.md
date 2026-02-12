# Story 0.3: Parse Agent Definitions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **the Go sidecar to parse BMAD agent files**,
so that **the UI can display agent information and menus**.

## Acceptance Criteria

1. **Given** agent files exist in `_bmad/bmm/agents/*.md`, **When** the project is loaded, **Then** all agent files are parsed.

2. **Given** an agent file with YAML frontmatter and embedded XML, **When** parsed, **Then** the following are extracted:
   - From frontmatter: `name`, `description`
   - From XML `<agent>`: `id`, `name` (display name), `title`, `icon`
   - From XML `<persona>`: `role`, `identity`, `communication_style`
   - From XML `<menu>`: list of menu items with `cmd`, `workflow`/`exec` paths

3. **Given** agents are parsed, **When** `GET /api/v1/bmad/agents` is called, **Then** the response includes all agents with their metadata, **And** each agent includes which workflows they can execute.

## Tasks / Subtasks

- [x] Task 1: Define agent types (AC: #1, #2, #3)
  - [x] 1.1 Create `backend/types/agent.go` with types for parsed agent definitions
  - [x] 1.2 Define `AgentFrontmatter` struct with fields: `Name`, `Description` (YAML tags only)
  - [x] 1.3 Define `AgentXML` struct with fields: `ID`, `Name`, `Title`, `Icon`
  - [x] 1.4 Define `PersonaXML` struct with fields: `Role`, `Identity`, `CommunicationStyle`
  - [x] 1.5 Define `MenuItemXML` struct with fields: `Cmd`, `Workflow`, `Exec`, `Content` (text content of item)
  - [x] 1.6 Define `Agent` struct combining frontmatter + XML data with JSON tags using `snake_case`
  - [x] 1.7 Define `MenuItem` struct for API response with resolved paths

- [x] Task 2: Define agent response types (AC: #3)
  - [x] 2.1 Create `AgentResponse` struct for API output
  - [x] 2.2 Create `AgentsResponse` struct as wrapper for list of agents
  - [x] 2.3 Include `workflows` field listing all workflow/exec paths for each agent
  - [x] 2.4 Ensure response types use `snake_case` JSON tags

- [x] Task 3: Create agent service (AC: #1, #2, #3)
  - [x] 3.1 Create `backend/services/agent_service.go` with `AgentService` struct
  - [x] 3.2 Implement `NewAgentService(configService *BMadConfigService)` constructor
  - [x] 3.3 Implement `LoadAgents() error` to scan `_bmad/bmm/agents/*.md` files
  - [x] 3.4 Implement `parseFrontmatter(content []byte) (*AgentFrontmatter, int, error)` to extract YAML frontmatter
  - [x] 3.5 Implement `parseXML(content []byte) (*AgentXML, *PersonaXML, []MenuItemXML, error)` to extract embedded XML within markdown code fence
  - [x] 3.6 Implement `resolveMenuPaths(items []MenuItemXML, projectRoot string) []MenuItem` to replace `{project-root}` in `workflow` and `exec` paths
  - [x] 3.7 Implement `GetAgents() ([]AgentResponse, error)` to return parsed agents
  - [x] 3.8 Implement `GetAgent(id string) (*AgentResponse, error)` to return single agent by ID
  - [x] 3.9 Add `sync.RWMutex` for thread-safe access to agent data

- [x] Task 4: Create agents handler (AC: #3)
  - [x] 4.1 Add `GetAgents(w http.ResponseWriter, r *http.Request)` method to `BMadHandler`
  - [x] 4.2 Handler calls `AgentService.GetAgents()` and returns JSON
  - [x] 4.3 Return appropriate error if agents not loaded (using existing error patterns)
  - [x] 4.4 Optional: Add `GetAgent` handler for `GET /api/v1/bmad/agents/{id}`

- [x] Task 5: Register routes (AC: #3)
  - [x] 5.1 Add `GET /api/v1/bmad/agents` endpoint in `router.go`
  - [x] 5.2 Update `NewRouterWithServices` to accept `AgentService` dependency (third parameter)
  - [x] 5.3 Update `BMadHandler` constructor to accept `AgentService`
  - [x] 5.4 Wire up handler to service

- [x] Task 6: Write unit tests (AC: #1, #2, #3)
  - [x] 6.1 Create `backend/services/agent_service_test.go`
  - [x] 6.2 Test: valid agent files parse correctly with all frontmatter fields
  - [x] 6.3 Test: XML `<agent>` attributes extracted correctly (id, name, title, icon)
  - [x] 6.4 Test: XML `<persona>` fields extracted correctly (role, identity, communication_style)
  - [x] 6.5 Test: XML `<menu>` items extracted with cmd, workflow, exec paths
  - [x] 6.6 Test: `{project-root}` placeholders resolve in workflow and exec paths
  - [x] 6.7 Test: missing agents directory returns appropriate error
  - [x] 6.8 Test: invalid YAML frontmatter returns structured error
  - [x] 6.9 Test: missing XML content returns structured error
  - [x] 6.10 Test: GetAgent returns correct agent by ID
  - [x] 6.11 Create `backend/tests/api/bmad_agents_test.go` (moved to tests/api to avoid import cycle)
  - [x] 6.12 Test: `GET /api/v1/bmad/agents` returns 200 with valid agent list
  - [x] 6.13 Test: `GET /api/v1/bmad/agents` returns error when service not loaded

## Dev Notes

### Architecture Patterns & Constraints

- **Router:** chi/v5 (v5.2.4) - use existing pattern in `router.go`
- **Handler pattern:** Follow existing `BMadHandler` style - struct methods taking `(w http.ResponseWriter, r *http.Request)`
- **Response formatting:** Use `response.WriteJSON(w, statusCode, data)` for success, `response.WriteError(w, statusCode, code, message)` for errors
- **Error codes:** Use snake_case strings (e.g., `"agents_not_found"`, `"invalid_agent_file"`) consistent with existing codes
- **JSON field convention:** All JSON tags must use `snake_case` (e.g., `json:"communication_style"`)
- **Go file naming:** `snake_case.go` (e.g., `agent_service.go`)
- **Go exports:** `PascalCase` for exported types/functions

### Agent File Structure

Agent files are located at: `{projectRoot}/_bmad/bmm/agents/*.md`

**File Format:**
```markdown
---
name: "pm"
description: "Product Manager"
---

You must fully embody this agent's persona...

```xml
<agent id="pm.agent.yaml" name="John" title="Product Manager" icon="📋">
<activation critical="MANDATORY">
  ...
</activation>
<persona>
    <role>Product Manager specializing in...</role>
    <identity>Product management veteran with 8+ years...</identity>
    <communication_style>Asks 'WHY?' relentlessly...</communication_style>
    <principles>...</principles>
</persona>
<menu>
    <item cmd="MH or fuzzy match on menu or help">[MH] Redisplay Menu Help</item>
    <item cmd="CP or fuzzy match on create-prd" exec="{project-root}/_bmad/bmm/workflows/...">[CP] Create PRD</item>
    <item cmd="WS or fuzzy match on workflow-status" workflow="{project-root}/_bmad/bmm/workflows/...">[WS] Get workflow status</item>
</menu>
</agent>
```
```

**Key Points:**
1. YAML frontmatter is delimited by `---` at the start
2. XML is embedded within a markdown code fence (triple backticks with `xml` language)
3. Menu items have either `workflow` OR `exec` attribute (not both)
4. `workflow` paths point to `.yaml` files, `exec` paths point to `.md` files
5. Menu item text content (between tags) is the display label

### XML Parsing Strategy

Since Go's `encoding/xml` requires proper struct tags, use this approach:

1. Extract markdown frontmatter using string split on `---`
2. Find XML content within markdown code fence using regex: `` ```xml\n(.*?)``` ``
3. Parse XML using Go's `encoding/xml` with struct tags

**XML Struct Example:**
```go
type agentXMLRoot struct {
    XMLName xml.Name `xml:"agent"`
    ID      string   `xml:"id,attr"`
    Name    string   `xml:"name,attr"`
    Title   string   `xml:"title,attr"`
    Icon    string   `xml:"icon,attr"`
    Persona personaXML `xml:"persona"`
    Menu    menuXML    `xml:"menu"`
}

type personaXML struct {
    Role               string `xml:"role"`
    Identity           string `xml:"identity"`
    CommunicationStyle string `xml:"communication_style"`
}

type menuXML struct {
    Items []menuItemXML `xml:"item"`
}

type menuItemXML struct {
    Cmd      string `xml:"cmd,attr"`
    Workflow string `xml:"workflow,attr"`
    Exec     string `xml:"exec,attr"`
    Content  string `xml:",chardata"` // Text content between tags
}
```

### API Response Format

`GET /api/v1/bmad/agents` should return:
```json
{
  "agents": [
    {
      "id": "pm.agent.yaml",
      "name": "John",
      "title": "Product Manager",
      "icon": "📋",
      "frontmatter_name": "pm",
      "description": "Product Manager",
      "persona": {
        "role": "Product Manager specializing in collaborative PRD creation...",
        "identity": "Product management veteran with 8+ years...",
        "communication_style": "Asks 'WHY?' relentlessly like a detective..."
      },
      "menu_items": [
        {
          "cmd": "MH or fuzzy match on menu or help",
          "label": "[MH] Redisplay Menu Help",
          "workflow": null,
          "exec": null
        },
        {
          "cmd": "CP or fuzzy match on create-prd",
          "label": "[CP] Create Product Requirements Document (PRD)",
          "workflow": null,
          "exec": "/absolute/path/to/workflow.md"
        },
        {
          "cmd": "WS or fuzzy match on workflow-status",
          "label": "[WS] Get workflow status...",
          "workflow": "/absolute/path/to/workflow.yaml",
          "exec": null
        }
      ],
      "workflows": [
        "/absolute/path/to/workflow.yaml",
        "/absolute/path/to/workflow.md"
      ]
    }
  ]
}
```

### Variable Resolution Logic

Same pattern as Stories 0.1 and 0.2. Replace all `{project-root}` in `workflow` and `exec` fields with absolute project root path using `strings.ReplaceAll`.

### Error Codes for This Service

| Error Code | Condition |
|------------|-----------|
| `agents_not_found` | `_bmad/bmm/agents/` directory doesn't exist or contains no .md files |
| `invalid_agent_file` | YAML frontmatter or XML parsing fails |
| `config_not_loaded` | BMadConfigService has no config (can't determine project root) |
| `agent_not_found` | Requested agent ID doesn't exist (for GetAgent endpoint) |

### Service Dependency Pattern

Follow the established pattern from Stories 0.1 and 0.2:
```go
type AgentService struct {
    mu            sync.RWMutex
    configService *BMadConfigService  // Dependency: needs project root
    agents        map[string]*Agent   // Keyed by agent ID
}

func NewAgentService(configService *BMadConfigService) *AgentService { ... }
func (s *AgentService) LoadAgents() error { ... }
func (s *AgentService) GetAgents() ([]AgentResponse, error) { ... }
func (s *AgentService) GetAgent(id string) (*AgentResponse, error) { ... }
```

### File Scanning Pattern

Use `filepath.Glob` to find all markdown files:
```go
agentFiles, err := filepath.Glob(filepath.Join(agentsDir, "*.md"))
```

### Previous Story Intelligence (Stories 0.1 and 0.2)

**Patterns Established:**
- Service struct with `sync.RWMutex` for thread-safe access
- `NewXxxService()` constructor pattern with configService dependency
- `LoadXxx()` method for loading, `GetXxx()` for retrieval
- Custom error type with `Code` and `Message` fields (e.g., `BMadConfigError`, `WorkflowPathError`)
- Router accepts services via `NewRouterWithServices()` function
- Tests use `os.MkdirTemp` for fixture directories

**Files Modified in Previous Stories:**
- `backend/api/router.go` - Update `NewRouterWithServices` signature to add AgentService
- `backend/api/handlers/bmad.go` - Update constructor, add GetAgents method

**Key Learnings:**
- Added `sync.RWMutex` for thread-safe access after code review (0.1)
- Default track mismatch required careful attention to actual file values (0.2)
- Missing fields caught during code review (0.2) - ensure all YAML/XML fields are captured
- Use pointer types (`*string`) in response structs for optional fields

### Project Structure Notes

**New files:**
- `backend/types/agent.go`
- `backend/services/agent_service.go`
- `backend/services/agent_service_test.go`
- `backend/api/handlers/bmad_agents_test.go`

**Modified files:**
- `backend/api/handlers/bmad.go` (add GetAgents method, update constructor)
- `backend/api/router.go` (add agents route, update NewRouterWithServices signature)

### Testing Notes

- Use Go's standard `testing` package
- Create test fixture agent files using `os.MkdirTemp` and `os.WriteFile`
- Follow table-driven test pattern for multiple scenarios
- Run tests: `cd backend && go test ./...`
- Test XML parsing edge cases: missing attributes, empty elements, special characters in content

### Regex for XML Extraction

To extract XML from markdown code fence:
```go
import "regexp"

var xmlCodeFenceRegex = regexp.MustCompile("(?s)```xml\\s*\\n(.*?)```")

func extractXML(content []byte) ([]byte, error) {
    matches := xmlCodeFenceRegex.FindSubmatch(content)
    if len(matches) < 2 {
        return nil, fmt.Errorf("no XML code fence found")
    }
    return matches[1], nil
}
```

### Frontmatter Parsing

```go
import "bytes"

func parseFrontmatter(content []byte) (*AgentFrontmatter, int, error) {
    // Check for frontmatter delimiter
    if !bytes.HasPrefix(content, []byte("---\n")) {
        return nil, 0, fmt.Errorf("no frontmatter found")
    }

    // Find closing delimiter
    endIdx := bytes.Index(content[4:], []byte("\n---"))
    if endIdx == -1 {
        return nil, 0, fmt.Errorf("frontmatter not closed")
    }

    frontmatterBytes := content[4 : 4+endIdx]
    var fm AgentFrontmatter
    if err := yaml.Unmarshal(frontmatterBytes, &fm); err != nil {
        return nil, 0, err
    }

    // Return end position (after closing ---)
    return &fm, 4 + endIdx + 4, nil
}
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Go Backend Structure, API Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 - Story 0.3 acceptance criteria]
- [Source: _bmad-output/project-context.md - Technology stack rules, Go naming conventions]
- [Source: _bmad/bmm/agents/pm.md - Agent file structure example]
- [Source: _bmad/bmm/agents/dev.md - Agent file structure example]
- [Source: backend/services/bmad_config.go - Service pattern with mutex]
- [Source: backend/services/workflow_path_service.go - Service pattern, error handling]
- [Source: backend/types/bmad.go - Type definition pattern with JSON/YAML tags]
- [Source: backend/api/handlers/bmad.go - Handler pattern reference]
- [Source: 0-2-parse-workflow-path-definitions.md - Previous story patterns and learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Implemented full agent parsing service following TDD approach (red-green-refactor)
- Created AgentService with thread-safe access using sync.RWMutex
- Implemented YAML frontmatter parsing using gopkg.in/yaml.v3
- Implemented XML extraction from markdown code fences using regex
- Implemented XML parsing using encoding/xml with struct tags
- Implemented {project-root} variable resolution in workflow/exec paths
- Added GetAgents and GetAgent handlers to BMadHandler
- Updated router to accept AgentService as third parameter
- Created comprehensive unit tests covering all acceptance criteria
- All 17 tests pass (14 original + 3 new from code review), plus 45+ existing tests continue to pass
- Updated existing bmad_test.go and bmad_phases_test.go to use new handler constructor signature

### Code Review Fixes (Gemini Review)

**HIGH Severity Fixed:**
1. Non-deterministic API Response - Added `sort.Strings(workflows)` for consistent ordering
2. Fault Tolerance - Service now logs errors and continues loading other valid agents instead of failing on first error

**MEDIUM Severity Fixed:**
3. Duplicate Agent ID Detection - Now checks for and logs duplicate IDs, skipping subsequent duplicates
4. Brittle Frontmatter Parsing - Dynamically finds newlines instead of hardcoded byte offsets (handles CRLF)
5. Empty ID Validation - Added check for empty agent IDs

**LOW Severity Fixed:**
6. Path Separator Normalization - Added `filepath.Clean()` for cross-platform path handling

**New Tests Added:**
- TestAgentService_LoadAgents_FaultTolerance
- TestAgentService_LoadAgents_DuplicateIDsSkipped
- TestAgentService_LoadAgents_WorkflowsSorted

### Change Log

- 2026-01-28: Code Review Fixes (Gemini)
  - Fixed non-deterministic workflows array ordering
  - Added fault tolerance for malformed agent files
  - Added duplicate ID detection
  - Fixed brittle frontmatter parsing
  - Added empty ID validation
  - Added filepath.Clean for path normalization
  - Added 3 new tests for new behaviors

- 2026-01-28: Implemented Story 0.3 - Parse Agent Definitions
  - Created agent type definitions
  - Implemented AgentService with parsing logic
  - Added API endpoints for agents
  - Wrote comprehensive test suite

### File List

**New Files:**
- backend/types/agent.go
- backend/services/agent_service.go
- backend/services/agent_service_test.go
- backend/tests/api/bmad_agents_test.go

**Modified Files:**
- backend/api/handlers/bmad.go (added GetAgents, GetAgent handlers, updated constructor)
- backend/api/router.go (added agents routes, updated NewRouterWithServices signature)
- backend/api/handlers/bmad_test.go (updated constructor calls)
- backend/api/handlers/bmad_phases_test.go (updated constructor calls)

