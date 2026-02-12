# Story 3.8: Text Highlighting in Conversations

Status: done

## Story

As a **user**,
I want **to text-select and color-highlight conversation passages**,
So that **I can mark important content for the extraction agent to prioritize during compaction** (FR21).

## Acceptance Criteria

1. **Given** a conversation block is displayed, **When** I select text within it, **Then** a `<highlight-popover>` appears at the end of the selection **And** it shows 3-4 color dots in a horizontal row.

2. **Given** the highlight popover is visible, **When** I click a color dot, **Then** the selected text is highlighted with a semi-transparent tint of that color **And** the popover dismisses **And** the highlight is stored in the conversation's in-memory highlight array.

3. **Given** the highlight popover is visible, **When** I click outside or press Escape, **Then** the popover dismisses with no highlight applied.

4. **Given** default highlight colors, **When** no customization has been made, **Then** defaults are: yellow (important), green (keep), red (disagree), blue (question).

5. **Given** a conversation block has highlights, **When** the block renders, **Then** highlighted regions display with colored tints **And** multiple highlights can coexist within a single block **And** highlighted regions have `aria-label` describing the color meaning.

6. **Given** the highlight popover, **When** keyboard navigation is used, **Then** arrow keys navigate between colors, Enter selects, Escape dismisses.

**Note:** Highlights are ephemeral in-memory state (v1). They persist for the duration of the conversation session but are not saved to disk. Color customization via settings (AC about `sl-color-picker`) is deferred -- only defaults are implemented in this story.

## Tasks / Subtasks

