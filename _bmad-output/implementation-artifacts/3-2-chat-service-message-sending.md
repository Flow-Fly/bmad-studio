# Story 3.2: Chat Service & Message Sending

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to send messages to BMAD agents**,
So that **I can have conversations about my project** (FR9).

## Acceptance Criteria

1. **Given** I have a configured provider (API key validated) and open project, **When** I type a message and press Enter (or Cmd+Enter for multi-line), **Then** the message is sent via `chat:send` WebSocket event with conversationId, message content, model, and provider **And** the backend ChatService routes it through the Provider interface (`StreamChat(ctx, messages, options) -> chan StreamEvent`) **And** the Go backend consumes the Claude API SSE stream using `anthropic-sdk-go` and translates to `chat:*` WebSocket events **And** my message appears in the conversation immediately (optimistic UI).

2. **Given** I press Enter in the chat input, **When** the input contains text, **Then** the message is sent (single-line mode) **And** the input is cleared.

3. **Given** I press Cmd+Enter, **When** in multi-line mode, **Then** the message is sent regardless of newlines in content.

4. **Given** a message is being sent, **When** waiting for response, **Then** the input is disabled with a subtle pulse animation **And** I cannot send another message until streaming completes or errors.

5. **Given** the provider returns an error, **When** sending fails, **Then** an error message is displayed inline (red text) **And** a "Retry" button appears.

## Tasks / Subtasks

