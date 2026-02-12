---
title: 'Chat & UX Improvements'
slug: 'chat-ux-improvements'
created: '2026-02-05'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Go (backend)
  - Lit (frontend)
  - WebSocket
  - Tauri (desktop)
  - localStorage (dev fallback)
files_to_modify:
  - backend/services/chat_service.go (conversation history + tool-start event fix)
  - backend/main.go (InsightService wiring + project history callback)
  - backend/types/api.go (Settings extension for project history)
  - src/components/core/chat/conversation-block.ts (popover Shadow DOM fix)
  - src/services/keychain.service.ts (localStorage fallback)
  - src/state/project.state.ts (recent projects state)
  - src/services/project.service.ts (auto-load last project)
  - src/app-shell.ts (init sequence + recent projects UI)
code_patterns:
  - Signal stores with context injection
  - WebSocket event handlers
  - Mutex-protected maps for concurrent access
  - ConfigStore atomic Load/Save/Update pattern
  - Shadow DOM boundary handling
test_patterns:
  - Table-driven Go tests
  - Lit component tests with @open-wc/testing
---

# Tech-Spec: Chat & UX Improvements

**Created:** 2026-02-05

## Overview

### Problem Statement

BMAD Studio's chat has critical gaps:
1. **Model appears stateless** — Backend expects frontend to send conversation history, but frontend doesn't send it. Each message is treated as a new conversation.
2. **Tool calls invisible** — Backend sends `chat:tool-delta` instead of `chat:tool-start`, so frontend never creates tool blocks. Users see only a typing indicator.
3. **Insights endpoint broken** — POST/GET to `/api/v1/projects/{project}/insights` returns 404 despite route existing. Likely middleware issue with project loading.
4. **Highlight popover broken** — Text selection should show color picker popover, but it never opens.
5. **API keys don't persist** — Keychain service uses in-memory fallback in dev mode (no Tauri), keys lost on refresh.
6. **Projects don't persist** — Must manually open project every session, no history of recent projects.

### Solution

1. Backend-managed conversation history with in-memory accumulation per conversation ID
2. Fix backend tool event emission to send `chat:tool-start` before deltas
3. Trace insights middleware chain and fix project loading requirement
4. Add debug logging to highlight popover and fix event binding
5. Add localStorage fallback for API keys when Tauri unavailable
6. Implement project registry with localStorage persistence

### Scope

**In Scope:**
- Backend conversation history management (in-memory map, mutex-protected, with TTL cleanup)
- Fix backend `chat:tool-start` event emission
- Fix insights 404 (middleware/project loading issue)
- Fix highlight popover (debug logging, event binding)
- API key persistence (localStorage fallback for dev mode)
- Project persistence (remember recently opened, auto-load last active)

