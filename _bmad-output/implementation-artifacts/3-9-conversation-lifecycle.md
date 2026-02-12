# Story 3.9: Conversation Lifecycle

Status: done

## Story

As a **user**,
I want **to choose what happens when I'm done with a conversation**,
So that **I can extract valuable knowledge or cleanly discard** (FR22, FR20).

## Acceptance Criteria

1. **Given** a conversation is active, **When** I trigger the end-of-conversation action (via chat header dropdown or context indicator click), **Then** I see three options: "Keep Working", "Compact into Insight", "Discard".

2. **Given** I select "Keep Working", **When** the action completes, **Then** the conversation remains open and active **And** no data is modified.

3. **Given** I select "Compact into Insight" (FR15), **When** the action begins, **Then** a progress indicator shows compaction is in progress **And** on completion, a stub Insight record is created with: title (derived from conversation summary), source agent, status "fresh", and timestamp **And** the Insight is saved via a POST to the backend `/projects/:id/insights` endpoint **And** the conversation is cleared from memory.

4. **Given** I select "Discard", **When** the action begins, **Then** a confirmation prompt appears: "Discard conversation? This cannot be undone." **And** on confirm, the conversation and its highlights are deleted from memory permanently **And** no Insight is created.

5. **Given** context usage reaches 100% (FR20), **When** the forced modal appears, **Then** only "Compact into Insight" and "Discard" are available (no "Keep Working").

6. **Given** multiple conversations are open, **When** I attempt to close the app, **Then** a single prompt appears: "Multiple conversations open, quit anyway? Yes/No" **And** selecting "Yes" discards all conversations without compaction.

**Scope notes:**
- The "extraction agent" (sending the full conversation to an LLM to generate a structured Insight) is NOT in scope for this story. Compaction creates a **stub Insight** with metadata only (title auto-derived from the first user message, source agent, timestamp). The full extraction pipeline is a future story.
- Insight persistence uses a new backend REST endpoint. The frontend calls the backend; the backend writes the JSON file.
- The `beforeunload` listener for AC #6 is best-effort; Tauri may override browser unload behavior, so the guard only fires in dev mode (Vite dev server in browser).

## Tasks / Subtasks