- [x] Task 1: Create `chat-panel` container component (AC: #1, #4, #5)
  - [x] 1.1: Create `src/components/core/chat/chat-panel.ts` extending `SignalWatcher(LitElement)` with `@customElement('chat-panel')`
  - [x] 1.2: Subscribe to `activeConversations`, `streamingConversationId`, and `chatConnectionState` signals from `chat.state.ts`
  - [x] 1.3: Subscribe to `activeProviderState`, `selectedModelState` from `provider.state.ts`
  - [x] 1.4: Implement panel layout: header (agent name + connection status) + scrollable message area + chat input at bottom
  - [x] 1.5: Auto-create a new conversation (UUID via `crypto.randomUUID()`) when the panel renders and no active conversation exists for the current context
  - [x] 1.6: Implement auto-scroll: scroll to bottom on new messages, unless user has scrolled up (track via `scrollTop` vs `scrollHeight`)
  - [x] 1.7: Show empty state when no project is open: "Open a project to start chatting"
  - [x] 1.8: Show empty state when no provider configured: "Configure a provider in settings to start chatting"

- [x] Task 2: Create `chat-input` component (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `src/components/core/chat/chat-input.ts` extending `SignalWatcher(LitElement)` with `@customElement('chat-input')`
  - [x] 2.2: Render a `<textarea>` with auto-grow behavior (min 1 row, max ~6 rows) and a send button (Lucide `send` icon)
  - [x] 2.3: Implement Enter-to-send: on `keydown`, if Enter without Shift, prevent default and submit; Shift+Enter inserts newline
  - [x] 2.4: Implement Cmd+Enter: always sends regardless of content (multi-line mode)
  - [x] 2.5: On send: call `sendMessage()` from `chat.service.ts` with current `conversationId`, input content, `selectedModelState`, `activeProviderState`, and API key from keychain
  - [x] 2.6: Clear input after successful send dispatch (before streaming completes)
  - [x] 2.7: Disable input + send button when `chatConnectionState === 'streaming'` with CSS class `.chat-input--disabled` and subtle pulse animation
  - [x] 2.8: Disable input + show "Configure provider" message when no valid provider is active
  - [x] 2.9: Add `aria-label="Chat message input"`, `role="textbox"`, `aria-multiline="true"`
  - [x] 2.10: Show character/line count is NOT needed (keep it minimal)

- [x] Task 3: Create `conversation-block` component (AC: #1, #4, #5)
  - [x] 3.1: Create `src/components/core/chat/conversation-block.ts` extending `LitElement` with `@customElement('conversation-block')`
  - [x] 3.2: Accept `message: Message` as `@property()` — render user vs assistant messages with distinct visual styling
  - [x] 3.3: User messages: right-aligned or left-aligned with accent background tint, show content as plain text
  - [x] 3.4: Assistant messages: left-aligned with subtle background, show content as plain text (markdown rendering is Story 3.5)
  - [x] 3.5: Show timestamp on each message (`new Date(message.timestamp).toLocaleTimeString()`)
  - [x] 3.6: Show typing indicator (3-dot animation) when `message.isStreaming === true` and content is empty
  - [x] 3.7: Show streaming content progressively when `message.isStreaming === true` and content exists (text appears as it streams)
  - [x] 3.8: Show `isPartial` indicator when message was cancelled mid-stream ("Response was interrupted")
  - [x] 3.9: Show error state: red border, error message text, "Retry" ghost button that re-sends the last user message
  - [x] 3.10: Add `role="listitem"` for accessibility, `aria-label` describing sender and time

- [x] Task 4: Wire chat-panel into app-shell (AC: #1)
  - [x] 4.1: Replace the chat placeholder `<div class="placeholder">Chat panel (Epic 3)</div>` in `app-shell.ts` with `<chat-panel>`
  - [x] 4.2: Import `chat-panel` component in app-shell.ts
  - [x] 4.3: Pass relevant state (project loaded, provider configured) to chat-panel via properties or let it read signals directly
  - [x] 4.4: Ensure `Cmd+2` focus shortcut focuses the chat-input textarea within chat-panel

- [x] Task 5: Implement API key retrieval for chat send (AC: #1)
  - [x] 5.1: In `chat-input.ts` send handler, retrieve API key using the pattern from provider settings (check how `provider-settings.ts` accesses keys)
  - [x] 5.2: If API key retrieval fails, show inline error "API key not found. Check provider settings."
  - [x] 5.3: Handle the case where provider type is 'ollama' (no API key needed — send empty string or omit)

- [x] Task 6: Implement retry functionality (AC: #5)
  - [x] 6.1: On error state in conversation-block, show "Retry" button
  - [x] 6.2: Retry re-sends the last user message content to `sendMessage()` with same parameters
  - [x] 6.3: Clear error state when retry is initiated
  - [x] 6.4: If retry also fails, show updated error message

- [x] Task 7: Write frontend tests (AC: #1, #2, #3, #4, #5)
  - [x] 7.1: Create `tests/frontend/components/chat-panel.test.ts` — test rendering, empty states, signal subscriptions, auto-scroll behavior, conversation creation
  - [x] 7.2: Create `tests/frontend/components/chat-input.test.ts` — test Enter-to-send, Cmd+Enter, Shift+Enter newline, disabled state during streaming, input clearing, aria attributes
  - [x] 7.3: Create `tests/frontend/components/conversation-block.test.ts` — test user vs assistant rendering, streaming indicator, partial message, error state, retry button, timestamp display
  - [x] 7.4: Verify 0 regressions on existing 229 frontend tests

## Dev Notes

### Critical Architecture Patterns

**This story creates the FIRST UI components in the chat/ directory.** It builds on Story 3.1's infrastructure (chat.service.ts, chat.state.ts, conversation types, WebSocket send). The chat pipeline is fully functional from 3.1 — this story provides the user-facing interface.

**Conversations are EPHEMERAL** — in-memory only, no persistence. When the user opens the chat panel, a new conversation is created in memory. Closing the app loses everything. Do NOT add any persistence logic.

**Optimistic UI pattern** — When the user sends a message, it appears immediately in the conversation (added by `chat.service.ts sendMessage()`). The streaming response comes back asynchronously via WebSocket events. The UI must handle the gap between send and first stream event gracefully.

**Signal-driven rendering** — Components extend `SignalWatcher(LitElement)` to automatically re-render when signals change. The conversation data flows: `chat.service.ts` (handles WebSocket events) -> `chat.state.ts` (updates signals) -> `chat-panel.ts` (re-renders). Components should NOT call services directly for state reads — they read from signals.

**The send flow is already implemented** in `chat.service.ts`:
```typescript
sendMessage(conversationId, content, model, provider, apiKey, systemPrompt?)
```
The chat-input component just needs to call this with the right parameters.

[Source: _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md#Dev-Notes, _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Conversation-Model]

### Project Structure Notes

**Files to Create:**

```
src/
├── components/
│   └── core/
│       └── chat/
│           ├── chat-panel.ts              # CREATE: Chat container with message list + input
│           ├── chat-input.ts              # CREATE: Message input with send button
│           └── conversation-block.ts      # CREATE: Individual message display

tests/
└── frontend/
    └── components/
        ├── chat-panel.test.ts             # CREATE: Chat panel tests
        ├── chat-input.test.ts             # CREATE: Chat input tests
        └── conversation-block.test.ts     # CREATE: Conversation block tests
```

**Files to Modify:**

```
src/
└── app-shell.ts                           # MODIFY: Replace chat placeholder with <chat-panel>
```

**Files to NOT Touch:**

```
src/services/chat.service.ts               # DO NOT MODIFY — chat send/receive logic is complete from 3.1
src/state/chat.state.ts                    # DO NOT MODIFY — signal state is complete from 3.1
src/types/conversation.ts                  # DO NOT MODIFY — types are complete from 3.1
src/services/websocket.service.ts          # DO NOT MODIFY — WebSocket send is complete from 3.1
src/state/project.state.ts                # DO NOT MODIFY
src/state/workflow.state.ts               # DO NOT MODIFY
src/state/phases.state.ts                 # DO NOT MODIFY
src/state/connection.state.ts             # DO NOT MODIFY
src/services/project.service.ts           # DO NOT MODIFY
src/services/provider.service.ts          # DO NOT MODIFY
src/styles/                                # DO NOT MODIFY (use existing design tokens)
backend/                                   # DO NOT MODIFY — backend is complete from 3.1
src/components/core/chat/context-indicator.ts     # DO NOT CREATE — that's Story 3.7
src/components/core/chat/highlight-popover.ts     # DO NOT CREATE — that's Story 3.8
src/components/shared/markdown-renderer.ts        # DO NOT CREATE — that's Story 3.5
src/components/core/navigation/agent-badge.ts     # DO NOT CREATE — that's Story 3.3
```

[Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete-Project-Directory-Structure]

### Technical Requirements

#### Frontend Stack (MUST USE)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Lit | `lit` | ^3.1.0 | Web Components framework |
| Signals | `@lit-labs/signals` + `signal-polyfill` | ^0.2.0 | Reactive state management |
| Context | `@lit-labs/context` | ^0.5.1 | Dependency injection (if needed) |
| Shoelace | `@shoelace-style/shoelace` | ^2.12.0 | UI primitives (buttons, tooltips) |
| Lucide | `lucide` | ^0.563.0 | Icons (send, alert-circle, etc.) |

**DO NOT** add new npm dependencies for this story.

#### Backend Stack — NO CHANGES NEEDED

This story is **frontend-only**. The backend ChatService, WebSocket event types, and streaming pipeline are all complete from Story 3.1. No backend modifications required.

[Source: package.json, _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md]

### Architecture Compliance

- **Signal-driven state:** Components read from `chat.state.ts` signals via `SignalWatcher(LitElement)` — do NOT fetch state imperatively [Source: project-context.md#State-Management]
- **Service layer pattern:** `sendMessage()` is a module-level function in `chat.service.ts`, NOT a class method. Call it directly. [Source: project-context.md#TypeScript]
- **Ephemeral conversations:** In-memory only, no persistence layer — matches architecture decision [Source: architecture/core-architectural-decisions.md#Conversation-Model]
- **Shared WebSocket:** Uses existing `/ws` connection with `chat:` namespace — no new endpoints [Source: architecture/core-architectural-decisions.md#API-Communication]
- **Component naming:** `kebab-case` tag names, `PascalCase` class names — `<chat-panel>` / `class ChatPanel` [Source: project-context.md#TypeScript]
- **File naming:** `kebab-case.ts` — `chat-panel.ts`, `chat-input.ts`, `conversation-block.ts` [Source: project-context.md#Language-Specific-Rules]
- **No inline styles:** All styling via CSS custom properties and component `:host` styles [Source: project-context.md#Style-Rules]
- **Design tokens:** Use `--bmad-*` CSS custom properties from `tokens.css` [Source: src/styles/tokens.css]
- **Shoelace integration:** Custom components compose Shoelace primitives (e.g., `<sl-button>`, `<sl-icon>`, `<sl-tooltip>`) [Source: project-context.md#Framework-Specific-Rules]
- **Lucide icons only:** Use Lucide icons exclusively — no mixing icon sets [Source: project-context.md#Anti-Patterns]

### Library & Framework Requirements

| Library | Current Version | Required Action |
|---|---|---|
| lit | ^3.1.0 | No update needed — LitElement, html, css, SignalWatcher all available |
| @lit-labs/signals | ^0.2.0 | No update needed — SignalWatcher mixin for auto re-render |
| @shoelace-style/shoelace | ^2.12.0 | No update needed — sl-button, sl-tooltip, sl-icon available |
| lucide | ^0.563.0 | No update needed — send, alert-circle, loader icons available |
| signal-polyfill | current | No update needed — Signal.State, Signal.Computed |

**Zero new dependencies.** All required functionality exists in current packages.

### File Structure Requirements

All new files follow established naming conventions:
- TS component files: `kebab-case.ts` (e.g., `chat-panel.ts`, `chat-input.ts`, `conversation-block.ts`)
- TS test files: `kebab-case.test.ts` in `tests/frontend/components/` (e.g., `chat-panel.test.ts`)
- Component class: `PascalCase` (e.g., `ChatPanel`, `ChatInput`, `ConversationBlock`)
- Custom element tag: `kebab-case` (e.g., `<chat-panel>`, `<chat-input>`, `<conversation-block>`)
- CSS custom properties: `--bmad-{category}-{name}` (e.g., `--bmad-color-accent`)

[Source: project-context.md#Language-Specific-Rules, _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md]

### Testing Requirements

**Frontend tests (@open-wc/testing):**
- Location: `tests/frontend/components/`
- Pattern: Use `@open-wc/testing` fixtures for Lit component tests
- Mock `chat.service.ts` functions (sendMessage, cancelStream) to prevent real WebSocket calls
- Mock signal state to test different UI states (idle, streaming, error)
- Test keyboard interactions (Enter, Cmd+Enter, Shift+Enter)
- Test accessibility (aria attributes, roles, keyboard navigation)
- Test empty states (no project, no provider)

**Test scenarios per component:**

**chat-panel.test.ts (8-10 tests):**
- Renders empty state when no project open
- Renders empty state when no provider configured
- Creates conversation on first render when project + provider available
- Renders message list from conversation signals
- Auto-scrolls to bottom on new messages
- Does not auto-scroll when user has scrolled up
- Shows streaming state feedback
- Renders chat-input at bottom

**chat-input.test.ts (10-12 tests):**
- Renders textarea with send button
- Enter key sends message and clears input
- Shift+Enter inserts newline
- Cmd+Enter sends message
- Disabled during streaming state
- Shows pulse animation when disabled
- Does not send empty messages
- Shows error when no provider configured
- Textarea auto-grows with content
- Correct aria attributes present

**conversation-block.test.ts (10-12 tests):**
- Renders user message with correct styling
- Renders assistant message with correct styling
- Shows timestamp on messages
- Shows typing indicator when isStreaming and empty content
- Shows streaming content progressively
- Shows partial indicator for cancelled messages
- Shows error state with red styling
- Shows retry button on error
- Retry button triggers re-send
- Correct accessibility attributes (role="listitem", aria-label)

**Current test count: 229 frontend tests passing.** This story should add ~30 tests without breaking existing ones.

[Source: _bmad-output/project-context.md#Testing-Rules, _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md#Dev-Agent-Record]

### Previous Story Intelligence

**From Story 3.1 (WebSocket Connection & Streaming):**

- **229 frontend tests passing** — do NOT regress
- **`chat.service.ts` is fully implemented** with `sendMessage()`, `cancelStream()`, `initChatService()`, event handlers for all `chat:*` events. It creates conversations, adds user messages optimistically, handles streaming events, and manages state. Do NOT modify this file.
- **`chat.state.ts` signals** — `chatConnectionState` ('idle'|'streaming'|'error'), `activeConversations` (Map), `streamingConversationId` (string|null). Use `getConversation(id)` and `setConversation(conv)` helpers.
- **`conversation.ts` types** — `Message` has `id`, `role`, `content`, `thinkingContent`, `timestamp`, `isStreaming`, `isPartial`, `usage`. `Conversation` has `id`, `agentId`, `messages`, `createdAt`, `model`, `provider`.
- **Code review findings from 3.1** revealed critical issues that were fixed:
  - C1: Dead pipeline — `sendMessage` now creates conversation + user message BEFORE sending WS event
  - C7: API key transmitted over WebSocket — accepted as architecture trade-off (localhost-only)
  - I1: Silent handler drops — console.warn added for when conversation not found
  - I7: State stuck in error — `sendMessage` sets 'streaming' before WS send
  - M5: crypto.randomUUID() used for message IDs (not Date.now())
- **`initChatService()` is called in `app-shell.ts`** during `_setupWorkflowSubscription()` — chat service is already initialized when the chat panel loads
- **WebSocket send pattern:** `wsSend({ type: CHAT_SEND, payload: {...}, timestamp: ... })` — already abstracted in chat.service.ts
- **No duplicate state management needed** — chat.service.ts handles all WebSocket events and state updates. The UI components just need to READ from signals and CALL sendMessage/cancelStream.

**Technical debt addressed in 3.1:**
- `Model` field added to `StreamChunk` (Epic 1 tech debt item)
- Thorough bidirectional WebSocket tests written

**From Epic 2 Retrospective:**
- Dual-model code review mandatory for every story
- Code-simplifier runs between stories
- Earlier services reveal bugs under real load

[Source: _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md]

### Git Intelligence

**Recent commits:**
```
7b5c757 Story/3-1-websocket-connection-streaming (#15)
85629d3 Epic/2-project-workflow-state-visualization (#14)
f6a75af Epic/1-app-foundation (#8)
```

**Current branch:** `epic/3-agent-conversation-xp`

**Branch strategy:**
- Create `story/3-2-chat-service-message-sending` from `epic/3-agent-conversation-xp`
- Implement all changes on story branch
- PR: story -> epic -> dev -> main

**Commit style:** `feat:` prefix, atomic commits, one logical change per commit.

**Files changed in Story 3.1 (16 files, +1683 lines):**
```
backend/api/websocket/client.go              # Bidirectional messaging
backend/api/websocket/hub.go                 # SendToClient, MessageHandler
backend/main.go                              # ChatService wiring
backend/providers/claude.go                  # ThinkingDelta
backend/providers/provider.go                # StreamChunk updates
backend/services/chat_service.go             # NEW: Chat streaming service
backend/types/websocket.go                   # Chat event types/payloads
src/app-shell.ts                             # Chat service init
src/services/chat.service.ts                 # NEW: Frontend chat service
src/services/websocket.service.ts            # send() function
src/state/chat.state.ts                      # NEW: Chat signals
src/types/conversation.ts                    # NEW: Conversation types
+ test files
```

[Source: git log, _bmad-output/project-context.md#Git-Strategy]

### Existing Component Patterns to Follow

**SignalWatcher pattern (from phase-graph-container.ts):**
```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

@customElement('chat-panel')
export class ChatPanel extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `;

  render() {
    // Access signals directly — SignalWatcher triggers re-render on changes
    const conversations = activeConversations.get();
    // ...
  }
}
```

**Lucide icon pattern (from phase-node.ts):**
```typescript
import { Send, AlertCircle } from 'lucide';
// Render as SVG in template
```

**Event dispatch pattern (from activity-bar.ts):**
```typescript
this.dispatchEvent(new CustomEvent('message-send', {
  detail: { content: this.inputValue },
  bubbles: true,
  composed: true,
}));
```

**Responsive/resize pattern (from phase-graph-container.ts):**
```typescript
private _resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    this._compact = entry.contentRect.width < 400;
  }
});
```

[Source: src/components/core/phase-graph/phase-graph-container.ts, src/components/core/phase-graph/phase-node.ts, src/components/core/layout/activity-bar.ts]

### UX Patterns to Implement

**Chat Input Behavior:**
- `Enter` sends message (single-line default)
- `Shift+Enter` inserts newline
- `Cmd+Enter` always sends (multi-line explicit)
- Input disabled during streaming with subtle pulse animation
- Input cleared immediately after send (before response arrives)

**Streaming Feedback (from UX spec):**
| Phase | Visual | Duration |
|-------|--------|----------|
| Sending | Input disabled, subtle pulse | Until `chat:stream-start` |
| Receiving | Typing indicator then streaming text | Duration of stream |
| Complete | Full message, timestamp appears | Permanent |
| Error | Red border, inline error text, Retry button | Until resolved |

**Connection Status (chat panel header):**
| State | Visual |
|-------|--------|
| Connected | Green dot (subtle, in header) |
| Connecting | Pulsing indicator |
| Disconnected | Yellow warning |
| Error | Red indicator |

**Empty States:**
| Context | Content |
|---------|---------|
| No project | "Open a project to start chatting" |
| No provider | "Configure a provider in settings to start chatting" |
| New conversation | Agent greeting placeholder or minimal empty state |

**Animation Timing:**
- State changes: 200ms ease-in-out
- Typing indicator: CSS animation (3-dot bounce)
- Pulse animation: CSS keyframes on input wrapper

**Accessibility:**
- Message list: `role="log"`, `aria-live="polite"` for streaming updates
- Individual messages: `role="listitem"` with `aria-label`
- Chat input: `role="textbox"`, `aria-multiline="true"`, `aria-label="Chat message input"`
- Send button: `aria-label="Send message"`, disabled state announced

**Design Token Usage:**
```css
/* Backgrounds */
--bmad-bg-primary       /* Main panel background */
--bmad-bg-secondary     /* Message area background */
--bmad-bg-tertiary      /* Input area background */

/* Text */
--bmad-text-primary     /* Message content */
--bmad-text-secondary   /* Timestamps, metadata */
--bmad-text-muted       /* Placeholder text */

/* Interactive */
--bmad-color-accent     /* Send button, user message tint */
--bmad-color-error      /* Error states */

/* Spacing */
--bmad-space-xs (4px)   /* Tight spacing */
--bmad-space-sm (8px)   /* Message padding */
--bmad-space-md (12px)  /* Between messages */
--bmad-space-lg (16px)  /* Section padding */

/* Borders */
--bmad-border-radius-sm (4px)  /* Message blocks */
--bmad-border-radius-md (8px)  /* Input area */
```

[Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md, src/styles/tokens.css]

### Anti-Patterns to Avoid

- **DO NOT** modify `chat.service.ts` — the send/receive logic is complete from 3.1
- **DO NOT** modify `chat.state.ts` — signal state is complete from 3.1
- **DO NOT** modify `conversation.ts` types — types are complete from 3.1
- **DO NOT** modify any backend files — backend is complete from 3.1
- **DO NOT** create a markdown renderer — that's Story 3.5 (render plain text for now)
- **DO NOT** create agent selection UI — that's Story 3.3
- **DO NOT** create context indicator — that's Story 3.7
- **DO NOT** create highlight popover — that's Story 3.8
- **DO NOT** create conversation lifecycle (compact/discard) — that's Story 3.9
- **DO NOT** persist conversation data to disk
- **DO NOT** use inline styles — use CSS custom properties
- **DO NOT** mix icon libraries — Lucide only
- **DO NOT** add new npm dependencies
- **DO NOT** use `@lit-labs/context` for state injection in these components — read signals directly via `SignalWatcher` mixin (context injection is for deeper component trees in later stories)
- **DO NOT** fetch data directly in components — call functions from `chat.service.ts`
- **DO NOT** implement cancel button UI yet — the cancel functionality exists in chat.service.ts but the UI cancel button can wait for Story 3.4 (chat panel refinement)
- **DO NOT** implement thinking content display — that's Story 3.6 (ignore `thinkingContent` field for now)
- **DO NOT** implement copy-to-clipboard on messages — that's Story 3.4
- **DO NOT** use spinners — use typing indicator (3-dot animation) per UX spec
- **DO NOT** break the existing 229 frontend tests

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.2 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md -- Conversation model, WebSocket protocol, provider architecture]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md -- Naming conventions, component patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md -- File structure, chat component locations]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md -- Chat input behavior, streaming feedback, empty states, animation timing]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md -- Previous story patterns, chat service implementation, code review findings, test baseline]
- [Source: src/services/chat.service.ts -- sendMessage(), cancelStream(), initChatService()]
- [Source: src/state/chat.state.ts -- chatConnectionState, activeConversations, streamingConversationId signals]
- [Source: src/types/conversation.ts -- Message, Conversation, UsageStats types]
- [Source: src/services/websocket.service.ts -- send() function]
- [Source: src/app-shell.ts -- Chat service initialization, section layout, placeholder location]
- [Source: src/components/core/phase-graph/phase-graph-container.ts -- SignalWatcher component pattern]
- [Source: src/components/core/layout/activity-bar.ts -- Section navigation, keyboard shortcuts]
- [Source: src/state/provider.state.ts -- activeProviderState, selectedModelState signals]
- [Source: src/styles/tokens.css -- Design tokens available]
- [Source: package.json -- Dependency versions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Test tree-shaking issue: esbuild drops `@customElement` decorated class imports when only used as TypeScript generic type parameter. Fixed by using side-effect imports in tests.

### Completion Notes List

- Created `chat-panel.ts`: Full-featured chat container with SignalWatcher, connection status indicator, auto-scroll with user scroll detection, conversation auto-creation, empty states for no project and no provider
- Created `chat-input.ts`: Textarea with auto-grow, Enter-to-send, Shift+Enter newline, Cmd+Enter send, streaming disable with pulse animation, API key retrieval from keychain, Ollama no-key handling, inline error display
- Created `conversation-block.ts`: User vs assistant message rendering, 3-dot typing indicator animation, progressive streaming content display, partial message indicator, error state with retry button, Lucide inline SVG icons
- Wired `chat-panel` into `app-shell.ts` replacing placeholder, updated Cmd+2 shortcut to focus chat-input textarea
- Updated 2 existing app-shell tests that referenced the chat placeholder div
- All 267 tests passing (33 new + 234 existing, 0 regressions)

### File List

**New files:**
- src/components/core/chat/chat-panel.ts
- src/components/core/chat/chat-input.ts
- src/components/core/chat/conversation-block.ts
- tests/frontend/components/chat-panel.test.ts
- tests/frontend/components/chat-input.test.ts
- tests/frontend/components/conversation-block.test.ts

**Modified files:**
- src/app-shell.ts (replaced chat placeholder with chat-panel, updated Cmd+2 focus)
- tests/frontend/components/app-shell.test.ts (updated 2 tests for chat-panel instead of placeholder)

### Senior Developer Review (AI)

**Date:** 2026-02-03
**Reviewers:** Claude (native) + Gemini (CLI) — Parallel adversarial review
**Issues Found:** 3 HIGH, 4 MEDIUM, 2 LOW | 1 dual-confirmed
**Git vs Story Discrepancies:** 0

**Fixes Applied:**
1. [HIGH][Both] Retry mechanism wired through chat-input.sendContent() — was dispatching event to void
2. [HIGH][Claude] _ensureConversation() moved from render() to willUpdate() — prevented signal mutation in render cycle
3. [HIGH][Claude] Test keyboard assertions improved — Enter/Cmd+Enter/Shift+Enter now verify preventDefault behavior
4. [MEDIUM][Gemini] Shadow DOM encapsulation fixed — app-shell uses ChatPanel.focusInput() instead of reaching into shadowRoot
5. [MEDIUM][Claude] Fragile error string-prefix detection documented as tech debt
6. [MEDIUM][Claude] Dead code removed — empty lifecycle overrides, unused _scrollContainer, unused imports (svg, sendMessage, chatConnectionState, streamingConversationId)
7. [MEDIUM][Claude] Test assertions added for all keyboard handler tests

**Tech Debt Noted:**
- conversation-block error detection uses `content.startsWith('Error: ')` — needs dedicated error field on Message type (future story)
- chat-input tests don't mock sendMessage/getApiKey — full send path untested in unit tests (would need module mocking infrastructure)

### Change Log

- 2026-02-03: Story 3.2 implementation complete — Created chat-panel, chat-input, and conversation-block components. Wired into app-shell. 33 new tests added, all 267 tests passing.
- 2026-02-03: Parallel code review (Claude + Gemini) — Fixed 7 issues (3 HIGH, 4 MEDIUM). Retry mechanism wired, render-time side effects moved to willUpdate, shadow DOM encapsulation fixed, dead code removed, test assertions improved.
