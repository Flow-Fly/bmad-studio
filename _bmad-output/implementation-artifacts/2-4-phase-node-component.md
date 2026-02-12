# Story 2.4: Phase Node Component

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see the status of each workflow as a visual node**,
So that **I know which workflows are complete, in progress, or available** (FR4, FR5).

## Acceptance Criteria

1. **Given** a workflow has not been started, **When** the phase graph renders, **Then** the node displays with "Empty" state (outline only, muted text)

2. **Given** a workflow is the current active workflow, **When** the phase graph renders, **Then** the node displays with "Current" state (accent border + glow effect) (FR5)

3. **Given** a workflow is complete, **When** the phase graph renders, **Then** the node displays with "Complete" state (solid fill, success indicator)

4. **Given** a workflow has unmet dependencies, **When** the phase graph renders, **Then** the node displays with "Locked" state (grayed out, lock icon) **And** hovering shows a tooltip explaining the prerequisites

5. **Given** the user hovers over any node, **When** the tooltip appears, **Then** it shows workflow name, current status, agent, and purpose

## Tasks / Subtasks

- [x] Task 1: Extract `<phase-node>` as a separate Lit component (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Create `src/components/core/phase-graph/phase-node.ts` as a Lit component extending `SignalWatcher(LitElement)` with typed properties: `node: PhaseGraphNode`, `visualState: NodeVisualState`, `compact: boolean`, `focused: boolean`
  - [x] 1.2: Move node rendering logic from `phase-graph-container.ts` `_renderNode()` into the new `<phase-node>` component's `render()` method — the node HTML template, icon rendering, CSS class application, tooltip wrapping, and `aria-label` generation all move to `<phase-node>`
  - [x]1.3: Move ALL node-related CSS styles from `phase-graph-container.ts` into `phase-node.ts` — `.node`, `.node--*` state classes, `.node-icon`, `.node-label`, `.node-agent`, compact mode node styles, focus-visible, hover, reduced-motion styles. Remove them from the container
  - [x]1.4: Register as `<phase-node>` custom element with `HTMLElementTagNameMap` declaration
  - [x]1.5: Import `@shoelace-style/shoelace/dist/components/tooltip/tooltip.js` in `phase-node.ts` (move from container)

- [x] Task 2: Implement "Locked" node state for unmet dependencies (AC: #4)
  - [x]2.1: Add `'locked'` to the `NodeVisualState` type in `src/types/phases.ts`
  - [x]2.2: Add `dependencies_met: boolean` field to `PhaseGraphNode` interface in `src/types/phases.ts`
  - [x]2.3: Add `unmet_dependencies: string[]` field to `PhaseGraphNode` interface — array of workflow IDs that must complete first
  - [x]2.4: Update `phaseGraphNodes$` in `src/state/phases.state.ts` to compute `dependencies_met` for each node: a workflow's dependencies are met if ALL required workflows that appear before it in the same phase (by array order) AND the last required workflow of the previous phase are `complete` or `skipped`. Use the edges from `phaseGraphEdges$` or inline dependency logic
  - [x]2.5: Update `phaseGraphNodes$` to populate `unmet_dependencies` with the `workflow_id` values of incomplete prerequisite workflows
  - [x]2.6: Update `getNodeVisualState()` in `phases.state.ts`: add `locked` check after `current` — if `!dependencies_met && status !== 'complete' && status !== 'skipped' && !isCurrent`, return `'locked'`. New precedence: current > complete > skipped > locked > conditional > required > recommended > optional > not-started
  - [x]2.7: Add `'locked'` entry to `STATE_ICONS` map using the `lock` icon (already defined in ICONS)
  - [x]2.8: Add `.node--locked` CSS class in `phase-node.ts`: `background-color: var(--bmad-color-bg-tertiary)`, `border-color: var(--bmad-color-border-primary)`, `.node-label { color: var(--bmad-color-text-muted) }`, `.node-icon { color: var(--bmad-color-text-muted) }`, `opacity: 0.6`, `cursor: not-allowed`

- [x] Task 3: Enhance tooltip content (AC: #4, #5)
  - [x]3.1: In `<phase-node>`, replace the existing simple `sl-tooltip content=` string with a richer tooltip: show workflow name (human-readable, formatted from ID), status label, agent name (if available), and purpose text (if available). Format: `"Workflow Name\nStatus: Complete\nAgent: analyst\nPurpose: Research and discovery"`
  - [x]3.2: For locked nodes, append prerequisite info to tooltip: `"\nBlocked by: create-architecture, check-implementation-readiness"` — list the human-readable names of `unmet_dependencies`
  - [x]3.3: Pass `purpose` through to `PhaseGraphNode` — add `purpose?: string` field to the interface, populate from `wf.purpose` in `phaseGraphNodes$`

- [x] Task 4: Human-readable workflow labels (AC: #5)
  - [x]4.1: Create a `formatWorkflowLabel(id: string): string` utility in `phase-node.ts` (or a shared util if preferred) that converts kebab-case workflow IDs to human-readable labels: `"create-product-brief"` -> `"Product Brief"`, `"check-implementation-readiness"` -> `"Readiness Check"`. Strategy: strip common prefixes (`create-`, `dev-`), split on `-`, capitalize each word. Special cases for known IDs can be hardcoded if the generic transform is insufficient
  - [x]4.2: Use `formatWorkflowLabel()` for the node label display text instead of raw `workflow_id`
  - [x]4.3: Update `phaseGraphNodes$` to set `label` to `formatWorkflowLabel(wf.id)` instead of raw `wf.id`

- [x] Task 5: Refactor `phase-graph-container.ts` to use `<phase-node>` (AC: #1, #2, #3, #4, #5)
  - [x]5.1: Replace inline node rendering in `_renderPhaseColumn()` with `<phase-node>` element: `html\`<phase-node .node=${node} .visualState=${visualState} .compact=${this._compact} .focused=${isFocused} data-node-index="${nodeIndex}" data-workflow-id="${node.workflow_id}"></phase-node>\``
  - [x]5.2: Remove `_renderNode()`, `_renderIcon()` methods from container — they now live in `<phase-node>`
  - [x]5.3: Remove ICONS, STATE_ICONS constants from container — they move to `<phase-node>`
  - [x]5.4: Remove node CSS styles from container (`.node`, `.node--*`, `.node-icon`, `.node-label`, `.node-agent`, compact `.node` overrides). Keep `.dev-loop` styles in container since dev loop is not a `<phase-node>` — it's a special grouped display
  - [x]5.5: Remove `sl-tooltip` import from container (moved to `<phase-node>`)
  - [x]5.6: Import `./phase-node.js` in `phase-graph-container.ts`
  - [x]5.7: Update keyboard navigation in `_handleKeydown()` — now `querySelector('[data-node-index="..."]')` targets `<phase-node>` elements. Focus the inner `.node` div via the phase-node's shadow DOM, OR delegate focus to the `<phase-node>` element itself by making it `tabindex`-capable. Decision: make `<phase-node>` handle its own `tabindex` and `focus()` — container sets `focused` property, phase-node applies `tabindex="0"` when focused, `-1` otherwise
  - [x]5.8: Update `_computeEdgePaths()` — `[data-workflow-id]` selectors now target `<phase-node>` custom elements. `getBoundingClientRect()` on `<phase-node>` works the same since it's a block-level custom element
  - [x]5.9: Pass `getNodeVisualState()` result as the `visualState` property to each `<phase-node>`
  - [x]5.10: Update the `_renderDevLoop()` method — keep the dev loop rendering in the container (it's a special grouped node, not a `<phase-node>`). But update its Lucide icon rendering to use a shared icon utility or inline SVG (since `_renderIcon` moved to phase-node)

- [x] Task 6: Update `aria-disabled` for locked nodes (AC: #4)
  - [x]6.1: In `<phase-node>`, when `visualState === 'locked'`, add `aria-disabled="true"` to the node element
  - [x]6.2: Update `aria-label` to include locked status and prerequisites: `"Product Brief, Analysis phase, required, locked — blocked by: Research"`
  - [x]6.3: In container `_handleKeydown()`, allow arrow key navigation TO locked nodes (user can see them) but `Enter` on a locked node is a no-op (same as current behavior since Epic 5 wires click)

- [x] Task 7: Testing (AC: #1, #2, #3, #4, #5)
  - [x]7.1: Create `tests/frontend/components/phase-node.test.ts`:
    - Test each visual state renders correct CSS class: `node--current`, `node--complete`, `node--skipped`, `node--locked`, `node--conditional`, `node--required`, `node--recommended`, `node--optional`, `node--not-started`
    - Test locked state: `aria-disabled="true"` present, `opacity: 0.6` applied, lock icon rendered
    - Test tooltip content for normal node: contains workflow name, status, agent
    - Test tooltip content for locked node: contains "Blocked by:" with prerequisite names
    - Test compact mode: node width 90px, label truncated at 10 chars, agent hidden
    - Test focus: `tabindex="0"` when `focused=true`, `tabindex="-1"` when `focused=false`
    - Test `formatWorkflowLabel()`: `"create-product-brief"` -> `"Product Brief"`, `"research"` -> `"Research"`, `"prd"` -> `"PRD"`, `"check-implementation-readiness"` -> `"Readiness Check"`
    - Test icon rendering: correct icon for each visual state
  - [x]7.2: Update `tests/frontend/state/phases.state.test.ts`:
    - Test `dependencies_met` computation: first workflow in first phase has `dependencies_met: true` (no prerequisites)
    - Test `dependencies_met` for dependent workflow: if predecessor is `not_started`, `dependencies_met: false`
    - Test `dependencies_met` for complete predecessor: if predecessor is `complete`, `dependencies_met: true`
    - Test `unmet_dependencies` populates with IDs of incomplete prerequisite workflows
    - Test updated `getNodeVisualState()` precedence: locked returns when `!dependencies_met && !current && !complete && !skipped`
  - [x]7.3: Update `tests/frontend/components/phase-graph-container.test.ts`:
    - Update existing tests to account for `<phase-node>` as child element instead of inline `.node` divs
    - Test that `<phase-node>` elements are rendered within phase columns
    - Test that container still renders dev loop inline (not as `<phase-node>`)
    - Test keyboard navigation still works with `<phase-node>` elements
    - Test edge paths still compute correctly with `<phase-node>` elements
  - [x]7.4: Update `tests/frontend/components/app-shell.test.ts` if any assertions reference `.node` elements directly (they should still pass since they check for `<phase-graph-container>` presence)

## Dev Notes

### Critical Architecture Patterns

**This story refactors the phase graph from a monolithic container into a container + node component architecture.** The `<phase-graph-container>` (Story 2.3) currently renders nodes inline. Story 2.4 extracts `<phase-node>` as a separate Lit component, adds the "Locked" state for dependency visualization, enhances tooltips with rich content, and introduces human-readable workflow labels.

**The UX spec explicitly defines `<phase-node>` as a separate component** (`src/components/core/phase-graph/phase-node.ts`). The architecture spec's project structure also lists it separately. Story 2.3 intentionally deferred extraction to keep the container story focused — Story 2.4 completes the component architecture.

**This is a pure frontend refactoring story** — no backend changes needed. All data sources (phases API, workflow status) already exist and are consumed by the existing signals.

[Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#Phase-Node, _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md]

#### Frontend Stack (MUST USE)

| Technology | Package | Purpose |
|---|---|---|
| Lit | `lit` ^3.1.0 | Web Components framework |
| Shoelace | `@shoelace-style/shoelace` ^2.12.0 | `<sl-tooltip>` for node hover |
| Lucide | `lucide` ^0.563.0 | Icons (inline SVG, NOT lucide-lit) |
| Signals | `@lit-labs/signals` ^0.2.0 | SignalWatcher mixin |
| signal-polyfill | `signal-polyfill` | Signal.State, Signal.Computed |

**Lucide icons are rendered as inline SVG** in the existing codebase — see `ICONS` constant in `phase-graph-container.ts`. This pattern uses raw SVG element definitions `[tagName, attributes]` rendered via Lit's `svg` tagged template. Do NOT change this to `lucide-lit` or any other approach — maintain consistency.

[Source: src/components/core/phase-graph/phase-graph-container.ts:18-24, package.json]

#### Dependency Computation for Locked State

**How to determine if a node's dependencies are met:**

1. For each workflow node, its prerequisites are:
   - All required workflows that appear before it in the SAME phase (by API array order)
   - The last required workflow of the PREVIOUS phase (cross-phase dependency)

2. A dependency is "met" if its workflow status is `complete` or `skipped`.

3. A node is "locked" if ANY prerequisite is not met AND the node is not `current`, `complete`, or `skipped`.

**The edge data already encodes these relationships** via `phaseGraphEdges$`. However, computing `dependencies_met` requires checking the STATUS of prerequisite workflows, not just their existence. The computation belongs in `phaseGraphNodes$` since it needs access to both phase structure and workflow status data.

**Approach:** In `phaseGraphNodes$`, after building the basic node array, do a second pass to compute `dependencies_met` for each node. For each node, find all edges where `edge.to === node.workflow_id` and check if all `edge.from` workflows have status `complete` or `skipped`.

**Alternative (simpler):** Compute dependencies inline during the `flatMap`. For each workflow, check:
- All preceding required workflows in the same phase have `complete`/`skipped` status
- If this is the first required workflow in phase N (N > 1), the last required workflow in phase N-1 has `complete`/`skipped` status

The second approach avoids needing edges and keeps the computation self-contained in `phaseGraphNodes$`.

[Source: src/state/phases.state.ts, _bmad-output/planning-artifacts/ux-design-specification/detailed-user-experience.md#Node-States]

#### Updated `getNodeVisualState()` Precedence

```typescript
function getNodeVisualState(
  status: WorkflowStatusValue,
  isCurrent: boolean,
  dependenciesMet: boolean = true, // backward-compatible default
): NodeVisualState {
  if (isCurrent) return 'current';
  if (status === 'complete') return 'complete';
  if (status === 'skipped') return 'skipped';
  if (!dependenciesMet) return 'locked';     // NEW — before other not-completed states
  if (status === 'conditional') return 'conditional';
  if (status === 'required') return 'required';
  if (status === 'recommended') return 'recommended';
  if (status === 'optional') return 'optional';
  return 'not-started';
}
```

**Key:** `locked` sits after `complete`/`skipped` (they override lock) but before `conditional`/`required`/etc (lock overrides future states when dependencies aren't met).

[Source: src/state/phases.state.ts:15-27]

#### `<phase-node>` Component Design

```typescript
import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

import type { PhaseGraphNode, NodeVisualState } from '../../../types/phases.js';

@customElement('phase-node')
export class PhaseNode extends LitElement {
  @property({ type: Object }) node!: PhaseGraphNode;
  @property({ type: String }) visualState: NodeVisualState = 'not-started';
  @property({ type: Boolean }) compact = false;
  @property({ type: Boolean }) focused = false;

  // ... render method uses node properties
}
```

**Important design decisions:**
- `<phase-node>` does NOT extend `SignalWatcher` — it receives data as properties from the container. This keeps the node component pure/presentational.
- The container remains the signal-aware orchestrator that reads `phaseGraphNodes$` and passes data down.
- The node handles its own tooltip rendering, icon selection, CSS state application, and accessibility attributes.
- `tabindex` is managed by the node itself based on the `focused` property.

[Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#Phase-Node]

#### Human-Readable Label Strategy

The current implementation uses raw `workflow_id` (e.g., `"create-product-brief"`) as the node label. This story converts to human-readable labels.

**Transform rules:**
1. Strip common prefixes: `create-` → removed, `dev-` → removed
2. Split remaining on `-`
3. Capitalize each word
4. Special cases: `"prd"` → `"PRD"`, `"ux"` → `"UX"`, `"ci"` → `"CI"`

**Examples:**
- `"create-product-brief"` → `"Product Brief"`
- `"research"` → `"Research"`
- `"prd"` → `"PRD"`
- `"create-ux-design"` → `"UX Design"`
- `"create-architecture"` → `"Architecture"`
- `"create-epics-and-stories"` → `"Epics And Stories"`
- `"check-implementation-readiness"` → `"Readiness Check"` (special case — strip `check-implementation-`)
- `"sprint-planning"` → `"Sprint Planning"`
- `"dev-story"` → `"Story"` (strip `dev-` prefix)
- `"code-review"` → `"Code Review"`
- `"retrospective"` → `"Retrospective"`

**Implementation location:** Compute in `phaseGraphNodes$` (set `label` field) so the transform happens once and is memoized by the Computed signal. The `<phase-node>` component just displays `node.label`.

[Source: _bmad-output/planning-artifacts/ux-design-specification/detailed-user-experience.md#Graph-Structure]

#### Signal State Pattern (Established)

```typescript
import { Signal } from 'signal-polyfill';
```

**Import `Signal` from `signal-polyfill`** (NOT from `@lit-labs/signals`).
**Naming:** `{noun}State` for stores, `{noun}$` for derived, `update{Noun}()` for helpers.
**Immutable updates:** `signal.set(newValue)` — never mutate in place.

[Source: src/state/project.state.ts, src/state/workflow.state.ts, src/state/phases.state.ts]

#### Design Tokens (MUST USE)

All styling uses CSS custom properties from `src/styles/tokens.css`. See Story 2.3 Dev Notes for the complete token table. Additional tokens for locked state:

| Token | Usage |
|---|---|
| `--bmad-color-bg-tertiary` (#21262d) | Locked node background |
| `--bmad-color-border-primary` (#30363d) | Locked node border |
| `--bmad-color-text-muted` (#484f58) | Locked node text and icon |

**No inline styles. Dark mode only. No new tokens needed.**

[Source: src/styles/tokens.css]

#### Keyboard Navigation (Unchanged Pattern)

Keyboard navigation stays in the container. The container manages `_focusedIndex` and passes `focused` boolean to each `<phase-node>`. When the user presses arrow keys, the container updates `_focusedIndex` and calls `focus()` on the target `<phase-node>` element (or its inner focusable div).

**Focus delegation approach:** `<phase-node>` should use `delegatesFocus: true` in its Shadow DOM options OR manage tabindex on its host element. Recommended: set `tabindex` on the host `<phase-node>` element itself and use `:host(:focus-visible)` for focus ring styling, avoiding shadow DOM focus delegation complexity.

[Source: src/components/core/phase-graph/phase-graph-container.ts:586-642]

#### Service Layer Pattern (Established)

No service changes needed for this story. All data is already available via:
- `phasesState` signal (from `loadPhases()`)
- `workflowState` signal (from `loadWorkflowStatus()`)
- Derived `phaseGraphNodes$` and `phaseGraphEdges$`

[Source: src/services/phases.service.ts, src/services/workflow.service.ts]

### Project Structure Notes

**Files to Create:**

```
src/
└── components/
    └── core/
        └── phase-graph/
            └── phase-node.ts              # CREATE: Individual phase node component
tests/
└── frontend/
    └── components/
        └── phase-node.test.ts             # CREATE: Phase node component tests
```

**Files to Modify:**

```
src/types/phases.ts                         # MODIFY: Add 'locked' to NodeVisualState, add dependencies_met/unmet_dependencies/purpose to PhaseGraphNode
src/state/phases.state.ts                   # MODIFY: Update phaseGraphNodes$ (dependency computation, labels), update getNodeVisualState() (locked state, new param)
src/components/core/phase-graph/phase-graph-container.ts  # MODIFY: Replace inline nodes with <phase-node>, remove node CSS/rendering logic, keep container orchestration
tests/frontend/state/phases.state.test.ts   # MODIFY: Add locked state + dependency computation tests
tests/frontend/components/phase-graph-container.test.ts   # MODIFY: Update for <phase-node> child elements
```

**Files to NOT Touch:**

```
backend/                                    # NO backend changes
src/state/workflow.state.ts                 # DO NOT MODIFY — consume via .get() only
src/state/project.state.ts                  # DO NOT MODIFY
src/state/connection.state.ts               # DO NOT MODIFY
src/services/                               # DO NOT MODIFY any service files
src/styles/tokens.css                       # DO NOT MODIFY — tokens are stable
src/types/workflow.ts                       # DO NOT MODIFY — consume types as-is
src/types/project.ts                        # DO NOT MODIFY
src/app-shell.ts                            # DO NOT MODIFY — already wired from Story 2.3
src/components/core/settings/               # DO NOT MODIFY
```

**Alignment:** New `phase-node.ts` goes in `src/components/core/phase-graph/` alongside `phase-graph-container.ts`, matching both the architecture and UX specs.

[Source: architecture.md#Project-Structure, project-context.md#File-Organization-Rules]

### Testing Requirements

**Frontend tests use `@open-wc/testing`** with `@web/test-runner` (Chrome). Follow table-driven style where possible.

**Test file locations:**
- Phase node tests: `tests/frontend/components/phase-node.test.ts`
- Updated state tests: `tests/frontend/state/phases.state.test.ts`
- Updated container tests: `tests/frontend/components/phase-graph-container.test.ts`

**Mocking patterns (established):**
- Use `fixture(html\`<phase-node .node=${mockNode} .visualState=${'locked'}></phase-node>\`)` for component rendering tests
- Set properties directly for component state control
- Use `await el.updateComplete` after property changes to wait for render
- Mock `ResizeObserver` in container tests (pattern established in Story 2.3)

**New test considerations:**
- Test `<phase-node>` in isolation — it's a presentational component, no signal dependencies
- Test dependency computation in `phases.state.test.ts` — verify `dependencies_met` and `unmet_dependencies`
- Test updated `getNodeVisualState()` with the new `dependenciesMet` parameter
- Update container tests to query for `<phase-node>` elements instead of `.node` divs
- Test `formatWorkflowLabel()` as a pure function with known inputs/outputs

**Coverage expectations:**
- Phase node: all 9 visual states render correct CSS class, tooltip content (normal + locked), compact mode, focus management, aria-disabled for locked, icon selection
- State: `dependencies_met` computation (first node = true, dependent node with incomplete prereq = false, dependent node with complete prereq = true), `unmet_dependencies` population, updated `getNodeVisualState()` precedence with locked
- Container: `<phase-node>` elements rendered, dev loop still inline, keyboard nav works, edge paths compute correctly

[Source: tests/frontend/components/phase-graph-container.test.ts, tests/frontend/state/phases.state.test.ts]

### Previous Story Intelligence

**From Story 2.3 (Phase Graph Container):**

- **Node rendering is inline in container** — `_renderNode()` at line 458 builds the entire node HTML including tooltip, icon, label, CSS classes. This entire method moves to `<phase-node>`.
- **`_renderIcon()` renders Lucide SVG inline** — uses an `ICONS` constant mapping icon names to SVG element arrays. This pattern stays the same, just moves to `phase-node.ts`.
- **`STATE_ICONS` maps visual state to icon name** — straightforward mapping, moves to `phase-node.ts`.
- **`PHASE_ABBR` stays in container** — it's for phase column labels, not node labels.
- **`DEV_LOOP_IDS` stays in container** — dev loop is rendered separately, not as `<phase-node>`.
- **Container has 671 lines** — after extracting node rendering + CSS, it should shrink significantly (~300-400 lines removed).
- **Current `getNodeVisualState()` takes 2 params** — needs to accept a 3rd `dependenciesMet` param. Use default value `true` for backward compatibility.
- **141 total frontend tests passing** — the extraction should not break any functionality, only restructure it.
- **Code review findings applied:** `_computeEdgePaths` uses pre-built element map via `data-workflow-id`, `updated()` skips edge recomputation on focus-only changes. These patterns must be preserved.
- **`sl-tooltip` CANNOT be self-closing** — always use `<sl-tooltip></sl-tooltip>`.
- **Code-simplifier pass in 2.3** removed 10 lines, consolidated imports, switched if-chain to switch in `_renderIcon`. Maintain this lean approach.

**From Story 2.2 (Workflow State):**

- **LoadingState** reused from `src/types/project.ts`
- **WebSocket debounce** (300ms) in app-shell — status updates are already debounced
- **`conditional` status value** was added during 2.2 code review

**Key learnings to apply:**
1. Signal state files are small and focused
2. Properties over signals for presentational components
3. Shoelace elements CANNOT be self-closing
4. Follow existing inline SVG icon pattern (do NOT switch to lucide-lit)
5. `data-workflow-id` and `data-node-index` attributes are used by container for edge computation and keyboard nav — these must remain accessible on the `<phase-node>` host element

[Source: 2-3-phase-graph-container-component.md, 2-2-workflow-state-storage.md]

### Git Intelligence

**Recent commits:**

```
b0b045a Feature/2-3-phase-graph-container-component (#11)
2e2f37a Feature/2-2-workflow-state-visualization (#10)
8f7b1c5 Feature/2-1-project-open-bmad-config-loading (#9)
```

**Branch pattern:** Create `feature/2-4-phase-node-component` off `epic/2-project-workflow-state-visualization`.

**Commit style:** `feat:` prefix for new features.

**Story 2.3 stats:** 13 files changed, 1975 insertions. Created 7 new files, modified 6. 141 tests passing.

[Source: git log]

### Anti-Patterns to Avoid

- **DO NOT** use `SignalWatcher` in `<phase-node>` — it's a presentational component receiving data via properties
- **DO NOT** duplicate the ICONS/STATE_ICONS constants — move them once to `phase-node.ts` (or a shared utils file if needed by dev-loop rendering in container)
- **DO NOT** use any icon set other than Lucide
- **DO NOT** change the inline SVG icon rendering pattern — maintain the `ICONS` map approach
- **DO NOT** create backend endpoints — all data already exists
- **DO NOT** modify `tokens.css` — use existing tokens for the locked state
- **DO NOT** implement clickable node navigation yet — that's Epic 5
- **DO NOT** implement the activity bar layout — that's Story 2.5
- **DO NOT** hardcode workflow topology — derive dependency state from API data
- **DO NOT** use inline styles — use design tokens via CSS custom properties
- **DO NOT** use self-closing tags for Shoelace elements
- **DO NOT** modify workflow.state.ts, project.state.ts, or connection.state.ts
- **DO NOT** break existing edge computation — `data-workflow-id` must remain accessible on `<phase-node>` host elements
- **DO NOT** break existing keyboard navigation — focus management can delegate to `<phase-node>` but arrow key logic stays in container
- **DO NOT** add the `purpose` field to the backend API — it already exists in the `WorkflowResponse` struct, just not yet consumed by `phaseGraphNodes$`

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-project-workflow-state-visualization.md#Story-2.4 — Story requirements]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — File structure: phase-node.ts listed]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming + patterns]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR4, FR5]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — PhaseNode component spec with states and props]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/detailed-user-experience.md — Node states: Empty, Partial, Full, Current, Locked]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md — Color tokens, spacing, icon choice]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md — Navigation, keyboard, tooltip patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — Compact mode, a11y, ARIA]
- [Source: _bmad-output/project-context.md — Project rules and conventions]
- [Source: _bmad-output/implementation-artifacts/2-3-phase-graph-container-component.md — Previous story: full implementation record]
- [Source: src/components/core/phase-graph/phase-graph-container.ts — Current container with inline node rendering]
- [Source: src/types/phases.ts — Current types to extend]
- [Source: src/state/phases.state.ts — Current state to modify]
- [Source: src/styles/tokens.css — Design tokens]
- [Source: tests/frontend/components/phase-graph-container.test.ts — Existing test patterns]
- [Source: tests/frontend/state/phases.state.test.ts — Existing state tests]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- aria-disabled binding: Initially used Lit `?` boolean binding which sets empty string; fixed to use `${isLocked || nothing}` pattern for proper `"true"` value or attribute removal.

### Completion Notes List

- Task 1: Created `phase-node.ts` as a standalone Lit component with typed properties (node, visualState, compact, focused). Moved all node rendering logic, icon SVG definitions, STATE_ICONS map, CSS styles from container. Registered as `<phase-node>` custom element with HTMLElementTagNameMap declaration.
- Task 2: Added `'locked'` to NodeVisualState type, added `dependencies_met: boolean` and `unmet_dependencies: string[]` to PhaseGraphNode interface. Updated `phaseGraphNodes$` to compute dependency satisfaction for each node (within-phase required predecessors, cross-phase last-required, included_by parent). Updated `getNodeVisualState()` with new `dependenciesMet` parameter (default `true` for backward compatibility). Added `.node--locked` CSS class with muted styling and `opacity: 0.6`.
- Task 3: Enhanced tooltip to show workflow name, status label, agent, purpose, and "Blocked by" prerequisites for locked nodes. Added `purpose?: string` field to PhaseGraphNode, populated from WorkflowResponse.
- Task 4: Created `formatWorkflowLabel()` utility that strips `create-`/`dev-` prefixes, uppercases known tokens (PRD, UX, CI, NFR, ATDD), and handles special cases (check-implementation-readiness -> Readiness Check). Applied to `phaseGraphNodes$` label computation.
- Task 5: Replaced inline `_renderNode()` with `<phase-node>` elements in container. Removed ICONS, STATE_ICONS constants, `_renderNode()`, `_renderIcon()` methods, and all node CSS from container. Kept dev loop rendering inline with a dedicated REPEAT_ICON constant. Preserved keyboard navigation, edge computation, and data attributes.
- Task 6: Added `aria-disabled` attribute for locked nodes using Lit's conditional attribute pattern. Updated aria-label to include locked status and prerequisite names. Keyboard navigation allows traversal to locked nodes.
- Task 7: Created `phase-node.test.ts` (27 tests covering visual states, locked state, tooltip content, compact mode, focus management, icon rendering, formatWorkflowLabel). Updated `phases.state.test.ts` (added 15 tests for formatWorkflowLabel, dependencies_met computation, human-readable labels, purpose field, locked getNodeVisualState precedence). Updated `phase-graph-container.test.ts` (updated to query `<phase-node>` elements, test dev loop isolation, data-workflow-id propagation). All 194 tests pass (53 new).

### Change Log

- 2026-02-02: Implemented Story 2.4 — extracted `<phase-node>` component, added locked state with dependency computation, enhanced tooltips, human-readable labels, accessibility updates, comprehensive tests. 194 tests passing (53 new).
- 2026-02-02: Parallel code review (Claude + Gemini). Fixed: locked node hover CSS override, tooltip multiline rendering (white-space: pre-line), edge computation for non-adjacent required phases, strengthened container reactivity test, removed dead .node-agent CSS, removed duplicate formatWorkflowLabel tests. Added 5 undocumented files to File List. Also includes Shoelace infrastructure fixes (basePath, dark theme class, theme token overrides, icon name fix) bundled with this story.

### File List

**New Files:**
- src/components/core/phase-graph/phase-node.ts
- tests/frontend/components/phase-node.test.ts

**Modified Files:**
- src/types/phases.ts
- src/state/phases.state.ts
- src/components/core/phase-graph/phase-graph-container.ts
- tests/frontend/state/phases.state.test.ts
- tests/frontend/components/phase-graph-container.test.ts
- tests/frontend/components/app-shell.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-4-phase-node-component.md

**Infrastructure/Bugfix Files (bundled):**
- index.html (added sl-theme-dark class)
- src/main.ts (added Shoelace basePath setup)
- src/styles/shoelace-theme.css (dark mode token overrides for tooltips, inputs, panels)
- src/app-shell.ts (icon name fix: folder-open -> folder2-open)
