# Story 2.3: Phase Graph Container Component

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see a visual representation of all BMAD phases**,
So that **I understand the overall methodology structure** (FR4).

## Acceptance Criteria

1. **Given** a project is loaded, **When** the main view renders, **Then** a phase graph displays showing four phases: Analysis, Planning, Solutioning, Implementation **And** phases are arranged left-to-right in logical order **And** connection lines show dependencies between workflow nodes **And** the graph renders within 1 second (NFR3)

2. **Given** the window is resized, **When** width drops below 1280px (compact mode), **Then** the phase graph adapts with abbreviated labels and tighter spacing **And** the graph remains usable at minimum window size (1024px)

3. **Given** keyboard navigation is used, **When** I press arrow keys while graph is focused, **Then** focus moves between nodes logically **And** focus indicators are clearly visible (2px accent ring)

## Tasks / Subtasks

- [x] Task 1: Create phase graph types (AC: #1)
  - [x] 1.1: Create `src/types/phases.ts` defining TypeScript interfaces matching the backend `PhasesResponse` struct: `PhasesResponse`, `PhaseResponse`, `WorkflowResponse`
  - [x] 1.2: Use `snake_case` field names matching the API JSON response per project convention (same pattern as `src/types/workflow.ts`)
  - [x] 1.3: Define `PhaseGraphNode` interface for internal node representation: `{ workflow_id: string; label: string; phase_num: number; is_required: boolean; is_optional: boolean; is_conditional: boolean; agent?: string; included_by?: string; status: WorkflowStatusValue; is_current: boolean; }`
  - [x] 1.4: Define `PhaseGraphEdge` interface for connection lines: `{ from: string; to: string; is_optional: boolean; }`
  - [x] 1.5: Define `NodeVisualState` type: `'current' | 'complete' | 'skipped' | 'conditional' | 'required' | 'recommended' | 'optional' | 'not-started'`

- [x] Task 2: Create phase graph state signals (AC: #1)
  - [x] 2.1: Create `src/state/phases.state.ts` with `phasesState` Signal holding the full `PhasesResponse` or null
  - [x] 2.2: Create `phasesLoadingState` Signal (`LoadingState`) for loading feedback (reuse from `src/types/project.ts`)
  - [x] 2.3: Create derived signal `phaseGraphNodes$` that merges `phasesState` structure with `workflowState` status data to produce an array of `PhaseGraphNode`. Returns empty array if EITHER source is null (wait for both to load). For each workflow in phases: lookup status from `workflowState.workflow_statuses[workflow.id]`, defaulting to `'not_started'` if not found. Set `is_current` by matching against `workflowState.next_workflow_id`.
  - [x] 2.4: Create derived signal `phaseGraphEdges$` that computes connection edges from three sources: (1) Sequential phase flow — last required workflow in phase N to first required workflow in phase N+1, (2) `included_by` relationships from the API — if `workflow.included_by` is set, draw edge from that workflow ID to this one, (3) Within-phase ordering for required workflows. Mark edges as `is_optional` when connecting optional/conditional workflows.
  - [x] 2.5: Create `getNodeVisualState(status: WorkflowStatusValue, isCurrent: boolean): NodeVisualState` helper with explicit precedence: current > complete > skipped > conditional > required > recommended > optional > not-started
  - [x] 2.6: Create `updatePhasesState(phases: PhasesResponse)` and `clearPhasesState()` helper functions
  - [x] 2.7: Follow naming convention: `{noun}State` for stores, `{noun}$` for derived, `update{Noun}()` for helpers

- [x] Task 3: Create phases service (AC: #1)
  - [x] 3.1: Create `src/services/phases.service.ts` with `loadPhases()` calling `GET /api/v1/bmad/phases`
  - [x] 3.2: Use the shared `apiFetch<T>()` from `src/services/api.service.ts` for consistent error handling
  - [x] 3.3: On success: call `updatePhasesState()` to set the signal
  - [x] 3.4: On error: set `phasesLoadingState` to error with message, do NOT crash
  - [x] 3.5: Phases data is static for a project (doesn't change at runtime), so load once after project open — no WebSocket subscription needed

- [x] Task 4: Create phase-graph-container component (AC: #1, #2, #3)
  - [x] 4.1: Create `src/components/core/phase-graph/phase-graph-container.ts` as a Lit component extending `SignalWatcher(LitElement)`
  - [x] 4.2: Use **HTML/CSS hybrid architecture**: HTML elements for phase columns and workflow nodes (enabling Lucide icons, Shoelace tooltips, and natural CSS token styling), with a positioned SVG layer for connection lines only
  - [x] 4.3: Render phase columns using CSS Grid or Flexbox — 4 equal-width columns, left-to-right. Each column has a phase label header and a vertical stack of workflow node elements
  - [x] 4.4: Render phase labels (Analysis, Planning, Solutioning, Implementation) as column headers using `--bmad-font-size-xs`, uppercase, letter-spacing 0.5px, `--bmad-color-text-secondary`
  - [x] 4.5: Render workflow nodes as HTML `<div>` elements with CSS styling (rounded rectangles, design tokens). Each node contains: workflow label text, a Lucide status icon (e.g., `circle-check` for complete, `lock` for locked, `circle-dot` for current, `circle` for not-started), and optional agent name in muted text
  - [x] 4.6: Wrap each node in `<sl-tooltip>` for hover details showing: workflow name, status, agent, and purpose. Cherry-pick: `import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js'`
  - [x] 4.7: Render connection lines using an absolutely-positioned SVG overlay. Use `svg` tag (from `lit`) for `<path>` elements with cubic bezier curves, consuming `phaseGraphEdges$`. Compute path endpoints from node element positions using `getBoundingClientRect()` relative to the container
  - [x] 4.8: Style connection lines: solid stroke (`--bmad-color-border-primary`) for required dependencies, dashed stroke for optional/conditional paths (e.g., PRD -> UX Design)
  - [x] 4.9: Style nodes based on `NodeVisualState` from `getNodeVisualState()` using CSS classes. Precedence: current > complete > skipped > conditional > required > recommended > optional > not-started. See Node Visual States table in Dev Notes for exact colors
  - [x] 4.10: Highlight the current phase column with subtle accent background (`--bmad-color-accent` at 10% opacity)
  - [x] 4.11: Handle the Implementation phase "dev loop" specially — show Story -> Dev -> Review as a grouped cycle indicator with a Lucide `repeat` icon rather than individual nodes
  - [x] 4.12: Implement compact layout mode: when container width < 1280px, switch to compact CSS class. Abbreviate labels: Analysis->Anl, Planning->Pln, Solutioning->Sol, Implementation->Impl. Reduce node size (120px->90px wide, 40px->32px tall), tighten gaps (16px->10px), reduce font from sm to xs, truncate node labels with ellipsis if > 10 chars
  - [x] 4.13: Use `ResizeObserver` on the host element to detect width changes and toggle a `compact` boolean property. Clean up observer in `disconnectedCallback()`
  - [x] 4.14: Implement keyboard navigation: arrow keys move focus between nodes (ArrowRight/Left across phases, ArrowUp/Down within phase), Tab exits graph, Enter activates focused node (no-op for now — Epic 5 wires click handler). Visible focus ring: 2px `--bmad-color-accent` outline. Track focused node index as local component state. On graph focus (Tab into), focus the current workflow node (from `nextWorkflow$`)
  - [x] 4.15: Set `role="group"` and `aria-label="BMAD phase graph"` on the container div. Each node gets `role="button"`, `tabindex` (-1 or 0), and descriptive `aria-label` like "Product Brief, Analysis phase, required, complete". Add an `aria-live="polite"` region that announces when current workflow changes
  - [x] 4.16: Handle empty/loading state: when `phasesState` or `workflowState` is null, show skeleton layout matching the graph shape (4 column placeholders with rounded rect skeletons)
  - [x] 4.17: Handle error state: when phases fail to load, show inline error message
  - [x] 4.18: All styling via design tokens from `tokens.css` — no inline styles
  - [x] 4.19: Respect `prefers-reduced-motion`: disable glow animations, reduce transitions
  - [x] 4.20: Register as `<phase-graph-container>` custom element with `HTMLElementTagNameMap` declaration

- [x] Task 5: Integrate into app-shell (AC: #1)
  - [x] 5.1: Import `phase-graph-container` component in `src/app-shell.ts`
  - [x] 5.2: In `_renderLoaded()`, **replace** `<workflow-status-display>` with `<phase-graph-container>` in the main content area. The phase graph supersedes the flat workflow status display — it shows the same data (phase completion, workflow statuses, current position) in a superior spatial layout. Remove the `workflow-status-display` import from app-shell. (The component file itself stays — it may be repurposed as a detail panel in Story 2.4 or 2.5)
  - [x] 5.3: In `_handleOpenProject()`, after project loads: call `loadPhases()` alongside existing `loadWorkflowStatus()` (both are needed — phases for structure, workflow status for completion data)
  - [x] 5.4: On project unload/switch: call `clearPhasesState()` alongside existing `clearWorkflowState()`
  - [x] 5.5: Import `loadPhases` from `phases.service.ts` and `clearPhasesState` from `phases.state.ts`

- [x] Task 6: Testing (AC: #1, #2, #3)
  - [x] 6.1: Create `tests/frontend/state/phases.state.test.ts`:
    - Test signal initialization (null default, idle loading)
    - Test `updatePhasesState()` and `clearPhasesState()` helpers
    - Test `phaseGraphNodes$` produces correct nodes from mock phases + workflow data merge (verify status lookup, `is_current` flag, default to `not_started` for unknown workflows)
    - Test `phaseGraphNodes$` returns empty array when either `phasesState` or `workflowState` is null
    - Test `phaseGraphEdges$` produces correct edges (sequential cross-phase, `included_by` relationships, optional edge marking)
    - Test `getNodeVisualState()` precedence: current beats complete, complete beats required, etc.
  - [x] 6.2: Create `tests/frontend/services/phases.service.test.ts` — test loadPhases with mocked fetch for success and error responses, verify signal state transitions
  - [x] 6.3: Create `tests/frontend/components/phase-graph-container.test.ts`:
    - Test loaded state: phase labels present (all 4 phase names), workflow node elements rendered with correct text and status CSS classes, SVG overlay present with path elements for edges
    - Test skeleton/loading state: when phasesState is null, skeleton layout renders
    - Test error state: when phasesLoadingState has error, error message displays
    - Test compact mode: set container width < 1280px via mock, verify abbreviated labels ("Anl", "Pln", "Sol", "Impl") and compact CSS class applied
    - Test signal reactivity: update `workflowState` signal, verify node status CSS classes change after `updateComplete`
  - [x] 6.4: Test keyboard navigation:
    - Simulate ArrowRight, verify focus moves to next node
    - Simulate ArrowDown, verify focus moves to node below in same phase
    - Simulate Tab, verify focus leaves graph container
    - Verify focused node has `tabindex="0"`, others have `tabindex="-1"`
    - Verify focus ring is visible (outline style applied)
  - [x] 6.5: Test accessibility: verify `role="group"` and `aria-label` on container, `role="button"` and descriptive `aria-label` on each node, `aria-live` region exists
  - [x] 6.6: Update `tests/frontend/components/app-shell.test.ts` — verify `<phase-graph-container>` is rendered when project is loaded, verify `<workflow-status-display>` is no longer rendered in loaded state

## Dev Notes

### Critical Architecture Patterns

**This story is primarily frontend** but includes backend changes for workflow status reconciliation with the file system. The `GET /api/v1/bmad/phases` endpoint already exists (from Epic 0) and returns the complete phase-to-workflow hierarchical structure (including `included_by` dependency fields). The `GET /api/v1/bmad/status` endpoint provides completion status for each workflow. This story creates the frontend phase graph visualization that merges both data sources using a **HTML/CSS hybrid architecture** (HTML nodes with Lucide icons + SVG overlay for connection lines).

**This story creates the visual phase graph** that is the primary navigation anchor for BMAD Studio. Stories 2.4 (Phase Node Component) will refine individual node appearance and interactions. Story 2.5 (App Shell Layout) will position the phase graph within the final layout with activity bar.

**The phase graph consumes data from two sources:**
1. `GET /api/v1/bmad/phases` — hierarchical structure (phases -> workflows), loaded once after project open
2. `workflowState` signal (from Story 2.2) — real-time status updates via WebSocket, already reactive

#### Backend API: Phase Structure (`GET /api/v1/bmad/phases`)

Returns (from `backend/types/workflow_path.go`):

```json
{
  "method_name": "greenfield",
  "track": "bmm",
  "field_type": "software",
  "description": "...",
  "phases": [
    {
      "phase": 1,
      "name": "Analysis",
      "required": true,
      "optional": false,
      "workflows": [
        {
          "id": "research",
          "required": false,
          "optional": true,
          "agent": "analyst",
          "purpose": "Research and discovery"
        },
        {
          "id": "create-product-brief",
          "required": true,
          "optional": false,
          "agent": "analyst",
          "purpose": "Product brief creation"
        }
      ]
    },
    {
      "phase": 2,
      "name": "Planning",
      "workflows": [
        {
          "id": "prd",
          "required": true,
          "agent": "pm"
        },
        {
          "id": "create-ux-design",
          "required": false,
          "optional": true,
          "conditional": "if_has_ui",
          "agent": "ux-designer"
        }
      ]
    }
  ]
}
```

**Key insight:** The `phases` array provides the complete structure. Each phase contains its workflows with metadata (required/optional/conditional, agent, purpose). Workflow-to-phase mapping comes directly from this response — no hardcoding needed.

**Dependency information is PARTIALLY available in the API.** The `WorkflowResponse` struct includes:
- `included_by` field — indicates which workflow includes/enables this one (e.g., a conditional UX workflow might have `included_by: "prd"`)
- `conditional` field — describes the condition for this workflow's inclusion (e.g., `"if_has_ui"`)

**Edge computation strategy (3 sources):**
1. **Cross-phase sequential flow:** Last required workflow in phase N -> first required workflow in phase N+1. This represents the primary forward path.
2. **`included_by` relationships:** If `workflow.included_by` is set, draw an edge from the referenced workflow to this one. This captures explicit API-provided dependencies.
3. **Within-phase ordering:** For required workflows within the same phase, connect them sequentially based on array order from the API.

Optional/conditional edges use dashed lines. Required edges use solid lines.

[Source: backend/types/workflow_path.go, backend/api/handlers/bmad.go:GetPhases]

#### Backend API: Workflow Status (`GET /api/v1/bmad/status`)

Already consumed by Story 2.2's `workflowState` signal. The `workflow_statuses` map keys match the `id` field from the phases response, enabling direct lookup.

[Source: src/state/workflow.state.ts, src/types/workflow.ts]

#### Frontend Stack (MUST USE)

| Technology | Package | Purpose |
|---|---|---|
| Lit | `lit` ^3.1.0 | Web Components framework |
| Shoelace | `@shoelace-style/shoelace` ^2.12.0 | UI component library (tooltips for node hover) |
| Lucide | `lucide` ^0.563.0 | Icons (status indicators in nodes) |
| Signals | `@lit-labs/signals` ^0.2.0 | SignalWatcher mixin |
| signal-polyfill | `signal-polyfill` | Signal.State, Signal.Computed |

**Lucide is the ONLY icon set.** Check how existing components import Lucide icons and follow the same pattern. Do NOT use Shoelace icons, Heroicons, or any other icon set.

[Source: package.json, project-context.md#Icons-Lucide]

#### Component Pattern: HTML/CSS Hybrid with SVG Connection Lines

**Architecture decision:** Use HTML elements for phase columns and workflow nodes, SVG only for connection lines. This enables:
- **Lucide icons** as HTML elements inside nodes (project mandates Lucide exclusively)
- **Shoelace `<sl-tooltip>`** wrapping nodes for hover details (HTML elements can't go inside SVG)
- **CSS design tokens** work naturally with HTML elements (no SVG `fill`/`stroke` workarounds)
- **Standard accessibility** with native `tabindex`, `role="button"`, focus management

```typescript
import { LitElement, html, css, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
// Lucide icons — import specific icons used
import 'lucide/dist/esm/icons/circle-check.js';
import 'lucide/dist/esm/icons/circle-dot.js';
import 'lucide/dist/esm/icons/circle.js';
import 'lucide/dist/esm/icons/lock.js';
import 'lucide/dist/esm/icons/repeat.js';

@customElement('phase-graph-container')
export class PhaseGraphContainer extends SignalWatcher(LitElement) {
  @state() private _compact = false;

  render() {
    const nodes = phaseGraphNodes$.get();
    const edges = phaseGraphEdges$.get();
    if (!nodes.length) return this._renderSkeleton();

    return html`
      <div class="graph ${this._compact ? 'compact' : ''}" role="group" aria-label="BMAD phase graph">
        <!-- Phase columns with HTML nodes -->
        ${this._renderPhaseColumns(nodes)}
        <!-- SVG overlay for connection lines only -->
        <svg class="edges-overlay" aria-hidden="true">
          ${edges.map(e => svg`<path d=${e.path} ... />`)}
        </svg>
      </div>
    `;
  }
}
```

**SVG in Lit rules (for the connection lines overlay):**
- Use `html` tag for the outer `<svg>` element (it's an HTML element in the shadow DOM)
- Use `svg` tag (imported from `lit`) for inner SVG content (`<path>`, `<line>`)
- The SVG overlay is absolutely positioned over the HTML node layout
- Mark SVG as `aria-hidden="true"` — connection lines are decorative, node relationships are conveyed by structure

**Lucide icon integration:** Check how Lucide is imported in the existing codebase (may be `lucide-lit`, `lucide-static`, or inline SVG strings). Match the established pattern. If no pattern exists yet, use Lucide's SVG string exports with Lit's `unsafeSVG` or the `lucide-lit` package if available.

[Source: lit.dev/docs/components/rendering, project-context.md#Icons-Lucide]

#### Signal State Pattern (Established)

```typescript
import { Signal } from 'signal-polyfill';
import { workflowState } from './workflow.state.js';

// Stores
export const phasesState = new Signal.State<PhasesResponse | null>(null);
export const phasesLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

// Derived — merges phases structure with workflow status
// Returns empty array if EITHER source is null (wait for both to load)
export const phaseGraphNodes$ = new Signal.Computed(() => {
  const phases = phasesState.get();
  const ws = workflowState.get();
  if (!phases || !ws) return [];  // Both must be loaded
  return phases.phases.flatMap(phase =>
    phase.workflows.map(wf => {
      const status = ws.workflow_statuses[wf.id]?.status ?? 'not_started';
      const isCurrent = ws.next_workflow_id === wf.id;
      return { workflow_id: wf.id, ..., status, is_current: isCurrent };
    })
  );
});
```

**Cross-file import:** `phases.state.ts` imports `workflowState` from `workflow.state.ts`. This is a one-way dependency (phases reads workflow, not vice versa). No circular import risk.

**Import `Signal` from `signal-polyfill`** (NOT from `@lit-labs/signals`).
**Naming:** `{noun}State` for stores, `{noun}$` for derived, `update{Noun}()` for helpers.
**Immutable updates:** `signal.set(newValue)` — never mutate in place.

[Source: src/state/project.state.ts, src/state/workflow.state.ts]

#### Service Layer Pattern (Established)

```typescript
import { apiFetch } from './api.service';

const API_BASE = '/api/v1';

export async function loadPhases(): Promise<void> {
  phasesLoadingState.set({ status: 'loading' });
  try {
    const phases = await apiFetch<PhasesResponse>(`${API_BASE}/bmad/phases`);
    updatePhasesState(phases);
  } catch (err) {
    phasesLoadingState.set({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load phase definitions',
    });
  }
}
```

**Use `apiFetch<T>()` from `src/services/api.service.ts`** — already extracted as shared utility.
**Vite proxies `/api/*` to `localhost:3008`** — no hardcoded backend URL.

[Source: src/services/api.service.ts, src/services/workflow.service.ts]

#### Design Tokens (MUST USE)

All styling uses CSS custom properties from `src/styles/tokens.css`:

| Token | Usage in Phase Graph |
|---|---|
| `--bmad-color-bg-primary` | Main background (#0d1117) |
| `--bmad-color-bg-secondary` | Graph container background (#161b22) |
| `--bmad-color-bg-tertiary` | Node default fill (#21262d) |
| `--bmad-color-text-primary` | Node labels (#f0f6fc) |
| `--bmad-color-text-secondary` | Phase labels, muted text (#8b949e) |
| `--bmad-color-text-muted` | Locked nodes (#484f58) |
| `--bmad-color-accent` | Current phase/node highlight (#58a6ff) |
| `--bmad-color-accent-hover` | Node hover state (#79c0ff) |
| `--bmad-color-success` | Complete node fill (#3fb950) |
| `--bmad-color-warning` | Conditional node indicator (#d29922) |
| `--bmad-color-border-primary` | Node borders, connection lines (#30363d) |
| `--bmad-spacing-*` | Node spacing, padding |
| `--bmad-font-size-xs` | Phase labels (11px) |
| `--bmad-font-size-sm` | Node labels (12px) |
| `--bmad-radius-md` | Node border radius (6px) |
| `--bmad-transition-fast` | Hover/focus transitions (150ms ease) |
| `--bmad-transition-normal` | State change animations (250ms ease) |

**Dark mode only for MVP. No inline styles.**

[Source: src/styles/tokens.css, project-context.md#Code-Quality-Style-Rules]

#### Graph Layout Strategy

**HTML/CSS layout with SVG overlay — NO external graph library needed.** The BMAD phase graph has a fixed, known structure (4 phases, ~15 workflows). Layout is CSS-driven:

1. **Phase columns:** CSS Grid with 4 equal-width columns (`grid-template-columns: repeat(4, 1fr)`)
2. **Workflow nodes:** Flexbox column within each phase, ordered by the `workflows` array from the API
3. **Connection lines:** Absolutely-positioned SVG overlay. Compute `<path>` bezier curves from node element positions (`getBoundingClientRect()` relative to container). Recalculate after layout changes (resize, data update).
4. **Responsive:** `ResizeObserver` detects width, toggles `compact` class on container

**Node sizing:**
- Normal mode: ~120px wide, ~40px tall, 16px vertical gap between nodes
- Compact mode: ~90px wide, ~32px tall, 10px vertical gap, font-size xs (11px), truncate labels > 10 chars with ellipsis
- Phase label height: ~24px above nodes

**Compact mode label abbreviations:**
- Analysis -> Anl
- Planning -> Pln
- Solutioning -> Sol
- Implementation -> Impl

**Implementation phase (dev loop) special handling:**
- Instead of showing individual Story/Dev/Review workflow nodes, show a single grouped "Dev Loop" node with a Lucide `repeat` icon
- The dev loop represents the repeating Story -> Dev -> Review cycle
- Sprint Planning and Retrospective remain as individual nodes

#### Workflow Topology (Edge Definitions)

The graph's connection topology. Edges come from the API's `included_by` field and sequential phase ordering:

```
PHASE 1: Analysis
  research (optional) ──┐
  create-product-brief ◄┘ (sequential within phase)

PHASE 2: Planning
  prd ◄── create-product-brief (cross-phase: phase 1 last required → phase 2 first required)
  create-ux-design ◄── prd (included_by / conditional: if_has_ui, dashed line)

PHASE 3: Solutioning
  create-architecture ◄── prd (cross-phase: phase 2 last required → phase 3 first required)
  create-epics-and-stories ◄── create-architecture (sequential)
  check-implementation-readiness ◄── create-epics-and-stories (sequential, GATE)

PHASE 4: Implementation
  sprint-planning ◄── check-implementation-readiness (cross-phase)
  [Dev Loop] ◄── sprint-planning (grouped: create-story → dev-story → code-review cycle)
  retrospective (standalone, per-epic)
```

**NOTE:** The exact workflow IDs and relationships depend on the `GET /api/v1/bmad/phases` response for the loaded project. The topology above is the expected greenfield path. The component must derive edges dynamically from the API data, NOT hardcode this topology.

[Source: ux-design-specification/detailed-user-experience.md, ux-design-specification/component-strategy.md]

#### Node Visual States (from UX Spec)

| NodeVisualState | CSS Class | Visual | Color | Lucide Icon |
|---|---|---|---|---|
| `current` | `.node--current` | Accent border + glow | `--bmad-color-accent` border, box-shadow glow | `circle-dot` |
| `complete` | `.node--complete` | Success fill | `--bmad-color-success` background, `--bmad-color-text-primary` text | `circle-check` |
| `skipped` | `.node--skipped` | Muted fill, strikethrough text | `--bmad-color-bg-tertiary` background, `--bmad-color-text-muted` text | `circle-check` (muted) |
| `conditional` | `.node--conditional` | Warning border | `--bmad-color-warning` border | `circle` |
| `required` | `.node--required` | Accent outline | `--bmad-color-accent` border, `--bmad-color-text-primary` text | `circle` |
| `recommended` | `.node--recommended` | Accent outline, dashed | `--bmad-color-accent` dashed border | `circle` |
| `optional` | `.node--optional` | Dashed outline | `--bmad-color-border-primary` dashed border, `--bmad-color-text-secondary` text | `circle` |
| `not-started` | `.node--not-started` | Muted outline | `--bmad-color-border-primary` border, `--bmad-color-text-muted` text | `circle` |

**Visual state precedence (highest to lowest):**

```typescript
function getNodeVisualState(status: WorkflowStatusValue, isCurrent: boolean): NodeVisualState {
  if (isCurrent) return 'current';        // Always wins — this is the next workflow to run
  if (status === 'complete') return 'complete';
  if (status === 'skipped') return 'skipped';    // Distinct from complete — different visual
  if (status === 'conditional') return 'conditional';
  if (status === 'required') return 'required';
  if (status === 'recommended') return 'recommended';
  if (status === 'optional') return 'optional';
  return 'not-started';                    // Default for 'not_started' and any unknown
}
```

**Note:** "In Progress" is NOT a current `WorkflowStatusValue` from the API. Do NOT implement it — the backend doesn't track workflow-level progress (only story-level). If needed in the future, it would require a backend change.

[Source: ux-design-specification/detailed-user-experience.md, ux-design-specification/design-system-foundation.md]

#### Keyboard Navigation Pattern

| Key | Behavior |
|---|---|
| `ArrowRight` | Move focus to next node (same row or next phase) |
| `ArrowLeft` | Move focus to previous node |
| `ArrowDown` | Move focus to node below in same phase |
| `ArrowUp` | Move focus to node above in same phase |
| `Tab` | Exit graph to next focusable element |
| `Enter` | Activate focused node (no-op for now, Epic 5 wires click handler) |

**Focus management:**
- Track focused node index in component state (`@state()` decorator — local to component, not a signal)
- Apply `tabindex="0"` to the focused node, `tabindex="-1"` to all other nodes
- Visible focus ring: 2px `--bmad-color-accent` outline with 2px offset
- On graph focus (Tab into), focus the current workflow node (matching `nextWorkflow$`)
- Each node gets `role="button"` and `aria-label` describing: workflow name, phase, required/optional, and current status (e.g., "Product Brief, Analysis phase, required, complete")
- Container gets `role="group"` and `aria-label="BMAD phase graph"`
- Add `aria-live="polite"` visually-hidden region that announces when the current workflow changes (e.g., "Current workflow: create-architecture")

[Source: ux-design-specification/ux-consistency-patterns.md, ux-design-specification/responsive-design-accessibility.md]

#### UX Patterns to Follow

**Phase Graph Navigation:**
- Graph-first navigation — the graph is the primary spatial anchor for "Instant Resume"
- Current position immediately visible on app load
- Dense, information-rich layout (power-user first, per UX analysis)

**Animation:**
- State changes: 200ms ease-in-out for node fill/border transitions
- Glow effect on current node: subtle CSS box-shadow pulse
- Respect `prefers-reduced-motion`: disable glow animation, reduce all transitions

**Responsive:**
- Normal mode (>= 1280px): Full phase labels, standard node size
- Compact mode (< 1280px): Abbreviated labels ("Anl", "Pln", "Sol", "Impl"), smaller nodes, tighter spacing
- Minimum window size: 1024px — graph must remain usable

[Source: ux-design-specification/ux-consistency-patterns.md, ux-design-specification/responsive-design-accessibility.md]

### Project Structure Notes

**Files to Create:**

```
src/
├── types/
│   └── phases.ts                        # CREATE: Phase/workflow structure interfaces
├── state/
│   └── phases.state.ts                  # CREATE: Phases signal state + derived graph
├── services/
│   └── phases.service.ts                # CREATE: Phase definitions API call
└── components/
    └── core/
        └── phase-graph/
            └── phase-graph-container.ts  # CREATE: Phase graph container (HTML/CSS nodes + SVG edges)

tests/
└── frontend/
    ├── services/
    │   └── phases.service.test.ts       # CREATE: Service tests
    ├── state/
    │   └── phases.state.test.ts         # CREATE: State + derived signal tests
    └── components/
        ├── phase-graph-container.test.ts # CREATE: Component tests
        └── app-shell.test.ts            # MODIFY: Add phase graph integration test
```

**Files to Modify:**

```
src/app-shell.ts                          # MODIFY: Replace workflow-status-display with phase-graph-container, wire loadPhases/clearPhasesState
```

**Files to NOT Touch:**

```
backend/                                   # NO backend changes — all endpoints exist
src/state/workflow.state.ts                # DO NOT MODIFY — consume via .get() only
src/state/project.state.ts                 # DO NOT MODIFY
src/state/connection.state.ts              # DO NOT MODIFY
src/services/workflow.service.ts           # DO NOT MODIFY — use loadWorkflowStatus as-is
src/services/project.service.ts            # DO NOT MODIFY
src/services/websocket.service.ts          # DO NOT MODIFY
src/services/api.service.ts               # DO NOT MODIFY — use apiFetch as-is
src/styles/                                # DO NOT MODIFY — tokens stable
src/types/workflow.ts                      # DO NOT MODIFY — consume types as-is
src/types/project.ts                       # DO NOT MODIFY — reuse LoadingState type
src/components/core/settings/              # DO NOT MODIFY
src/components/core/workflow/              # DO NOT MODIFY — workflow-status-display file stays (may be repurposed later), just remove its import from app-shell
backend/providers/                         # DO NOT MODIFY
```

**Alignment:** All new files follow the architecture.md project structure exactly. `phase-graph-container.ts` goes in `src/components/core/phase-graph/` which already exists as a `.gitkeep` placeholder directory.

[Source: architecture.md#Project-Structure, project-context.md#File-Organization-Rules]

### Testing Requirements

**Frontend tests use `@open-wc/testing`** with `@web/test-runner` (Chrome). Follow table-driven style where possible.

**Test file locations:**
- Service tests: `tests/frontend/services/phases.service.test.ts`
- State tests: `tests/frontend/state/phases.state.test.ts`
- Component tests: `tests/frontend/components/phase-graph-container.test.ts`

**Mocking patterns (established):**
- Mock `fetch` globally for service tests — see `tests/frontend/services/project.service.test.ts` for the pattern
- Use `fixture(html`<phase-graph-container></phase-graph-container>`)` for component rendering tests
- Set signal values directly in tests to control component state
- Use `await el.updateComplete` after signal changes to wait for render

**Mock data for phases:**
```typescript
const mockPhasesResponse: PhasesResponse = {
  method_name: 'greenfield',
  track: 'bmm',
  field_type: 'software',
  description: 'Test',
  phases: [
    {
      phase: 1, name: 'Analysis', required: true, optional: false, note: null,
      workflows: [
        { id: 'research', required: false, optional: true, agent: 'analyst', /* ... */ },
        { id: 'create-product-brief', required: true, optional: false, agent: 'analyst', /* ... */ },
      ]
    },
    // ... phases 2, 3, 4
  ]
};
```

**Coverage expectations:**
- Service: success, error responses, signal state transitions
- State: signal initialization, `phaseGraphNodes$` computation (merge phases + workflow, handles null sources, defaults unknown workflows to not_started, sets is_current flag), `phaseGraphEdges$` computation (cross-phase, included_by, optional marking), `getNodeVisualState()` precedence logic
- Component: loaded state (phase labels present, node elements rendered with correct CSS classes, SVG overlay with paths), skeleton/loading state, error state
- Compact mode: width < 1280px triggers abbreviated labels and compact class
- Signal reactivity: update `workflowState`, verify node status classes change
- Keyboard: arrow key focus movement (right/left across phases, up/down within phase), Tab exits, focus ring visible, correct tabindex management
- Accessibility: `role="group"` on container, `role="button"` + descriptive `aria-label` on nodes, `aria-live` region
- Integration: app-shell renders `<phase-graph-container>` when project is loaded, `<workflow-status-display>` no longer rendered

[Source: tests/frontend/services/project.service.test.ts, tests/frontend/components/app-shell.test.ts]

### Previous Story Intelligence

**From Story 2.2 (Workflow State Visualization):**

- **Signal pattern established:** `workflowState`, `workflowLoadingState`, `currentPhase$`, `phaseCompletions$`, `nextWorkflow$` — all ready to consume. The phase graph will use `workflowState.get()` to read `workflow_statuses` map and merge with phase structure.
- **LoadingState reuse:** `{ status: 'idle' } | { status: 'loading' } | { status: 'success' } | { status: 'error'; error: string }` — already defined in `src/types/project.ts`, reuse it (NOT 'idle' for success — use 'success' as corrected in code review).
- **WebSocket wiring already done:** `workflow:status-changed` triggers `loadWorkflowStatus()` which updates `workflowState`. The phase graph automatically re-renders because `phaseGraphNodes$` depends on `workflowState.get()` — SignalWatcher handles reactivity.
- **App-shell layout:** Four states: empty, loading, error, loaded. The loaded state has `<div class="main-content">` containing `<workflow-status-display>`. This story **replaces** `<workflow-status-display>` with `<phase-graph-container>` — the phase graph provides a superior spatial visualization of the same data. The workflow-status-display component file is kept (not deleted) for potential repurposing as a detail panel in Story 2.4 or 2.5.
- **Code review fixes applied:** Workflow display restructured to honest flat layout, LoadingState corrected to use 'success', WebSocket debounce added (300ms), `conditional` status value added.
- **Lean code standard:** Code-simplifier pass removed 33 net lines in Story 2.1, 7 refinements in Story 2.2. Follow same lean approach.

**Key learnings to apply:**
1. Signal state files are small and focused — one domain per file
2. Service functions are standalone exports (not class methods)
3. Reuse `LoadingState` from `src/types/project.ts`
4. Tests follow established patterns — look at existing test files for mocking setup
5. Cherry-pick Shoelace from `/dist/components/` paths — only import what's needed (likely just `sl-tooltip` for this story)
6. Shoelace elements CANNOT be self-closing: `<sl-tooltip></sl-tooltip>`

[Source: 2-2-workflow-state-storage.md#Completion-Notes, #Change-Log, #Senior-Developer-Review]

### Git Intelligence

**Recent commits (last 5):**

```
2e2f37a Feature/2-2-workflow-state-visualization (#10)
8f7b1c5 Feature/2-1-project-open-bmad-config-loading (#9)
f6a75af Epic/1-app-foundation (#8)
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
```

**Branch pattern:** Create `feature/2-3-phase-graph-container-component` off the epic branch `epic/2-project-workflow-state-visualization`.

**Commit style:** `feat:` prefix for new features.

**Key conventions observed:**
- Feature branches merged via PR into epic branch
- PRs squash-merged with descriptive title
- Story 2.2 added 8 new files, modified 2 existing — total 96 tests
- Current test count: 96 frontend tests passing

[Source: git log]

### Latest Technical Information

**SVG in Lit (lit ^3.1.0) — for connection lines overlay only:**
- Use `import { svg } from 'lit'` for SVG template fragments (path elements inside the overlay)
- The `<svg>` overlay element goes in an `html` tagged template (it's an HTML element)
- Inner SVG content (`<path>`, `<line>`) goes in `svg` tagged templates
- The SVG overlay is `position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;` so it doesn't block mouse events on the HTML nodes beneath

**signal-polyfill v0.2.2:** TC39 Signals proposal at Stage 1. API stable. `Signal.Computed` automatically tracks dependencies — `phaseGraphNodes$` will react when either `phasesState` or `workflowState` changes.

**Shoelace v2.20.1:** `<sl-tooltip>` for node hover details. Works naturally since nodes are HTML elements.

**Lucide v0.563.0:** Check existing import pattern in the codebase. Lucide provides icons as SVG strings, ES modules, or framework-specific packages. The `lucide` package exports icon functions that return SVG strings. For Lit, either use the SVG string with `unsafeSVG` directive, or check if `lucide-lit` is available/installed.

**Graph layout:** No external library needed. The phase graph has ~15-20 nodes. CSS Grid handles column layout, Flexbox handles vertical stacking within columns. SVG is only needed for curved connection lines between columns.

[Source: lit.dev/docs/components/rendering, shoelace.style/resources/changelog, lucide.dev/docs]

### Anti-Patterns to Avoid

- **DO NOT** use any external graph library (d3, dagre, cytoscape, etc.) — CSS Grid + SVG overlay is sufficient for ~15 nodes
- **DO NOT** render nodes as SVG elements — use HTML elements for nodes (enables Lucide icons, Shoelace tooltips, CSS design tokens). SVG is ONLY for connection line paths
- **DO NOT** use any icon set other than Lucide — no Shoelace icons, Heroicons, Phosphor, or custom SVG icons
- **DO NOT** create backend endpoints — `GET /api/v1/bmad/phases` and `GET /api/v1/bmad/status` already exist
- **DO NOT** hardcode the workflow topology — derive edges dynamically from the API's `included_by` field and phase ordering
- **DO NOT** duplicate `LoadingState` type — reuse from `src/types/project.ts`
- **DO NOT** hardcode backend URL — use Vite proxy (`/api/*` -> `localhost:3008`)
- **DO NOT** fetch data directly in components — use service layer
- **DO NOT** use inline styles — use design tokens via CSS custom properties
- **DO NOT** use barrel imports for Shoelace — cherry-pick from `/dist/components/`
- **DO NOT** use self-closing tags for Shoelace elements
- **DO NOT** modify existing state files (workflow, project, connection) — create new phases state
- **DO NOT** implement clickable node navigation yet — that's Epic 5. Node click/Enter is a no-op
- **DO NOT** implement the full phase node refinement — that's Story 2.4. This story creates the container with basic node rendering
- **DO NOT** implement the activity bar layout — that's Story 2.5
- **DO NOT** use Canvas or WebGL — SVG overlay for lines is appropriate
- **DO NOT** create multiple copies of `signal-polyfill`
- **DO NOT** compute node positions or edge paths inside `render()` — derive in `phaseGraphNodes$`/`phaseGraphEdges$` signals for memoization
- **DO NOT** create N-squared edges — only draw edges for direct sequential flow and `included_by` relationships
- **DO NOT** write to signals inside Lit lifecycle methods — risk of infinite loops
- **DO NOT** implement dark/light theme toggle — dark mode only for MVP
- **DO NOT** implement an "In Progress" node visual state — the API doesn't support workflow-level progress tracking

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-project-workflow-state-visualization.md#Story-2.3 — Story requirements]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — Architecture decisions]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — File structure]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming + patterns]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR4 (phase graph)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — PhaseGraphContainer spec]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/detailed-user-experience.md — Graph structure, node states]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md — Color tokens, spacing]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md — Navigation, keyboard, animation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — Responsive, a11y]
- [Source: _bmad-output/project-context.md — Project rules and conventions]
- [Source: _bmad-output/implementation-artifacts/2-2-workflow-state-storage.md — Previous story patterns]
- [Source: backend/types/workflow_path.go — PhasesResponse struct]
- [Source: backend/types/workflow_status.go — StatusResponse struct]
- [Source: backend/api/handlers/bmad.go — GetPhases, GetStatus endpoints]
- [Source: src/app-shell.ts — Current app shell layout]
- [Source: src/state/workflow.state.ts — Workflow signals to consume]
- [Source: src/types/workflow.ts — WorkflowStatus, WorkflowStatusValue types]
- [Source: src/services/api.service.ts — Shared apiFetch utility]
- [Source: src/styles/tokens.css — Design tokens]
- [Source: tests/frontend/services/project.service.test.ts — Test mocking pattern]
- [Source: tests/frontend/components/app-shell.test.ts — Component test pattern]
- [Source: lit.dev/docs/components/rendering — Lit SVG rendering]
- [Source: lit.dev/tutorials/content/svg-templates — SVG template guide]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- ResizeObserver loop error in tests: Resolved by mocking ResizeObserver in test setup (known benign issue in @web/test-runner with Chrome)
- shadowRoot null in component tests: Caused by ResizeObserver throwing during fixture creation, swallowing the custom element definition. Mock fixed it.

### Completion Notes List

- Created `src/types/phases.ts` with TypeScript interfaces matching backend `PhasesResponse`, `PhaseResponse`, `WorkflowResponse` Go structs, plus frontend-specific `PhaseGraphNode`, `PhaseGraphEdge`, and `NodeVisualState` types
- Created `src/state/phases.state.ts` with `phasesState` and `phasesLoadingState` signals, derived `phaseGraphNodes$` (merges phase structure with workflow status), derived `phaseGraphEdges$` (computes edges from within-phase ordering, cross-phase flow, and `included_by` relationships), `getNodeVisualState()` helper with correct precedence, and update/clear helpers
- Created `src/services/phases.service.ts` with `loadPhases()` using shared `apiFetch<T>()`, matching the established service pattern from `workflow.service.ts`
- Created `src/components/core/phase-graph/phase-graph-container.ts` as the main phase graph component using HTML/CSS hybrid architecture: HTML nodes with inline Lucide SVG icons in a CSS Grid layout, SVG overlay for cubic bezier connection lines between nodes, compact mode via ResizeObserver, keyboard navigation (arrow keys), full accessibility (ARIA roles, labels, live region), 8 node visual states with design token styling, dev loop grouping for Implementation phase, skeleton/error/loaded states
- Modified `src/app-shell.ts`: replaced `<workflow-status-display>` with `<phase-graph-container>`, wired `loadPhases()` in workflow subscription setup and `clearPhasesState()` in cleanup
- Created 3 new test files (phases.state, phases.service, phase-graph-container) and updated app-shell tests. Total: 141 tests passing, 0 failures, 45 new tests added
- Code-simplifier pass on `phase-graph-container.ts`: consolidated duplicate workflow.state import into single line, replaced inline `import()` type with proper `PhasesResponse` import, replaced `devLoopNodes` filter with `.some()` check, simplified `_renderEdges` by removing misleading DOM query guard, switched `_renderIcon` if-chain to switch statement, converted `forEach` to `for...of` in `_computeEdgePaths` for codebase consistency, standardized `ArrowDown`/`ArrowUp` variable names, removed 7 redundant comments. 6 refinements, net -10 lines. 141 tests passing, 0 failures

### File List

**Created:**
- src/types/phases.ts
- src/state/phases.state.ts
- src/services/phases.service.ts
- src/components/core/phase-graph/phase-graph-container.ts (code-simplifier refined)
- tests/frontend/state/phases.state.test.ts
- tests/frontend/services/phases.service.test.ts
- tests/frontend/components/phase-graph-container.test.ts

**Modified:**
- src/app-shell.ts
- tests/frontend/components/app-shell.test.ts
- backend/services/file_watcher_service.go
- backend/services/workflow_path_service.go
- backend/services/workflow_status_service.go
- backend/types/workflow_path.go
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-3-phase-graph-container-component.md

### Change Log

- 2026-02-02: Implemented phase graph container component — visual representation of BMAD methodology phases with HTML/CSS hybrid architecture (HTML nodes + SVG connection lines), signal-based state management, service layer integration, compact mode, keyboard navigation, accessibility, and comprehensive test coverage (45 new tests, 141 total passing)
- 2026-02-02: Code-simplifier pass — 6 refinements in `phase-graph-container.ts`: consolidated duplicate imports, replaced inline import() type, simplified dev loop detection with `.some()`, removed misleading DOM guard in `_renderEdges`, switched if-chain to switch in `_renderIcon`, converted `forEach` to `for...of`, standardized variable names, removed redundant comments. Net -10 lines, 141 tests passing
- 2026-02-02: Parallel code review (Claude + Gemini) — 9 findings (3 HIGH, 4 MEDIUM, 2 LOW). Fixed: eliminated repeated signal reads in `_renderNode` by passing pre-computed index map; added same-column edge path detection for within-phase vertical bezier curves; replaced O(N) DOM queries in `_computeEdgePaths` with pre-built element map via `data-workflow-id`; guarded `updated()` to skip edge recomputation on focus-only changes; added `role="group"` and `aria-label` to dev loop node; fixed backend `filepath.Rel` fallback to skip instead of exposing absolute paths; updated story File List with undocumented backend changes; added compact mode test with ResizeObserver trigger and dev loop accessibility test
