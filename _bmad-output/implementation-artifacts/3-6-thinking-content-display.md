# Story 3.6: Thinking Content Display

Status: done

## Story

As a **user**,
I want **to see the agent's "thinking" process when available**,
So that **I understand how the agent is reasoning** (FR13).

## Acceptance Criteria

1. **Given** the provider streams `chat:thinking-delta` events during a response, **When** thinking deltas arrive, **Then** thinking content accumulates in a separate section from the main text **And** thinking content is displayed in a collapsible section with muted styling **And** it is visually distinct (different background, smaller font) **And** thinking content streams in real-time alongside text content (not after).

2. **Given** thinking content exists, **When** the message first renders, **Then** the thinking section is collapsed by default **And** a toggle shows "Show thinking" / "Hide thinking".

3. **Given** thinking content is expanded, **When** I click the toggle, **Then** the section collapses smoothly (200ms animation).

4. **Given** no thinking content is returned, **When** the message renders, **Then** no thinking section appears.

## Tasks / Subtasks

- [x] Task 1: Add thinking content toggle and collapsible section to `conversation-block.ts` (AC: #1, #2, #3, #4)
  - [x] 1.1: Add `@state() private _thinkingExpanded = false` to track toggle state
  - [x] 1.2: Add a `_renderThinkingSection()` method that returns a collapsible section when `message.thinkingContent` is truthy, or `nothing` when absent
  - [x] 1.3: The thinking section renders ABOVE the main content inside the `.message` div, after the header
  - [x] 1.4: The toggle button shows "Show thinking" or "Hide thinking" with a Lucide `chevron-right` / `chevron-down` icon
  - [x] 1.5: The thinking content body renders through `<markdown-renderer>` (reuse existing shared component) so code blocks and formatting work
  - [x] 1.6: Add `_handleThinkingToggle()` method that flips `_thinkingExpanded`
  - [x] 1.7: Call `_renderThinkingSection()` in `_renderContent()` before the main content div

- [x] Task 2: Style the thinking section for dark mode (AC: #1, #2, #3)
  - [x] 2.1: `.thinking-section` container: `margin: var(--bmad-spacing-xs) 0`, no overflow
  - [x] 2.2: `.thinking-toggle` button: `display: inline-flex; align-items: center; gap: var(--bmad-spacing-xs)`, no border/background, `color: var(--bmad-color-text-tertiary)`, `font-size: var(--bmad-font-size-xs)`, `cursor: pointer`, hover changes to `--bmad-color-text-secondary`
  - [x] 2.3: `.thinking-toggle .icon`: 14px, `transition: transform 200ms ease` for rotation
  - [x] 2.4: `.thinking-body`: `background: var(--bmad-color-bg-tertiary)`, `border-radius: var(--bmad-radius-md)`, `padding: var(--bmad-spacing-sm) var(--bmad-spacing-md)`, `font-size: var(--bmad-font-size-sm)`, `color: var(--bmad-color-text-secondary)`, `margin-top: var(--bmad-spacing-xs)`
  - [x] 2.5: `.thinking-body` collapse/expand: use `max-height` + `overflow: hidden` + `transition: max-height 200ms ease` for smooth animation; collapsed = `max-height: 0; padding: 0; margin: 0; opacity: 0`, expanded = `max-height: none; opacity: 1`
  - [x] 2.6: Add `@media (prefers-reduced-motion: reduce)` to disable the `max-height` and `transform` transitions
  - [x] 2.7: `.thinking-toggle--expanded .icon` rotates 90deg (chevron-right to chevron-down effect via CSS transform)

- [x] Task 3: Add Lucide chevron-right icon to ICONS constant (AC: #2)
  - [x] 3.1: Add `'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]]` to the existing `ICONS` object in `conversation-block.ts`

- [x] Task 4: Write frontend tests (AC: #1, #2, #3, #4)
  - [x] 4.1: Test: assistant message WITH thinkingContent shows `.thinking-section` with toggle
  - [x] 4.2: Test: assistant message WITHOUT thinkingContent does NOT show `.thinking-section`
  - [x] 4.3: Test: user message never shows thinking section (even if thinkingContent were set)
  - [x] 4.4: Test: thinking section is collapsed by default (`.thinking-body` is hidden)
  - [x] 4.5: Test: clicking toggle expands thinking section (`.thinking-body` becomes visible)
  - [x] 4.6: Test: toggle text changes between "Show thinking" and "Hide thinking"
  - [x] 4.7: Test: thinking content renders through `<markdown-renderer>`
  - [x] 4.8: Test: streaming message with thinkingContent shows thinking section while streaming
  - [x] 4.9: Verify 0 regressions on existing conversation-block tests

## Dev Notes

### Critical Architecture Patterns

**This story modifies ONLY `conversation-block.ts` and its test file.** No new files are created. The thinking content display is a feature of the conversation block, not a separate component.

**All backend plumbing is already in place:**
- `Message.thinkingContent?: string` field exists in `src/types/conversation.ts`
- `chat:thinking-delta` WebSocket event type exists in `src/types/conversation.ts`
- `handleThinkingDelta()` in `chat.service.ts` already accumulates thinking deltas into `message.thinkingContent`
- Signal-driven re-rendering in `chat-panel.ts` already triggers updates when `thinkingContent` changes

**The `<markdown-renderer>` shared component (from Story 3.5) should be reused** for thinking content rendering. It is already imported in `conversation-block.ts`. This ensures code blocks, formatting, and links work correctly inside thinking sections.

**Thinking content streams in parallel with text content.** The backend sends `chat:thinking-delta` events interleaved with `chat:text-delta` events. Both update the same `Message` object in state. Since `conversation-block` receives the full `Message` via `@property()`, it re-renders whenever either field changes.

[Source: src/types/conversation.ts, src/services/chat.service.ts, src/components/core/chat/conversation-block.ts]

### Project Structure Notes

**Files to MODIFY:**

```
src/
└── components/
    └── core/
        └── chat/
            └── conversation-block.ts  # MODIFY: Add thinking section rendering + styles

tests/
└── frontend/
    └── components/
        └── conversation-block.test.ts  # MODIFY: Add ~8 new thinking content tests
```

**Files to NOT Touch:**

```
src/types/conversation.ts              # DO NOT MODIFY -- Message.thinkingContent already exists
src/services/chat.service.ts           # DO NOT MODIFY -- handleThinkingDelta already works
src/state/chat.state.ts                # DO NOT MODIFY -- signal updates already propagate
src/components/core/chat/chat-panel.ts # DO NOT MODIFY -- already passes full Message to conversation-block
src/components/core/chat/chat-input.ts # DO NOT MODIFY
src/components/shared/markdown-renderer.ts # DO NOT MODIFY -- reuse as-is for thinking content
src/styles/tokens.css                  # DO NOT MODIFY -- use existing tokens
backend/                               # DO NOT MODIFY -- backend already handles thinking events
```

[Source: project-context.md#Project-Structure, src/types/conversation.ts, src/services/chat.service.ts]

### Technical Requirements

#### Collapse/Expand Pattern

Use CSS `max-height` transition for smooth collapse/expand:

```typescript
// In _renderThinkingSection():
const expanded = this._thinkingExpanded;
return html`
  <div class="thinking-section">
    <button
      class="thinking-toggle ${expanded ? 'thinking-toggle--expanded' : ''}"
      @click=${this._handleThinkingToggle}
      aria-expanded=${expanded}
      aria-controls="thinking-body"
    >
      ${this._renderIcon('chevron-right')}
      <span>${expanded ? 'Hide thinking' : 'Show thinking'}</span>
    </button>
    <div
      class="thinking-body ${expanded ? 'thinking-body--expanded' : ''}"
      id="thinking-body"
      role="region"
      aria-label="Agent thinking process"
    >
      <markdown-renderer
        .content=${this.message.thinkingContent ?? ''}
        @link-click=${this._handleLinkClick}
      ></markdown-renderer>
    </div>
  </div>
`;
```

**CSS animation approach:**
- Collapsed: `max-height: 0; overflow: hidden; opacity: 0; padding: 0; margin: 0;`
- Expanded: `max-height: none; overflow: visible; opacity: 1;` with normal padding/margin
- Transition: `max-height 200ms ease, opacity 200ms ease, padding 200ms ease, margin 200ms ease`
- The `max-height: 0` -> `max-height: none` transition requires a two-step approach: use a large `max-height` value (e.g., `2000px`) for the expanded state to animate, then switch to `max-height: none` after transition ends. Alternatively, just use `max-height: 2000px` as a pragmatic cap since thinking content rarely exceeds that.

#### Chevron Icon

Add to existing ICONS constant:
```typescript
'chevron-right': [
  ['path', { d: 'm9 18 6-6-6-6' }],
],
```

The chevron rotates 90 degrees via CSS `transform: rotate(90deg)` when expanded, creating a chevron-down effect.

#### Backend Stack -- NO CHANGES NEEDED

This story is **frontend-only**. No backend modifications required. All WebSocket events and message accumulation are already implemented.

### Architecture Compliance

- **No new components:** Thinking section is part of `conversation-block`, not a separate component
- **Reuses `<markdown-renderer>`:** Already imported in conversation-block from Story 3.5
- **Lucide icons only:** Chevron-right icon follows existing SVG pattern [Source: project-context.md#Anti-Patterns]
- **No inline styles:** All styling via CSS custom properties and design tokens [Source: project-context.md#Style-Rules]
- **Signal-driven rendering:** conversation-block re-renders on any Message property change via SignalWatcher in chat-panel [Source: chat-panel.ts]
- **Dark mode only (MVP):** Thinking section styles target dark mode [Source: project-context.md#Style-Rules]
- **Accessibility:** Toggle uses `aria-expanded`, content region uses `role="region"` and `aria-label`

### Library & Framework Requirements

No new dependencies. All required libraries are already installed:
- `lit` -- Web Components framework (already in use)
- `markdown-renderer` -- Shared component (already imported in conversation-block)

### File Structure Requirements

No new files. Only modifications to existing `conversation-block.ts` and `conversation-block.test.ts`.

### Testing Requirements

**Modify `tests/frontend/components/conversation-block.test.ts`:**

Add ~8 new tests in a `describe('thinking section', ...)` block:

```typescript
// Test helpers
const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world!',
  timestamp: Date.now(),
  ...overrides,
});

describe('thinking section', () => {
  it('shows thinking section when assistant message has thinkingContent');
  it('does not show thinking section when thinkingContent is absent');
  it('does not show thinking section for user messages');
  it('thinking section is collapsed by default');
  it('clicking toggle expands thinking section');
  it('toggle text shows "Show thinking" when collapsed');
  it('toggle text shows "Hide thinking" when expanded');
  it('thinking content renders through markdown-renderer');
  it('shows thinking section during streaming with thinkingContent');
});
```

**Current test count: ~330 frontend tests passing.** This story should add ~8 new tests. Verify 0 regressions.

[Source: tests/frontend/components/conversation-block.test.ts]

### Previous Story Intelligence

**From Story 3.5 (Markdown Renderer):**
- `<markdown-renderer>` is already imported in conversation-block via `import '../../shared/markdown-renderer.js'`
- The component accepts `.content` string property and emits `link-click` events
- conversation-block already handles `link-click` via `_handleLinkClick()`
- Code-simplifier pass replaced dynamic imports with static `litRender` import
- The `_renderIcon()` method handles Lucide SVG icons with a switch statement for `rect`, `path`, `circle`, `line` tags

**From Story 3.4 (Chat Panel & Conversation Blocks):**
- conversation-block has copy-on-hover button, error states, typing indicator, partial indicator
- The `_renderContent()` method is the main rendering method -- thinking section should be added here
- Copy button copies raw `message.content` (not rendered HTML) -- this should NOT include thinking content

**From Story 3.1 (WebSocket & Streaming):**
- `chat:thinking-delta` events are defined and handled in chat.service.ts
- Thinking content accumulates via `(msg.thinkingContent ?? '') + payload.content`
- Provider timeouts up to 5 minutes for extended thinking responses

[Source: 3-5-markdown-renderer.md, 3-4-chat-panel-conversation-blocks.md]

### Existing Patterns to Follow

**Icon rendering pattern (from conversation-block.ts):**
```typescript
private _renderIcon(name: keyof typeof ICONS) {
  const elements = ICONS[name];
  if (!elements) return nothing;
  return html`
    <span class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ...>
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'path': return svg`<path d=${attrs.d} />`;
            // ... other cases
          }
        })}
      </svg>
    </span>
  `;
}
```

**Content rendering pattern (from conversation-block.ts):**
```typescript
private _renderContent() {
  // Streaming with no content yet -- show typing indicator
  if (message.isStreaming && !message.content) {
    return this._renderTypingIndicator();
  }
  // Error state
  if (this._isError()) { ... }
  // Regular content -- render through markdown
  return html`
    <div class="content">
      <markdown-renderer .content=${message.content} @link-click=${this._handleLinkClick}></markdown-renderer>
    </div>
  `;
}
```

### Anti-Patterns to Avoid

- **DO NOT** create a separate `<thinking-section>` component -- keep it in conversation-block
- **DO NOT** modify any backend files -- this is frontend-only
- **DO NOT** modify `chat.service.ts`, `chat.state.ts`, or `conversation.ts` types
- **DO NOT** modify `chat-panel.ts` or `chat-input.ts`
- **DO NOT** modify `markdown-renderer.ts` -- reuse as-is
- **DO NOT** modify `tokens.css` -- use existing design tokens
- **DO NOT** include thinking content in the copy button's clipboard text -- copy only `message.content`
- **DO NOT** use JavaScript animation (requestAnimationFrame, WAAPI) -- use CSS transitions
- **DO NOT** create new npm dependencies -- everything needed is already installed
- **DO NOT** show thinking section for user messages
- **DO NOT** show thinking section when `thinkingContent` is falsy/empty
- **DO NOT** break existing ~330 frontend tests
- **DO NOT** mix icon sets -- Lucide only

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.6 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/implementation-artifacts/3-5-markdown-renderer.md -- Previous story patterns, markdown-renderer integration]
- [Source: src/components/core/chat/conversation-block.ts -- Current implementation, icon pattern, _renderContent()]
- [Source: src/types/conversation.ts -- Message type with thinkingContent field]
- [Source: src/services/chat.service.ts -- handleThinkingDelta() handler already in place]
- [Source: src/components/shared/markdown-renderer.ts -- Reusable markdown rendering component]
- [Source: tests/frontend/components/conversation-block.test.ts -- Existing tests to not regress]

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. The story correctly reuses the existing `<markdown-renderer>` shared component rather than building custom thinking content rendering. No new components are created -- thinking display is integrated directly into the existing `conversation-block.ts`.

#### Dependency Policy
No issues found. No new dependencies required. All needed libraries (Lit, markdown-renderer) are already installed and imported.

#### Effort-to-Value Ratio
No issues found. 4 tasks with 17 subtasks. All tasks directly serve the four acceptance criteria: Task 1 (core toggle+section) -> AC #1-4, Task 2 (styling) -> AC #1-3, Task 3 (icon) -> AC #2, Task 4 (testing) is standard supporting work.

#### Scope Creep
No issues found. All tasks trace to acceptance criteria. No feature work beyond the story's scope. The story explicitly avoids modifying backend, types, or other components.

#### Feasibility
No issues found. CSS max-height transitions are a well-established pattern for collapse/expand. The `Message.thinkingContent` field and `handleThinkingDelta()` handler already exist, so the rendering layer is the only missing piece. The `<markdown-renderer>` component is already imported in conversation-block.

### Summary

- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0

### Notes for Development

- The CSS `max-height` transition approach requires a fixed upper bound value (e.g., `2000px`) rather than `max-height: none` for animation to work. Use a generous cap since thinking content length varies.
- During streaming, both `thinkingContent` and `content` may grow simultaneously. Ensure the thinking section renders correctly even when both fields are being updated rapidly.
- The `_thinkingExpanded` state is per-component instance. If the user scrolls past one message and expands thinking on another, each toggle is independent.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Added `_thinkingExpanded` state, `_handleThinkingToggle()`, and `_renderThinkingSection()` methods to conversation-block. Thinking section renders above main content when `message.thinkingContent` is truthy and role is assistant. Reuses existing `<markdown-renderer>` for content rendering.
- Task 2: Styled thinking section with collapsible CSS animation using `max-height` transition (200ms ease). Toggle button is muted text, thinking body has tertiary background. Added prefers-reduced-motion support.
- Task 3: Added `chevron-right` Lucide icon to ICONS constant. Chevron rotates 90deg via CSS transform when expanded.
- Task 4: Added 8 new tests for thinking section: presence/absence, user vs assistant, collapsed default, toggle expand, toggle text, markdown-renderer integration, streaming support, empty string handling.

### Code-Simplifier Pass

- No simplifications needed. The implementation is minimal -- only 2 files modified, no new files created. All new code follows existing patterns directly. CSS transitions are straightforward and the render method uses a clean guard clause pattern.

### Change Log

- Modified `src/components/core/chat/conversation-block.ts` -- added thinking section with collapsible toggle, chevron icon, CSS styles, accessibility attributes
- Modified `tests/frontend/components/conversation-block.test.ts` -- added 8 new thinking section tests

### File List

- src/components/core/chat/conversation-block.ts (MODIFIED)
- tests/frontend/components/conversation-block.test.ts (MODIFIED)

## Code Review

**Reviewers:** Claude + adversarial review (parallel)
**Verdict:** approved (no HIGH or MEDIUM issues)
**Date:** 2026-02-04

### Findings

No HIGH or MEDIUM issues found.

### Findings Not Fixed (LOW)

1. **[LOW] Hardcoded `id="thinking-body"` in thinking section** -- Would create duplicate IDs if multiple thinking sections existed in the same DOM. However, each `conversation-block` has its own Shadow DOM root, so IDs are scoped and isolated. No real conflict in practice.

2. **[LOW] `_thinkingExpanded` state resets on component re-creation** -- If virtual scrolling is implemented in the future, components may be destroyed and re-created, resetting the toggle state. Acceptable for MVP since conversation blocks are persistent.
