# Story 3.10: Insight Library

Status: review

## Story

As a **user**,
I want **to browse, filter, and manage my Insights per project**,
So that **I can find and reuse knowledge from past conversations** (FR16).

## Acceptance Criteria

1. **Given** the Insights section is active in the activity bar, **When** the `<insight-panel>` renders, **Then** all Insights for the current project are displayed as `<insight-card>` items **And** cards show: title, origin agent, date, tags, 1-2 line content preview **And** cards are sorted by most recent first (default).

2. **Given** an Insight card is displayed, **When** it is in "fresh" status, **Then** it shows a solid dot indicator at full opacity.

3. **Given** an Insight card is displayed, **When** it is in "used" status, **Then** it shows a half dot indicator with "USED" tag and usage count.

4. **Given** an Insight card is displayed, **When** it is in "archived" status, **Then** it is dimmed and only visible when the archived filter is active.

5. **Given** the Insight panel, **When** I use the filter controls, **Then** I can filter by status (fresh, used, archived), tags, and agent origin **And** I can sort by recency, used count, or title.

6. **Given** an Insight card, **When** I click it, **Then** it expands (accordion) to show full content rendered as Markdown **And** the expanded view shows: full origin context, full extracted idea, all tags (editable), highlight colors used, and action buttons.

7. **Given** an expanded Insight card, **When** I use the action buttons, **Then** I can: inject into conversation, edit tags, archive, or delete.

8. **Given** the Insight library is empty, **When** the panel renders, **Then** an empty state displays: "No Insights yet. Compact a conversation to create your first."

9. **Given** the Insight library, **When** rendered, **Then** the card container uses `role="list"` and each card uses `role="listitem"`.

**Scope notes:**
- "Inject into conversation" dispatches an event for story 3-11 to consume. This story wires the button but only dispatches the event -- actual injection is not in scope.
- Tag editing is inline: clicking a tag shows a small input to add/remove tags. Edits update the Insight in state and call the backend to persist.
- Delete calls the backend DELETE endpoint and removes from local state.
- Archive updates status to "archived" via the backend PUT endpoint and updates local state.
- Fuzzy search is deferred to post-MVP (FR17). This story implements a simple substring filter on title and tags.

## Tasks / Subtasks

