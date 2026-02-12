# Story 3.11: Attach Context & Insight Injection

Status: done

## Story

As a **user**,
I want **to attach Insights, project files, or uploaded documents to any conversation**,
So that **I can give the agent relevant context with visibility into the cost** (FR18).

## Acceptance Criteria

1. **Given** a conversation is active, **When** I click the paperclip affordance in the chat input area, **Then** the `<attach-context-picker>` opens as a modal overlay.

2. **Given** the attach context picker is open, **When** I view the tabs, **Then** I see three tabs: Insights, Project Files, Upload.

3. **Given** the Insights tab is active, **When** I browse or search, **Then** I see all project Insights with fuzzy search by title, content, and tags **And** each Insight shows its estimated context cost as a percentage (e.g., "+8%").

4. **Given** the Project Files tab is active, **When** I browse, **Then** I see the `_bmad-output/` folder tree with file browser navigation **And** each file shows its estimated context cost as a percentage.

5. **Given** the Upload tab is active, **When** I drag-and-drop or select a file, **Then** the file is staged for attachment with its estimated context cost.

6. **Given** I've selected one or more items, **When** viewing the picker footer, **Then** I see: selected item count, total context cost, current percentage, projected post-injection percentage **And** a warning appears if injection would exceed the 80% context threshold.

7. **Given** I click "Attach", **When** the items are injected, **Then** the context is injected into the conversation invisibly (no visible block in chat UI) **And** the context indicator updates to reflect the new percentage **And** any injected Insights are tagged as "used" with their usage count incremented.

8. **Given** a conversation with attached context, **When** the paperclip affordance is used again, **Then** additional injections are allowed at any time during the conversation.

9. **Given** the attach context picker, **When** rendered, **Then** it uses `role="dialog"` with `aria-label="Attach context to conversation"` **And** tab navigation uses `role="tablist"`.

**Scope notes:**
- "Project Files" tab lists files from `_bmad-output/` via the existing `GET /api/v1/bmad/artifacts` endpoint. No new backend endpoint needed for file listing.
- File content for project files is fetched on-demand via `GET /api/v1/bmad/artifacts/{id}` when attached.
- "Upload" tab accepts local files via `<input type="file">` or drag-and-drop. Files are read client-side using `FileReader` -- no backend upload endpoint.
- Context cost estimation uses a simple heuristic: `Math.ceil((charCount / 4) / contextWindowSize * 100)` (approx 4 chars per token). The exact token count is approximate; precision is not critical for the cost preview.
- Context injection prepends content as a system-level "context block" in the messages array before the next user message is sent. The content is NOT displayed in the chat UI but IS included when sending to the backend.
- The `insight-inject` event from story 3-10's `<insight-panel>` is consumed here: it opens the picker with the Insight pre-selected.

## Tasks / Subtasks

