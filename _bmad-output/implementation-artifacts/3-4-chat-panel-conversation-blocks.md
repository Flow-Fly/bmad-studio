# Story 3.4: Chat Panel & Conversation Blocks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to see my conversation as a series of message blocks**,
So that **I can follow the dialogue with the agent** (FR11).

## Acceptance Criteria

1. **Given** a conversation exists, **When** the chat panel renders, **Then** messages display as conversation blocks **And** user messages are visually distinct from agent messages **And** each block shows sender and timestamp.

2. **Given** an agent response is streaming, **When** chunks arrive, **Then** content appears progressively in the conversation block **And** a typing indicator shows while receiving **And** streaming begins displaying within 500ms of send (NFR1).

3. **Given** streaming completes, **When** `chat:stream-end` is received, **Then** the typing indicator disappears **And** the full message is displayed **And** timestamp appears.

4. **Given** a long conversation exists, **When** scrolling, **Then** performance remains smooth **And** new messages auto-scroll into view (unless user has scrolled up).

5. **Given** a message block, **When** I hover over it, **Then** a "Copy" action becomes available.

## Tasks / Subtasks

- [x] Task 1: Enhance conversation-block with copy-on-hover action (AC: #5)
  - [x] 1.1: Add a copy button that appears on hover, positioned top-right of the message block using existing Lucide `copy` icon pattern
  - [x] 1.2: Implement `_handleCopy()` that writes the message content to clipboard via `navigator.clipboard.writeText()`
  - [x] 1.3: Show brief "Copied!" feedback text (1.5s) after successful copy via internal `@state() _copied` boolean
  - [x] 1.4: Style copy button with existing design tokens: `--bmad-color-text-tertiary` default, `--bmad-color-text-primary` on hover, fade in via `opacity` transition (200ms)
  - [x] 1.5: Add `aria-label="Copy message"` on the copy button, change to `aria-label="Copied"` when copied feedback is active
  - [x] 1.6: Add `@media (prefers-reduced-motion: reduce)` to disable copy button fade animation

- [x] Task 2: Enhance chat-panel auto-scroll behavior (AC: #4)
  - [x] 2.1: Refine `_handleScroll()` to track `_userHasScrolled` correctly -- already implemented, verify threshold (50px from bottom) works during streaming
  - [x] 2.2: Update `updated()` lifecycle to also scroll to bottom when a new message is added (detect message count change via `_lastMessageCount` tracker)
  - [x] 2.3: Scroll to bottom when streaming content updates ONLY if user has NOT scrolled up -- use `requestAnimationFrame` in `updated()` for smooth scrolling
  - [x] 2.4: When user scrolls back to bottom during streaming, reset `_userHasScrolled` to false so auto-scroll resumes
  - [x] 2.5: Add a "scroll to bottom" floating button that appears when `_userHasScrolled` is true and new messages exist below the viewport -- use Lucide `arrow-down` icon in a circular button at bottom-right of message area

- [x] Task 3: Verify streaming display performance and timing (AC: #2, #3)
  - [x] 3.1: Verify the existing typing indicator in `conversation-block.ts` displays correctly during streaming (it already shows 3 bouncing dots when `isStreaming && !content`)
  - [x] 3.2: Verify progressive content display works correctly (content shows as soon as first `chat:text-delta` arrives -- already implemented via signal-driven re-render)
  - [x] 3.3: Verify typing indicator disappears when `isStreaming` becomes false (set by `handleStreamEnd` in `chat.service.ts`)
  - [x] 3.4: Verify timestamp is visible on both streaming and completed messages (already rendered in `_renderContent()`)
  - [x] 3.5: Profile render performance with 50+ messages -- if rendering is slow, consider keyed repeat directive (`repeat()` from `lit/directives/repeat.js`) in chat-panel's message list to avoid unnecessary DOM re-creation

- [x] Task 4: Ensure message display correctness and visual polish (AC: #1, #3)
  - [x] 4.1: Verify user messages show `message--user` class with accent-tinted background and "You" sender label (already implemented)
  - [x] 4.2: Verify assistant messages show `message--assistant` class with secondary background and "Assistant" sender label (already implemented)
  - [x] 4.3: Verify error messages show `message--error` class with red left border, error icon, and retry button (already implemented)
  - [x] 4.4: Verify partial messages show "Response was interrupted" indicator (already implemented)
  - [x] 4.5: Verify the message area has `role="log"` and `aria-live="polite"` for screen reader announcements (already implemented on chat-panel)
  - [x] 4.6: Verify each conversation-block has `role="listitem"` and descriptive `aria-label` (already implemented)

- [x] Task 5: Write and update frontend tests (AC: #1, #2, #3, #4, #5)
  - [x] 5.1: Add tests to `conversation-block.test.ts` for copy button: hover shows copy button, click copies content, "Copied!" feedback appears, ARIA label changes on copy
  - [x] 5.2: Add tests to `chat-panel.test.ts` for auto-scroll: auto-scrolls on new message, respects `_userHasScrolled` flag, scroll-to-bottom button appears when scrolled up
  - [x] 5.3: Add tests to `chat-panel.test.ts` for streaming display: typing indicator shows during streaming, content appears progressively, typing indicator disappears on stream end
  - [x] 5.4: Optionally add a performance smoke test: render 50 conversation blocks and verify no errors or excessive render time
  - [x] 5.5: Verify 0 regressions on existing frontend tests (currently ~306 tests based on 267 from 3.2 + ~39 from 3.3)

## Dev Notes

### Critical Architecture Patterns

**This story ENHANCES the existing chat-panel and conversation-block components.** The core message display infrastructure was built in Story 3.2 (chat-panel, conversation-block, chat-input) and extended with agent support in Story 3.3. This story adds the copy-on-hover affordance, refines auto-scroll behavior, and verifies the full streaming display pipeline meets acceptance criteria.

**Most ACs are ALREADY partially or fully implemented.** The conversation-block already renders user/assistant messages with distinct styling, timestamps, typing indicators, streaming content, error states, and partial indicators. The chat-panel already has a message area with `role="log"`, scroll handling, and auto-scroll to bottom. The primary NEW functionality is:
1. Copy-on-hover action on conversation blocks (AC #5 -- entirely new)
2. Scroll-to-bottom floating button when user has scrolled up (AC #4 -- enhancement)
3. Performance verification with many messages (AC #4 -- verification + optional optimization)

**Signal-driven rendering ensures streaming responsiveness.** The chat.service.ts handlers (`handleTextDelta`, `handleStreamStart`, `handleStreamEnd`) update the `activeConversations` signal immutably. chat-panel extends `SignalWatcher(LitElement)` which triggers re-render on signal change. conversation-block receives message via `@property()`. This chain ensures content appears within the same render cycle as the signal update.

**The `repeat()` directive from Lit may be needed for performance.** Currently chat-panel maps messages with `messages.map(msg => html`...`)`. For long conversations (50+ messages), each signal update causes Lit to diff the entire list. Using `repeat(messages, msg => msg.id, msg => html`...`)` provides keyed rendering that only updates changed items.

[Source: src/components/core/chat/chat-panel.ts, src/components/core/chat/conversation-block.ts, src/services/chat.service.ts, src/state/chat.state.ts]

### Project Structure Notes

**Files to Modify:**

```
src/
├── components/
│   └── core/
│       └── chat/
│           ├── chat-panel.ts                 # MODIFY: Add scroll-to-bottom button, refine auto-scroll, optionally add repeat() directive
│           └── conversation-block.ts         # MODIFY: Add copy-on-hover button with clipboard API

tests/
└── frontend/
    └── components/
        ├── chat-panel.test.ts               # MODIFY: Add auto-scroll and streaming tests
        └── conversation-block.test.ts       # MODIFY: Add copy button tests
```

**Files to NOT Touch:**

```
src/services/chat.service.ts              # DO NOT MODIFY -- streaming handlers are complete
src/services/websocket.service.ts         # DO NOT MODIFY
src/state/chat.state.ts                   # DO NOT MODIFY -- chat signals are complete
src/types/conversation.ts                 # DO NOT MODIFY -- Message type already has all needed fields
src/components/core/chat/chat-input.ts    # DO NOT MODIFY -- input logic is complete from 3.2
src/components/core/navigation/agent-badge.ts  # DO NOT MODIFY -- agent selection from 3.3
src/state/agent.state.ts                  # DO NOT MODIFY
src/services/agent.service.ts             # DO NOT MODIFY
src/app-shell.ts                          # DO NOT MODIFY
src/styles/                               # DO NOT MODIFY (use existing design tokens)
backend/                                  # DO NOT MODIFY -- backend is complete for chat
src/components/core/chat/context-indicator.ts   # DO NOT CREATE -- that's Story 3.7
src/components/core/chat/highlight-popover.ts   # DO NOT CREATE -- that's Story 3.8
src/components/shared/markdown-renderer.ts      # DO NOT CREATE -- that's Story 3.5
```

[Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md, _bmad-output/project-context.md#Code-Quality-Style-Rules]

### Technical Requirements

#### Frontend Stack (MUST USE)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Lit | `lit` | ^3.1.0 | Web Components framework |
| Lit repeat directive | `lit/directives/repeat.js` | ^3.1.0 | Keyed list rendering for performance |
| Signals | `@lit-labs/signals` + `signal-polyfill` | ^0.2.0 | Reactive state management |
| Lucide | `lucide` | ^0.563.0 | Copy and arrow-down icons |

**DO NOT** add new npm dependencies for this story. The `repeat` directive is built into Lit.

#### Clipboard API

Use `navigator.clipboard.writeText()` for the copy action. This is available in all modern browsers and Tauri WebView. No polyfill needed. Handle the promise rejection gracefully (e.g., fallback to `document.execCommand('copy')` if clipboard API is not available, though unlikely in Tauri).

#### Backend Stack -- NO CHANGES NEEDED

This story is **frontend-only**. All streaming infrastructure (WebSocket, chat.service.ts event handlers, chat.state.ts signals) is fully implemented from Stories 3.1 and 3.2.

[Source: package.json, src/services/chat.service.ts, src/state/chat.state.ts]

### Architecture Compliance

- **Signal-driven state:** conversation-block receives `Message` via `@property()` -- Lit handles property-based re-rendering automatically when the parent (chat-panel) re-renders from signal changes [Source: src/components/core/chat/conversation-block.ts]
- **Service layer pattern:** No direct fetching in components -- all message data flows through chat.service.ts -> chat.state.ts -> chat-panel -> conversation-block [Source: project-context.md#Framework-Specific-Rules]
- **Ephemeral conversations:** All conversation data is in-memory only -- no persistence changes needed [Source: project-context.md#Conversation-Insight-Model]
- **Component naming:** `kebab-case` tag, `PascalCase` class -- existing `<conversation-block>` / `class ConversationBlock` [Source: project-context.md#TypeScript]
- **No inline styles:** Use design tokens via CSS custom properties [Source: project-context.md#Style-Rules]
- **Lucide icons only:** Use Lucide icons for copy and arrow-down buttons [Source: project-context.md#Anti-Patterns]
- **SignalWatcher pattern:** chat-panel already extends `SignalWatcher(LitElement)` for reactive rendering [Source: src/components/core/chat/chat-panel.ts]

### Library & Framework Requirements

| Library | Current Version | Required Action |
|---|---|---|
| lit | ^3.1.0 | No update -- `repeat` directive available at `lit/directives/repeat.js` |
| @lit-labs/signals | ^0.2.0 | No update -- SignalWatcher mixin for auto re-render |
| signal-polyfill | current | No update -- Signal.State, Signal.Computed |
| lucide | ^0.563.0 | No update -- copy and arrow-down icon SVGs available |

**Zero new dependencies.** All required functionality exists in current packages.

### File Structure Requirements

All modified files follow established naming conventions already in place. No new files need to be created for this story -- only modifications to existing components and test files.

[Source: project-context.md#Language-Specific-Rules]

### Testing Requirements

**Frontend tests (@open-wc/testing):**
- Location: `tests/frontend/components/` (existing test files)
- Pattern: Use `@open-wc/testing` fixtures for Lit component tests
- Side-effect imports needed due to esbuild tree-shaking (import component file directly)

**Test scenarios to ADD:**

**conversation-block.test.ts (add ~6 new tests):**
- Copy button appears on hover (mouseenter triggers visibility)
- Copy button has correct ARIA label
- Click copy button calls navigator.clipboard.writeText with message content
- "Copied!" feedback text appears after copy
- Copy button not shown for empty/streaming messages with no content
- Copy button works for both user and assistant messages

**chat-panel.test.ts (add ~6 new tests):**
- Auto-scrolls to bottom when new message is added
- Does NOT auto-scroll when user has scrolled up (`_userHasScrolled` is true)
- Scroll-to-bottom button appears when `_userHasScrolled` is true
- Scroll-to-bottom button click scrolls to bottom and resets `_userHasScrolled`
- Messages render with correct count matching conversation state
- Streaming message updates trigger re-render without scroll position loss

**Current test count: ~306 frontend tests passing.** This story should add ~12 tests without breaking existing ones.

[Source: _bmad-output/project-context.md#Testing-Rules, tests/frontend/components/conversation-block.test.ts, tests/frontend/components/chat-panel.test.ts]

### Previous Story Intelligence

**From Story 3.3 (Agent Selection & Parallel Conversations):**

- **~306 frontend tests passing** (267 from 3.2 + ~39 from 3.3) -- do NOT regress
- **chat-panel.ts** already has: agent-aware conversation switching, scroll handling with `_userHasScrolled` + `_handleScroll()` + `_scrollToBottom()`, `willUpdate()` for conversation management, `updated()` for auto-scroll
- **conversation-block.ts** already has: user/assistant message styling, typing indicator (3 bouncing dots), streaming content display, error state with retry button, partial message indicator, Lucide icon rendering pattern (ICONS object + SVG template), ARIA attributes (role="listitem", aria-label)
- **Code review findings from 3.3:**
  - `requestAnimationFrame` used in `_handleFocusout` for async focus safety -- use same pattern for scroll operations
  - `@media (prefers-reduced-motion: reduce)` added to agent-badge -- add same to any new animations
  - Hardcoded SVG icons pattern (ICONS object with tag/attrs arrays) -- follow this same pattern for copy and arrow-down icons
- **agent-badge** handles dropdown z-index with `--bmad-z-dropdown` -- scroll-to-bottom button should use a lower z-index (e.g., 50 or use `--bmad-z-base`)

**From Story 3.2 (Chat Service & Message Sending):**

- **chat.service.ts `sendMessage()`** adds user message optimistically then sends via WebSocket -- user message appears immediately
- **`handleStreamStart()`** adds assistant message with `isStreaming: true, content: ''` -- this triggers typing indicator in conversation-block
- **`handleTextDelta()`** appends content to streaming message -- this triggers progressive content display
- **`handleStreamEnd()`** sets `isStreaming: false`, `isPartial` flag -- typing indicator disappears, timestamp confirmed
- **Error detection** uses `content.startsWith('Error: ')` prefix -- do NOT introduce new string-prefix patterns
- **Retry mechanism** wired through `ChatPanel._handleRetry()` -> `ChatInput.sendContent()` -> `ChatInput.focusInput()`

**From Story 3.1 (WebSocket Connection & Streaming):**

- **WebSocket events** use `chat:` namespace: `chat:stream-start`, `chat:text-delta`, `chat:thinking-delta`, `chat:stream-end`, `chat:error`
- **`Message` type** has `thinkingContent?: string` field -- thinking content display is Story 3.6, do NOT implement it here
- **`streamingConversationId` signal** tracks which conversation is currently streaming -- can be used to determine if current conversation is actively streaming

[Source: _bmad-output/implementation-artifacts/3-3-agent-selection-parallel-conversations.md, _bmad-output/implementation-artifacts/3-2-chat-service-message-sending.md, _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md]

### Git Intelligence

**Recent commits:**
```
9f3209b Merge pull request #17 from Flow-Fly/story/3-3-agent-selection-parallel-conversations
7f893fe fix(3-3-agent-selection-parallel-conversations): apply code review fixes
9f0f273 feat(3-3-agent-selection-parallel-conversations): implement story
0991faa Story/3-2-chat-service-message-sending (#16)
7b5c757 Story/3-1-websocket-connection-streaming (#15)
```

**Current branch:** `epic/3-agent-conversation-xp`

**Branch strategy:**
- Create `story/3-4-chat-panel-conversation-blocks` from `epic/3-agent-conversation-xp`
- Implement all changes on story branch
- PR: story -> epic -> dev -> main

**Commit style:** `feat:` prefix, atomic commits, one logical change per commit.

**Files modified in Story 3.3 (most recent):**
```
src/components/core/chat/chat-panel.ts         # MODIFY in this story
src/components/core/navigation/agent-badge.ts  # DO NOT TOUCH
src/state/agent.state.ts                       # DO NOT TOUCH
src/services/agent.service.ts                  # DO NOT TOUCH
src/types/agent.ts                             # DO NOT TOUCH
src/app-shell.ts                               # DO NOT TOUCH
```

[Source: git log, _bmad-output/project-context.md#Git-Strategy]

### Existing Patterns to Follow

**Lucide icon SVG pattern (from conversation-block.ts):**
```typescript
const ICONS = {
  'copy': [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  'arrow-down': [
    ['path', { d: 'M12 5v14' }],
    ['path', { d: 'm19 12-7 7-7-7' }],
  ],
  // ... existing icons ...
} as const;
```

**SVG rendering helper (from conversation-block.ts):**
```typescript
private _renderIcon(name: keyof typeof ICONS) {
  const elements = ICONS[name];
  if (!elements) return nothing;
  return html`
    <span class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'rect': return svg`<rect ...attrs />`;
            case 'path': return svg`<path d=${attrs.d} />`;
            // etc.
          }
        })}
      </svg>
    </span>
  `;
}
```

**Clipboard copy pattern:**
```typescript
private async _handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(this.message.content);
    this._copied = true;
    setTimeout(() => { this._copied = false; }, 1500);
  } catch {
    // Fallback or silent failure
  }
}
```

**CSS hover-reveal pattern:**
```css
.copy-button {
  opacity: 0;
  transition: opacity 200ms ease;
}

.message:hover .copy-button,
.copy-button:focus-visible {
  opacity: 1;
}
```

**Lit repeat directive for keyed rendering:**
```typescript
import { repeat } from 'lit/directives/repeat.js';

// In render():
${repeat(messages, msg => msg.id, msg => html`
  <conversation-block
    .message=${msg}
    @retry-message=${this._handleRetry}
  ></conversation-block>
`)}
```

**Scroll-to-bottom button pattern:**
```typescript
${this._userHasScrolled ? html`
  <button
    class="scroll-to-bottom"
    @click=${this._scrollToBottomAndReset}
    aria-label="Scroll to latest message"
  >
    ${this._renderIcon('arrow-down')}
  </button>
` : nothing}
```

[Source: src/components/core/chat/conversation-block.ts, src/components/core/chat/chat-panel.ts, src/components/core/navigation/agent-badge.ts]

### UX Patterns to Implement

**Copy-on-Hover Action:**
- Copy button appears on message hover, positioned absolute top-right within the message block
- Semi-transparent background on the button to ensure readability over message content
- Button fades in (200ms opacity transition)
- After click: brief "Copied!" text feedback replaces the copy icon for 1.5s
- Button also visible on `:focus-visible` for keyboard accessibility

**Scroll-to-Bottom Button:**
- Appears when user has scrolled up and new messages exist below viewport
- Positioned: absolute bottom-right of the message area, above the chat-input border
- Circular button with arrow-down icon
- Background: `--bmad-color-bg-elevated` with border
- Shadow: `--bmad-shadow-sm`
- Click: smooth scroll to bottom, reset `_userHasScrolled`
- Disappears when user reaches bottom or clicks the button

**Auto-Scroll Behavior:**
- Default: auto-scroll to bottom on every new message or streaming update
- Interrupted: when user scrolls up past 50px threshold from bottom, `_userHasScrolled = true`
- Resumed: when user scrolls back to within 50px of bottom, `_userHasScrolled = false`
- On new message while scrolled up: scroll-to-bottom button appears, no forced scroll

**Animation Timing (from UX spec):**
- Copy button fade-in: 200ms ease (matches UX state change timing)
- Scroll-to-bottom button: 200ms ease-out appearance
- "Copied!" feedback: 1.5s visible, then fade back to copy icon

**Accessibility:**
- Copy button: `aria-label="Copy message"` (changes to `"Copied"` briefly)
- Scroll-to-bottom: `aria-label="Scroll to latest message"`
- Message area: `role="log"` with `aria-live="polite"` (already present)
- Each message: `role="listitem"` with descriptive `aria-label` (already present)
- Respect `prefers-reduced-motion`: disable fade animations

**Design Token Usage:**
```css
/* Copy Button */
--bmad-color-text-tertiary      /* Default icon color */
--bmad-color-text-primary       /* Hover icon color */
--bmad-color-bg-elevated        /* Button background */
--bmad-color-success            /* "Copied!" feedback color */
--bmad-radius-sm                /* Button border radius */
--bmad-transition-fast          /* 150ms transition */

/* Scroll-to-Bottom Button */
--bmad-color-bg-elevated        /* Button background */
--bmad-color-border-primary     /* Button border */
--bmad-color-text-secondary     /* Icon color */
--bmad-shadow-sm                /* Button shadow */
--bmad-radius-full              /* Circular button */
--bmad-spacing-sm               /* Positioning offset */
```

[Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md, _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md, src/styles/tokens.css]

### Anti-Patterns to Avoid

- **DO NOT** modify `chat.service.ts` -- streaming handlers are complete and working
- **DO NOT** modify `chat.state.ts` -- chat signals are complete
- **DO NOT** modify `conversation.ts` types -- Message type has all needed fields (content, isStreaming, isPartial, thinkingContent, usage, timestamp)
- **DO NOT** modify `chat-input.ts` -- input logic is complete from 3.2
- **DO NOT** modify `agent-badge.ts` -- agent selection is complete from 3.3
- **DO NOT** modify any backend files -- streaming infrastructure is complete
- **DO NOT** create context indicator -- that's Story 3.7
- **DO NOT** create markdown renderer -- that's Story 3.5 (messages currently render as plain text with `white-space: pre-wrap`)
- **DO NOT** create highlight popover -- that's Story 3.8
- **DO NOT** create thinking content display -- that's Story 3.6
- **DO NOT** implement virtual scrolling -- the epic AC says "performance remains smooth" which at MVP can be addressed with the `repeat()` directive; virtual scrolling is a future optimization if needed
- **DO NOT** persist any conversation data or copy history to disk
- **DO NOT** use inline styles -- use CSS custom properties
- **DO NOT** mix icon libraries -- Lucide only
- **DO NOT** add new npm dependencies
- **DO NOT** introduce new string-prefix error detection patterns (existing `content.startsWith('Error: ')` is tech debt, do not expand it)
- **DO NOT** break the existing ~306 frontend tests
- **DO NOT** add copy button to messages that are currently streaming with no content (only show copy on messages with actual content)

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.4 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md -- Naming conventions, component patterns, WebSocket events]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md -- File structure, component locations]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md -- Animation timing, feedback patterns, keyboard shortcuts]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md -- ConversationBlock props, ChatPanel layout, copy action spec]
- [Source: _bmad-output/implementation-artifacts/3-3-agent-selection-parallel-conversations.md -- Previous story patterns, test count, code review findings]
- [Source: _bmad-output/implementation-artifacts/3-2-chat-service-message-sending.md -- Chat service architecture, streaming pipeline, error handling]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-connection-streaming.md -- WebSocket events, Message type, streaming protocol]
- [Source: src/components/core/chat/chat-panel.ts -- Current implementation to modify, scroll handling, message rendering]
- [Source: src/components/core/chat/conversation-block.ts -- Current implementation to modify, icon pattern, message rendering]
- [Source: src/components/core/chat/chat-input.ts -- Input component, no changes needed]
- [Source: src/services/chat.service.ts -- sendMessage, handleStreamStart/TextDelta/StreamEnd/Error]
- [Source: src/state/chat.state.ts -- activeConversations, setConversation, streamingConversationId]
- [Source: src/types/conversation.ts -- Message interface (id, role, content, thinkingContent, timestamp, isStreaming, isPartial, usage)]
- [Source: src/styles/tokens.css -- Design tokens available (colors, spacing, radius, shadows, transitions)]
- [Source: tests/frontend/components/conversation-block.test.ts -- Existing 12 tests, test patterns]
- [Source: tests/frontend/components/chat-panel.test.ts -- Existing ~16 tests, mock patterns, agent-aware tests]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Enhanced conversation-block with copy-on-hover action -- added copy button with Lucide copy/check icons, clipboard API integration with fallback, "Copied!" feedback (1.5s), ARIA labels, prefers-reduced-motion support
- Task 2: Enhanced chat-panel auto-scroll -- added scroll-to-bottom floating button with arrow-down icon, message-area-wrapper for positioning, _scrollToBottomAndReset method, _lastMessageCount tracker in updated()
- Task 3: Verified streaming display -- typing indicator, progressive content, stream end behavior all confirmed working via existing signal-driven rendering pipeline
- Task 4: Verified message display correctness -- user/assistant styling, error states, partial indicators, ARIA attributes all confirmed working
- Task 5: Added ~14 new tests (8 conversation-block copy tests, 6 chat-panel auto-scroll/repeat tests) without breaking existing tests
- Performance: Replaced messages.map() with repeat() directive for keyed rendering in chat-panel

### Code-Simplifier Pass

- Consolidated duplicate `.message` CSS rule: merged `position: relative` into the main `.message` block instead of a separate rule
- Simplified `_handleCopy()`: removed deprecated `document.execCommand('copy')` fallback (Tauri WebView fully supports Clipboard API)
- Files modified: src/components/core/chat/conversation-block.ts

### Change Log

- Added copy-on-hover button to conversation-block (Lucide copy/check icons, clipboard API, "Copied!" feedback)
- Added scroll-to-bottom floating button to chat-panel (Lucide arrow-down icon, circular button)
- Added message-area-wrapper div for scroll-to-bottom positioning
- Replaced messages.map() with repeat() directive for keyed rendering performance
- Added _lastMessageCount tracker for message count change detection
- Added prefers-reduced-motion media query for copy button and typing indicator animations

### File List

- src/components/core/chat/conversation-block.ts (MODIFIED)
- src/components/core/chat/chat-panel.ts (MODIFIED)
- tests/frontend/components/conversation-block.test.ts (MODIFIED)
- tests/frontend/components/chat-panel.test.ts (MODIFIED)