- [ ] Task 1: Extend backend with GET, PUT, DELETE Insight endpoints (AC: #1, #5, #6, #7)
  - [ ] 1.1: Add `ListInsights(projectName string) ([]Insight, error)` to `InsightStore` -- reads all JSON files from `{baseDir}/{projectName}/insights/` directory, returns sorted by `created_at` descending
  - [ ] 1.2: Add `GetInsight(projectName, insightID string) (Insight, error)` to `InsightStore` -- reads single Insight JSON
  - [ ] 1.3: Add `DeleteInsight(projectName, insightID string) error` to `InsightStore` -- removes the JSON file
  - [ ] 1.4: Add `ListInsights`, `GetInsight`, `UpdateInsight`, `DeleteInsight` to `InsightService` with validation
  - [ ] 1.5: Add `GET /api/v1/projects/{id}/insights` handler -- returns array of all project Insights
  - [ ] 1.6: Add `GET /api/v1/projects/{id}/insights/{insightId}` handler -- returns single Insight
  - [ ] 1.7: Add `PUT /api/v1/projects/{id}/insights/{insightId}` handler -- updates Insight (uses `SaveInsight` which overwrites)
  - [ ] 1.8: Add `DELETE /api/v1/projects/{id}/insights/{insightId}` handler -- deletes Insight
  - [ ] 1.9: Register all new routes in `router.go` under the existing `/{id}` project route group

- [ ] Task 2: Extend frontend Insight service and state (AC: #1, #5, #7)
  - [ ] 2.1: Add `fetchInsights(projectId: string): Promise<Insight[]>` to `insight.service.ts` -- GET request
  - [ ] 2.2: Add `updateInsight(projectId: string, insight: Insight): Promise<void>` to `insight.service.ts` -- PUT request
  - [ ] 2.3: Add `deleteInsight(projectId: string, insightId: string): Promise<void>` to `insight.service.ts` -- DELETE request
  - [ ] 2.4: Add `setInsights(insights: Insight[])`, `updateInsightInState(insight: Insight)`, `removeInsight(insightId: string)` to `insight.state.ts`
  - [ ] 2.5: Add `insightFilters` signal to `insight.state.ts` with type `InsightFilters` (status array, tags array, agentOrigin array, sortBy, searchQuery string)
  - [ ] 2.6: Add `filteredInsights$` computed signal that derives from `insightsState` and `insightFilters`

- [ ] Task 3: Create `<insight-card>` component (AC: #2, #3, #4, #6, #7, #9)
  - [ ] 3.1: Create `src/components/core/insights/insight-card.ts` as `@customElement('insight-card')`
  - [ ] 3.2: Properties: `@property({ type: Object }) insight!: Insight`, `@property({ type: Boolean, reflect: true }) expanded = false`
  - [ ] 3.3: Collapsed view: status dot (solid for fresh, half for used, dimmed for archived), title, source agent, formatted date, tags as `<sl-tag>` elements, 1-2 line content preview from `extracted_idea`
  - [ ] 3.4: Expanded view: full `origin_context` and `extracted_idea` rendered via `<markdown-renderer>`, all tags with inline add/remove editing, highlight color dots, action buttons (Inject, Edit Tags, Archive, Delete)
  - [ ] 3.5: Dispatch events: `insight-inject` (detail: insightId), `insight-update` (detail: updated Insight), `insight-archive` (detail: insightId), `insight-delete` (detail: insightId)
  - [ ] 3.6: Accessibility: `role="listitem"`, `aria-expanded` on card, action buttons with descriptive `aria-label`
  - [ ] 3.7: Style with design tokens: `--bmad-color-bg-elevated` background, `--bmad-color-border-primary` border, archived cards use reduced opacity (0.5)

- [ ] Task 4: Create `<insight-panel>` component (AC: #1, #4, #5, #8, #9)
  - [ ] 4.1: Create `src/components/core/insights/insight-panel.ts` as `@customElement('insight-panel')`
  - [ ] 4.2: Extend `SignalWatcher(LitElement)` to subscribe to `insightsState` and `insightFilters`
  - [ ] 4.3: Header: "Insights" title, sort dropdown (`<sl-select>` with options: recency, used count, title)
  - [ ] 4.4: Search bar: `<sl-input>` with search icon, filters on title and tags (substring match), debounced 200ms
  - [ ] 4.5: Filter controls: status filter buttons (fresh, used, archived as toggle chips), tag filter dropdown, agent origin dropdown
  - [ ] 4.6: Card list: `role="list"` container rendering `<insight-card>` for each filtered/sorted Insight
  - [ ] 4.7: Empty state: centered message "No Insights yet. Compact a conversation to create your first." when no Insights exist
  - [ ] 4.8: Filtered empty state: "No Insights match your filters." when filters produce no results
  - [ ] 4.9: Footer: summary stats "N insights, M used, K archived"
  - [ ] 4.10: Handle card events: `insight-update` calls `updateInsight` service + updates state, `insight-archive` sets status to "archived" via service, `insight-delete` calls `deleteInsight` service + removes from state, `insight-inject` re-dispatches upward for story 3-11
  - [ ] 4.11: Fetch Insights on `connectedCallback` by calling `fetchInsights` service (requires project ID from `projectState`)

- [ ] Task 5: Add "insights" section to activity-bar and app-shell (AC: #1)
  - [ ] 5.1: Add `{ id: 'insights', label: 'Insights', icon: 'lightbulb' }` to `SECTIONS` in `activity-bar.ts`, positioned after "chat"
  - [ ] 5.2: Add the Lucide `lightbulb` icon SVG paths to the `ICONS` record in `activity-bar.ts`
  - [ ] 5.3: Add `case 'insights'` to `_renderContent()` in `app-shell.ts` that renders `<insight-panel>`
  - [ ] 5.4: Import `./components/core/insights/insight-panel.js` in `app-shell.ts`
  - [ ] 5.5: Update keyboard shortcut map in `app-shell.ts`: `'3': 'insights'`, `'4': 'artifacts'` (shift artifacts from 3 to 4)
  - [ ] 5.6: Import `clearInsightState` in `app-shell.ts` and call it in `_cleanupWorkflow()`

- [ ] Task 6: Write frontend tests (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [ ] 6.1: Create `tests/frontend/components/insight-card.test.ts` -- renders collapsed card with title/agent/date/tags, expands on click, renders markdown in expanded view, dispatches insight-inject/insight-update/insight-archive/insight-delete events, shows correct status indicators (solid dot for fresh, half dot for used, dimmed for archived), has role="listitem"
  - [ ] 6.2: Create `tests/frontend/components/insight-panel.test.ts` -- renders list of Insight cards, shows empty state when no Insights, filters by status, sorts by recency/used count/title, shows summary footer, has role="list" on container

- [ ] Task 7: Write backend tests (AC: #1, #5, #7)
  - [ ] 7.1: Add tests to `backend/storage/insight_store_test.go` -- ListInsights returns all Insights sorted, GetInsight returns correct Insight, DeleteInsight removes file
  - [ ] 7.2: Add tests to `backend/services/insight_service_test.go` -- ListInsights, UpdateInsight validation, DeleteInsight
  - [ ] 7.3: Add handler tests to `backend/tests/api/insights_test.go` -- GET list returns 200, GET single returns 200/404, PUT returns 200/400, DELETE returns 204/404

## Dev Notes

### Critical Architecture Patterns

**This story creates 2 new frontend component files (insight-panel.ts, insight-card.ts), modifies 4 existing files (insight.service.ts, insight.state.ts, activity-bar.ts, app-shell.ts), adds 3 new backend methods to InsightStore, adds 4 new methods to InsightService, adds 4 new handler methods, and modifies router.go. Plus 2 new test files and additions to 3 existing test files.**

**Insights are persistent.** Unlike conversations (ephemeral, in-memory), Insights are JSON files stored at `~/bmad-studio/projects/{project-name}/insights/{insight-id}.json`. The backend handles all file I/O; the frontend communicates via REST.

**Service layer pattern must be followed.** `insight-panel` never calls the backend directly. It calls functions in `insight.service.ts`, which makes REST calls and updates `insight.state.ts` signals. Components subscribe to signals via `SignalWatcher`.

**Existing infrastructure from story 3-9:** `src/types/insight.ts` (Insight interface with snake_case keys), `src/state/insight.state.ts` (insightsState signal, addInsight helper), `src/services/insight.service.ts` (createInsight function), `backend/types/insight.go`, `backend/storage/insight_store.go` (SaveInsight), `backend/services/insight_service.go` (CreateInsight), `backend/api/handlers/insights.go` (POST CreateInsight handler), route registered in `router.go`.

**Markdown rendering:** Use the existing `<markdown-renderer>` component (`src/components/shared/markdown-renderer.ts`) for rendering `origin_context` and `extracted_idea` content in the expanded card view. Import as `import '../shared/markdown-renderer.js'`.

[Source: src/types/insight.ts -- Insight interface with snake_case keys]
[Source: src/state/insight.state.ts -- insightsState signal, addInsight, clearInsightState]
[Source: src/services/insight.service.ts -- createInsight, API_BASE constant]
[Source: backend/storage/insight_store.go -- InsightStore with SaveInsight, baseDir path]
[Source: backend/services/insight_service.go -- InsightService with CreateInsight]
[Source: backend/api/handlers/insights.go -- InsightHandler with CreateInsight handler]
[Source: backend/api/router.go -- route registration pattern under /{id}]

### Project Structure Notes

**Files to CREATE:**

```
src/
└── components/
    └── core/
        └── insights/
            ├── insight-panel.ts         # NEW: Insight library browser panel
            └── insight-card.ts          # NEW: Individual Insight card with accordion expand

tests/
└── frontend/
    └── components/
        ├── insight-card.test.ts         # NEW
        └── insight-panel.test.ts        # NEW
```

**Files to MODIFY:**

```
src/
├── services/
│   └── insight.service.ts              # MODIFY: Add fetchInsights, updateInsight, deleteInsight
├── state/
│   └── insight.state.ts                # MODIFY: Add setInsights, updateInsightInState, removeInsight, insightFilters, filteredInsights$
├── components/
│   └── core/
│       └── layout/
│           └── activity-bar.ts         # MODIFY: Add "insights" section with lightbulb icon
└── app-shell.ts                        # MODIFY: Add insights case to _renderContent, import insight-panel, update keyboard shortcuts

backend/
├── storage/
│   └── insight_store.go                # MODIFY: Add ListInsights, GetInsight, DeleteInsight
├── services/
│   └── insight_service.go              # MODIFY: Add ListInsights, GetInsight, UpdateInsight, DeleteInsight
├── api/
│   ├── handlers/
│   │   └── insights.go                 # MODIFY: Add ListInsights, GetInsight, UpdateInsight, DeleteInsight handlers
│   └── router.go                       # MODIFY: Register GET/PUT/DELETE insight routes

tests/
├── backend/
│   ├── storage/
│   │   └── insight_store_test.go       # MODIFY: Add ListInsights, GetInsight, DeleteInsight tests
│   ├── services/
│   │   └── insight_service_test.go     # MODIFY: Add ListInsights, UpdateInsight, DeleteInsight tests
│   └── api/
│       └── insights_test.go            # MODIFY: Add GET list, GET single, PUT, DELETE handler tests
```

**Files to NOT touch:**

```
src/components/core/chat/chat-panel.ts           # DO NOT MODIFY
src/components/core/chat/conversation-block.ts   # DO NOT MODIFY
src/components/core/chat/conversation-lifecycle-menu.ts  # DO NOT MODIFY
src/components/shared/markdown-renderer.ts       # DO NOT MODIFY (use as-is)
src/types/insight.ts                             # DO NOT MODIFY (use existing interface)
```

### Technical Requirements

#### Insight State Extensions

```typescript
// Add to insight.state.ts:
import { Signal } from 'signal-polyfill';
import type { Insight, InsightStatus } from '../types/insight.js';

export interface InsightFilters {
  status: InsightStatus[];
  tags: string[];
  agentOrigin: string[];
  sortBy: 'recency' | 'used_count' | 'title';
  searchQuery: string;
}

export const insightFilters = new Signal.State<InsightFilters>({
  status: ['fresh', 'used'],
  tags: [],
  agentOrigin: [],
  sortBy: 'recency',
  searchQuery: '',
});

export function setInsights(insights: Insight[]): void {
  insightsState.set(insights);
}

export function updateInsightInState(updated: Insight): void {
  insightsState.set(
    insightsState.get().map(i => i.id === updated.id ? updated : i)
  );
}

export function removeInsight(insightId: string): void {
  insightsState.set(insightsState.get().filter(i => i.id !== insightId));
}
```

#### Insight Service Extensions

```typescript
// Add to insight.service.ts:
export async function fetchInsights(projectId: string): Promise<Insight[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights`);
  if (!response.ok) throw new Error(`Failed to fetch insights: ${response.statusText}`);
  return response.json();
}

export async function updateInsight(projectId: string, insight: Insight): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/${insight.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight),
  });
  if (!response.ok) throw new Error(`Failed to update insight: ${response.statusText}`);
}

export async function deleteInsight(projectId: string, insightId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/${insightId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`Failed to delete insight: ${response.statusText}`);
}
```

#### Backend Store Extensions

```go
// Add to insight_store.go:
func (s *InsightStore) ListInsights(projectName string) ([]types.Insight, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    dir := filepath.Join(s.baseDir, projectName, "insights")
    entries, err := os.ReadDir(dir)
    if err != nil {
        if os.IsNotExist(err) { return []types.Insight{}, nil }
        return nil, fmt.Errorf("read insights directory: %w", err)
    }
    var insights []types.Insight
    for _, entry := range entries {
        if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" { continue }
        data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
        if err != nil { continue } // skip unreadable files
        var insight types.Insight
        if err := json.Unmarshal(data, &insight); err != nil { continue } // skip corrupt files
        insights = append(insights, insight)
    }
    // Sort by created_at descending
    sort.Slice(insights, func(i, j int) bool { return insights[i].CreatedAt > insights[j].CreatedAt })
    return insights, nil
}

func (s *InsightStore) GetInsight(projectName, insightID string) (types.Insight, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    filePath := filepath.Join(s.baseDir, projectName, "insights", insightID+".json")
    data, err := os.ReadFile(filePath)
    if err != nil { return types.Insight{}, fmt.Errorf("read insight: %w", err) }
    var insight types.Insight
    if err := json.Unmarshal(data, &insight); err != nil { return types.Insight{}, fmt.Errorf("parse insight: %w", err) }
    return insight, nil
}

func (s *InsightStore) DeleteInsight(projectName, insightID string) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    filePath := filepath.Join(s.baseDir, projectName, "insights", insightID+".json")
    if err := os.Remove(filePath); err != nil { return fmt.Errorf("delete insight: %w", err) }
    return nil
}
```

#### Backend Handler Extensions

```go
// Add to insights.go:
func (h *InsightHandler) ListInsights(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    insights, err := h.service.ListInsights(projectID)
    if err != nil { response.WriteInternalError(w, err.Error()); return }
    response.WriteJSON(w, http.StatusOK, insights)
}

func (h *InsightHandler) GetInsight(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    insightID := chi.URLParam(r, "insightId")
    insight, err := h.service.GetInsight(projectID, insightID)
    if err != nil { response.WriteNotFound(w, "Insight not found"); return }
    response.WriteJSON(w, http.StatusOK, insight)
}

func (h *InsightHandler) UpdateInsight(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    insightID := chi.URLParam(r, "insightId")
    var insight types.Insight
    if err := json.NewDecoder(r.Body).Decode(&insight); err != nil {
        response.WriteInvalidRequest(w, "Invalid JSON body"); return
    }
    insight.ID = insightID // Ensure ID matches URL param
    if err := h.service.UpdateInsight(projectID, insight); err != nil {
        response.WriteInternalError(w, err.Error()); return
    }
    response.WriteJSON(w, http.StatusOK, insight)
}

func (h *InsightHandler) DeleteInsight(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    insightID := chi.URLParam(r, "insightId")
    if err := h.service.DeleteInsight(projectID, insightID); err != nil {
        response.WriteNotFound(w, "Insight not found"); return
    }
    w.WriteHeader(http.StatusNoContent)
}
```

#### Router Registration

```go
// In router.go, under the existing /{id} route group, expand the Insight routes:
if svc.Insight != nil {
    insightHandler := handlers.NewInsightHandler(svc.Insight)
    r.Route("/insights", func(r chi.Router) {
        r.Get("/", insightHandler.ListInsights)
        r.Post("/", insightHandler.CreateInsight)
        r.Route("/{insightId}", func(r chi.Router) {
            r.Get("/", insightHandler.GetInsight)
            r.Put("/", insightHandler.UpdateInsight)
            r.Delete("/", insightHandler.DeleteInsight)
        })
    })
}
```

#### Activity Bar Update

```typescript
// Add to SECTIONS array in activity-bar.ts (after 'chat'):
{ id: 'insights', label: 'Insights', icon: 'lightbulb' },

// Add to ICONS record:
'lightbulb': [
  ['path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' }],
  ['path', { d: 'M9 18h6' }],
  ['path', { d: 'M10 22h4' }],
],
```

#### App Shell Update

```typescript
// In _renderContent(), add before the 'artifacts' case:
case 'insights':
  return html`<insight-panel tabindex="-1"></insight-panel>`;

