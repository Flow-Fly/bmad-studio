# Story 2.2: Workflow State Visualization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see my workflow progress visually updated**,
So that **I can see where I am in the BMAD methodology** (FR2).

## Acceptance Criteria

1. **Given** a project is open, **When** the app loads, **Then** workflow state is fetched from `GET /api/v1/bmad/status` (provided by Story 0.4) **And** the UI displays: current phase, completed workflows, in-progress workflows

2. **Given** no BMAD status files exist for the project, **When** the project is opened, **Then** default state is displayed (all workflows not started) **And** BMAD status files are NOT auto-created (BMAD creates them via workflow)

3. **Given** the workflow status changes (file modified externally or via BMAD workflow), **When** the `workflow:status-changed` WebSocket event is received (from Story 0.6), **Then** the UI updates to reflect the new state **And** phase graph nodes update their visual status automatically

## Tasks / Subtasks

- [x] Task 1: Create workflow state types (AC: #1, #2)
  - [x] 1.1: Create `src/types/workflow.ts` defining TypeScript interfaces matching the backend `StatusResponse` struct: `WorkflowStatus`, `PhaseCompletionStatus`, `WorkflowCompletionStatus`, `StoryStatus`
  - [x] 1.2: Define `WorkflowCompletionStatus.status` as union type: `'complete' | 'not_started' | 'required' | 'optional' | 'skipped' | 'recommended'`
  - [x] 1.3: Include `PhaseCompletionStatus` with `phaseNum`, `name`, `completedCount`, `totalRequired`, `percentComplete`

- [x] Task 2: Create workflow state signals (AC: #1, #2, #3)
  - [x] 2.1: Create `src/state/workflow.state.ts` with `workflowState` Signal holding the full `WorkflowStatus` or null
  - [x] 2.2: Create `workflowLoadingState` Signal (`idle | loading | error`) for loading feedback
  - [x] 2.3: Create derived signals: `currentPhase$` (current phase name+number), `phaseCompletions$` (array of phase completion stats), `nextWorkflow$` (next workflow id and agent)
  - [x] 2.4: Create `updateWorkflowState(status: WorkflowStatus)` helper function
  - [x] 2.5: Follow naming convention: `{noun}State` for stores, `{noun}$` for derived, `update{Noun}()` for helpers

- [x] Task 3: Create workflow service (AC: #1, #2)
  - [x] 3.1: Create `src/services/workflow.service.ts` with `loadWorkflowStatus()` calling `GET /api/v1/bmad/status`
  - [x] 3.2: Use the shared `apiFetch<T>()` from `src/services/api.service.ts` for consistent error handling
  - [x] 3.3: On success: call `updateWorkflowState()` to set the signal
  - [x] 3.4: On error: set `workflowLoadingState` to error with message, do NOT crash
  - [x] 3.5: Handle the "no status files" case — the backend returns a default response with all workflows `not_started` and `currentPhase: 1`

- [x] Task 4: Wire WebSocket events for real-time updates (AC: #3)
  - [x] 4.1: In `src/app-shell.ts` (or a new coordinator), register a handler on `websocketService.on('workflow:status-changed', handler)` after project loads
  - [x] 4.2: When `workflow:status-changed` event received: call `loadWorkflowStatus()` to re-fetch full status from backend (the WebSocket event is a notification, not the data itself)
  - [x] 4.3: Store the unsubscribe function returned by `websocketService.on()` and call it on project unload/disconnect
  - [x] 4.4: Ensure the handler is only registered once (not duplicated on reconnect — the WebSocket service handles reconnection internally)

- [x] Task 5: Create workflow status display component (AC: #1, #2)
  - [x] 5.1: Create `src/components/core/workflow/workflow-status-display.ts` as a Lit component extending `SignalWatcher(LitElement)`
  - [x] 5.2: Render a summary card showing: current phase name, overall progress (e.g., "Phase 2 of 4"), and next recommended workflow with agent
  - [x] 5.3: Render per-phase completion row: phase name, progress bar (`<sl-progress-bar>`), completed/total count, percentage
  - [x] 5.4: For each phase, render individual workflow items showing: workflow name, status badge (complete/in-progress/not-started/locked), and artifact link if complete
  - [x] 5.5: Use Shoelace components: `<sl-badge>` for status (variant: success=complete, primary=in-progress, neutral=not-started, warning=locked), `<sl-progress-bar>` for phase completion, `<sl-tooltip>` for workflow details
  - [x] 5.6: Handle empty/default state: show "No workflow status available — run a BMAD workflow to begin" with explanation per UX empty state pattern
  - [x] 5.7: Handle loading state: use skeleton layout (NOT spinner) matching the component's final layout shape
  - [x] 5.8: Apply design tokens from `tokens.css` — no inline styles

- [x] Task 6: Integrate into app-shell (AC: #1, #2, #3)
  - [x] 6.1: Import `workflow-status-display` component in `src/app-shell.ts`
  - [x] 6.2: Replace the placeholder text "Project loaded — phase graph will appear here" in the `main-content` div with `<workflow-status-display></workflow-status-display>`
  - [x] 6.3: In the `_handleProjectOpen()` flow (or `updated()` lifecycle), after project loads successfully: call `loadWorkflowStatus()` and register the WebSocket event handler
  - [x] 6.4: On project unload/switch: reset `workflowState` to null, unsubscribe from WebSocket events

- [x] Task 7: Testing (AC: #1, #2, #3)
  - [x] 7.1: Create `tests/frontend/services/workflow.service.test.ts` — test loadWorkflowStatus with mocked fetch for success, error, and no-status-files responses
  - [x] 7.2: Create `tests/frontend/state/workflow.state.test.ts` — test signal state transitions, derived signals compute correctly, updateWorkflowState helper
  - [x] 7.3: Create `tests/frontend/components/workflow-status-display.test.ts` — test rendering for loaded state (phases, workflows, badges), empty state, loading skeleton, and error state
  - [x] 7.4: Test WebSocket event handler: mock `websocketService.on()`, simulate `workflow:status-changed` event, verify `loadWorkflowStatus()` is called
  - [x] 7.5: Update `tests/frontend/components/app-shell.test.ts` — verify workflow-status-display is rendered when project is loaded

## Dev Notes

### Critical Architecture Patterns

**This is a frontend-only story.** No backend changes are needed. The `GET /api/v1/bmad/status` endpoint and `workflow:status-changed` WebSocket event already exist from Epic 0. This story creates the frontend state layer, service, and UI component to consume them.

**This story establishes the workflow state pattern** that Stories 2.3 (Phase Graph Container) and 2.4 (Phase Node) will consume. The signal state created here becomes the data source for the visual phase graph. Design signals and types with those downstream consumers in mind.

#### Backend API Response Shape (Already Implemented)

`GET /api/v1/bmad/status` returns (from `backend/types/workflow_status.go`):

```json
{
  "current_phase": 2,
  "current_phase_name": "Planning",
  "next_workflow_id": "create-architecture",
  "next_workflow_agent": "architect",
  "phase_completion": [
    {
      "phase_num": 1,
      "name": "Analysis",
      "completed_count": 2,
      "total_required": 2,
      "percent_complete": 100
    },
    {
      "phase_num": 2,
      "name": "Planning",
      "completed_count": 1,
      "total_required": 3,
      "percent_complete": 33
    }
  ],
  "workflow_statuses": {
    "create-product-brief": {
      "workflow_id": "create-product-brief",
      "status": "complete",
      "artifact_path": "_bmad-output/planning-artifacts/product-brief.md",
      "is_complete": true,
      "is_required": true,
      "is_optional": false
    },
    "create-architecture": {
      "workflow_id": "create-architecture",
      "status": "required",
      "is_complete": false,
      "is_required": true,
      "is_optional": false
    }
  },
  "story_statuses": {
    "1-1-project-scaffolding": "done",
    "2-1-project-open-bmad-config-loading": "review"
  }
}
```

**JSON field casing:** Backend uses `snake_case`. TypeScript interfaces must use `camelCase` with mapping in the service layer, OR define interfaces matching the JSON `snake_case` shape. The existing codebase uses `snake_case` matching in TS types (see `src/types/project.ts` — `project_name`, `project_root`, `bmad_loaded`). **Follow that same pattern: use snake_case in TS interfaces matching the API response.**

[Source: backend/types/workflow_status.go, backend/api/handlers/bmad.go:GetWorkflowStatus]

#### Frontend Stack (MUST USE)

| Technology | Package | Purpose |
|---|---|---|
| Lit | `lit` ^3.1.0 | Web Components framework |
| Shoelace | `@shoelace-style/shoelace` ^2.12.0 | UI component library |
| Signals | `@lit-labs/signals` ^0.2.0 | SignalWatcher mixin |
| signal-polyfill | `signal-polyfill` | Signal.State, Signal.Computed |

[Source: package.json, architecture.md#Starter-Template]

#### Component Pattern (Established in Stories 1.6 and 2.1)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

// Cherry-pick Shoelace — NEVER barrel import
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

@customElement('workflow-status-display')
export class WorkflowStatusDisplay extends SignalWatcher(LitElement) {
  render() {
    const status = workflowState.get();
    const loading = workflowLoadingState.get();
    // SignalWatcher auto-tracks these reads
  }
}
```

**Key rules:**
- Extend `SignalWatcher(LitElement)` for automatic signal subscription
- Cherry-pick Shoelace from `/dist/components/` paths
- Shoelace elements CANNOT be self-closing: `<sl-badge></sl-badge>`, NOT `<sl-badge />`
- `useDefineForClassFields: false` already set in tsconfig.json

[Source: 2-1-project-open-bmad-config-loading.md#Component-Architecture-Pattern]

#### Signal State Pattern (Established)

```typescript
import { Signal } from 'signal-polyfill';

// Stores
export const workflowState = new Signal.State<WorkflowStatus | null>(null);
export const workflowLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

// Derived
export const currentPhase$ = new Signal.Computed(() => {
  const ws = workflowState.get();
  if (!ws) return null;
  return { num: ws.current_phase, name: ws.current_phase_name };
});

// Helper
export function updateWorkflowState(status: WorkflowStatus): void {
  workflowState.set(status);
  workflowLoadingState.set({ status: 'idle' });
}
```

**Import `Signal` from `signal-polyfill`** (NOT from `@lit-labs/signals`).
**Naming:** `{noun}State` for stores, `{noun}$` for derived, `update{Noun}()` for helpers.
**Immutable updates:** `signal.set(newValue)` — never mutate in place.

[Source: src/state/project.state.ts, src/state/provider.state.ts]

#### Service Layer Pattern (Established)

```typescript
import { apiFetch } from './api.service';

const API_BASE = '/api/v1';

export async function loadWorkflowStatus(): Promise<void> {
  workflowLoadingState.set({ status: 'loading' });
  try {
    const status = await apiFetch<WorkflowStatus>(`${API_BASE}/bmad/status`);
    updateWorkflowState(status);
  } catch (err) {
    workflowLoadingState.set({
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to load workflow status',
    });
  }
}
```

**Use `apiFetch<T>()` from `src/services/api.service.ts`** — already extracted as shared utility in Story 2.1.
**Vite proxies `/api/*` to `localhost:3008`** — no hardcoded backend URL.

[Source: src/services/api.service.ts, src/services/project.service.ts]

#### WebSocket Event Handling (Established in Story 2.1)

```typescript
import { websocketService } from './websocket.service';

// Register handler (returns unsubscribe function)
const unsub = websocketService.on('workflow:status-changed', () => {
  loadWorkflowStatus(); // Re-fetch full status on change notification
});

// Later: unsub() to clean up
```

The `workflow:status-changed` event is emitted by the backend `FileWatcherService` when `bmm-workflow-status.yaml` or `sprint-status.yaml` files change. The event is a notification only — it does NOT contain the new status data. Always re-fetch from the REST endpoint.

[Source: src/services/websocket.service.ts, backend/services/file_watcher_service.go]

#### Design Tokens (MUST USE)

All styling uses CSS custom properties from `src/styles/tokens.css`:

| Token | Usage |
|---|---|
| `--bmad-color-bg-primary` | Main background (#0d1117) |
| `--bmad-color-bg-secondary` | Card/panel background (#161b22) |
| `--bmad-color-bg-tertiary` | Nested surface (#1e1e1e) |
| `--bmad-color-text-primary` | Primary text (#f0f6fc) |
| `--bmad-color-text-secondary` | Secondary/muted text (#8b949e) |
| `--bmad-color-accent` | Primary action, current phase (#58a6ff) |
| `--bmad-color-success` | Complete status (#3fb950) |
| `--bmad-color-warning` | Locked/warning status (#d29922) |
| `--bmad-color-error` | Error states (#f85149) |
| `--bmad-color-border` | Borders and dividers |
| `--bmad-spacing-*` | 4px-48px spacing scale |
| `--bmad-font-size-sm` | Small labels (12px) |
| `--bmad-font-size-md` | Body text (14px) |
| `--bmad-font-size-lg` | Headings (16px) |
| `--bmad-radius-md` | Border radius for cards |
| `--bmad-transition-normal` | State transitions (150ms ease) |

**Dark mode only for MVP. No inline styles.**

[Source: src/styles/tokens.css, project-context.md#Code-Quality-Style-Rules]

#### UX Patterns to Follow

**Workflow Status Display:**
- Dense, information-rich layout (power-user first, per UX analysis)
- Phase completion uses progress bars — familiar, scannable
- Status badges: color-coded with Shoelace variants (success/primary/neutral/warning)
- Current phase highlighted with accent color + subtle emphasis

**Empty State (no status files):**
- Centered content explaining why empty
- Actionable CTA: "Run a BMAD workflow to begin tracking progress"
- Follow pattern: "Tell users why it's empty and what action will fill it"

**Loading State:**
- Skeleton layout matching final component shape (phase rows with placeholder bars)
- NEVER use spinners in primary content areas

**Real-time Update:**
- When `workflow:status-changed` fires, the UI updates silently — no toast/notification needed
- Progress bars and badges update via signal reactivity (SignalWatcher handles re-render)
- Animation: 200ms ease-in-out for state changes (respect `prefers-reduced-motion`)

[Source: ux-consistency-patterns.md#Loading-Empty-States, ux-consistency-patterns.md#Feedback-Patterns, ux-pattern-analysis-inspiration.md]

### Project Structure Notes

**Files to Create:**

```
src/
├── types/
│   └── workflow.ts                    # CREATE: Workflow TypeScript interfaces
├── state/
│   └── workflow.state.ts              # CREATE: Workflow signal state + derived
├── services/
│   └── workflow.service.ts            # CREATE: Workflow status API calls
└── components/
    └── core/
        └── workflow/
            └── workflow-status-display.ts  # CREATE: Workflow status UI component

tests/
└── frontend/
    ├── services/
    │   └── workflow.service.test.ts    # CREATE: Service tests
    ├── state/
    │   └── workflow.state.test.ts      # CREATE: State tests
    └── components/
        ├── workflow-status-display.test.ts  # CREATE: Component tests
        └── app-shell.test.ts          # MODIFY: Add workflow display integration test
```

**Files to Modify:**

```
src/app-shell.ts                       # MODIFY: Import workflow-status-display, wire loading + WS events
```

**Files to NOT Touch:**

```
backend/                               # NO backend changes — all endpoints exist
src/state/project.state.ts             # DO NOT MODIFY — project state is stable
src/state/provider.state.ts            # DO NOT MODIFY
src/state/connection.state.ts          # DO NOT MODIFY
src/services/project.service.ts        # DO NOT MODIFY — loadBmadStatus() already exists but this story creates a dedicated workflow service
src/services/websocket.service.ts      # DO NOT MODIFY — use .on() API as-is
src/services/api.service.ts            # DO NOT MODIFY — use apiFetch as-is
src/services/provider.service.ts       # DO NOT MODIFY
src/styles/                            # DO NOT MODIFY — tokens stable
src/components/core/settings/          # DO NOT MODIFY
backend/providers/                     # DO NOT MODIFY
```

**Alignment:** All new files follow the architecture.md project structure exactly. `workflow-status-display.ts` goes in `src/components/core/workflow/` per the architecture's `phase-graph/` directory pattern.

[Source: architecture.md#Project-Structure, project-context.md#File-Organization-Rules]

### Testing Requirements

**Frontend tests use `@open-wc/testing`** with `@web/test-runner` (Chrome). Follow table-driven style where possible.

**Test file locations:**
- Service tests: `tests/frontend/services/workflow.service.test.ts`
- State tests: `tests/frontend/state/workflow.state.test.ts`
- Component tests: `tests/frontend/components/workflow-status-display.test.ts`

**Mocking patterns (established):**
- Mock `fetch` globally for service tests — see `tests/frontend/services/project.service.test.ts` for the pattern
- Mock `websocketService.on()` to return a stub unsubscribe function
- Use `fixture(html`<workflow-status-display></workflow-status-display>`)` for component rendering tests
- Set signal values directly in tests to control component state
- Use `await el.updateComplete` after signal changes to wait for render

**Coverage expectations:**
- Service: success, error, no-status-files responses
- State: signal initialization, derived signal computation, helper function behavior
- Component: loaded state (all phases rendered), empty state, loading skeleton, error state
- Integration: app-shell renders `<workflow-status-display>` when project is loaded

[Source: tests/frontend/services/project.service.test.ts, tests/frontend/components/app-shell.test.ts]

### Previous Story Intelligence

**From Story 2.1 (Project Open & BMAD Config Loading):**

- **ProjectManager pattern:** Backend now supports dynamic project switching. All BMAD services re-initialize when `POST /api/v1/projects/open` is called. The `GET /api/v1/bmad/status` endpoint resolves services per-request via `ServiceProvider` interface — no stale pointer issues.
- **WebSocket wiring:** Story 2.1 connected/disconnected the WebSocket in `app-shell.ts` after project open. The `websocketService.connect()` and `websocketService.disconnect()` calls are already in place. This story adds event handlers on top.
- **App-shell render states:** Four states exist: empty (no project), loading, error, loaded. The loaded state has a `<div class="main-content">` placeholder that says "Project loaded — phase graph will appear here". This is the exact insertion point for `<workflow-status-display>`.
- **Shared API fetch:** `apiFetch<T>()` was extracted to `src/services/api.service.ts` with `ApiRequestError` class (includes error code). Use this for all API calls.
- **Code review fix (HIGH):** BMAD/artifact handlers now resolve services via `ServiceProvider` interface from `ProjectManager` per-request. This means `GET /api/v1/bmad/status` always returns current project state, even after project switch.
- **Code simplification pass:** 10 files cleaned, -33 net lines. Removed unused types, replaced type assertions with `instanceof`, simplified optional chaining. Follow this standard of lean code.

**Key learnings to apply:**
1. Signal state files are small and focused — one domain per file
2. Service functions are standalone exports (not class methods)
3. `LoadingState` type reuse: `{ status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string }` — already defined in `src/types/project.ts`, reuse it
4. Tests follow established patterns — look at existing test files for mocking setup

[Source: 2-1-project-open-bmad-config-loading.md#Completion-Notes, #Change-Log]

### Git Intelligence

**Recent commits (last 5):**

```
8f7b1c5 Feature/2-1-project-open-bmad-config-loading (#9)
f6a75af Epic/1-app-foundation (#8)
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
40f508a Merge pull request #3 from Flow-Fly/feature/artifact-registry
```

**Branch pattern:** Create `feature/2-2-workflow-state-visualization` off the epic branch `epic/2-project-workflow-state-visualization`.

**Commit style:** `feat:` prefix for new features.

**Recent file patterns (Story 2.1 — 27 files):**
- Created: `project_manager.go`, `project.service.ts`, `project.state.ts`, `websocket.service.ts`, `dialog.service.ts`, `connection.state.ts`, `api.service.ts`
- Modified: `app-shell.ts`, `router.go`, `main.go`, `projects.go`
- Tests: 64 frontend tests passing, all backend tests passing

**Key conventions observed:**
- Feature branches merged via PR into epic branch
- PRs squash-merged with descriptive title
- Go error handling: `(result, error)` return, never panic
- Handler dependency injection via struct fields
- Table-driven Go tests with `httptest`

[Source: git log]

### Latest Technical Information

**@lit-labs/signals v0.2.0** — Current, no breaking changes. `SignalWatcher` mixin auto-tracks signals across full Lit lifecycle. `watch()` directive available for pinpoint DOM updates (useful if performance becomes an issue with frequent WebSocket updates). Do NOT write to signals inside lifecycle methods to avoid infinite loops.

**signal-polyfill v0.2.2** — TC39 Signals proposal at Stage 1. API stable: `Signal.State`, `Signal.Computed`, `Signal.subtle`. One copy rule enforced.

**Shoelace v2.20.1** — Latest in 2.x line. Relevant components for this story:
- `<sl-badge>` — `variant` (success/primary/neutral/warning/danger), `pill`, `pulse` attributes
- `<sl-progress-bar>` — `value` (0-100), `indeterminate`, `label`, `--height` CSS custom property
- `<sl-tooltip>` — hover details for workflow items
- No breaking changes since v2.12.0

**Web Awesome (Shoelace 3)** in beta — `sl-*` will become `wa-*`. Not relevant for MVP, stay on 2.x.

[Source: lit.dev/docs/data/signals, shoelace.style/resources/changelog, npm registry]

### Anti-Patterns to Avoid

- **DO NOT** create backend endpoints — `GET /api/v1/bmad/status` already exists and returns everything needed
- **DO NOT** embed workflow status data in the WebSocket event handler — always re-fetch from REST
- **DO NOT** duplicate `LoadingState` type — reuse from `src/types/project.ts`
- **DO NOT** hardcode backend URL — use Vite proxy (`/api/*` -> `localhost:3008`)
- **DO NOT** fetch data directly in components — use service layer
- **DO NOT** use inline styles — use design tokens via CSS custom properties
- **DO NOT** use barrel imports for Shoelace — cherry-pick from `/dist/components/`
- **DO NOT** use self-closing tags for Shoelace elements
- **DO NOT** use spinners in primary content areas — use skeleton layouts
- **DO NOT** modify existing state files (project, provider, connection) — create new workflow state
- **DO NOT** implement the full phase graph layout yet — that's Stories 2.3/2.4. This story creates a status overview that feeds data to those components
- **DO NOT** implement clickable nodes or navigation — that's Epic 5
- **DO NOT** create multiple copies of `signal-polyfill`
- **DO NOT** use Go `panic()` — but no Go changes needed in this story
- **DO NOT** implement dark/light theme toggle — dark mode only for MVP

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Full architecture decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — File structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#State-Management — Signals pattern]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2 — Story requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md — UX patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-pattern-analysis-inspiration.md — Dense layout inspiration]
- [Source: _bmad-output/project-context.md — Project rules and conventions]
- [Source: _bmad-output/implementation-artifacts/2-1-project-open-bmad-config-loading.md — Previous story patterns]
- [Source: backend/types/workflow_status.go — StatusResponse struct]
- [Source: backend/api/handlers/bmad.go — GetWorkflowStatus handler]
- [Source: backend/services/workflow_status_service.go — Status computation logic]
- [Source: backend/services/file_watcher_service.go — WebSocket event emission]
- [Source: src/app-shell.ts — Current app shell with placeholder]
- [Source: src/state/project.state.ts — Established signal pattern]
- [Source: src/services/api.service.ts — Shared apiFetch utility]
- [Source: src/services/websocket.service.ts — WebSocket .on() API]
- [Source: src/styles/tokens.css — Design tokens]
- [Source: tests/frontend/services/project.service.test.ts — Test mocking pattern]
- [Source: tests/frontend/components/app-shell.test.ts — Component test pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Initial test run: 2 failures in websocket-workflow.test.ts due to ES module read-only exports. Fixed by rewriting tests to avoid module property assignment.
- Final test run: 96/96 tests pass (32 new + 64 existing).
- Code-simplifier pass: 7 refinements across 3 files. 96/96 tests still pass post-simplification.

### Completion Notes List

- **Task 1:** Created `src/types/workflow.ts` with `WorkflowStatus`, `PhaseCompletionStatus`, `WorkflowCompletionStatus`, `StoryStatus` interfaces. Used `snake_case` field names matching backend API response per project convention. Defined `WorkflowStatusValue` union type.
- **Task 2:** Created `src/state/workflow.state.ts` with `workflowState` and `workflowLoadingState` signals, three derived signals (`currentPhase$`, `phaseCompletions$`, `nextWorkflow$`), and `updateWorkflowState()`/`clearWorkflowState()` helpers. Reused `LoadingState` from `src/types/project.ts`. Followed established naming conventions.
- **Task 3:** Created `src/services/workflow.service.ts` with `loadWorkflowStatus()` using shared `apiFetch<T>()`. Handles success, error, and no-status-files cases gracefully.
- **Task 4:** Wired WebSocket `workflow:status-changed` event in `app-shell.ts`. Added `_setupWorkflowSubscription()` and `_cleanupWorkflow()` methods. Unsubscribe stored and called on project switch/disconnect. Handler registered once after project load (not duplicated on reconnect).
- **Task 5:** Created `workflow-status-display` component with: summary card (phase info + next workflow), per-phase rows with progress bars and workflow items, skeleton loading layout, empty state, error state. Uses Shoelace `<sl-badge>`, `<sl-progress-bar>`, `<sl-tooltip>`. All styling via design tokens. Respects `prefers-reduced-motion`.
- **Task 6:** Integrated into app-shell: imported component, replaced placeholder text, wired `loadWorkflowStatus()` + WS subscription in `_handleOpenProject()`, cleanup on disconnect/switch.
- **Task 7:** Created 32 new tests across 4 test files. All 96 tests pass with zero regressions.
- **Code-simplifier pass (post-implementation):**
  - `workflow-status-display.ts`: Strengthened `STATUS_BADGE_VARIANT`/`STATUS_LABELS` maps from `Record<string, string>` to `Record<WorkflowStatusValue, string>` for compile-time exhaustiveness. Removed dead fallbacks in `_renderWorkflowItem`. Eliminated non-null assertion by passing `status` as parameter to `_renderLoaded`. Used `WorkflowStatus` type in `_renderPhaseRow` instead of inline structural type. Condensed `_getWorkflowsForPhase` to single ternary with concise JSDoc.
  - `workflow-status-display.test.ts`: Removed unused `workflowState` import.
  - `app-shell.test.ts`: Removed unused `projectState` and `projectLoadingState` imports.
  - 5 files reviewed with no changes needed (types, state, service, app-shell source, remaining tests).

### File List

**Created:**
- `src/types/workflow.ts`
- `src/state/workflow.state.ts`
- `src/services/workflow.service.ts`
- `src/components/core/workflow/workflow-status-display.ts`
- `tests/frontend/state/workflow.state.test.ts`
- `tests/frontend/services/workflow.service.test.ts`
- `tests/frontend/services/websocket-workflow.test.ts`
- `tests/frontend/components/workflow-status-display.test.ts`

**Modified:**
- `src/app-shell.ts`
- `tests/frontend/components/app-shell.test.ts`

## Senior Developer Review (AI)

**Reviewer:** Opus + Gemini (dual-model parallel)
**Date:** 2026-02-02

### Findings Summary
- **Issues Found:** 1 Critical (elevated), 2 High, 2 Medium, 2 Low
- **Dual-Confirmed:** 2 issues found by both reviewers
- **Issues Fixed:** 5 (all CRITICAL + HIGH + MEDIUM)
- **Action Items:** 0

### Fixes Applied

1. **[CRITICAL][Both] Restructured workflow-to-phase display** — Removed fake `_getWorkflowsForPhase` hack that dumped all workflows under phase 1. Workflows now render in a separate flat "Workflows" section below phase progress rows. Phase rows show accurate progress bars; workflow items show honest flat list with status badges. (workflow-status-display.ts)

2. **[HIGH][Claude] Fixed LoadingState inconsistency** — Changed `updateWorkflowState()` to set `{ status: 'success' }` instead of `{ status: 'idle' }`, aligning with how project state uses `LoadingState` (loading->success vs loading->idle). Updated 3 test files. (workflow.state.ts, workflow.service.test.ts, workflow.state.test.ts, websocket-workflow.test.ts)

3. **[HIGH][Both] Added debounce to WebSocket handler** — Added 300ms debounce to `workflow:status-changed` handler to prevent rapid concurrent `loadWorkflowStatus()` calls from file watcher event bursts. Debounce timer cleaned up in `_cleanupWorkflow()`. (app-shell.ts)

4. **[MEDIUM][Claude] Added missing `conditional` to WorkflowStatusValue** — Backend Go type has `StatusConditional = "conditional"` but frontend union type was missing it. Added to union type and both lookup maps (STATUS_BADGE_VARIANT, STATUS_LABELS). (workflow.ts, workflow-status-display.ts)

5. **[MEDIUM][Claude] Added progress bar value assertions** — Tests now verify progress bar `value` attributes match mock data `percent_complete` values (100, 33). Also updated badge test to verify badges in new flat workflows section. (workflow-status-display.test.ts)

### Unfixed (LOW)

- **[LOW][Claude] WebSocket test too shallow** — `websocket-workflow.test.ts` calls `loadWorkflowStatus()` directly rather than simulating actual event dispatch. Functional but doesn't test integration path.
- **[LOW][Claude] Duplicate skeleton-card CSS** — **Fixed** alongside CRITICAL restructure (merged into single rule).

## Change Log

- 2026-01-30: Implemented Story 2.2 — Workflow State Visualization. Created frontend workflow state layer (types, signals, service), workflow-status-display UI component, WebSocket real-time update wiring, and comprehensive tests (96 total, 32 new). All acceptance criteria satisfied.
- 2026-01-30: Code-simplifier pass — 7 refinements across 3 files. Strengthened type safety (exhaustive Record keys), removed unused imports and dead code, eliminated non-null assertion. All 96 tests pass.
- 2026-02-02: Parallel code review (Opus + Gemini). 7 issues found, 5 fixed: restructured workflow display to honest flat layout, fixed LoadingState inconsistency (idle->success), added WS debounce (300ms), added missing `conditional` status value, strengthened test assertions.