**Out of Scope:**
- Tool approval UI (Issue #7 from original request) — lower priority, future story

## Context for Development

### Codebase Patterns

- **Services → Signal stores → Components**: Services handle backend communication, update signal stores, components subscribe
- **WebSocket events**: Use `snake_case` JSON tags (existing pattern despite project-context.md saying camelCase)
- **Go error handling**: Always return `(result, error)`, never panic
- **Mutex for concurrent maps**: `sync.RWMutex` for thread-safe map access
- **ConfigStore pattern**: Atomic Load/Save/Update with mutex, persists to `~/.bmad-studio/config.json`
- **Shadow DOM boundaries**: Cross-component selections require special handling (no `contains()` across boundaries)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `backend/services/chat_service.go:346-353` | Tool event emission bug — sends `tool-delta` instead of `tool-start` |
| `backend/services/chat_service.go:92-94` | Where `payload.History` is consumed — needs conversation accumulation |
| `backend/main.go:177-182` | RouterServices setup — missing `Insight` service |
| `backend/types/api.go:39-46` | Settings struct — needs `RecentProjects` and `LastActiveProjectPath` |
| `backend/storage/config_store.go` | ConfigStore pattern to follow for persistence |
| `backend/types/websocket.go:283-292` | `NewChatToolStartEvent` constructor (correct one to use) |
| `src/components/core/chat/conversation-block.ts:369-388` | `_handleContentMouseUp` — Shadow DOM boundary bug |
| `src/services/keychain.service.ts:13-15` | In-memory fallback — needs localStorage |
| `src/state/project.state.ts` | Project state — needs recent projects signal |
| `src/app-shell.ts:199` | Init sequence — add auto-load last project |

### Technical Decisions

1. **Conversation history in backend**: Single source of truth, survives frontend refresh, captures tool calls automatically
2. **In-memory with TTL**: No database for MVP, conversations expire after inactivity (e.g., 1 hour)
3. **localStorage for dev mode**: Practical for rapid iteration without Tauri, secure keychain for production
4. **Extend Settings struct**: Reuse existing ConfigStore pattern for project history (no new storage mechanism)
5. **Simplify popover validation**: Trust mouseup event context instead of cross-Shadow DOM containment check

## Implementation Plan

### Tasks

#### Issue #1: Backend Conversation History (Critical)

- [x] **Task 1.1:** Add conversation storage to ChatService
  - File: `backend/services/chat_service.go`
  - Action: Add `conversations map[string]*ConversationState` field with mutex
  - Notes: `ConversationState` holds `[]providers.Message`, `lastActivity time.Time`, `provider string`, `model string`

- [x] **Task 1.2:** Create conversation accumulation in HandleMessage
  - File: `backend/services/chat_service.go`
  - Action: In `HandleMessage()`, lookup/create conversation by ID, append user message, use accumulated history instead of `payload.History`
  - Notes: Remove dependency on frontend-provided history

- [x] **Task 1.3:** Accumulate assistant messages after stream completion
  - File: `backend/services/chat_service.go`
  - Action: In `consumeStream()`, after successful stream end, append assistant message (with tool calls if any) to conversation history
  - Notes: Capture full assistant response including any tool call metadata

- [x] **Task 1.4:** Accumulate tool result messages
  - File: `backend/services/chat_service.go`
  - Action: After each tool execution in the tool loop, append tool result message to conversation history
  - Notes: Messages already being appended to local `messages` slice — need to persist back to conversation state

- [x] **Task 1.5:** Add conversation cleanup with TTL
  - File: `backend/services/chat_service.go`
  - Action: Add `cleanupStaleConversations()` goroutine that runs periodically (every 5 min), removes conversations with `lastActivity` > 1 hour ago
  - Notes: Start goroutine in `NewChatService()`, use context for graceful shutdown

#### Issue #2: Fix Tool Event Emission

- [x] **Task 2.1:** Send chat:tool-start on ChunkTypeToolCallStart
  - File: `backend/services/chat_service.go:346-353`
  - Action: Replace `NewChatToolDeltaEvent` with `NewChatToolStartEvent(conversationID, messageID, chunk.ToolID, chunk.ToolName, map[string]interface{}{})`
  - Notes: Empty input map is correct — input streams via subsequent tool-delta events

#### Issue #3: Fix Insights 404

- [x] **Task 3.1:** Wire InsightService in main.go
  - File: `backend/main.go`
  - Action: After ConfigStore creation, create `insightStore := storage.NewInsightStore(configStore.BaseDir())` and `insightService := services.NewInsightService(insightStore)`
  - Notes: Check if `NewInsightStore` constructor exists, create if needed

- [x] **Task 3.2:** Pass InsightService to RouterServices
  - File: `backend/main.go:177-182`
  - Action: Add `Insight: insightService` to `RouterServices{}` struct
  - Notes: This enables route registration at `router.go:73`

#### Issue #4: Fix Highlight Popover

- [x] **Task 4.1:** Simplify _handleContentMouseUp validation
  - File: `src/components/core/chat/conversation-block.ts:369-388`
  - Action: Remove `content.contains()` check — if mouseup fires on `.content`, selection is valid
  - Notes: Shadow DOM boundaries prevent cross-component containment checks

- [x] **Task 4.2:** Add debug logging (optional, can remove later)
  - File: `src/components/core/chat/conversation-block.ts`
  - Action: Add `console.log('[DEBUG] Popover:', { x, y, open })` before setting `_showPopover = true`
  - Notes: Skipped — fix is straightforward, debug logging not needed

#### Issue #5: API Key Persistence (Dev Mode)

- [x] **Task 5.1:** Add localStorage fallback to keychain service
  - File: `src/services/keychain.service.ts`
  - Action: In `getApiKey()` and `setApiKey()`, add localStorage branch between Tauri check and memory fallback
  - Notes: Key format: `bmad-studio-${provider}-api-key`

- [x] **Task 5.2:** Update deleteApiKey and hasApiKey
  - File: `src/services/keychain.service.ts`
  - Action: Apply same localStorage pattern to `deleteApiKey()` and `hasApiKey()`
  - Notes: Maintain consistency across all keychain operations

#### Issue #6: Project Persistence

- [x] **Task 6.1:** Extend Settings type with project history
  - File: `backend/types/api.go`
  - Action: Add `RecentProjects []ProjectEntry` and `LastActiveProjectPath string` to `Settings` struct; define `ProjectEntry{Name, Path, LastOpened}`
  - Notes: Use `json:"recent_projects"` and `json:"last_active_project_path"` tags

- [x] **Task 6.2:** Update project history on load
  - File: `backend/main.go`
  - Action: In `OnProjectLoaded` callback, update ConfigStore with project entry (upsert to recent list, set as last active)
  - Notes: Limit recent projects to 10, sort by LastOpened descending

- [x] **Task 6.3:** Add recent projects state to frontend
  - File: `src/state/project.state.ts`
  - Action: Add `recentProjectsState` Signal and `lastActiveProjectPath` Signal
  - Notes: Populated from settings on app init

- [x] **Task 6.4:** Load recent projects from settings
  - File: `src/services/project.service.ts`
  - Action: Add `loadRecentProjects()` that fetches from `/api/v1/settings` and updates state
  - Notes: Called during app initialization

- [x] **Task 6.5:** Auto-load last active project on startup
  - File: `src/app-shell.ts`
  - Action: In `connectedCallback()`, after `initProviderState()`, check `lastActiveProjectPath` and auto-open if set
  - Notes: Skip if path no longer exists (handle 404 gracefully)

- [x] **Task 6.6:** Show recent projects in empty state
  - File: `src/app-shell.ts`
  - Action: In `_renderEmpty()`, if recent projects exist, show dropdown/list before "Open Project" button
  - Notes: Simple list with project name and "Open" button per entry

### Acceptance Criteria

#### Issue #1: Conversation History

- [ ] **AC 1.1:** Given a conversation with previous messages, when user sends a new message, then the LLM receives full conversation history and responds with context awareness
- [ ] **AC 1.2:** Given a conversation with tool calls, when the tool loop completes, then all tool call and result messages are preserved in history
- [ ] **AC 1.3:** Given a conversation inactive for >1 hour, when cleanup runs, then the conversation is removed from memory
- [ ] **AC 1.4:** Given two concurrent conversations, when messages are sent to each, then histories remain isolated (no cross-contamination)

#### Issue #2: Tool Events

- [ ] **AC 2.1:** Given an LLM response with tool calls, when `ChunkTypeToolCallStart` is received, then frontend receives `chat:tool-start` event and creates tool block UI
- [ ] **AC 2.2:** Given a tool block created, when tool execution completes, then block shows input parameters and output/error result

#### Issue #3: Insights 404

- [ ] **AC 3.1:** Given a loaded project, when POST `/api/v1/projects/{id}/insights` is called, then insight is created and returns 201
- [ ] **AC 3.2:** Given insights exist, when GET `/api/v1/projects/{id}/insights` is called, then list of insights is returned

#### Issue #4: Highlight Popover

- [ ] **AC 4.1:** Given a completed assistant message, when user selects text, then highlight color popover appears near selection
- [ ] **AC 4.2:** Given popover is open, when user clicks a color, then selection is highlighted with that color
- [ ] **AC 4.3:** Given popover is open, when user clicks outside, then popover dismisses

#### Issue #5: API Key Persistence

- [ ] **AC 5.1:** Given dev mode (no Tauri), when user saves API key, then key persists in localStorage
- [ ] **AC 5.2:** Given saved API key in localStorage, when page refreshes, then key is restored without re-entry
- [ ] **AC 5.3:** Given Tauri mode, when user saves API key, then key is stored in OS keychain (existing behavior preserved)

#### Issue #6: Project Persistence

- [ ] **AC 6.1:** Given user opens a project, when project loads successfully, then project is added to recent projects list
- [ ] **AC 6.2:** Given recent projects exist, when app starts, then last active project auto-loads
- [ ] **AC 6.3:** Given last active project path is invalid, when app starts, then graceful fallback to empty state (no crash)
- [ ] **AC 6.4:** Given recent projects exist, when viewing empty state, then recent projects are shown for quick access

## Additional Context

### Dependencies

**Task Dependencies:**
- Issue #2 (Tool Events) is a one-line fix, can be done immediately
- Issue #1 (History) is foundational but independent of other issues
- Issue #3 (Insights) is independent — quick backend wiring fix
- Issue #4 (Popover) is independent — frontend-only fix
- Issue #5 (API Keys) is independent — frontend-only fix
- Issue #6 (Projects) requires both backend (Settings extension) and frontend changes

**External Dependencies:**
- None — all fixes use existing libraries and patterns

**Suggested Implementation Order:**
1. Issue #2 (Tool Events) — 5 min, one-line fix, immediate UX win
2. Issue #3 (Insights) — 15 min, backend wiring
3. Issue #4 (Popover) — 10 min, frontend fix
4. Issue #5 (API Keys) — 20 min, localStorage fallback
5. Issue #1 (History) — 1-2 hrs, largest change
6. Issue #6 (Projects) — 1-2 hrs, backend + frontend

### Testing Strategy

**Backend Tests:**
- `chat_service_test.go`: Table-driven tests for conversation accumulation, concurrent access, TTL cleanup
- `insights_test.go`: Verify routes are registered when InsightService is provided (existing tests should pass once wired)

**Frontend Tests:**
- `conversation-block.test.ts`: Test popover opens on text selection
- `keychain.service.test.ts`: Test localStorage fallback in non-Tauri environment

**Manual Testing:**
1. Send multiple messages in same conversation — verify context awareness
2. Trigger tool call — verify tool block appears with input/output
3. Create insight via API — verify 201 response
4. Select text in message — verify popover appears
5. Save API key, refresh page — verify key persists
6. Open project, restart app — verify auto-loads

### Notes

**Root Causes Identified:**

| Issue | Root Cause | Fix Location |
|-------|------------|--------------|
| Tool Events | Wrong event constructor | `chat_service.go:352` |
| Insights 404 | Service not wired | `main.go:177` |
| Popover | Shadow DOM boundary | `conversation-block.ts:380` |
| API Keys | No dev-mode persistence | `keychain.service.ts:24-35` |
| Projects | No persistence mechanism | `types/api.go` + `app-shell.ts` |

**Known Limitations:**
- Conversation history is in-memory only — lost on backend restart
- localStorage API keys are not encrypted — acceptable for dev mode only
- Project auto-load may fail silently if directory was deleted

**Future Considerations (Out of Scope):**
- Tool approval UI (Issue #7) — separate story
- Database persistence for conversations
- Conversation export/import

## Review Notes

- Adversarial review completed
- Findings: 4 total, 3 fixed, 1 skipped (intentional design decision)
- Resolution approach: walk-through

**Fixes Applied:**
- F2: Added mutex protection to `ChatService.Stop()` for thread safety
- F3: Moved `LastActivity` update to after message append in `HandleMessage`
- F4: Added documentation comment explaining `cleanupCancel` initialization safety

**Skipped:**
- F1: `BraveSearchAPIKey` JSON tag intentionally uses camelCase for FE/BE consistency