// Update keyboard shortcut map:
const sectionMap: Record<string, string> = { '1': 'graph', '2': 'chat', '3': 'insights', '4': 'artifacts' };
```

### Architecture Compliance

- **Service layer pattern:** `insight-panel` calls `insight.service.ts` for all backend communication, never fetches directly
- **State flow:** `insight.service.ts` -> `insight.state.ts` (signals) -> components subscribe via `SignalWatcher`
- **Signal-driven rendering:** `insight-panel` extends `SignalWatcher(LitElement)`; signal changes trigger re-render
- **Existing Insight type:** Uses `Insight` interface from `src/types/insight.ts` with snake_case keys (wire-compatible with Go backend)
- **Markdown rendering:** Reuses existing `<markdown-renderer>` component for expanded card content
- **Shoelace integration:** `<sl-tag>` for tags, `<sl-select>` for sort dropdown, `<sl-input>` for search
- **Design tokens:** All styling via CSS custom properties from `tokens.css`, no inline styles
- **Dark mode only (MVP):** All colors via tokens
- **Accessibility:** `role="list"`/`role="listitem"`, `aria-expanded` on cards, `aria-label` on actions
- **Lucide icons only:** Lightbulb icon added to activity bar using inline SVG (same pattern as existing icons)
- **Error handling:** Backend returns `{ "error": { "code": "...", "message": "..." } }`, frontend service throws on error
- **REST conventions:** `GET /projects/:id/insights`, `PUT /projects/:id/insights/:insightId`, `DELETE /projects/:id/insights/:insightId`

[Source: _bmad-output/project-context.md#Framework-Specific-Rules]
[Source: _bmad-output/project-context.md#Architectural-Boundaries]
[Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#API-Communication]

### Library & Framework Requirements

No new dependencies. All required libraries are already installed:
- `lit` -- Web Components framework
- `@lit-labs/signals` + `signal-polyfill` -- Signal-based state management
- Shoelace -- `<sl-tag>`, `<sl-select>`, `<sl-input>` (already available)
- Go `chi` router -- already used for API routing
- Go `os`, `encoding/json`, `sort` -- standard library

### File Structure Requirements

2 new frontend component files, 2 new frontend test files. 4 modified frontend files, 3 modified backend files, 1 modified router file, 3 modified backend test files.

### Testing Requirements

**Frontend tests (`@open-wc/testing`):**

```typescript
// insight-card.test.ts
describe('insight-card', () => {
  it('renders collapsed card with title, agent, date, tags');
  it('shows solid dot for fresh status');
  it('shows half dot and USED tag for used status');
  it('shows dimmed styling for archived status');
  it('expands on click to show full content');
  it('renders markdown in expanded view via markdown-renderer');
  it('dispatches insight-inject event on Inject click');
  it('dispatches insight-update event on tag edit');
  it('dispatches insight-archive event on Archive click');
  it('dispatches insight-delete event on Delete click');
  it('has role="listitem"');
  it('has aria-expanded attribute');
});