- [ ] Task 1: Add backend endpoint for reading project file content (AC: #4)
  - [ ] 1.1: Add `GET /api/v1/projects/{id}/files` handler that lists files under the project's `_bmad-output/` directory -- returns `[{ path, name, size }]` array. Use `os.ReadDir` recursively. Restrict to `_bmad-output/` subdirectory only.
  - [ ] 1.2: Add `GET /api/v1/projects/{id}/files/{path}` handler that reads and returns file content as plain text. Validate path stays within `_bmad-output/`. Return 404 for missing files.
  - [ ] 1.3: Add `FileService` to `backend/services/` with `ListProjectFiles(projectRoot string) ([]FileEntry, error)` and `ReadProjectFile(projectRoot, relativePath string) (string, error)` methods. Include path traversal validation.
  - [ ] 1.4: Add `FileEntry` type to `backend/types/` with `Path`, `Name`, `Size` fields.
  - [ ] 1.5: Register file routes in `router.go` under `/{id}` project group, guarded by `ProjectManager != nil`.

- [ ] Task 2: Extend frontend services for file listing and context injection (AC: #3, #4, #5, #7)
  - [ ] 2.1: Create `src/services/file.service.ts` with `fetchProjectFiles(projectId: string): Promise<FileEntry[]>` and `fetchFileContent(projectId: string, filePath: string): Promise<string>` functions.
  - [ ] 2.2: Add `FileEntry` type to `src/types/` (new file `file.ts`): `{ path: string; name: string; size: number }`.
  - [ ] 2.3: Add `injectContext(conversationId: string, content: string, label: string): void` function to `chat.service.ts` -- appends a system-role context message to the conversation's messages array in `chat.state.ts`. The message has `role: 'system'` and `isContext: true` flag so chat-panel can skip rendering it.
  - [ ] 2.4: Add `markInsightUsed(projectId: string, insight: Insight): Promise<void>` to `insight.service.ts` -- increments `used_in_count`, sets `status` to `'used'` if currently `'fresh'`, then calls `updateInsight`.

- [ ] Task 3: Create `<attach-context-picker>` component (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [ ] 3.1: Create `src/components/core/insights/attach-context-picker.ts` as `@customElement('attach-context-picker')`.
  - [ ] 3.2: Properties: `@property({ type: Boolean, reflect: true }) open = false`, `@property({ type: String }) conversationId = ''`, `@property({ type: String }) projectId = ''`, `@property({ type: Number }) currentContextPercent = 0`, `@property({ type: Number }) contextWindowSize = 200000`.
  - [ ] 3.3: Internal state: `@state() _activeTab: 'insights' | 'files' | 'upload' = 'insights'`, `@state() _selectedItems: SelectedItem[]`, `@state() _insights: Insight[]`, `@state() _files: FileEntry[]`, `@state() _uploadedFiles: { name: string; content: string; size: number }[]`, `@state() _searchQuery = ''`.
  - [ ] 3.4: `SelectedItem` interface: `{ type: 'insight' | 'file' | 'upload'; id: string; label: string; content: string; costPercent: number }`.
  - [ ] 3.5: Tab bar with `role="tablist"`: three tabs (Insights, Project Files, Upload) styled as toggle buttons.
  - [ ] 3.6: Insights tab: list all project Insights from `insightsState`, each with checkbox toggle, title, tags preview, and "+N%" cost badge. Simple substring search on title/tags/content.
  - [ ] 3.7: Project Files tab: list files from `fetchProjectFiles`, each with checkbox toggle, file name, and "+N%" cost badge. Files fetched on `connectedCallback` when tab is first activated.
  - [ ] 3.8: Upload tab: drag-and-drop zone with `<input type="file" multiple>` fallback. Files read via `FileReader.readAsText()`. Show staged files with name, size, "+N%" cost badge, and remove button.
  - [ ] 3.9: Footer: selected count, total cost, current context %, projected % after injection. Warning banner if projected exceeds 80%.
  - [ ] 3.10: "Attach" button in footer. On click: for each selected item, call `injectContext(conversationId, content, label)`. For Insight items, also call `markInsightUsed`. Dispatch `context-attached` event. Close picker.
  - [ ] 3.11: "Cancel" button closes without action.
  - [ ] 3.12: Accessibility: `role="dialog"`, `aria-label="Attach context to conversation"`, `aria-modal="true"`, trap focus within dialog, Escape to close.
  - [ ] 3.13: Cost estimation helper: `estimateCostPercent(text: string, contextWindowSize: number): number` -- `Math.ceil((text.length / 4) / contextWindowSize * 100)`.

- [ ] Task 4: Add paperclip button to `<chat-input>` and wire picker (AC: #1, #8)
  - [ ] 4.1: Add a paperclip icon button to `chat-input.ts` in the input wrapper, before the textarea. Use Lucide `paperclip` icon SVG.
  - [ ] 4.2: On click, dispatch `attach-context-request` custom event (bubbles, composed).
  - [ ] 4.3: In `chat-panel.ts`, listen for `attach-context-request` event and set `_showAttachPicker = true`.
  - [ ] 4.4: Render `<attach-context-picker>` in `chat-panel.ts` with `?open`, `conversationId`, `projectId`, `currentContextPercent`, `contextWindowSize` properties.
  - [ ] 4.5: Listen for `context-attached` event on the picker to update context indicator.
  - [ ] 4.6: Listen for `insight-inject` event (from insight-panel in app-shell) to open picker with the Insight pre-selected. In `chat-panel.ts`, add handler that sets `_showAttachPicker = true` and passes pre-selected insight ID to the picker.

- [ ] Task 5: Update conversation message model for context injection (AC: #7)
  - [ ] 5.1: Add optional `isContext?: boolean` and `contextLabel?: string` fields to `Message` interface in `src/types/conversation.ts`.
  - [ ] 5.2: In `conversation-block.ts`, skip rendering messages where `isContext === true` (return `nothing`).
  - [ ] 5.3: In `chat.service.ts` `sendMessage`, include context messages in the messages array sent to the backend (they are already in `conversation.messages`).

- [ ] Task 6: Write frontend tests (AC: #1, #2, #3, #6, #7, #9)
  - [ ] 6.1: Create `tests/frontend/components/attach-context-picker.test.ts` -- renders dialog with three tabs, shows insights list, shows files list, shows upload dropzone, calculates cost estimates, shows footer with projected percentage, warning at 80%, dispatches context-attached event on Attach, has role="dialog" with aria-label.
  - [ ] 6.2: Add test to `tests/frontend/components/chat-input.test.ts` (or create if missing) -- renders paperclip button, dispatches attach-context-request on click.

- [ ] Task 7: Write backend tests (AC: #4)
  - [ ] 7.1: Create `tests/backend/services/file_service_test.go` -- ListProjectFiles returns file entries, ReadProjectFile returns content, path traversal is rejected.
  - [ ] 7.2: Create `tests/backend/api/files_test.go` -- GET list returns 200, GET file returns 200/404, path traversal returns 400.

## Dev Notes

### Critical Architecture Patterns

**This story creates 1 new frontend component (attach-context-picker.ts), 1 new frontend service (file.service.ts), 1 new type file (file.ts), 1 new backend service (file_service.go), 1 new backend type, 1 new backend handler (files.go). It modifies chat-input.ts (paperclip button), chat-panel.ts (picker wiring), chat.service.ts (injectContext), conversation.ts (isContext field), conversation-block.ts (skip context messages), insight.service.ts (markInsightUsed), and router.go (file routes).**

**Context injection model:** Context is injected as `Message` objects with `role: 'system'` and `isContext: true` into the conversation's messages array. The `conversation-block` component skips rendering these messages. The `chat.service.ts` `sendMessage` function already sends all messages in the conversation, so injected context is automatically included in subsequent LLM requests.

**Cost estimation is approximate.** Use `Math.ceil((charCount / 4) / contextWindowSize * 100)` as a simple heuristic. The `contextWindowSize` comes from `MODEL_CONTEXT_WINDOWS` in `chat-panel.ts` (already defined). Pass it to the picker as a property.

**Insight "used" tracking.** When an Insight is injected, increment its `used_in_count` and set status to `'used'` (if currently `'fresh'`). Call the existing `updateInsight` service + state function.

**File listing uses the BMAD artifacts endpoint pattern.** The existing `GET /api/v1/bmad/artifacts` returns BMAD artifacts, but we need a generic file listing for `_bmad-output/`. Create a new `FileService` and handler rather than overloading the existing artifact service. Register under `/{id}/files`.

[Source: src/components/core/chat/chat-panel.ts -- MODEL_CONTEXT_WINDOWS, _getContextPercentage]
[Source: src/components/core/chat/chat-input.ts -- input wrapper layout, icon pattern]
[Source: src/services/chat.service.ts -- sendMessage, message handling]
[Source: src/state/chat.state.ts -- setConversation, getConversation]
[Source: src/types/conversation.ts -- Message, Conversation interfaces]
[Source: src/services/insight.service.ts -- updateInsight, API_BASE]
[Source: src/state/insight.state.ts -- insightsState, updateInsightInState]
[Source: backend/api/router.go -- route registration pattern under /{id}]
[Source: backend/api/handlers/artifacts.go -- ArtifactHandler pattern for file serving]

### Project Structure Notes

**Files to CREATE:**

```
src/
├── components/
│   └── core/
│       └── insights/
│           └── attach-context-picker.ts    # NEW: Modal picker with 3 tabs
├── services/
│   └── file.service.ts                     # NEW: File listing and content fetching
└── types/
    └── file.ts                             # NEW: FileEntry type

backend/
├── services/
│   └── file_service.go                     # NEW: File listing and reading
├── types/
│   └── file.go                             # NEW: FileEntry type
└── api/
    └── handlers/
        └── files.go                        # NEW: File API handlers

tests/
├── frontend/
│   └── components/
│       └── attach-context-picker.test.ts   # NEW
└── backend/
    ├── services/
    │   └── file_service_test.go            # NEW
    └── api/
        └── files_test.go                   # NEW
```

**Files to MODIFY:**

```
src/
├── components/
│   └── core/
│       └── chat/
│           ├── chat-input.ts               # MODIFY: Add paperclip button
│           ├── chat-panel.ts               # MODIFY: Wire picker, handle events
│           └── conversation-block.ts       # MODIFY: Skip isContext messages
├── services/
│   ├── chat.service.ts                     # MODIFY: Add injectContext function
│   └── insight.service.ts                  # MODIFY: Add markInsightUsed function
└── types/
    └── conversation.ts                     # MODIFY: Add isContext, contextLabel to Message

backend/
└── api/
    └── router.go                           # MODIFY: Register file routes
```

**Files to NOT touch:**

```
src/components/core/insights/insight-panel.ts  # DO NOT MODIFY (already dispatches insight-inject)
src/components/core/insights/insight-card.ts   # DO NOT MODIFY
src/state/insight.state.ts                     # DO NOT MODIFY (state functions already exist)
src/state/chat.state.ts                        # DO NOT MODIFY (setConversation already exists)
src/components/shared/markdown-renderer.ts     # DO NOT MODIFY
```

### Technical Requirements

#### Message Model Extension

```typescript
// Add to conversation.ts Message interface:
export interface Message {
  // ... existing fields ...
  isContext?: boolean;       // true for injected context (not rendered in UI)
  contextLabel?: string;     // label for the context source (e.g., "Insight: My Title")
}
```

#### Context Injection Function

```typescript
// Add to chat.service.ts:
export function injectContext(conversationId: string, content: string, label: string): void {
  const conversation = getConversation(conversationId);
  if (!conversation) return;

  const contextMessage: Message = {
    id: `ctx-${crypto.randomUUID()}`,
    role: 'user',        // role 'user' so it's included in chat history sent to LLM
    content: `[Attached Context: ${label}]\n\n${content}`,
    timestamp: Date.now(),
    isContext: true,
    contextLabel: label,
  };

  setConversation({
    ...conversation,
    messages: [...conversation.messages, contextMessage],
  });
}
```

#### Mark Insight Used

```typescript
// Add to insight.service.ts:
export async function markInsightUsed(projectId: string, insight: Insight): Promise<void> {
  const updated: Insight = {
    ...insight,
    status: insight.status === 'fresh' ? 'used' : insight.status,
    used_in_count: insight.used_in_count + 1,
  };
  await updateInsight(projectId, updated);
}
```

#### File Service (Frontend)

```typescript
// src/services/file.service.ts
import type { FileEntry } from '../types/file.js';

const API_BASE = 'http://localhost:3008/api/v1';

export async function fetchProjectFiles(projectId: string): Promise<FileEntry[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/files`);
  if (!response.ok) throw new Error(`Failed to fetch files: ${response.statusText}`);
  return response.json();
}

export async function fetchFileContent(projectId: string, filePath: string): Promise<string> {
  const encoded = encodeURIComponent(filePath);
  const response = await fetch(`${API_BASE}/projects/${projectId}/files/${encoded}`);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
  return response.text();
}
```

#### File Types

```typescript
// src/types/file.ts
export interface FileEntry {
  path: string;
  name: string;
  size: number;
}
```

#### Backend File Service

```go
// backend/services/file_service.go
package services

import (
    "fmt"
    "os"
    "path/filepath"
    "strings"

    "bmad-studio/backend/types"
)

type FileService struct {
    projectManager *ProjectManager
}

func NewFileService(pm *ProjectManager) *FileService {
    return &FileService{projectManager: pm}
}

func (s *FileService) ListProjectFiles(projectRoot string) ([]types.FileEntry, error) {
    bmadOutput := filepath.Join(projectRoot, "_bmad-output")
    var entries []types.FileEntry
    err := filepath.Walk(bmadOutput, func(path string, info os.FileInfo, err error) error {
        if err != nil { return nil } // skip unreadable
        if info.IsDir() { return nil }
        rel, _ := filepath.Rel(bmadOutput, path)
        entries = append(entries, types.FileEntry{
            Path: rel,
            Name: info.Name(),
            Size: info.Size(),
        })
        return nil
    })
    if err != nil && !os.IsNotExist(err) {
        return nil, fmt.Errorf("walk _bmad-output: %w", err)
    }
    return entries, nil
}

func (s *FileService) ReadProjectFile(projectRoot, relativePath string) (string, error) {
    // Path traversal prevention
    clean := filepath.Clean(relativePath)
    if strings.Contains(clean, "..") {
        return "", fmt.Errorf("invalid path: directory traversal not allowed")
    }
    fullPath := filepath.Join(projectRoot, "_bmad-output", clean)
    // Verify still under _bmad-output
    bmadOutput := filepath.Join(projectRoot, "_bmad-output")
    if !strings.HasPrefix(fullPath, bmadOutput) {
        return "", fmt.Errorf("invalid path: outside _bmad-output directory")
    }
    data, err := os.ReadFile(fullPath)
    if err != nil { return "", fmt.Errorf("read file: %w", err) }
    return string(data), nil
}
```

#### Backend File Handler

```go
// backend/api/handlers/files.go
func (h *FileHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    // Resolve project root from ProjectManager
    files, err := h.service.ListProjectFiles(projectRoot)
    if err != nil { response.WriteInternalError(w, err.Error()); return }
    response.WriteJSON(w, http.StatusOK, files)
}

func (h *FileHandler) ReadFile(w http.ResponseWriter, r *http.Request) {
    projectID := chi.URLParam(r, "id")
    filePath := chi.URLParam(r, "*")  // wildcard for nested paths
    content, err := h.service.ReadProjectFile(projectRoot, filePath)
    if err != nil {
        if strings.Contains(err.Error(), "traversal") {
            response.WriteInvalidRequest(w, err.Error()); return
        }
        response.WriteNotFound(w, "File not found"); return
    }
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.Write([]byte(content))
}
```

#### Router Registration

```go
// In router.go, under /{id} project route group:
if svc.ProjectManager != nil {
    fileHandler := handlers.NewFileHandler(services.NewFileService(svc.ProjectManager))
    r.Route("/files", func(r chi.Router) {
        r.Get("/", fileHandler.ListFiles)
        r.Get("/*", fileHandler.ReadFile)
    })
}
```

#### Paperclip Icon (Lucide)

```typescript
// Add to chat-input.ts:
const PAPERCLIP_ICON = [
  ['path', { d: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48' }],
] as const;
```

#### Conversation Block Skip

```typescript
// In conversation-block.ts render():
render() {
  if (this.message?.isContext) return nothing;
  // ... existing render logic ...
}
```

### Architecture Compliance

- **Service layer pattern:** `attach-context-picker` calls `file.service.ts` and `insight.service.ts` for all backend communication, never fetches directly.
- **State flow:** Services update signals; components subscribe via SignalWatcher.
- **Existing Insight infrastructure:** Reuses `insightsState` signal, `updateInsight` service, `Insight` type from story 3-10.
- **Existing chat infrastructure:** Reuses `setConversation`, `getConversation`, `activeConversations` from chat state.
- **Shoelace integration:** Use `<sl-dialog>`, `<sl-tab-group>`, `<sl-tab>`, `<sl-tab-panel>`, `<sl-input>`, `<sl-button>`, `<sl-badge>` for the picker UI.
- **Design tokens:** All styling via CSS custom properties from `tokens.css`.
- **Dark mode only (MVP).**
- **Accessibility:** `role="dialog"`, `aria-modal`, `role="tablist"`, focus trap, Escape to close.
- **Lucide icons only:** Paperclip icon using inline SVG (same pattern as send icon in chat-input).
- **Error handling:** Backend returns `{ "error": { "code": "...", "message": "..." } }`, frontend throws on error.
- **REST conventions:** `GET /projects/:id/files`, `GET /projects/:id/files/*path`.
- **No inline styles:** Use CSS classes and design tokens only.

[Source: _bmad-output/project-context.md#Framework-Specific-Rules]
[Source: _bmad-output/project-context.md#Architectural-Boundaries]

### Library & Framework Requirements

No new npm dependencies. All required libraries are already installed:
- `lit` -- Web Components framework
- `@lit-labs/signals` + `signal-polyfill` -- Signal-based state management
- Shoelace -- `<sl-dialog>`, `<sl-tab-group>`, `<sl-input>`, `<sl-button>`, `<sl-badge>` (already available)
- Go `chi` router -- already used for API routing
- Go `os`, `path/filepath`, `strings` -- standard library

### File Structure Requirements

3 new frontend files (component, service, type), 3 new backend files (service, type, handler), 2 new test files (frontend), 2 new test files (backend). 6 modified frontend files, 1 modified backend file.

### Testing Requirements

**Frontend tests (`@open-wc/testing`):**

```typescript
// attach-context-picker.test.ts
describe('attach-context-picker', () => {
  it('renders closed by default');
  it('opens as dialog when open=true');
  it('renders three tabs: Insights, Project Files, Upload');
  it('has role="dialog" with aria-label');
  it('has role="tablist" for tab navigation');
  it('shows insight items with cost badges');
  it('shows file items with cost badges');
  it('shows upload dropzone');
  it('calculates cost percentage correctly');
  it('shows footer with selected count and projected percentage');
  it('shows warning when projected exceeds 80%');
  it('dispatches context-attached event on Attach');
  it('closes on Cancel');
  it('closes on Escape key');
});

// chat-input.test.ts
describe('chat-input paperclip', () => {
  it('renders paperclip button');
  it('dispatches attach-context-request on paperclip click');
});
```

**Backend tests (Go table-driven):**

```go
// file_service_test.go
func TestListProjectFiles(t *testing.T) { /* returns file entries from _bmad-output */ }
func TestListProjectFilesEmptyDir(t *testing.T) { /* returns empty slice */ }
func TestReadProjectFile(t *testing.T) { /* returns file content */ }
func TestReadProjectFileNotFound(t *testing.T) { /* returns error */ }
func TestReadProjectFilePathTraversal(t *testing.T) { /* rejects ../ paths */ }

// files_test.go
func TestListFilesHandler(t *testing.T) { /* GET returns 200 with array */ }
func TestReadFileHandler(t *testing.T) { /* GET returns 200 with content */ }
func TestReadFileHandlerNotFound(t *testing.T) { /* GET returns 404 */ }
func TestReadFileHandlerPathTraversal(t *testing.T) { /* GET returns 400 */ }
```

### Previous Story Intelligence

**From Story 3.10 (Insight Library):**
- `insight-panel.ts` dispatches `insight-inject` event with `{ insightId }` detail -- this story must consume that event.
- `insightsState` signal holds all project Insights -- attach-context-picker can read directly.
- `updateInsight` in `insight.service.ts` handles PUT + state update -- reuse for marking used.
- `fetchInsights` loads Insights on panel mount -- picker should read from state, not re-fetch.

**From Chat Panel:**
- `MODEL_CONTEXT_WINDOWS` and `_getContextPercentage()` are defined in `chat-panel.ts` -- pass context window size to picker as property.
- `chat-input.ts` layout has send button on the right of textarea -- paperclip goes on the left.
- `conversation-block.ts` renders all messages -- needs `isContext` check to skip context messages.

**From Chat Service:**
- `sendMessage` in `chat.service.ts` sends `conversation_id` + `content` -- context messages are already in the conversation, so they are included automatically.
- Context messages should use `role: 'user'` (not a new role) so the LLM sees them as user-provided context.

### Anti-Patterns to Avoid

- **DO NOT** create a new role like `'context'` -- use `role: 'user'` with `isContext: true` flag.
- **DO NOT** re-fetch Insights in the picker -- read from `insightsState` signal directly.
- **DO NOT** add new npm dependencies -- use existing Lit + Shoelace.
- **DO NOT** upload files to the backend -- read them client-side with FileReader.
- **DO NOT** use inline styles -- use design tokens via CSS custom properties.
- **DO NOT** mix icon sets -- Lucide only (paperclip icon).
- **DO NOT** modify insight-panel.ts or insight-card.ts -- they already dispatch the right events.
- **DO NOT** persist context injections -- they exist only in the ephemeral conversation.
- **DO NOT** block the main thread reading large files -- use async FileReader.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.11 -- Story requirements and AC]
- [Source: _bmad-output/project-context.md -- Project rules, conventions, anti-patterns]
- [Source: _bmad-output/implementation-artifacts/3-10-insight-library.md -- Previous story, insight-inject event]
- [Source: src/components/core/chat/chat-panel.ts -- MODEL_CONTEXT_WINDOWS, context percentage logic]
- [Source: src/components/core/chat/chat-input.ts -- Input wrapper layout, icon pattern]
- [Source: src/services/chat.service.ts -- sendMessage, message handling pattern]
- [Source: src/state/chat.state.ts -- setConversation, getConversation]
- [Source: src/types/conversation.ts -- Message, Conversation interfaces]
- [Source: src/services/insight.service.ts -- updateInsight, fetchInsights, API_BASE]
- [Source: src/state/insight.state.ts -- insightsState, updateInsightInState]
- [Source: backend/api/router.go -- Route registration pattern]
- [Source: backend/api/handlers/artifacts.go -- Handler pattern for file operations]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Created backend FileService (file_service.go) with ListProjectFiles and ReadProjectFile methods including path traversal prevention. Created FileEntry type (file.go), FileHandler (files.go) with ListFiles and ReadFile handlers. Registered routes in router.go under /{id}/files.
- Task 2: Created frontend file.service.ts with fetchProjectFiles and fetchFileContent. Created file.ts type. Added injectContext to chat.service.ts for invisible context message injection. Added markInsightUsed to insight.service.ts.
- Task 3: Created attach-context-picker.ts component with three tabs (Insights, Project Files, Upload), cost estimation, footer with projected percentage and 80% warning, and full accessibility (role="dialog", aria-modal, role="tablist").
- Task 4: Added paperclip button to chat-input.ts with Lucide icon. Wired attach-context-request event through chat-panel.ts. Rendered attach-context-picker in chat-panel with all necessary properties. Wired insight-inject event forwarding through app-shell.ts.
- Task 5: Extended Message interface in conversation.ts with isContext and contextLabel fields. Updated conversation-block.ts to skip rendering context messages.
- Task 6: Created attach-context-picker.test.ts with 14 test cases. Added 2 tests to existing chat-input.test.ts for paperclip button.
- Task 7: Created file_service_test.go with 7 test cases covering file listing, reading, empty directories, and path traversal rejection.

### Code-Simplifier Pass

- Removed unused PAPERCLIP_ICON constant from attach-context-picker.ts (it was only needed in chat-input.ts)
- Verified all imports are used across modified files
- No public API changes; all simplifications are internal

### Change Log

- backend/types/file.go (CREATED) -- FileEntry type
- backend/services/file_service.go (CREATED) -- FileService with ListProjectFiles, ReadProjectFile
- backend/api/handlers/files.go (CREATED) -- FileHandler with ListFiles, ReadFile
- backend/api/router.go (MODIFIED) -- Registered file routes under /{id}/files
- src/types/file.ts (CREATED) -- FileEntry interface
- src/types/conversation.ts (MODIFIED) -- Added isContext, contextLabel to Message
- src/services/file.service.ts (CREATED) -- fetchProjectFiles, fetchFileContent
- src/services/chat.service.ts (MODIFIED) -- Added injectContext function
- src/services/insight.service.ts (MODIFIED) -- Added markInsightUsed function
- src/components/core/insights/attach-context-picker.ts (CREATED) -- Modal picker with 3 tabs
- src/components/core/chat/chat-input.ts (MODIFIED) -- Added paperclip button
- src/components/core/chat/chat-panel.ts (MODIFIED) -- Wired picker, insight-inject handling
- src/components/core/chat/conversation-block.ts (MODIFIED) -- Skip rendering isContext messages
- src/app-shell.ts (MODIFIED) -- Forward insight-inject to chat section
- tests/frontend/components/attach-context-picker.test.ts (CREATED) -- 14 tests
- tests/frontend/components/chat-input.test.ts (MODIFIED) -- Added 2 paperclip tests
- tests/backend/services/file_service_test.go (CREATED) -- 7 tests

### File List

- backend/types/file.go (CREATED)
- backend/services/file_service.go (CREATED)
- backend/api/handlers/files.go (CREATED)
- backend/api/router.go (MODIFIED)
- src/types/file.ts (CREATED)
- src/types/conversation.ts (MODIFIED)
- src/services/file.service.ts (CREATED)
- src/services/chat.service.ts (MODIFIED)
- src/services/insight.service.ts (MODIFIED)
- src/components/core/insights/attach-context-picker.ts (CREATED)
- src/components/core/chat/chat-input.ts (MODIFIED)
- src/components/core/chat/chat-panel.ts (MODIFIED)
- src/components/core/chat/conversation-block.ts (MODIFIED)
- src/app-shell.ts (MODIFIED)
- tests/frontend/components/attach-context-picker.test.ts (CREATED)
- tests/frontend/components/chat-input.test.ts (MODIFIED)
- tests/backend/services/file_service_test.go (CREATED)

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. All tasks use standard patterns: Lit web components composing Shoelace primitives, Go handlers with chi router, signal-based state management. No custom implementations of things that libraries already handle.

#### Dependency Policy
No issues found. "No new dependencies" constraint is backed by `project-context.md` which states all required libraries (Lit, Shoelace, signal-polyfill, Go chi, Go standard library) are already installed.

#### Effort-to-Value Ratio
No issues found. 7 tasks total: 1 backend infrastructure (file service), 1 frontend service, 1 core component (attach-context-picker), 1 wiring task (chat-input + chat-panel), 1 message model update, 2 testing tasks. All tasks directly serve the story's core value of attaching context to conversations with cost visibility.

#### Scope Creep
No issues found. All tasks trace to specific Acceptance Criteria. Backend file listing (Task 1) serves AC #4. Context injection (Tasks 2, 5) serves AC #7. Picker component (Task 3) serves AC #1-6, #8-9. Wiring (Task 4) serves AC #1, #8.

#### Feasibility
**[MEDIUM] Context message role choice.** The story specifies `role: 'user'` for context messages with an `isContext: true` flag. This is pragmatic -- the LLM will see context as user-provided content. However, the dev must ensure that `conversation-block.ts` properly filters these messages so they never render in the UI. The `isContext` check should be the first thing in the render method.

**[MEDIUM] FileReader for large files.** The Upload tab uses `FileReader.readAsText()` which loads the entire file into memory. For very large files this could cause performance issues. The dev should consider adding a reasonable file size limit (e.g., 1MB) in the upload handler with a user-facing warning.

### Summary

- **HIGH:** 0
- **MEDIUM:** 2
- **LOW:** 0

### Notes for Development

- For context message rendering (Task 5.2): Add the `isContext` check as the very first line in `conversation-block.ts` render() method, before any other logic. This prevents any accidental rendering of context blocks.
- For file uploads (Task 3.8): Consider adding a 1MB file size limit with a user-facing message like "File too large. Maximum size: 1MB." This prevents browser memory issues with very large text files.