- [ ] Task 1: Add Insight types and state (AC: #3)
  - [ ] 1.1: Create `src/types/insight.ts` with `InsightStatus = 'fresh' | 'used' | 'archived'` and `Insight` interface: `{ id: string; title: string; originContext: string; extractedIdea: string; tags: string[]; highlightColorsUsed: string[]; createdAt: string; sourceAgent: string; status: InsightStatus; usedInCount: number; }`
  - [ ] 1.2: Create `src/state/insight.state.ts` with `insightsState` signal (`Signal.State<Insight[]>`) and `addInsight(insight: Insight)` helper

- [ ] Task 2: Add backend Insight endpoint (AC: #3)
  - [ ] 2.1: Create `backend/types/insight.go` with `Insight` struct matching the frontend type (JSON-tagged fields)
  - [ ] 2.2: Create `backend/storage/insight_store.go` with `InsightStore` struct: `SaveInsight(projectName string, insight Insight) error` that writes JSON to `~/bmad-studio/projects/{project-name}/insights/{insight-id}.json`, creating directories as needed
  - [ ] 2.3: Create `backend/services/insight_service.go` with `InsightService` that wraps `InsightStore` and exposes `CreateInsight(projectName string, insight Insight) error`
  - [ ] 2.4: Create `backend/api/handlers/insights.go` with `POST /projects/:id/insights` handler that accepts an Insight JSON body, validates required fields (id, title, status), and calls `InsightService.CreateInsight`
  - [ ] 2.5: Register the route in the router (same file where other project routes are registered)

- [ ] Task 3: Create `src/services/insight.service.ts` frontend service (AC: #3)
  - [ ] 3.1: Create `src/services/insight.service.ts` with `createInsight(projectId: string, insight: Insight): Promise<void>` that POSTs to `/projects/${projectId}/insights`
  - [ ] 3.2: On success, call `addInsight(insight)` to update local state

- [ ] Task 4: Add conversation lifecycle actions to chat.state.ts (AC: #2, #3, #4)
  - [ ] 4.1: Add `removeConversation(conversationId: string): void` to `chat.state.ts` that deletes the conversation from the `activeConversations` map
  - [ ] 4.2: Add `clearAgentConversation(agentId: string): void` to `agent.state.ts` that removes the agent-to-conversation mapping
  - [ ] 4.3: Add `getActiveConversationCount(): number` helper to `chat.state.ts` that returns `activeConversations.get().size`

- [ ] Task 5: Create `conversation-lifecycle-menu.ts` component (AC: #1, #2, #3, #4, #5)
  - [ ] 5.1: Create `src/components/core/chat/conversation-lifecycle-menu.ts` as `@customElement('conversation-lifecycle-menu')`
  - [ ] 5.2: Add properties: `@property({ type: Boolean }) open = false`, `@property({ type: Boolean }) forceAction = false` (true when context is at 100%)
  - [ ] 5.3: Render a dropdown/popover with three buttons: "Keep Working" (hidden when `forceAction`), "Compact into Insight", "Discard"
  - [ ] 5.4: Each button dispatches a custom event: `lifecycle-keep`, `lifecycle-compact`, `lifecycle-discard`
  - [ ] 5.5: Style with design tokens: `--bmad-color-bg-elevated` background, `--bmad-color-border-primary` border, `--bmad-radius-md` border radius, `--bmad-shadow-md` shadow
  - [ ] 5.6: Add keyboard navigation: arrow keys to move between options, Enter to select, Escape to close
  - [ ] 5.7: Add `role="menu"` on container, `role="menuitem"` on each button, auto-focus first item on open

- [ ] Task 6: Create discard confirmation dialog (AC: #4)
  - [ ] 6.1: Create `src/components/core/chat/discard-confirm-dialog.ts` as `@customElement('discard-confirm-dialog')`
  - [ ] 6.2: Render a Shoelace `<sl-dialog>` with label "Discard conversation?", message "This cannot be undone.", and two buttons: "Cancel" and "Discard"
  - [ ] 6.3: Dispatch `discard-confirmed` event on Discard click, `discard-cancelled` on Cancel or dialog close
  - [ ] 6.4: Add `@property({ type: Boolean, reflect: true }) open = false`

- [ ] Task 7: Create context-full modal (AC: #5)
  - [ ] 7.1: Create `src/components/core/chat/context-full-modal.ts` as `@customElement('context-full-modal')`
  - [ ] 7.2: Render a Shoelace `<sl-dialog>` with label "Context window full", message explaining the user must compact or discard
  - [ ] 7.3: Show only two buttons: "Compact into Insight" and "Discard" (no "Keep Working")
  - [ ] 7.4: Dispatch `lifecycle-compact` and `lifecycle-discard` events respectively
  - [ ] 7.5: Add `@property({ type: Boolean, reflect: true }) open = false`, prevent closing via overlay click or Escape (use `no-header-close` and prevent `sl-request-close`)

- [ ] Task 8: Integrate lifecycle menu into chat-panel (AC: #1, #2, #3, #4, #5)
  - [ ] 8.1: Import `conversation-lifecycle-menu.ts`, `discard-confirm-dialog.ts`, `context-full-modal.ts` in `chat-panel.ts`
  - [ ] 8.2: Add `@state() private _showLifecycleMenu = false`, `@state() private _showDiscardConfirm = false`, `@state() private _showContextFullModal = false`
  - [ ] 8.3: Add a dropdown trigger button (Lucide `more-vertical` icon) in the panel header next to the agent-badge
  - [ ] 8.4: Wire `context-indicator-click` event to open the lifecycle menu
  - [ ] 8.5: Handle `lifecycle-keep`: close menu, no action
  - [ ] 8.6: Handle `lifecycle-compact`: close menu, create stub Insight (title from first user message or "Untitled conversation", sourceAgent from activeAgent, status "fresh"), call `insight.service.createInsight()`, then call `removeConversation()` and `clearAgentConversation()` to clear conversation from memory, reset `_conversationId`
  - [ ] 8.7: Handle `lifecycle-discard`: close menu, show discard confirmation dialog
  - [ ] 8.8: Handle `discard-confirmed`: call `removeConversation()` and `clearAgentConversation()`, reset `_conversationId`
  - [ ] 8.9: Watch `_getContextPercentage()` -- when it reaches 100, set `_showContextFullModal = true`
  - [ ] 8.10: Render the lifecycle menu, discard dialog, and context-full modal in the template

- [ ] Task 9: Add beforeunload guard for multiple conversations (AC: #6)
  - [ ] 9.1: In `chat-panel.ts`, add a `connectedCallback` that registers a `window.addEventListener('beforeunload', handler)`
  - [ ] 9.2: The handler checks `getActiveConversationCount() > 1` and if so, sets `e.preventDefault()` to trigger the browser's native "Leave page?" prompt
  - [ ] 9.3: Clean up the listener in `disconnectedCallback`

- [ ] Task 10: Write tests (AC: #1, #2, #3, #4, #5)
  - [ ] 10.1: Create `tests/frontend/components/conversation-lifecycle-menu.test.ts` -- renders 3 options, hides "Keep Working" when forceAction, dispatches correct events, keyboard navigation, Escape closes
  - [ ] 10.2: Create `tests/frontend/components/discard-confirm-dialog.test.ts` -- renders dialog text, dispatches discard-confirmed on Discard click, dispatches discard-cancelled on Cancel
  - [ ] 10.3: Create `tests/frontend/components/context-full-modal.test.ts` -- renders 2 options only, dispatches correct events, cannot be dismissed via Escape
  - [ ] 10.4: Create `tests/backend/services/insight_service_test.go` -- tests InsightService.CreateInsight writes JSON file to correct path, validates required fields
  - [ ] 10.5: Create `tests/backend/handlers/insights_test.go` -- tests POST /projects/:id/insights returns 201, rejects invalid body with 400

## Dev Notes

### Critical Architecture Patterns

**This story creates 5 new frontend files (3 components, 1 service, 1 types file) + 1 new state file + 4 new backend files (types, storage, service, handler). It modifies 3 existing files (chat-panel.ts, chat.state.ts, agent.state.ts).**

**Conversations are ephemeral.** They exist only in memory. The lifecycle menu offers three exits: keep working (no-op), compact into Insight (creates persistent Insight, clears conversation), or discard (deletes conversation). There is no "save conversation" action.

**Insight creation in this story is a stub.** The full extraction agent pipeline (sending conversation to LLM, generating structured Insight with extracted ideas) is out of scope. Here we create a minimal Insight record with: title (from first user message), source agent, status "fresh", empty extracted idea, empty tags. Future stories will add the extraction agent.

**Backend follows existing patterns.** The Insight endpoint uses the same routing and handler structure as the existing providers/settings/projects endpoints. Response format: success returns direct payload (no wrapper), error returns `{ "error": { "code": "...", "message": "..." } }`.

**State management flow for compact:** chat-panel calls `insightService.createInsight()` -> backend writes JSON -> on success, chat-panel calls `removeConversation()` + `clearAgentConversation()` -> Signal update triggers re-render -> `willUpdate()` calls `_ensureConversation()` which creates a fresh conversation.

**State management flow for discard:** chat-panel calls `removeConversation()` + `clearAgentConversation()` -> same re-render flow as compact.

[Source: src/state/chat.state.ts -- activeConversations, setConversation]
[Source: src/state/agent.state.ts -- agentConversations, setAgentConversation]
[Source: src/components/core/chat/chat-panel.ts -- willUpdate, _ensureConversation]

### Project Structure Notes

**Files to CREATE:**

```
src/
├── types/
│   └── insight.ts                          # NEW: Insight interface, InsightStatus type
├── state/
│   └── insight.state.ts                    # NEW: insightsState signal, addInsight helper
├── services/
│   └── insight.service.ts                  # NEW: createInsight REST call
└── components/
    └── core/
        └── chat/
            ├── conversation-lifecycle-menu.ts  # NEW: Keep/Compact/Discard dropdown
            ├── discard-confirm-dialog.ts       # NEW: Confirmation dialog for discard
            └── context-full-modal.ts           # NEW: Forced modal at 100% context

backend/
├── types/
│   └── insight.go                          # NEW: Insight struct
├── storage/
│   └── insight_store.go                    # NEW: JSON file persistence
├── services/
│   └── insight_service.go                  # NEW: InsightService wrapper
└── api/
    └── handlers/
        └── insights.go                     # NEW: POST /projects/:id/insights handler

tests/
├── frontend/
│   └── components/
│       ├── conversation-lifecycle-menu.test.ts  # NEW
│       ├── discard-confirm-dialog.test.ts       # NEW
│       └── context-full-modal.test.ts           # NEW
└── backend/
    ├── services/
    │   └── insight_service_test.go              # NEW
    └── handlers/
        └── insights_test.go                     # NEW
```

**Files to MODIFY:**

```
src/
├── state/
│   └── chat.state.ts                # MODIFY: Add removeConversation, getActiveConversationCount
└── state/
    └── agent.state.ts               # MODIFY: Add clearAgentConversation
src/
└── components/
    └── core/
        └── chat/
            └── chat-panel.ts        # MODIFY: Add lifecycle menu integration, header dropdown, context-full modal, beforeunload
```

**Files to NOT Touch:**

```
src/components/core/chat/conversation-block.ts   # DO NOT MODIFY
src/components/core/chat/highlight-popover.ts     # DO NOT MODIFY
src/components/core/chat/chat-input.ts            # DO NOT MODIFY
src/components/shared/markdown-renderer.ts        # DO NOT MODIFY
src/services/chat.service.ts                      # DO NOT MODIFY
```

[Source: project-context.md#Project-Structure]

### Technical Requirements

#### Insight Type (Frontend)

```typescript
// src/types/insight.ts
export type InsightStatus = 'fresh' | 'used' | 'archived';

export interface Insight {
  id: string;
  title: string;
  originContext: string;
  extractedIdea: string;
  tags: string[];
  highlightColorsUsed: string[];
  createdAt: string;        // ISO 8601
  sourceAgent: string;
  status: InsightStatus;
  usedInCount: number;
}
```

#### Insight Type (Backend)

```go
// backend/types/insight.go
type Insight struct {
    ID                 string   `json:"id"`
    Title              string   `json:"title"`
    OriginContext       string   `json:"origin_context"`
    ExtractedIdea       string   `json:"extracted_idea"`
    Tags               []string `json:"tags"`
    HighlightColorsUsed []string `json:"highlight_colors_used"`
    CreatedAt           string   `json:"created_at"`
    SourceAgent         string   `json:"source_agent"`
    Status              string   `json:"status"`
    UsedInCount         int      `json:"used_in_count"`
}
```

#### Insight Storage Path

Insights are stored at `~/bmad-studio/projects/{project-name}/insights/{insight-id}.json`. The `InsightStore` must create the directory tree if it does not exist (`os.MkdirAll`).

#### State Helpers

```typescript
// Add to chat.state.ts:
export function removeConversation(conversationId: string): void {
  const map = new Map(activeConversations.get());
  map.delete(conversationId);
  activeConversations.set(map);
}

export function getActiveConversationCount(): number {
  return activeConversations.get().size;
}

// Add to agent.state.ts:
export function clearAgentConversation(agentId: string): void {
  const map = new Map(agentConversations.get());
  map.delete(agentId);
  agentConversations.set(map);
}
```

#### Stub Insight Creation (in chat-panel)

```typescript
// When user selects "Compact into Insight":
const conversation = activeConversations.get().get(this._conversationId);
const firstUserMsg = conversation?.messages.find(m => m.role === 'user');
const agent = activeAgent$.get();

const insight: Insight = {
  id: crypto.randomUUID(),
  title: firstUserMsg?.content.slice(0, 100) || 'Untitled conversation',
  originContext: '',      // Stub -- extraction agent will fill this
  extractedIdea: '',      // Stub -- extraction agent will fill this
  tags: [],
  highlightColorsUsed: [...new Set(conversation?.highlights.map(h => h.color) ?? [])],
  createdAt: new Date().toISOString(),
  sourceAgent: agent?.name || 'Unknown',
  status: 'fresh',
  usedInCount: 0,
};
```

#### Lifecycle Menu Component

```typescript
// conversation-lifecycle-menu.ts render():
render() {
  return html`
    <div class="menu" role="menu" aria-label="Conversation actions">
      ${!this.forceAction ? html`
        <button class="menu-item" role="menuitem" @click=${this._keepWorking}>
          Keep Working
        </button>
      ` : nothing}
      <button class="menu-item" role="menuitem" @click=${this._compact}>
        Compact into Insight
      </button>
      <button class="menu-item menu-item--danger" role="menuitem" @click=${this._discard}>
        Discard
      </button>
    </div>
  `;
}
```

#### Backend Handler

```go
// POST /projects/:id/insights
func (h *InsightHandler) CreateInsight(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    var insight types.Insight
    if err := json.NewDecoder(r.Body).Decode(&insight); err != nil {
        writeError(w, http.StatusBadRequest, "invalid_body", "Invalid JSON body")
        return
    }
    if insight.ID == "" || insight.Title == "" || insight.Status == "" {
        writeError(w, http.StatusBadRequest, "missing_fields", "id, title, and status are required")
        return
    }
    if err := h.service.CreateInsight(projectID, insight); err != nil {
        writeError(w, http.StatusInternalServerError, "create_failed", err.Error())
        return
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(insight)
}
```

### Architecture Compliance

- **Service layer pattern:** Frontend components never call the backend directly -- `insight.service.ts` handles all REST communication
- **State flow:** `insight.service.ts` -> `insight.state.ts` (signal) -> components subscribe
- **Signal-driven rendering:** chat-panel is SignalWatcher; removing conversation from `activeConversations` triggers re-render, which calls `_ensureConversation()` to create a fresh one
- **Shoelace integration:** Discard dialog and context-full modal use `<sl-dialog>` (already available in the project)
- **Design tokens:** All styling via CSS custom properties, no inline styles except dynamic values
- **Dark mode only (MVP):** All structural colors via tokens
- **Accessibility:** `role="menu"`, `role="menuitem"`, keyboard navigation, `<sl-dialog>` provides built-in a11y
- **Lucide icons only:** Dropdown trigger uses `more-vertical` Lucide icon
- **Error handling:** Backend returns `{ "error": { "code": "...", "message": "..." } }`; frontend REST service handles errors with try/catch

[Source: project-context.md#Framework-Specific-Rules]
[Source: project-context.md#Architectural-Boundaries]

### Library & Framework Requirements

No new dependencies. All required libraries are already installed:
- `lit` -- Web Components framework
- `@lit-labs/signals` -- Signal-based state management
- `signal-polyfill` -- Signal polyfill
- Shoelace -- `<sl-dialog>` for confirmation dialogs (already available)
- Go `chi` router -- already used for API routing
- Go `os` / `encoding/json` -- standard library for file I/O

### File Structure Requirements

5 new frontend files, 1 new state file, 4 new backend files. 3 modified files. 5 new test files.

### Testing Requirements

**Frontend tests (`@open-wc/testing`):**

```typescript
// conversation-lifecycle-menu.test.ts
describe('conversation-lifecycle-menu', () => {
  it('renders 3 options when not forceAction');
  it('hides Keep Working when forceAction is true');
  it('dispatches lifecycle-keep on Keep Working click');
  it('dispatches lifecycle-compact on Compact click');
  it('dispatches lifecycle-discard on Discard click');
  it('navigates with arrow keys');
  it('selects with Enter key');
  it('closes on Escape');
  it('has role="menu" on container');
  it('has role="menuitem" on each option');
});

// discard-confirm-dialog.test.ts
describe('discard-confirm-dialog', () => {
  it('renders dialog with correct title');
  it('dispatches discard-confirmed on Discard click');
  it('dispatches discard-cancelled on Cancel click');
});

// context-full-modal.test.ts
describe('context-full-modal', () => {
  it('renders only Compact and Discard (no Keep Working)');
  it('dispatches lifecycle-compact on Compact click');
  it('dispatches lifecycle-discard on Discard click');
  it('cannot be dismissed via Escape');
});
```

**Backend tests (Go table-driven):**

```go
// insight_service_test.go
func TestCreateInsight(t *testing.T) {
    // Test writes JSON file to correct path in temp dir
    // Test validates required fields
}

// insights_test.go (handler)
func TestCreateInsightHandler(t *testing.T) {
    // Test POST returns 201 with valid body
    // Test POST returns 400 with missing fields
    // Test POST returns 400 with invalid JSON
}
```

[Source: tests/frontend/components/highlight-popover.test.ts -- existing test patterns]
[Source: tests/backend/services/ -- existing Go test patterns]

### Previous Story Intelligence

**From Story 3.8 (Text Highlighting):**
- Highlights array is on the `Conversation` object in `activeConversations` signal
- `addHighlight` / `removeHighlight` are in `chat.state.ts`
- Conversation-block passes `conversationId` and `highlights` as properties
- `_ensureConversation()` in chat-panel creates conversations with `highlights: []`

**From Story 3.7 (Context Indicator):**
- `context-indicator` dispatches `context-indicator-click` on click -- this is the hook for opening the lifecycle menu
- `_getContextPercentage()` in chat-panel computes context usage -- when it returns 100, open the forced modal
- Context indicator uses `role="meter"` with proper aria attributes

**From Story 3.3 (Agent Selection & Parallel Conversations):**
- `agentConversations` maps agent IDs to conversation IDs
- `setAgentConversation` / `getAgentConversationId` manage this mapping
- When an agent's conversation is discarded, we must also clear this mapping
- Multiple conversations can be open simultaneously (one per agent)

**From Story 3.4 (Chat Panel):**
- `willUpdate()` in chat-panel handles agent switches and conversation creation
- When `_conversationId` is reset to empty string, `_ensureConversation()` creates a new conversation on next render
- `repeat()` directive with keyed `msg.id` renders message list

### Existing Patterns to Follow

**Event dispatch pattern:**
```typescript
this.dispatchEvent(new CustomEvent('lifecycle-compact', {
  bubbles: true,
  composed: true,
}));
```

**REST service pattern (from existing services):**
```typescript
const response = await fetch(`http://localhost:3008/projects/${projectId}/insights`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(insight),
});
if (!response.ok) throw new Error(`Failed to create insight: ${response.statusText}`);
```

**Backend handler pattern (from existing handlers):**
```go
func writeError(w http.ResponseWriter, status int, code, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": map[string]string{"code": code, "message": message},
    })
}
```

### Anti-Patterns to Avoid

- **DO NOT** implement full extraction agent pipeline -- only create a stub Insight with metadata
- **DO NOT** persist conversation data to disk -- conversations are ephemeral in-memory only
- **DO NOT** modify conversation-block, highlight-popover, chat-input, or markdown-renderer
- **DO NOT** add new npm dependencies -- use existing Lit + Shoelace
- **DO NOT** use inline styles except for dynamic values
- **DO NOT** mix icon sets -- Lucide only
- **DO NOT** break existing conversation flow (agent switching, message sending, streaming)
- **DO NOT** skip beforeunload cleanup in disconnectedCallback

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.9 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md -- Conversation model, Insight storage, REST API]
- [Source: _bmad-output/implementation-artifacts/3-8-text-highlighting-in-conversations.md -- Previous story patterns]
- [Source: src/components/core/chat/chat-panel.ts -- Chat panel structure, _ensureConversation, willUpdate]
- [Source: src/components/core/chat/context-indicator.ts -- context-indicator-click event]
- [Source: src/state/chat.state.ts -- activeConversations, setConversation, addHighlight]
- [Source: src/state/agent.state.ts -- agentConversations, setAgentConversation]
- [Source: src/types/conversation.ts -- Conversation, Message, Highlight types]
- [Source: src/services/chat.service.ts -- sendMessage, chat event handling]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Created `src/types/insight.ts` with Insight interface, InsightStatus type. Created `src/state/insight.state.ts` with insightsState signal and addInsight helper.
- Task 2: Created backend Insight pipeline: `backend/types/insight.go` (Insight struct), `backend/storage/insight_store.go` (JSON file persistence with directory creation), `backend/services/insight_service.go` (validation + persistence wrapper), `backend/api/handlers/insights.go` (POST handler). Registered route in `backend/api/router.go` under `/projects/{id}/insights`.
- Task 3: Created `src/services/insight.service.ts` with `createInsight()` that POSTs to backend and updates local state.
- Task 4: Added `removeConversation()` and `getActiveConversationCount()` to `chat.state.ts`. Added `clearAgentConversation()` to `agent.state.ts`.
- Task 5: Created `conversation-lifecycle-menu.ts` with 3 options (Keep Working, Compact into Insight, Discard), keyboard navigation (arrow keys, Enter, Escape), `role="menu"` + `role="menuitem"`, auto-focus on open, and `forceAction` mode.
- Task 6: Created `discard-confirm-dialog.ts` using Shoelace `<sl-dialog>` with Cancel/Discard buttons and custom events.
- Task 7: Created `context-full-modal.ts` using Shoelace `<sl-dialog>` with no-header-close, prevents Escape/overlay dismissal, shows only Compact and Discard options.
- Task 8: Integrated all lifecycle components into `chat-panel.ts`: added more-vertical dropdown trigger in header, wired context-indicator-click to open lifecycle menu, implemented compact (creates stub Insight via service, clears conversation), discard (shows confirmation dialog, clears conversation), context-full modal (triggers at 100% context with guard flag). Added `beforeunload` guard for multiple conversations.
- Task 9: Added `connectedCallback`/`disconnectedCallback` with `beforeunload` listener that prevents page close when multiple conversations are open.
- Task 10: Created 3 frontend test files (conversation-lifecycle-menu, discard-confirm-dialog, context-full-modal) and 3 backend test files (insight_store_test, insight_service_test, insights_test integration).

### Code-Simplifier Pass

- No simplification changes needed. Implementation follows established patterns consistently.
- All new components are lean and focused on their single responsibility.
- State helpers are minimal one-line functions matching existing patterns in chat.state.ts and agent.state.ts.

### Change Log

- Created `src/types/insight.ts` -- Insight interface and InsightStatus type
- Created `src/state/insight.state.ts` -- insightsState signal, addInsight helper
- Created `src/services/insight.service.ts` -- createInsight REST service
- Created `src/components/core/chat/conversation-lifecycle-menu.ts` -- lifecycle dropdown menu
- Created `src/components/core/chat/discard-confirm-dialog.ts` -- discard confirmation dialog
- Created `src/components/core/chat/context-full-modal.ts` -- forced modal at 100% context
- Modified `src/state/chat.state.ts` -- added removeConversation, getActiveConversationCount
- Modified `src/state/agent.state.ts` -- added clearAgentConversation
- Modified `src/components/core/chat/chat-panel.ts` -- integrated lifecycle menu, dialogs, modals, beforeunload
- Created `backend/types/insight.go` -- Insight struct
- Created `backend/storage/insight_store.go` -- JSON file persistence
- Created `backend/services/insight_service.go` -- InsightService with validation
- Created `backend/api/handlers/insights.go` -- POST /projects/:id/insights handler
- Modified `backend/api/router.go` -- registered insights route and InsightService in RouterServices
- Created `tests/frontend/components/conversation-lifecycle-menu.test.ts` -- 10 tests
- Created `tests/frontend/components/discard-confirm-dialog.test.ts` -- 5 tests
- Created `tests/frontend/components/context-full-modal.test.ts` -- 6 tests
- Created `backend/storage/insight_store_test.go` -- 3 tests
- Created `backend/services/insight_service_test.go` -- 4 tests
- Created `backend/tests/api/insights_test.go` -- 3 integration tests

### File List

- src/types/insight.ts (CREATED)
- src/state/insight.state.ts (CREATED)
- src/services/insight.service.ts (CREATED)
- src/components/core/chat/conversation-lifecycle-menu.ts (CREATED)
- src/components/core/chat/discard-confirm-dialog.ts (CREATED)
- src/components/core/chat/context-full-modal.ts (CREATED)
- src/state/chat.state.ts (MODIFIED)
- src/state/agent.state.ts (MODIFIED)
- src/components/core/chat/chat-panel.ts (MODIFIED)
- backend/types/insight.go (CREATED)
- backend/storage/insight_store.go (CREATED)
- backend/services/insight_service.go (CREATED)
- backend/api/handlers/insights.go (CREATED)
- backend/api/router.go (MODIFIED)
- tests/frontend/components/conversation-lifecycle-menu.test.ts (CREATED)
- tests/frontend/components/discard-confirm-dialog.test.ts (CREATED)
- tests/frontend/components/context-full-modal.test.ts (CREATED)
- backend/storage/insight_store_test.go (CREATED)
- backend/services/insight_service_test.go (CREATED)
- backend/tests/api/insights_test.go (CREATED)

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. The story correctly scopes down the extraction agent to a stub Insight. The three UI components (lifecycle-menu, discard-dialog, context-full-modal) are appropriately decomposed -- each serves a distinct UI purpose and maps to specific acceptance criteria.

#### Dependency Policy
No issues found. No new dependencies required. Uses existing Lit, Shoelace (`<sl-dialog>`), and Go standard library (`encoding/json`, `os`).

#### Effort-to-Value Ratio
No issues found. 10 tasks total: Tasks 1-4 are infrastructure (types, state, backend, service), Tasks 5-7 are UI components, Task 8 is integration, Task 9 is the beforeunload guard, Task 10 is tests. Each task maps to at least one acceptance criterion.

#### Scope Creep
No issues found. The full extraction agent pipeline is explicitly excluded. Only a stub Insight with metadata is created. The story stays within the conversation lifecycle boundary.

#### Feasibility
**[MEDIUM] `_getContextPercentage()` threshold for AC #5.** The current implementation in chat-panel computes context usage from cumulative token counts across all messages. The 100% threshold detection in Task 8.9 should be checked in `willUpdate()` or `updated()` to trigger the modal reactively. Be aware that `_getContextPercentage()` can return 100 repeatedly across renders -- the modal should only open once (guard with a flag to avoid re-triggering).

**[MEDIUM] Backend test location.** The story specifies tests at `tests/backend/services/insight_service_test.go` and `tests/backend/handlers/insights_test.go`, but existing backend tests follow two patterns: (1) co-located tests in the same package (e.g., `backend/services/chat_service_test.go`), and (2) integration tests in `backend/tests/api/`. The dev should follow the established patterns: put unit tests co-located with the source files (`backend/storage/insight_store_test.go`, `backend/services/insight_service_test.go`) and handler integration tests in `backend/tests/api/insights_test.go`.

### Summary

- **HIGH:** 0
- **MEDIUM:** 2
- **LOW:** 0

### Notes for Development

- For Task 8.9 (context-full modal trigger): add a `_contextFullShown` flag to chat-panel so the modal is only shown once per conversation reaching 100%. Reset the flag when conversation changes.
- For Task 10 backend tests: place unit tests co-located with source files (e.g., `backend/storage/insight_store_test.go`) and handler tests in `backend/tests/api/insights_test.go`, following existing project patterns.

## Code Review

**Reviewers:** Claude (parallel review)
**Verdict:** approved (1 HIGH fixed automatically)
**Date:** 2026-02-04

### Findings

1. **[HIGH] Frontend Insight interface used camelCase keys but Go backend expects snake_case JSON tags.** When `JSON.stringify()` serialized the TypeScript Insight object, camelCase keys like `originContext` were sent, but Go's `json.Decode` expected `origin_context` (from struct tags). **FIX APPLIED:** Changed `src/types/insight.ts` to use snake_case keys (`origin_context`, `extracted_idea`, `highlight_colors_used`, `created_at`, `source_agent`, `used_in_count`). Updated `chat-panel.ts` Insight creation to use matching keys. This follows the pattern established by other wire types in `conversation.ts` (e.g., `conversation_id`, `message_id`).

### Findings Not Fixed (LOW)

1. **[LOW] `agentConversations` import unused in chat-panel.ts** -- This was pre-existing (imported but not directly referenced in the component body). Not introduced by this story.

2. **[LOW] Lifecycle menu does not close on outside click** -- The menu dispatches `lifecycle-dismiss` on Escape but does not detect outside clicks. This is acceptable for v1; a click-outside handler could be added in a future improvement pass.