// insight-panel.test.ts
describe('insight-panel', () => {
  it('renders list of insight cards');
  it('shows empty state when no insights');
  it('shows filtered empty state when filters match nothing');
  it('filters by status');
  it('sorts by recency (default)');
  it('sorts by used count');
  it('sorts by title');
  it('filters by search query on title and tags');
  it('shows summary footer with counts');
  it('has role="list" on card container');
});
```

**Backend tests (Go table-driven):**

```go
// insight_store_test.go (additions)
func TestListInsights(t *testing.T) { /* returns all insights sorted by created_at desc */ }
func TestListInsightsEmptyDir(t *testing.T) { /* returns empty slice when no insights */ }
func TestGetInsight(t *testing.T) { /* returns specific insight by ID */ }
func TestGetInsightNotFound(t *testing.T) { /* returns error for missing ID */ }
func TestDeleteInsight(t *testing.T) { /* removes file from disk */ }

// insight_service_test.go (additions)
func TestListInsightsService(t *testing.T) { /* delegates to store */ }
func TestUpdateInsight(t *testing.T) { /* validates and saves */ }
func TestDeleteInsightService(t *testing.T) { /* delegates to store */ }

// insights_test.go (additions)
func TestListInsightsHandler(t *testing.T) { /* GET returns 200 with array */ }
func TestGetInsightHandler(t *testing.T) { /* GET returns 200 with insight / 404 */ }
func TestUpdateInsightHandler(t *testing.T) { /* PUT returns 200 / 400 for invalid body */ }
func TestDeleteInsightHandler(t *testing.T) { /* DELETE returns 204 / 404 */ }
```

[Source: tests/frontend/components/conversation-lifecycle-menu.test.ts -- existing frontend test patterns]
[Source: backend/storage/insight_store_test.go -- existing Go test patterns]

### Previous Story Intelligence

**From Story 3.9 (Conversation Lifecycle):**
- Created `src/types/insight.ts` with `Insight` interface using snake_case keys for wire compatibility with Go backend
- Created `src/state/insight.state.ts` with `insightsState` signal, `addInsight` helper, `clearInsightState`
- Created `src/services/insight.service.ts` with `createInsight` function and `API_BASE = 'http://localhost:3008/api/v1'`
- Created backend pipeline: `backend/types/insight.go`, `backend/storage/insight_store.go` (SaveInsight), `backend/services/insight_service.go` (CreateInsight), `backend/api/handlers/insights.go` (POST handler)
- Route registered in `router.go`: `r.Post("/insights", insightHandler.CreateInsight)` under `/{id}` -- **this needs to change to `r.Route("/insights", ...)` to add sub-routes**
- `InsightStore` uses mutex for thread safety and creates directories with `os.MkdirAll`
- Backend response helpers: `response.WriteJSON`, `response.WriteInvalidRequest`, `response.WriteNotFound`, `response.WriteInternalError`
- Code review found snake_case alignment issue between frontend and backend -- already fixed

**From Activity Bar / App Shell:**
- `SECTIONS` array in `activity-bar.ts` defines sections with `{ id, label, icon }` objects
- `ICONS` record maps icon names to SVG element arrays for inline Lucide rendering
- `app-shell.ts` uses `_renderContent()` switch to render section content
- Keyboard shortcuts in `_handleKeydown` map Cmd+number to sections
- `_cleanupWorkflow()` calls all state clear functions on project close

### Anti-Patterns to Avoid

- **DO NOT** fetch data directly in components -- always go through `insight.service.ts`
- **DO NOT** implement full fuzzy search (FR17 is post-MVP) -- use simple substring filter
- **DO NOT** implement the actual "inject into conversation" action -- only dispatch the event for story 3-11
- **DO NOT** modify `src/types/insight.ts` -- the Insight interface is correct as-is
- **DO NOT** add new npm dependencies -- use existing Lit + Shoelace + signal-polyfill
- **DO NOT** use inline styles except for dynamic values (e.g., opacity for archived cards via class)
- **DO NOT** mix icon sets -- Lucide only, use inline SVG pattern from activity-bar
- **DO NOT** break existing POST /insights endpoint -- extend the route group, do not replace
- **DO NOT** skip signal cleanup in `disconnectedCallback`

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.10 -- Story requirements and AC]
- [Source: _bmad-output/project-context.md -- Project rules, conventions, anti-patterns]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md -- Insight storage, REST API]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md -- insight-panel and insight-card specs]
- [Source: _bmad-output/implementation-artifacts/3-9-conversation-lifecycle.md -- Previous story, Insight infrastructure created]
- [Source: src/types/insight.ts -- Insight interface]
- [Source: src/state/insight.state.ts -- insightsState signal]
- [Source: src/services/insight.service.ts -- createInsight, API_BASE]
- [Source: src/components/core/layout/activity-bar.ts -- SECTIONS, ICONS, SVG pattern]
- [Source: src/app-shell.ts -- _renderContent, _handleKeydown, _cleanupWorkflow]
- [Source: backend/storage/insight_store.go -- InsightStore, SaveInsight, baseDir, mutex]
- [Source: backend/services/insight_service.go -- InsightService, CreateInsight]
- [Source: backend/api/handlers/insights.go -- InsightHandler, CreateInsight handler]
- [Source: backend/api/router.go -- Route registration, RouterServices]
- [Source: backend/api/response/errors.go -- WriteError, WriteNotFound, WriteInvalidRequest helpers]
- [Source: backend/api/response/json.go -- WriteJSON helper]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Extended backend with full CRUD for Insights. Added ListInsights, GetInsight, DeleteInsight to InsightStore (with sort, directory-not-exist handling, corrupt file tolerance). Added ListInsights, GetInsight, UpdateInsight, DeleteInsight to InsightService with validation. Added 4 new handler methods (ListInsights, GetInsight, UpdateInsight, DeleteInsight). Migrated router from single POST route to full Route group with GET/POST/PUT/DELETE.
- Task 2: Extended frontend insight.service.ts with fetchInsights, updateInsight, deleteInsight. Extended insight.state.ts with setInsights, updateInsightInState, removeInsight, InsightFilters interface, insightFilters signal, getFilteredInsights function (filtering by status/tags/agent/search + sorting by recency/used_count/title).
- Task 3: Created insight-card.ts component with collapsed view (status dot, title, meta, tags, preview), expanded accordion view (markdown-rendered origin_context and extracted_idea, editable tags with inline add/remove, highlight color dots, action buttons), and event dispatch for inject/update/archive/delete.
- Task 4: Created insight-panel.ts component extending SignalWatcher(LitElement) with header+sort, search bar with 200ms debounce, status filter toggle chips, card list with role="list", empty state and filtered empty state, summary footer, and event handling for card actions (update/archive/delete via service, inject re-dispatched upward).
- Task 5: Added "insights" section to activity-bar with lightbulb Lucide icon (positioned after chat, before artifacts). Updated app-shell to render insight-panel for insights section, updated keyboard shortcuts (Cmd+3=insights, Cmd+4=artifacts), added clearInsightState to cleanup.
- Task 6: Created insight-card.test.ts (12 test cases) and insight-panel.test.ts (10 test cases).
- Task 7: Added 5 store tests, 5 service tests, and 8 handler integration tests for the new CRUD endpoints.

### Change Log

- backend/storage/insight_store.go (MODIFIED) -- Added ListInsights, GetInsight, DeleteInsight methods
- backend/services/insight_service.go (MODIFIED) -- Added ListInsights, GetInsight, UpdateInsight, DeleteInsight
- backend/api/handlers/insights.go (MODIFIED) -- Added ListInsights, GetInsight, UpdateInsight, DeleteInsight handlers
- backend/api/router.go (MODIFIED) -- Migrated insight routes from single POST to full CRUD route group
- src/services/insight.service.ts (MODIFIED) -- Added fetchInsights, updateInsight, deleteInsight
- src/state/insight.state.ts (MODIFIED) -- Added InsightFilters, insightFilters signal, setInsights, updateInsightInState, removeInsight, getFilteredInsights
- src/components/core/insights/insight-card.ts (CREATED) -- Individual Insight card with accordion expand
- src/components/core/insights/insight-panel.ts (CREATED) -- Insight library browser panel
- src/components/core/layout/activity-bar.ts (MODIFIED) -- Added insights section with lightbulb icon
- src/app-shell.ts (MODIFIED) -- Added insights panel rendering, keyboard shortcut, cleanup
- tests/frontend/components/insight-card.test.ts (CREATED) -- 12 tests
- tests/frontend/components/insight-panel.test.ts (CREATED) -- 10 tests
- backend/storage/insight_store_test.go (MODIFIED) -- Added ListInsights, GetInsight, DeleteInsight tests
- backend/services/insight_service_test.go (MODIFIED) -- Added ListInsights, UpdateInsight, DeleteInsight tests
- backend/tests/api/insights_test.go (MODIFIED) -- Added GET list, GET single, PUT, DELETE handler tests

### File List

- backend/storage/insight_store.go (MODIFIED)
- backend/services/insight_service.go (MODIFIED)
- backend/api/handlers/insights.go (MODIFIED)
- backend/api/router.go (MODIFIED)
- src/services/insight.service.ts (MODIFIED)
- src/state/insight.state.ts (MODIFIED)
- src/components/core/insights/insight-card.ts (CREATED)
- src/components/core/insights/insight-panel.ts (CREATED)
- src/components/core/layout/activity-bar.ts (MODIFIED)
- src/app-shell.ts (MODIFIED)
- tests/frontend/components/insight-card.test.ts (CREATED)
- tests/frontend/components/insight-panel.test.ts (CREATED)
- backend/storage/insight_store_test.go (MODIFIED)
- backend/services/insight_service_test.go (MODIFIED)
- backend/tests/api/insights_test.go (MODIFIED)

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. All tasks are standard CRUD backend endpoints, Lit web components composing Shoelace primitives, and signal-based state management. No custom implementations of things that libraries already handle.

#### Dependency Policy
No issues found. "No new dependencies" constraint is backed by `project-context.md` -- all required libraries (Lit, Shoelace, signal-polyfill, Go chi, Go standard library) are already installed.

#### Effort-to-Value Ratio
No issues found. 7 tasks total: 2 infrastructure (backend + service), 2 core components (insight-card, insight-panel), 1 integration (activity-bar + app-shell), 2 testing. All tasks directly serve the story's core value of browsing, filtering, and managing Insights.

#### Scope Creep
No issues found. All tasks trace to specific Acceptance Criteria. "Inject into conversation" is correctly scoped as event-dispatch only (actual injection deferred to story 3-11). Tag editing and archive/delete are required by AC #7.

#### Feasibility
**[MEDIUM] Router migration from single-route to route group.** The current router registers `r.Post("/insights", insightHandler.CreateInsight)` as a single route. This story changes it to `r.Route("/insights", func(r chi.Router) { ... })` to support GET/PUT/DELETE sub-routes. The migration preserves the existing POST endpoint, but the dev must ensure the refactor does not break existing POST functionality -- the `r.Post("/", ...)` inside the route group is equivalent.

**[MEDIUM] Computed signal for filteredInsights$.** The story references a computed/derived signal `filteredInsights$` but the existing code uses `Signal.State` from `signal-polyfill`. The dev should implement filtering as a plain function called in the `SignalWatcher` render cycle rather than a `Signal.Computed` if `signal-polyfill` does not support computed signals cleanly. Alternatively, compute the filtered list inside the `insight-panel` render method directly from `insightsState` and `insightFilters` signals.

### Summary

- **HIGH:** 0
- **MEDIUM:** 2
- **LOW:** 0

### Notes for Development

- For the router migration (Task 1.9): Replace the existing `r.Post("/insights", insightHandler.CreateInsight)` with `r.Route("/insights", func(r chi.Router) { ... })` containing all CRUD routes. The POST route is preserved as `r.Post("/", ...)` inside the group.
- For `filteredInsights$` (Task 2.6): If `Signal.Computed` from `signal-polyfill` works cleanly, use it. Otherwise, compute the filtered/sorted list directly in the `insight-panel` render method from both state signals. Both approaches work with `SignalWatcher`.
