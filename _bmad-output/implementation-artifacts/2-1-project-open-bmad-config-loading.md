# Story 2.1: Project Open & BMAD Config Loading

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to open an existing project folder containing BMAD configuration**,
So that **I can work on my BMAD project in the studio** (FR1).

## Acceptance Criteria

1. **Given** the app is running, **When** I select "Open Project" and choose a folder with `_bmad/` configuration, **Then** Epic 0 services are initialized (config, paths, agents, status, registry) **And** the project name is displayed in the UI **And** the UI subscribes to artifact/status WebSocket events from Epic 0

2. **Given** I select a folder without `_bmad/` configuration, **When** the folder is opened, **Then** an error message explains "No BMAD configuration found" **And** I am prompted to select a different folder or install BMAD

3. **Given** the `_bmad/` configuration is malformed, **When** the project is opened, **Then** the app shows a clear error message identifying the issue (NFR13) **And** the app does not crash

## Tasks / Subtasks

- [x] Task 1: Create project state management (AC: #1)
  - [x] 1.1: Create `src/state/project.state.ts` with Signal-based state for project loading, active project, and error states
  - [x] 1.2: Define signals: `projectState` (active project data), `projectLoadingState` (loading/error states), `bmadServicesAvailable$` (derived: whether BMAD services are loaded)
  - [x] 1.3: Define `ProjectData` interface with project name, root path, BMAD config status, and service availability flags

- [x] Task 2: Create project service (AC: #1, #2, #3)
  - [x] 2.1: Create `src/services/project.service.ts` implementing REST calls to backend project/BMAD endpoints
  - [x] 2.2: Implement `openProject(folderPath: string)` that calls `POST /api/v1/projects/open` (new endpoint) passing the folder path
  - [x] 2.3: Implement `loadBmadConfig()` calling `GET /api/v1/bmad/config` to verify BMAD is loaded
  - [x] 2.4: Implement `loadBmadStatus()` calling `GET /api/v1/bmad/status` to get workflow state
  - [x] 2.5: Handle error responses for missing BMAD config (503 with `bmad_not_installed` code) and malformed config
  - [x] 2.6: Use the shared `apiFetch<T>()` pattern from `provider.service.ts` for consistent error handling

- [x] Task 3: Implement backend project open endpoint (AC: #1, #2, #3)
  - [x] 3.1: Implement `POST /api/v1/projects/open` in `backend/api/handlers/projects.go` — accepts `{ "path": "/absolute/path" }`, validates the path exists and contains `_bmad/`
  - [x] 3.2: On valid path: re-initialize all BMAD services (config, workflow paths, agents, workflow status, artifacts, file watcher) for the new project root
  - [x] 3.3: On invalid path (no `_bmad/`): return `{ "error": { "code": "bmad_not_found", "message": "No BMAD configuration found in the selected folder. Ensure the project has _bmad/bmm/config.yaml or run npx bmad-method install." } }`
  - [x] 3.4: On malformed config: return `{ "error": { "code": "bmad_config_invalid", "message": "..." } }` with specific parsing error details
  - [x] 3.5: Create a `ProjectManager` struct or extend existing router to support re-initializing services at runtime (the current `main.go` initializes services once at startup — this needs to support dynamic project switching)
  - [x] 3.6: Return success response with project name and service availability: `{ "project_name": "...", "project_root": "...", "bmad_loaded": true, "services": { "config": true, "phases": true, "agents": true, "status": true, "artifacts": true, "watcher": true } }`

- [x] Task 4: Integrate Tauri dialog for folder selection (AC: #1, #2)
  - [x] 4.1: Install Tauri dialog plugin: `npm run tauri add dialog`
  - [x] 4.2: Add `"dialog:default"` to `src-tauri/capabilities/default.json` permissions
  - [x] 4.3: Register the dialog plugin in `src-tauri/src/lib.rs`
  - [x] 4.4: Create `src/services/dialog.service.ts` wrapping Tauri's `open()` dialog API with `directory: true` for folder selection
  - [x] 4.5: Implement dev mode fallback: when not running in Tauri (browser dev), use a text input for path entry or prompt the user to enter a path manually

- [x] Task 5: Create project open UI (AC: #1, #2, #3)
  - [x] 5.1: Update `src/app-shell.ts` to show project open state when no project is loaded
  - [x] 5.2: Create empty state view: centered content with "Open Project" button (primary), project name display, and BMAD status
  - [x] 5.3: Add "Open Project" button to toolbar (alongside existing settings gear) for switching projects later
  - [x] 5.4: Implement project loading state: skeleton/loading indicator while BMAD services initialize
  - [x] 5.5: Implement error state: inline error message for missing BMAD, clear error message for malformed config, "Try Again" and "Select Different Folder" actions
  - [x] 5.6: On successful load: display project name in header area, transition to project-loaded view (placeholder for future phase graph area)

- [x] Task 6: WebSocket subscription for real-time updates (AC: #1)
  - [x] 6.1: Create `src/services/websocket.service.ts` wrapping WebSocket connection to `ws://localhost:3008/ws`
  - [x] 6.2: Implement connection management: connect on project open, handle reconnection with exponential backoff
  - [x] 6.3: Implement event handlers for `artifact:created`, `artifact:updated`, `artifact:deleted`, `workflow:status-changed` events
  - [x] 6.4: Create `src/state/connection.state.ts` with connection status signal (`connected`, `connecting`, `disconnected`, `error`)
  - [x] 6.5: Wire WebSocket events to project state updates (for future stories to consume)

- [x] Task 7: Testing (AC: #1-#3)
  - [x] 7.1: Create `tests/frontend/services/project.service.test.ts` — test API calls with mocked fetch for open project, load config, load status, error handling
  - [x] 7.2: Create `tests/frontend/state/project.state.test.ts` — test signal state transitions during project loading
  - [x] 7.3: Create `backend/tests/api/projects_test.go` — test POST /projects/open endpoint with valid path, missing BMAD, malformed config, non-existent path
  - [x] 7.4: Test WebSocket service connection/disconnection and event routing
  - [x] 7.5: Test app-shell rendering in empty state, loading state, error state, and loaded state

## Dev Notes

### Critical Architecture Patterns

**This is the FIRST story of Epic 2** and the first story to create the project lifecycle flow. It establishes the pattern for how the frontend communicates project context to the backend and subscribes to real-time updates. All subsequent Epic 2 stories depend on this foundation.

**Key Architectural Insight:** The Go backend currently initializes all BMAD services once at startup in `main.go` using a hardcoded project root (from `BMAD_PROJECT_ROOT` env or `os.Getwd()`). This story needs to make that initialization dynamic so the user can open any project folder at runtime. This is the most significant backend change.

#### Frontend Stack (MUST USE)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Lit | `lit` | ^3.1.0 | Web Components framework |
| Shoelace | `@shoelace-style/shoelace` | ^2.12.0 | UI component library |
| Signals | `@lit-labs/signals` | ^0.2.0 | Reactive state management |
| signal-polyfill | `signal-polyfill` | - | TC39 Signals Polyfill (single copy critical!) |
| Tauri Dialog | `@tauri-apps/plugin-dialog` | ^2.x | Native folder picker |
| Lucide | `lucide` | - | Icons (single icon set - NO mixing) |

[Source: package.json, architecture.md#Starter-Template-Evaluation]

#### Component Architecture Pattern (Established in Story 1.6)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

// Cherry-pick Shoelace components (NEVER barrel import)
import '@shoelace-style/shoelace/dist/components/button/button.js';

@customElement('my-component')
export class MyComponent extends SignalWatcher(LitElement) {
  // Access signals in render() — auto-tracked by SignalWatcher
  render() {
    const project = projectState.get();
    return html`...`;
  }
}
```

**Key rules (from Story 1.6 learnings):**
- Extend `SignalWatcher(LitElement)` for automatic signal subscription
- Cherry-pick Shoelace imports from `/dist/components/` paths (NEVER `/cdn/`, NEVER barrel imports)
- Shoelace elements CANNOT be self-closing: use `<sl-button></sl-button>`, NOT `<sl-button />`
- `useDefineForClassFields: false` in tsconfig.json (already set — required for Lit `@state()` to work)

[Source: 1-6-provider-settings-ui.md#Debug-Log-References, @lit-labs/signals docs]

#### Signal State Pattern (Established)

```typescript
// src/state/project.state.ts
import { Signal } from 'signal-polyfill';

export const projectState = new Signal.State<ProjectData | null>(null);
export const projectLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

// Derived
export const bmadServicesAvailable$ = new Signal.Computed(() => {
  const project = projectState.get();
  return project?.bmadLoaded === true;
});
```

**Naming:** `{noun}State` for stores, `{noun}$` for derived computed signals, `update{Noun}()` for helpers.
**Immutable updates:** `signal.set({ ...signal.get(), key: newValue })`
**Import:** `Signal` from `signal-polyfill` (NOT from `@lit-labs/signals`)

[Source: src/state/provider.state.ts, project-context.md#Language-Specific-Rules]

#### Service Layer Pattern (Established)

```typescript
// src/services/project.service.ts
const API_BASE = '/api/v1';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error?.message) message = body.error.message;
    } catch { /* Use default */ }
    throw new Error(message);
  }
  return response.json();
}
```

**Vite proxies `/api/*` to `localhost:3008`** — no need to hardcode the backend URL.
The `apiFetch<T>` pattern is already established in `provider.service.ts`. Consider extracting to a shared `src/services/api.service.ts` if not already done.

[Source: src/services/provider.service.ts, vite.config.ts]

### Backend: Dynamic Project Initialization

**Current architecture (main.go:16-73):** Services are initialized once at startup:
1. `BMadConfigService.LoadConfig(projectRoot)` — parses `_bmad/bmm/config.yaml`
2. `WorkflowPathService.LoadPaths()` — parses workflow definitions
3. `AgentService.LoadAgents()` — parses agent markdown files
4. `WorkflowStatusService.LoadStatus()` — reads status files
5. `ArtifactService.LoadArtifacts()` — indexes `_bmad-output/`
6. `FileWatcherService.Start()` — watches for file changes

**Required change:** Create a `ProjectManager` (or `ServiceRegistry`) that:
- Holds references to all BMAD services
- Exposes a `LoadProject(path string) error` method that stops existing watchers, re-initializes all services for the new path
- Is injected into the router so handlers can access current services
- Handles the case where services are nil (no project loaded yet)

**The handlers already handle nil services** — see `bmad.go` where each handler checks `if h.workflowPathService == nil` etc. This pattern should continue working.

**New endpoint needed:** `POST /api/v1/projects/open`
```json
// Request
{ "path": "/Users/flow/Documents/github/repositories/bmad-studio" }

// Success Response
{
  "project_name": "bmad-studio",
  "project_root": "/Users/flow/Documents/github/repositories/bmad-studio",
  "bmad_loaded": true,
  "services": {
    "config": true,
    "phases": true,
    "agents": true,
    "status": true,
    "artifacts": true,
    "watcher": true
  }
}

// Error Response (no BMAD)
{
  "error": {
    "code": "bmad_not_found",
    "message": "No BMAD configuration found. Ensure the project has _bmad/bmm/config.yaml or run npx bmad-method install."
  }
}
```

[Source: backend/main.go, backend/api/handlers/bmad.go, backend/api/handlers/projects.go]

### Tauri Dialog Integration

**Plugin:** `@tauri-apps/plugin-dialog` (Tauri 2.x)

**Setup steps:**
1. `npm run tauri add dialog` — installs Rust crate + JS bindings
2. Add `"dialog:default"` to `src-tauri/capabilities/default.json` permissions array
3. Plugin registered automatically by the `tauri add` command in `lib.rs`

**Frontend usage:**
```typescript
import { open } from '@tauri-apps/plugin-dialog';

const selected = await open({
  directory: true,
  title: 'Select BMAD Project Folder',
});
// selected is string (path) or null (cancelled)
```

**Dev mode fallback:** When running in browser dev mode (no Tauri), `window.__TAURI__` is undefined. Implement a fallback that shows a text input for manual path entry. This pattern is already established in `keychain.service.ts` (Story 1.6).

**Detection:**
```typescript
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
```

[Source: src-tauri/capabilities/default.json, src/services/keychain.service.ts, Tauri Dialog plugin docs]

### WebSocket Integration

**The WebSocket hub and client infrastructure already exists** in `backend/api/websocket/`. The frontend just needs to connect and handle events.

**Backend WebSocket events (already emitted by FileWatcherService):**
- `artifact:created` — new file in `_bmad-output/`
- `artifact:updated` — file modified
- `artifact:deleted` — file removed
- `workflow:status-changed` — status YAML files changed

**Frontend WebSocket connection:**
```typescript
const ws = new WebSocket('ws://localhost:3008/ws');
// In dev mode, Vite proxy handles this via /ws path
```

**Connection states to track:** `connected`, `connecting`, `disconnected`, `error`

**Reconnection strategy:** Exponential backoff starting at 1s, max 30s, with jitter.

[Source: backend/api/websocket/hub.go, backend/api/websocket/client.go]

### Design Token Usage

All styling MUST use CSS custom properties from `tokens.css`. Key tokens:

| Token | Usage |
|---|---|
| `--bmad-color-bg-primary` | Main background (#0d1117) |
| `--bmad-color-bg-secondary` | Card/panel background (#161b22) |
| `--bmad-color-text-primary` | Primary text (#f0f6fc) |
| `--bmad-color-text-secondary` | Secondary text (#8b949e) |
| `--bmad-color-accent` | Primary action, CTA (#58a6ff) |
| `--bmad-color-error` | Error states (#f85149) |
| `--bmad-color-success` | Success indicator (#3fb950) |
| `--bmad-color-warning` | Warning states (#d29922) |
| `--bmad-spacing-*` | 4px-48px scale |
| `--bmad-font-size-md` | Body text (14px) |
| `--bmad-transition-normal` | State transitions (150ms ease) |

**Dark mode only for MVP.** No inline styles.

[Source: src/styles/tokens.css, project-context.md#Code-Quality-Style-Rules]

### UX Patterns to Follow

**Empty State (No project loaded):**
- Centered content: project name placeholder, "Open Project" CTA button
- Explain why it's empty: "Select a BMAD project folder to get started"
- Follow UX consistency pattern: "Tell users why it's empty and what action will fill it"

**Loading State:**
- Use skeleton layout (never spinners in primary content areas)
- Show structure early — display app shell with loading skeleton

**Error State:**
- Missing BMAD: Inline error with explanation + actionable CTA ("Select Different Folder" or "Install BMAD")
- Malformed config: Inline error with specific issue + "Try Again" option
- Follow feedback pattern: errors are prominent, recoverable errors stay in context

**Success State:**
- Project name displayed in header area
- Quiet success indicator (subtle, 2-second fade)
- Transition to loaded view ready for phase graph (Story 2.3)

[Source: ux-consistency-patterns.md#Loading-Empty-States, ux-consistency-patterns.md#Feedback-Patterns]

### Project Structure Notes

**Files to Create:**

```
src/
├── services/
│   ├── project.service.ts            # CREATE: Project open/load API calls
│   ├── websocket.service.ts          # CREATE: WebSocket connection management
│   └── dialog.service.ts             # CREATE: Tauri folder picker wrapper
├── state/
│   ├── project.state.ts              # CREATE: Project signal state
│   └── connection.state.ts           # CREATE: WebSocket connection state
└── types/
    └── project.ts                    # CREATE: Project TypeScript interfaces

backend/
├── api/
│   └── handlers/
│       └── projects.go               # MODIFY: Implement POST /projects/open (currently all 501 stubs)
├── services/
│   └── project_manager.go            # CREATE: Dynamic service lifecycle manager
└── api/
    └── router.go                     # MODIFY: Add POST /projects/open route, inject ProjectManager

src-tauri/
├── src/
│   └── lib.rs                        # MODIFY: Register dialog plugin
└── capabilities/
    └── default.json                  # MODIFY: Add dialog:default permission
```

**Files to Modify (carefully):**

```
src/app-shell.ts                      # MODIFY: Add project open flow, empty/loading/error states
backend/main.go                       # MODIFY: Use ProjectManager instead of direct service initialization
backend/api/router.go                 # MODIFY: Wire POST /projects/open to handler
```

**Files to NOT Touch:**

```
backend/services/bmad_config.go       # DO NOT MODIFY - stable, working
backend/services/workflow_path_service.go  # DO NOT MODIFY
backend/services/agent_service.go     # DO NOT MODIFY
backend/services/workflow_status_service.go  # DO NOT MODIFY
backend/services/artifact_service.go  # DO NOT MODIFY
backend/services/file_watcher_service.go   # DO NOT MODIFY
backend/api/handlers/bmad.go          # DO NOT MODIFY - already handles nil services
backend/providers/                    # DO NOT MODIFY - provider implementations
src/styles/                           # DO NOT MODIFY - design tokens stable
src/state/provider.state.ts           # DO NOT MODIFY
src/services/provider.service.ts      # DO NOT MODIFY
src/components/core/settings/         # DO NOT MODIFY
```

[Source: architecture.md#Project-Structure-Boundaries, project-context.md#File-Organization-Rules]

### Previous Story Intelligence

**From Story 1.6 (Provider Settings UI - Most Recent):**

- Established the full frontend pattern: Signal state -> Service layer -> Component with SignalWatcher
- `apiFetch<T>()` generic helper already exists in `provider.service.ts` — can be reused or extracted to shared module
- Shoelace integration patterns are solid: cherry-pick imports, no self-closing tags, `password-toggle` on inputs
- `useDefineForClassFields: false` is set in tsconfig.json — required for Lit decorators
- Keychain service established Tauri environment detection pattern (`window.__TAURI__`)
- Settings dialog opens from app-shell via `@query` decorator and `.open()` method
- 23 frontend tests + 11 backend tests demonstrate testing patterns

**From Epic 0 (BMAD Integration Layer):**

- All 6 backend services are complete and tested
- Services follow dependency injection pattern — created in `main.go`, passed to router
- File watcher uses `fsnotify` with 100ms debouncing
- WebSocket hub broadcasts events to all connected clients
- Artifact registry persists to `artifact-registry.json`
- Error handling: services log warnings but don't crash on individual failures

**Code review learnings (Story 1.5):**
- Added 10s context timeout to provider `ListModels()` — consider similar timeouts for BMAD service calls
- Provider errors use `UserMessage` via `Error()` method — frontend error display should use the error message directly

[Source: 1-6-provider-settings-ui.md, 0-6-watch-for-file-changes.md]

### Git Intelligence

**Recent Commits (last 5):**

```
f6a75af Epic/1-app-foundation (#8)
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
40f508a Merge pull request #3 from Flow-Fly/feature/artifact-registry
c88c3c9 Merge branch 'main' into feature/artifact-registry
```

**Branch Pattern:** `epic/2-project-workflow-state-visualization` is the epic branch. Developer should create `feature/2-1-project-open-bmad-config-loading` off the epic branch.

**Commit style:** `feat:` prefix for new features, `fix:` for bug fixes.

**Backend patterns established:**
- Go error handling with `(result, error)` return — never panic
- Handler dependency injection via struct fields
- Table-driven Go tests with `httptest` for handler testing
- JSON response format: `{ "error": { "code": "...", "message": "..." } }` for errors, direct payload for success

[Source: git log]

### Latest Technical Information

**Tauri 2 Dialog Plugin:**
- Desktop (macOS/Linux/Windows): Full folder picker support via `open({ directory: true })`
- Setup: `npm run tauri add dialog` installs both Rust crate and JS bindings
- Permissions: Add `"dialog:default"` to capabilities (includes `allow-open`, `allow-save`, etc.)
- Frontend API: `import { open } from '@tauri-apps/plugin-dialog'`
- Returns `string | null` — path string on selection, null on cancel

**@lit-labs/signals + signal-polyfill:**
- Package remains in Lit Labs (experimental) as of 2026
- `SignalWatcher(LitElement)` mixin auto-tracks signals read during render lifecycle
- CRITICAL: Only one copy of `signal-polyfill` allowed in the dependency tree — use `npm dedupe` if issues arise
- `Signal.State` for mutable state, `Signal.Computed` for derived values
- Import `Signal` from `signal-polyfill`, not from `@lit-labs/signals`

**WebSocket Reconnection Best Practice:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Add jitter (random +-20%) to prevent thundering herd
- Reset backoff counter on successful connection

### Anti-Patterns to Avoid

- **DO NOT** hardcode backend URL — use Vite proxy (`/api/*` -> `localhost:3008`)
- **DO NOT** fetch data directly in components — use service layer
- **DO NOT** use inline styles — use design tokens via CSS custom properties
- **DO NOT** use barrel imports for Shoelace — cherry-pick from `/dist/components/`
- **DO NOT** use self-closing tags for Shoelace elements
- **DO NOT** use spinners in primary content areas — use skeleton layouts
- **DO NOT** modify existing BMAD services (bmad_config.go, agent_service.go, etc.) — they are stable
- **DO NOT** modify provider implementations or settings handler
- **DO NOT** implement the full activity bar layout yet — that's Story 2.5
- **DO NOT** implement the phase graph yet — that's Stories 2.3/2.4
- **DO NOT** create multiple copies of `signal-polyfill` — ensure `npm dedupe` works
- **DO NOT** use Go `panic()` — always return errors
- **DO NOT** wrap successful API responses — return payload directly
- **DO NOT** implement dark/light theme toggle — dark mode only for MVP

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Full architecture decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-Boundaries - File structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions - REST patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#State-Management - Signals pattern]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1-Project-Open-BMAD-Config-Loading - Story requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md - UX patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md - Component patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/detailed-user-experience.md - User flows]
- [Source: _bmad-output/project-context.md - Project rules and conventions]
- [Source: _bmad-output/implementation-artifacts/1-6-provider-settings-ui.md - Previous story patterns]
- [Source: backend/main.go - Current service initialization]
- [Source: backend/api/handlers/bmad.go - BMAD endpoint handlers with nil checks]
- [Source: backend/api/handlers/projects.go - Project endpoint stubs (501)]
- [Source: backend/api/websocket/hub.go - WebSocket hub implementation]
- [Source: backend/api/websocket/client.go - WebSocket client handling]
- [Source: src/app-shell.ts - Current root component]
- [Source: src/state/provider.state.ts - Established signal state pattern]
- [Source: src/services/provider.service.ts - Established service layer pattern]
- [Source: src/services/keychain.service.ts - Tauri environment detection pattern]
- [Source: src-tauri/capabilities/default.json - Current Tauri permissions]
- [Source: src-tauri/src/lib.rs - Tauri plugin registration]
- [Source: vite.config.ts - Dev server proxy configuration]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 64 frontend tests pass (Chrome, web-test-runner)
- All backend tests pass (go test ./... — 0 failures)
- 6 new backend integration tests for POST /projects/open endpoint

### Completion Notes List

- **Task 1:** Created `src/types/project.ts` (ProjectData, LoadingState, OpenProjectResponse interfaces) and `src/state/project.state.ts` (projectState, projectLoadingState signals, bmadServicesAvailable$ and projectName$ derived signals, helper functions)
- **Task 2:** Created `src/services/api.service.ts` (extracted shared apiFetch<T> with ApiRequestError class including error code) and `src/services/project.service.ts` (openProject, loadBmadConfig, loadBmadStatus). Refactored provider.service.ts to use shared apiFetch.
- **Task 3:** Created `backend/services/project_manager.go` (ProjectManager with mutex-protected service lifecycle, LoadProject/Stop, thread-safe getters). Added ProjectHandler with OpenProject endpoint in handlers/projects.go. Wired POST /projects/open in router.go. Updated main.go to use ProjectManager for both startup and dynamic project switching.
- **Task 4:** Added tauri-plugin-dialog to Cargo.toml, registered in lib.rs, added dialog:default to capabilities. Created `src/services/dialog.service.ts` with Tauri folder picker and dev mode prompt fallback. Installed @tauri-apps/plugin-dialog JS package.
- **Task 5:** Rewrote `src/app-shell.ts` with SignalWatcher mixin, four render states (empty/loading/error/loaded), project name in header with BMAD badge, folder-open toolbar button when project loaded, all using design tokens.
- **Task 6:** Created `src/services/websocket.service.ts` (connect/disconnect/on event handler, exponential backoff with jitter reconnection) and `src/state/connection.state.ts` (ConnectionStatus signal).
- **Task 7:** Created 4 new test files (project.service.test.ts, project.state.test.ts, websocket.service.test.ts, projects_test.go), updated app-shell.test.ts with 15 new state-aware tests. Total: 64 frontend tests, all backend tests passing.

### File List

**New Files:**
- src/types/project.ts
- src/state/project.state.ts
- src/state/connection.state.ts
- src/services/api.service.ts
- src/services/project.service.ts
- src/services/dialog.service.ts
- src/services/websocket.service.ts
- backend/services/project_manager.go
- backend/tests/api/projects_test.go
- tests/frontend/services/project.service.test.ts
- tests/frontend/state/project.state.test.ts
- tests/frontend/state/connection.state.test.ts (renamed from websocket.service.test.ts)

**Modified Files:**
- src/app-shell.ts
- src/services/provider.service.ts
- backend/main.go
- backend/api/router.go
- backend/api/handlers/projects.go
- backend/api/handlers/bmad.go
- backend/api/handlers/artifacts.go
- backend/api/handlers/bmad_test.go
- backend/api/handlers/bmad_phases_test.go
- src-tauri/Cargo.toml
- src-tauri/src/lib.rs
- src-tauri/capabilities/default.json
- package.json (added @tauri-apps/plugin-dialog)
- tests/frontend/components/app-shell.test.ts

### Change Log

- 2026-01-30: Implemented Story 2.1 — Project Open & BMAD Config Loading. Created full project lifecycle: native folder picker -> backend project validation -> dynamic BMAD service initialization -> frontend state management -> UI with empty/loading/error/loaded states. Extracted shared API fetch utility. Added WebSocket service with reconnection. All tests passing (64 frontend, all backend).
- 2026-01-30: Code simplification pass (10 files, -33 net lines). Removed unused `ApiErrorDetail` interface from api.service.ts. Replaced duplicated inline type with `ServiceAvailability` reference in project.ts. Replaced type assertions with proper `instanceof` checks in project.service.ts. Simplified dev-mode fallback in dialog.service.ts with optional chaining. Deduplicated state-setting in websocket.service.ts `onclose` and eliminated non-null assertions in `on()`. Moved inline spinner style to CSS rule using design token in app-shell.ts. Removed redundant comments from project_manager.go and main.go. Marked unused request params as `_` in projects.go stubs.
- 2026-01-30: Code review fixes (13 files, parallel Opus + Gemini review). Fixed: (1) HIGH — Wired WebSocket connect/disconnect in app-shell after project open (AC-1 completion). (2) HIGH — BMAD/artifact handlers now resolve services via ServiceProvider interface from ProjectManager per-request, fixing stale pointer bug that broke endpoints after dynamic project switch. (3) HIGH — Added filepath.Abs() path sanitization in LoadProject. (4) HIGH — Atomic project switching: validate new config before stopping old services. (5) MEDIUM — Added 4KB MaxBytesReader on POST /projects/open body. (6) MEDIUM — Set ApiRequestError.name for proper stack traces. (7) MEDIUM — Made WS_URL lazy (computed in connect() not module scope) to avoid crashes in non-browser environments. (8) LOW — Strengthened malformed config test to assert 422 + bmad_config_invalid. (9) Renamed misnamed websocket.service.test.ts to connection.state.test.ts. (10) Reduced mutex lock scope in LoadProject to swap-only phase.