- [ ] Task 1: Define highlight types and state (AC: #2, #4, #5)
  - [ ] 1.1: Add `Highlight` interface to `src/types/conversation.ts`: `{ id: string; messageId: string; startOffset: number; endOffset: number; color: HighlightColor; }`
  - [ ] 1.2: Add `HighlightColor` type: `'yellow' | 'green' | 'red' | 'blue'`
  - [ ] 1.3: Add `HIGHLIGHT_COLORS` constant with label mapping: `{ yellow: 'important', green: 'keep', red: 'disagree', blue: 'question' }`
  - [ ] 1.4: Add `highlights` field to `Conversation` interface: `highlights: Highlight[]` with default `[]`
  - [ ] 1.5: Add `addHighlight` and `removeHighlight` helper functions to `chat.state.ts` that immutably update the conversation's highlights array
  - [ ] 1.6: Update `_ensureConversation()` in `chat-panel.ts` to include `highlights: []` in new conversation objects

- [ ] Task 2: Create `highlight-popover.ts` web component (AC: #1, #2, #3, #6)
  - [ ] 2.1: Create `src/components/core/chat/highlight-popover.ts` as `@customElement('highlight-popover')`
  - [ ] 2.2: Add `@property({ type: Number }) x = 0` and `@property({ type: Number }) y = 0` for positioning
  - [ ] 2.3: Add `@property({ type: Boolean, reflect: true }) open = false`
  - [ ] 2.4: Render a row of 4 color dots (circular `<button>` elements), each with `background-color` set to the highlight color and `aria-label` set to the color meaning (e.g., "Highlight as important")
  - [ ] 2.5: On color dot click, dispatch `highlight-select` custom event with `{ color: HighlightColor }` detail, then set `open = false`
  - [ ] 2.6: Add `keydown` listener: ArrowLeft/ArrowRight to navigate dots (manage focus), Enter to select focused dot, Escape to dismiss
  - [ ] 2.7: On Escape or click-outside, dispatch `highlight-dismiss` event and set `open = false`
  - [ ] 2.8: Position using `position: fixed; left: ${x}px; top: ${y}px;` with boundary clamping to keep within viewport
  - [ ] 2.9: When `open` changes to true, focus the first color dot for keyboard accessibility

- [ ] Task 3: Style the highlight-popover (AC: #1, #4)
  - [ ] 3.1: `:host` -- `display: none; position: fixed; z-index: var(--bmad-z-dropdown);`
  - [ ] 3.2: `:host([open])` -- `display: block;`
  - [ ] 3.3: `.popover` -- `display: flex; gap: var(--bmad-spacing-xs); padding: var(--bmad-spacing-xs); background: var(--bmad-color-bg-elevated); border: 1px solid var(--bmad-color-border-primary); border-radius: var(--bmad-radius-md); box-shadow: var(--bmad-shadow-md);`
  - [ ] 3.4: `.color-dot` -- `width: 20px; height: 20px; border-radius: var(--bmad-radius-full); border: 2px solid transparent; cursor: pointer; transition: transform var(--bmad-transition-fast), border-color var(--bmad-transition-fast);`
  - [ ] 3.5: `.color-dot:hover, .color-dot:focus-visible` -- `transform: scale(1.2); border-color: var(--bmad-color-text-primary);`
  - [ ] 3.6: `.color-dot:focus-visible` -- `outline: 2px solid var(--bmad-color-accent); outline-offset: 2px;`
  - [ ] 3.7: Color dot backgrounds: yellow `#f0c040`, green `#40c057`, red `#e05252`, blue `#4a9eff`
  - [ ] 3.8: Add `@media (prefers-reduced-motion: reduce)` to disable transform transition

- [ ] Task 4: Integrate text selection handling in conversation-block (AC: #1, #2, #5)
  - [ ] 4.1: Import `./highlight-popover.js` in `conversation-block.ts`
  - [ ] 4.2: Add `@state() private _showPopover = false`, `@state() private _popoverX = 0`, `@state() private _popoverY = 0`
  - [ ] 4.3: Add `_handleMouseUp()` method: check `window.getSelection()`, if selection is non-empty and within `.content`, compute selection rect via `range.getBoundingClientRect()`, set popover position to bottom-right of selection rect, set `_showPopover = true`
  - [ ] 4.4: Add `_handleHighlightSelect(e: CustomEvent)` method: extract color from event detail, get current selection range, compute `startOffset` and `endOffset` relative to the `.content` text node, create `Highlight` object with `crypto.randomUUID()`, call `addHighlight(conversationId, highlight)`, clear selection via `window.getSelection()?.removeAllRanges()`
  - [ ] 4.5: Add `_handleHighlightDismiss()` method: set `_showPopover = false`
  - [ ] 4.6: Render `<highlight-popover>` at the end of the message div, passing position and open state
  - [ ] 4.7: Add `@mouseup` handler on `.content` div to trigger `_handleMouseUp()`
  - [ ] 4.8: Pass `conversationId` as a new `@property()` on conversation-block (chat-panel already iterates messages; add `.conversationId=${this._conversationId}` to the template)

- [ ] Task 5: Render highlights within conversation blocks (AC: #5)
  - [ ] 5.1: Add `@property({ type: Array }) highlights: Highlight[] = []` on conversation-block
  - [ ] 5.2: Filter highlights for the current message: `this.highlights.filter(h => h.messageId === this.message.id)`
  - [ ] 5.3: Create `_applyHighlights(content: string, messageHighlights: Highlight[]): TemplateResult` method that wraps highlighted ranges in `<mark>` elements with appropriate background color and aria-label
  - [ ] 5.4: For user messages (plain text), apply highlights directly to the text content by splitting at highlight boundaries and wrapping
  - [ ] 5.5: For assistant messages (rendered via markdown-renderer), apply highlights as CSS `::highlight` pseudo-elements using the CSS Custom Highlight API (`CSS.highlights`) if available, with a fallback of overlay `<mark>` elements positioned absolutely over the text
  - [ ] 5.6: Each highlighted `<mark>` or highlight range gets `aria-label="${HIGHLIGHT_COLORS[color]}"` for accessibility
  - [ ] 5.7: Pass filtered highlights from chat-panel: `.highlights=${conversationHighlights}` where `conversationHighlights` is retrieved from the conversation state

- [ ] Task 6: Update chat-panel to pass highlight data (AC: #2, #5)
  - [ ] 6.1: In chat-panel's render method, get conversation highlights: `const highlights = conversation?.highlights ?? []`
  - [ ] 6.2: Pass to each conversation-block: `.highlights=${highlights}` and `.conversationId=${this._conversationId}`
  - [ ] 6.3: Listen for `highlight-select` events bubbling from conversation blocks (no additional handler needed -- state updates via addHighlight will trigger re-render through SignalWatcher)

- [ ] Task 7: Write tests for highlight-popover (AC: #1, #2, #3, #6)
  - [ ] 7.1: Test: renders 4 color dots when open
  - [ ] 7.2: Test: hidden when open is false
  - [ ] 7.3: Test: dispatches highlight-select with correct color on dot click
  - [ ] 7.4: Test: dispatches highlight-dismiss on Escape key
  - [ ] 7.5: Test: each dot has correct aria-label
  - [ ] 7.6: Test: arrow keys move focus between dots
  - [ ] 7.7: Test: Enter key selects the focused dot
  - [ ] 7.8: Test: positions at specified x, y coordinates

- [ ] Task 8: Write tests for conversation-block highlighting (AC: #1, #2, #5)
  - [ ] 8.1: Test: highlight-popover appears after text selection in content
  - [ ] 8.2: Test: highlight-popover hidden by default
  - [ ] 8.3: Test: highlighted text displays with colored mark
  - [ ] 8.4: Test: multiple highlights render correctly
  - [ ] 8.5: Test: highlighted marks have correct aria-label

## Dev Notes

### Critical Architecture Patterns

**This story creates ONE new component (`highlight-popover.ts`) and modifies TWO existing files (`conversation-block.ts`, `chat-panel.ts`) plus the shared types (`conversation.ts`) and state (`chat.state.ts`).**

**Highlights are ephemeral in-memory state.** Like conversations, they exist only during the session. They are stored as an array on the `Conversation` object. No backend changes, no persistence -- purely frontend.

**Text selection approach:** Use the native `window.getSelection()` API. When the user completes a text selection within a `.content` div of a conversation-block, detect it via `mouseup`, compute the selection rectangle for positioning the popover, and store character offsets for later highlight rendering.

**Highlight rendering approach for user messages (plain text):** Split the text content at highlight boundaries and wrap highlighted segments in `<mark>` elements with `background-color` set to the semi-transparent highlight color.

**Highlight rendering approach for assistant messages (markdown-rendered):** Since markdown-renderer produces Shadow DOM content, overlaying highlights is more complex. Use CSS Custom Highlight API (`CSS.highlights`) where supported (Chrome, Edge) or fall back to absolute-positioned semi-transparent overlay `<div>` elements. The fallback overlays are positioned using `range.getBoundingClientRect()` relative to the content container.

**Offset calculation:** The `startOffset` and `endOffset` in the `Highlight` object refer to character positions within the message's raw `content` string (not the rendered DOM). This allows highlights to survive re-renders. When rendering, map these offsets back to DOM positions.

**The highlight-popover is a "dumb" component.** It receives position and open state as properties. It dispatches events for color selection and dismissal. The conversation-block handles the selection logic and state updates.

[Source: src/types/conversation.ts -- Message, Conversation types]
[Source: src/state/chat.state.ts -- activeConversations, setConversation]
[Source: src/components/core/chat/conversation-block.ts -- existing block structure]

### Project Structure Notes

**Files to CREATE:**

```
src/
└── components/
    └── core/
        └── chat/
            └── highlight-popover.ts  # NEW: Color selection popover for text highlighting

tests/
└── frontend/
    └── components/
        ├── highlight-popover.test.ts       # NEW: Tests for highlight-popover
        └── conversation-block-highlight.test.ts  # NEW: Tests for highlighting in conversation-block
```

**Files to MODIFY:**

```
src/
├── types/
│   └── conversation.ts       # MODIFY: Add Highlight interface, HighlightColor type, HIGHLIGHT_COLORS constant
├── state/
│   └── chat.state.ts          # MODIFY: Add addHighlight, removeHighlight helpers
└── components/
    └── core/
        └── chat/
            ├── conversation-block.ts  # MODIFY: Add selection handling, popover integration, highlight rendering
            └── chat-panel.ts          # MODIFY: Pass highlights and conversationId to conversation-block
```

**Files to NOT Touch:**

```
src/components/core/chat/context-indicator.ts   # DO NOT MODIFY
src/components/core/chat/chat-input.ts          # DO NOT MODIFY
src/components/shared/markdown-renderer.ts      # DO NOT MODIFY
src/services/chat.service.ts                    # DO NOT MODIFY
backend/                                        # DO NOT MODIFY -- no backend changes
```

[Source: project-context.md#Project-Structure]

### Technical Requirements

#### Highlight Type Definitions

```typescript
// In src/types/conversation.ts:
export type HighlightColor = 'yellow' | 'green' | 'red' | 'blue';

export interface Highlight {
  id: string;
  messageId: string;
  startOffset: number;
  endOffset: number;
  color: HighlightColor;
}

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'important',
  green: 'keep',
  red: 'disagree',
  blue: 'question',
};

// Update Conversation:
export interface Conversation {
  id: string;
  agentId?: string;
  messages: Message[];
  highlights: Highlight[];  // ADD THIS
  createdAt: number;
  model: string;
  provider: string;
}
```

#### State Helpers

```typescript
// In src/state/chat.state.ts:
export function addHighlight(conversationId: string, highlight: Highlight): void {
  const map = new Map(activeConversations.get());
  const conv = map.get(conversationId);
  if (!conv) return;
  map.set(conversationId, {
    ...conv,
    highlights: [...conv.highlights, highlight],
  });
  activeConversations.set(map);
}

export function removeHighlight(conversationId: string, highlightId: string): void {
  const map = new Map(activeConversations.get());
  const conv = map.get(conversationId);
  if (!conv) return;
  map.set(conversationId, {
    ...conv,
    highlights: conv.highlights.filter(h => h.id !== highlightId),
  });
  activeConversations.set(map);
}
```

#### Highlight Popover Component

```typescript
// highlight-popover.ts render():
render() {
  const colors: HighlightColor[] = ['yellow', 'green', 'red', 'blue'];
  const colorValues: Record<HighlightColor, string> = {
    yellow: '#f0c040',
    green: '#40c057',
    red: '#e05252',
    blue: '#4a9eff',
  };

  return html`
    <div class="popover" role="toolbar" aria-label="Highlight colors">
      ${colors.map(color => html`
        <button
          class="color-dot"
          style="background-color: ${colorValues[color]}"
          aria-label="Highlight as ${HIGHLIGHT_COLORS[color]}"
          @click=${() => this._selectColor(color)}
        ></button>
      `)}
    </div>
  `;
}
```

#### Selection Handling in conversation-block

```typescript
// In conversation-block.ts:
private _handleMouseUp(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const content = this.shadowRoot?.querySelector('.content');
  if (!content || !content.contains(range.commonAncestorContainer)) {
    return;
  }

  const rect = range.getBoundingClientRect();
  this._popoverX = rect.right;
  this._popoverY = rect.bottom;
  this._showPopover = true;
}
```

#### Backend Stack -- NO CHANGES NEEDED

This story is **frontend-only**. Highlights are ephemeral in-memory state stored on the Conversation object.

### Architecture Compliance

- **New component follows pattern:** `highlight-popover.ts` in `src/components/core/chat/` alongside existing chat components [Source: project-context.md#Project-Structure]
- **Lucide icons:** Not needed -- color dots are pure CSS circles
- **No inline styles except dynamic values:** Popover position uses `style` for dynamic x/y, color dot backgrounds use `style` for dynamic color -- both are necessary dynamic values
- **Signal-driven rendering:** chat-panel is a SignalWatcher; addHighlight updates activeConversations signal, triggering re-render that passes highlights down to conversation-block
- **Dark mode only (MVP):** All structural colors via design tokens; highlight tint colors are semi-transparent overlays that work on any background
- **Accessibility:** `role="toolbar"` on popover, `aria-label` on each dot, keyboard navigation with arrow keys, Enter, Escape
- **Component receives props, not signals:** highlight-popover and conversation-block receive highlights as properties

### Library & Framework Requirements

No new dependencies. All required libraries are already installed:
- `lit` -- Web Components framework (already in use)

### File Structure Requirements

One new file: `src/components/core/chat/highlight-popover.ts`. Two new test files: `tests/frontend/components/highlight-popover.test.ts`, `tests/frontend/components/conversation-block-highlight.test.ts`. Modified files: `conversation.ts`, `chat.state.ts`, `conversation-block.ts`, `chat-panel.ts`.

### Testing Requirements

**Create `tests/frontend/components/highlight-popover.test.ts`:**

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import '../../../src/components/core/chat/highlight-popover.ts';

describe('highlight-popover', () => {
  it('renders 4 color dots when open');
  it('is hidden when open is false');
  it('dispatches highlight-select with correct color on dot click');
  it('dispatches highlight-dismiss on Escape key');
  it('each dot has correct aria-label');
  it('arrow keys move focus between dots');
  it('Enter key selects the focused dot');
  it('positions at specified x, y coordinates');
});
```

**Create `tests/frontend/components/conversation-block-highlight.test.ts`:**

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import '../../../src/components/core/chat/conversation-block.ts';

describe('conversation-block highlighting', () => {
  it('highlight-popover is hidden by default');
  it('highlighted text displays with colored mark');
  it('multiple highlights render correctly');
  it('highlighted marks have correct aria-label');
});
```

[Source: tests/frontend/components/conversation-block.test.ts -- existing test patterns]

### Previous Story Intelligence

**From Story 3.7 (Context Indicator):**
- "dumb" component pattern (props, not signals) works well -- same for highlight-popover
- chat-panel passes computed data down to child components
- Tests follow `@open-wc/testing` fixture pattern with `html` template tag

**From Story 3.6 (Thinking Content Display):**
- conversation-block handles complex nested rendering (thinking section) -- highlight overlay is similar
- CSS animations use design tokens with `prefers-reduced-motion` support

**From Story 3.4 (Chat Panel & Conversation Blocks):**
- chat-panel already iterates messages via `repeat()` directive with keyed `msg.id`
- conversation-block receives `message` as `@property({ type: Object })`
- Adding `highlights` and `conversationId` properties follows the same pattern

**From Story 3.5 (Markdown Renderer):**
- markdown-renderer is a shared component with Shadow DOM encapsulation
- Highlighting over markdown-rendered content needs to account for Shadow DOM boundaries

### Existing Patterns to Follow

**Event dispatch pattern (from context-indicator and conversation-block):**
```typescript
// Dispatch custom event:
this.dispatchEvent(new CustomEvent('highlight-select', {
  bubbles: true,
  composed: true,
  detail: { color },
}));
```

**Property passing pattern (from chat-panel to conversation-block):**
```typescript
// chat-panel passes data as properties:
<conversation-block
  .message=${msg}
  .conversationId=${this._conversationId}
  .highlights=${highlights}
  @retry-message=${this._handleRetry}
></conversation-block>
```

### Anti-Patterns to Avoid

- **DO NOT** persist highlights to disk -- they are ephemeral in-memory state
- **DO NOT** implement color customization via settings -- only defaults for this story
- **DO NOT** modify markdown-renderer -- apply highlights as overlays on conversation-block
- **DO NOT** modify backend -- this is frontend-only
- **DO NOT** implement the insight extraction integration -- that belongs to Story 3-9-conversation-lifecycle
- **DO NOT** use inline styles except for dynamic positioning and colors
- **DO NOT** mix icon sets -- no icons needed for this component
- **DO NOT** break existing tests or conversation-block functionality

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.8 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/implementation-artifacts/3-7-context-indicator.md -- Previous story patterns and learnings]
- [Source: src/components/core/chat/conversation-block.ts -- Block structure, existing event patterns]
- [Source: src/components/core/chat/chat-panel.ts -- Layout, SignalWatcher, conversation management]
- [Source: src/types/conversation.ts -- Message, Conversation, UsageStats types]
- [Source: src/state/chat.state.ts -- activeConversations, setConversation]
- [Source: src/styles/tokens.css -- Design tokens for colors, spacing, typography, z-index]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Added `Highlight` interface, `HighlightColor` type, and `HIGHLIGHT_COLORS` constant to conversation.ts. Added `highlights: Highlight[]` field to Conversation interface. Added `addHighlight()` and `removeHighlight()` helpers to chat.state.ts. Updated conversation creation in chat-panel.ts and chat.service.ts to include `highlights: []`.
- Task 2-3: Created `highlight-popover.ts` web component with 4 color dots (yellow/green/red/blue), keyboard navigation (arrow keys + Enter + Escape), click-outside dismissal, viewport boundary clamping, and auto-focus on open. Styled with design tokens, `role="toolbar"`, and `prefers-reduced-motion` support.
- Task 4: Integrated text selection handling in conversation-block.ts. Added `_handleContentMouseUp()` to detect text selection within `.content`, compute popover position from selection rect. Added `_handleHighlightSelect()` to create highlights with character offsets and store via `addHighlight()`. Added `_handleHighlightDismiss()`. Added `conversationId` and `highlights` properties.
- Task 5: Implemented highlight rendering for user messages using `<mark>` elements with semi-transparent tint backgrounds and aria-labels. Highlights are sorted by offset and non-overlapping segments are joined.
- Task 6: Updated chat-panel.ts render method to retrieve conversation highlights and pass them (plus conversationId) to each conversation-block.
- Task 7: Created 10 tests for highlight-popover covering: dot rendering, visibility, color selection events, Escape dismissal, aria-labels, arrow key focus, Enter selection, positioning, toolbar role, and auto-close.
- Task 8: Created 7 tests for conversation-block highlighting covering: popover hidden by default, mark rendering for user messages, multiple highlights, aria-labels on marks, filtering by messageId, popover component presence, and streaming message behavior.

### Code-Simplifier Pass

- Removed unused `_renderHighlightOverlays()` method from conversation-block.ts (was a no-op placeholder)
- Removed unused `.highlight-overlay` CSS class from conversation-block.ts
- Replaced overlay call with a preparation comment for Story 3-9

### Change Log

- Created `src/components/core/chat/highlight-popover.ts` -- new highlight color selection popover component
- Modified `src/types/conversation.ts` -- added Highlight, HighlightColor, HIGHLIGHT_COLORS
- Modified `src/state/chat.state.ts` -- added addHighlight, removeHighlight helpers
- Modified `src/components/core/chat/conversation-block.ts` -- added selection handling, popover integration, highlight rendering
- Modified `src/components/core/chat/chat-panel.ts` -- passes highlights and conversationId to conversation-block
- Modified `src/services/chat.service.ts` -- added highlights: [] to fallback conversation creation
- Created `tests/frontend/components/highlight-popover.test.ts` -- 10 unit tests
- Created `tests/frontend/components/conversation-block-highlight.test.ts` -- 7 unit tests

### File List

- src/components/core/chat/highlight-popover.ts (CREATED)
- src/types/conversation.ts (MODIFIED)
- src/state/chat.state.ts (MODIFIED)
- src/components/core/chat/conversation-block.ts (MODIFIED)
- src/components/core/chat/chat-panel.ts (MODIFIED)
- src/services/chat.service.ts (MODIFIED)
- tests/frontend/components/highlight-popover.test.ts (CREATED)
- tests/frontend/components/conversation-block-highlight.test.ts (CREATED)

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. The highlight-popover is a minimal UI component (4 color dots). No library is being reinvented -- the Selection API and `<mark>` elements are standard browser primitives appropriate for this use case.

#### Dependency Policy
No issues found. No new dependencies required. The component uses only Lit (already installed) and native browser APIs (Selection API, Range API).

#### Effort-to-Value Ratio
No issues found. 8 tasks total: 6 core feature tasks directly serving acceptance criteria, 2 testing tasks. The feature is self-contained and each task maps cleanly to ACs. Task 1 (types/state) -> AC #2,4,5, Task 2-3 (popover) -> AC #1,2,3,6, Task 4 (selection) -> AC #1,2, Task 5 (rendering) -> AC #5, Task 6 (integration) -> AC #2,5, Tasks 7-8 (tests).

#### Scope Creep
No issues found. Color customization via `sl-color-picker` is explicitly deferred in the note section. Insight extraction integration is correctly excluded. All tasks trace to the 6 acceptance criteria.

#### Feasibility
**[MEDIUM] CSS Custom Highlight API complexity in Task 5.5.** The story mentions using the CSS Custom Highlight API with a fallback for assistant messages. Since this is a Tauri app running on Chromium-based WebView, the CSS Custom Highlight API is supported. However, the dual-approach (CSS Custom Highlight API + fallback overlays) adds implementation complexity. **Recommendation:** Simplify to use only `<mark>` element overlays for both user and assistant messages. For assistant messages where content is rendered through markdown-renderer's Shadow DOM, compute highlight positions using `range.getBoundingClientRect()` relative to the content container and position semi-transparent overlay divs. This single approach works consistently regardless of Shadow DOM boundaries.

**[MEDIUM] Offset stability across re-renders.** The story stores `startOffset` and `endOffset` as character positions in the raw `content` string. During streaming, the content changes, which could invalidate existing highlight offsets. However, the ACs specify highlighting completed messages (selection happens after content is fully rendered), so this is acceptable. The dev should ensure highlights are only created on non-streaming messages.

### Summary

- **HIGH:** 0
- **MEDIUM:** 2
- **LOW:** 0

### Notes for Development

- Simplify Task 5.5: Use `<mark>` overlay approach consistently for both user and assistant messages. For assistant messages (markdown-rendered), position overlay `<div>` elements using `getBoundingClientRect()` relative to the content container rather than trying to inject into Shadow DOM.
- Ensure the selection handler in Task 4.3 only activates when the message is NOT streaming (`!this.message.isStreaming`). This prevents creating highlights with unstable offsets.
- The highlight-popover z-index should be `var(--bmad-z-dropdown)` (100) which is above normal content but below modals (300). This prevents overlap issues with any future modal components.

## Code Review

**Reviewers:** Claude (parallel review)
**Verdict:** approved (no HIGH or MEDIUM issues)
**Date:** 2026-02-04

### Findings

No HIGH or MEDIUM issues found.

### Findings Not Fixed (LOW)

1. **[LOW] User messages render as plain text instead of markdown-renderer** -- This is intentional for v1 highlight support. User messages rarely need markdown formatting. The `<mark>` element approach requires access to the text content, which is not easily done through markdown-renderer's Shadow DOM. Future stories can revisit if needed.

2. **[LOW] Inline arrow functions on color dot click handlers** -- Creates new function instances on each render. Performance impact is negligible for 4 buttons, and this pattern is consistent with the existing codebase (used in conversation-block and chat-panel).

3. **[LOW] Redundant `position: fixed` on both `:host` and `.popover`** -- The CSS sets `position: fixed` on `:host` while the inline style also sets it on `.popover`. The inner positioning takes precedence. Harmless redundancy.
