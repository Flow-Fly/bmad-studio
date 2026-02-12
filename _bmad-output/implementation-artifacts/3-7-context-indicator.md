# Story 3.7: Context Indicator

Status: done

## Story

As a **user**,
I want **to see how much of the context window I've used in my conversation**,
So that **I know when I'm running low and need to compact or discard** (FR19, FR20).

## Acceptance Criteria

1. **Given** a conversation is active, **When** the chat panel renders, **Then** a `<context-indicator>` displays at the bottom edge of the chat panel, above the input **And** it shows context usage as a color-coded progress bar.

2. **Given** the context usage percentage **When** it changes, **Then** the indicator color transitions smoothly: 0-60% thin accent line (`.context--low`), 60-80% slightly thicker warm amber (`.context--medium`), 80-95% prominent orange (`.context--high`), 95-100% red with gentle pulse animation (`.context--critical`).

3. **Given** the context indicator, **When** I hover over it, **Then** a percentage label appears: "73% of claude-sonnet-4-20250514 context".

4. **Given** the context indicator, **When** I click it, **Then** the compact/discard menu opens (Prepared for Story 3-9-conversation-lifecycle).

5. **Given** context usage reaches 100%, **When** I attempt to continue the conversation (FR20), **Then** a forced modal appears requiring me to compact or discard before continuing **And** no new messages can be sent until I take action (Prepared for Story 3-9-conversation-lifecycle).

6. **Given** the context indicator, **When** rendered, **Then** it uses `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.

## Tasks / Subtasks

- [x] Task 1: Create `context-indicator.ts` web component (AC: #1, #2, #3, #6)
  - [x] 1.1: Create file at `src/components/core/chat/context-indicator.ts`
  - [x] 1.2: Define `@customElement('context-indicator')` extending `LitElement` (NOT SignalWatcher -- this component receives data via `@property`)
  - [x] 1.3: Add `@property({ type: Number }) percentage = 0` for context usage 0-100
  - [x] 1.4: Add `@property({ type: String }) modelName = ''` for hover tooltip label
  - [x] 1.5: Add `@state() private _hovered = false` to track hover state for tooltip
  - [x] 1.6: Implement `_getLevel()` method returning `'low' | 'medium' | 'high' | 'critical'` based on thresholds: 0-60 low, 60-80 medium, 80-95 high, 95-100 critical
  - [x] 1.7: Render a `<div role="meter" aria-valuenow=${percentage} aria-valuemin="0" aria-valuemax="100" aria-label="Context usage">` container
  - [x] 1.8: Inside the meter, render a `.bar` element whose `width` is `${percentage}%` and class includes `.context--{level}`
  - [x] 1.9: On `mouseenter` set `_hovered = true`, on `mouseleave` set `_hovered = false`
  - [x] 1.10: When `_hovered` is true, render a `.tooltip` element showing `"${percentage}% of ${modelName} context"`
  - [x] 1.11: Dispatch `context-indicator-click` custom event on click (bubbles, composed) for future compact/discard menu integration

- [x] Task 2: Style the context-indicator with color-coded thresholds (AC: #2)
  - [x] 2.1: `:host` -- `display: block; padding: 0 var(--bmad-spacing-lg); cursor: pointer;`
  - [x] 2.2: `.track` -- `height: 2px; background: var(--bmad-color-bg-tertiary); border-radius: var(--bmad-radius-full); position: relative; overflow: hidden;`
  - [x] 2.3: `.bar` -- `height: 100%; border-radius: var(--bmad-radius-full); transition: width 300ms ease, background-color 300ms ease;`
  - [x] 2.4: `.context--low .bar` -- `background-color: var(--bmad-color-accent); height: 2px;`
  - [x] 2.5: `.context--medium .track` height 3px, `.context--medium .bar` -- `background-color: var(--bmad-color-warning);`
  - [x] 2.6: `.context--high .track` height 4px, `.context--high .bar` -- `background-color: #f0883e;` (orange between warning and error)
  - [x] 2.7: `.context--critical .track` height 4px, `.context--critical .bar` -- `background-color: var(--bmad-color-error);` with pulse animation
  - [x] 2.8: `.tooltip` -- positioned above the bar, `position: absolute; bottom: 100%; right: 0; margin-bottom: var(--bmad-spacing-xs);`, small text, muted background, `pointer-events: none; white-space: nowrap;`
  - [x] 2.9: Add `@keyframes pulse-bar` for critical state: opacity oscillation between 1 and 0.6
  - [x] 2.10: Add `@media (prefers-reduced-motion: reduce)` to disable pulse and transition animations

- [x] Task 3: Integrate `context-indicator` into `chat-panel.ts` (AC: #1, #4, #5)
  - [x] 3.1: Import `./context-indicator.js` in chat-panel.ts
  - [x] 3.2: Add `MODEL_CONTEXT_WINDOWS` constant mapping known model IDs to context window sizes (e.g., Claude models = 200000, GPT-4o models = 128000) with `DEFAULT_CONTEXT_WINDOW = 200000` fallback
  - [x] 3.3: Add `_getContextPercentage()` method: sum `usage.input_tokens + usage.output_tokens` across all conversation messages, divide by model's context window from lookup, clamp to 0-100
  - [x] 3.4: Place `<context-indicator .percentage=${pct} .modelName=${model}></context-indicator>` between `.message-area-wrapper` and `<chat-input>` in the render method
  - [x] 3.5: Only render context-indicator when a conversation has messages (not in empty state)

- [x] Task 4: Write frontend tests for context-indicator (AC: #1, #2, #3, #6)
  - [x] 4.1: Test: renders with role="meter" and correct aria attributes
  - [x] 4.2: Test: displays correct bar width matching percentage prop
  - [x] 4.3: Test: applies `.context--low` class when percentage is 0-60
  - [x] 4.4: Test: applies `.context--medium` class when percentage is 60-80
  - [x] 4.5: Test: applies `.context--high` class when percentage is 80-95
  - [x] 4.6: Test: applies `.context--critical` class when percentage is 95-100
  - [x] 4.7: Test: tooltip hidden by default, shown on hover with correct text
  - [x] 4.8: Test: dispatches `context-indicator-click` event on click
  - [x] 4.9: Test: renders nothing meaningful when percentage is 0 (bar has 0% width)
  - [x] 4.10: Test: clamps percentage at 100 (bar never exceeds 100% width)

- [x] Task 5: Write chat-panel integration tests (AC: #1)
  - [x] 5.1: Test: context-indicator is rendered in chat-panel when conversation has messages
  - [x] 5.2: Test: context-indicator is NOT rendered when no messages exist

## Dev Notes

### Critical Architecture Patterns

**This story creates ONE new component (`context-indicator.ts`) and modifies two existing files (`chat-panel.ts`, `chat.state.ts`).**

**Token usage data is already flowing.** The `ChatStreamEndPayload` includes a `usage: UsageStats | null` field, and `handleStreamEnd()` in `chat.service.ts` already stores `payload.usage` on the Message object. The `UsageStats` type has `input_tokens` and `output_tokens` fields. Each completed assistant message carries its token counts.

**Context window calculation approach:** Sum all token counts from completed messages in the active conversation. Compare against the model's `max_tokens` from the `Model` type (which has `max_tokens: number`). The `modelsState` signal holds `Record<string, Model[]>` and `selectedModelState` holds the current model ID string. Look up the selected model in the active provider's model list to get `max_tokens`.

**Important: `max_tokens` on the `Model` type represents the model's max OUTPUT tokens** (e.g., 32768 for Opus 4.5), NOT the context window size (which would be 200000 for Claude models). The context window size is not currently exposed by the backend API. Therefore, the frontend must maintain a lookup map of known model context window sizes. Add a `MODEL_CONTEXT_WINDOWS: Record<string, number>` constant in `context-indicator.ts` with known model IDs and their context window sizes. If a model is not in the map, fall back to a default of 200000. This is a pragmatic approach that avoids backend changes for what is fundamentally a display-only concern.

**The context-indicator is a "dumb" component.** It receives `percentage` and `modelName` as properties from chat-panel. It does NOT subscribe to signals directly. The chat-panel (which is already a `SignalWatcher`) computes the percentage and passes it down.

**Compact/discard click handling is deferred.** AC #4 and #5 mention opening a compact/discard menu and forced modal -- these belong to Story 3-9-conversation-lifecycle. For this story, the context-indicator dispatches a `context-indicator-click` event on click, which chat-panel can listen to later.

[Source: src/types/conversation.ts -- UsageStats, Message.usage, src/services/chat.service.ts -- handleStreamEnd stores usage, src/types/provider.ts -- Model.max_tokens]

### Project Structure Notes

**Files to CREATE:**

```
src/
└── components/
    └── core/
        └── chat/
            └── context-indicator.ts  # NEW: Context usage progress bar component

tests/
└── frontend/
    └── components/
        └── context-indicator.test.ts  # NEW: Tests for context-indicator
```

**Files to MODIFY:**

```
src/
└── components/
    └── core/
        └── chat/
            └── chat-panel.ts         # MODIFY: Import context-indicator, add MODEL_CONTEXT_WINDOWS, compute percentage
```

**Files to NOT Touch:**

```
src/types/conversation.ts              # DO NOT MODIFY -- UsageStats and Message.usage already exist
src/types/provider.ts                  # DO NOT MODIFY -- Model.max_tokens already exists
src/services/chat.service.ts           # DO NOT MODIFY -- already stores usage in handleStreamEnd
src/state/chat.state.ts                # DO NOT MODIFY -- no new signals needed
src/components/core/chat/chat-input.ts # DO NOT MODIFY
src/components/core/chat/conversation-block.ts  # DO NOT MODIFY
src/components/shared/markdown-renderer.ts      # DO NOT MODIFY
src/styles/tokens.css                  # DO NOT MODIFY -- use existing tokens
backend/                               # DO NOT MODIFY -- backend already sends usage stats
```

[Source: project-context.md#Project-Structure]

### Technical Requirements

#### Context Percentage Calculation

**Approach:** Do NOT add a computed signal to chat.state.ts. Instead, compute the total tokens directly in chat-panel's render method, since chat-panel already knows the `_conversationId` and has access to `activeConversations` via SignalWatcher. This avoids adding complexity for a simple summation.

**Context window lookup:** Since the backend `Model.max_tokens` is the max output tokens (NOT the context window), add a `MODEL_CONTEXT_WINDOWS` constant in chat-panel.ts that maps known model IDs to their context window sizes. Use these values for the percentage calculation.

```typescript
// In chat-panel.ts:
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-5-20251101': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'claude-haiku-4-5-20251001': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

private _getContextPercentage(): number {
  if (!this._conversationId) return 0;
  const conversation = activeConversations.get().get(this._conversationId);
  if (!conversation || conversation.messages.length === 0) return 0;

  const totalTokens = conversation.messages.reduce((sum, msg) => {
    if (msg.usage) {
      return sum + msg.usage.input_tokens + msg.usage.output_tokens;
    }
    return sum;
  }, 0);

  const model = selectedModelState.get();
  if (!model) return 0;

  const contextWindow = MODEL_CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW;
  return Math.min(100, Math.round((totalTokens / contextWindow) * 100));
}
```

#### Component Rendering Pattern

```typescript
// context-indicator.ts render():
render() {
  const level = this._getLevel();
  return html`
    <div
      class="context--${level}"
      @mouseenter=${() => this._hovered = true}
      @mouseleave=${() => this._hovered = false}
      @click=${this._handleClick}
    >
      <div
        class="track"
        role="meter"
        aria-valuenow=${this.percentage}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Context window usage"
      >
        <div class="bar" style="width: ${this.percentage}%"></div>
      </div>
      ${this._hovered ? html`
        <div class="tooltip">${this.percentage}% of ${this.modelName} context</div>
      ` : nothing}
    </div>
  `;
}
```

#### Backend Stack -- NO CHANGES NEEDED

This story is **frontend-only**. All token usage data already flows through the existing WebSocket event pipeline. The `chat:stream-end` payload includes `usage: { input_tokens, output_tokens }` and `handleStreamEnd()` stores it on the Message.

### Architecture Compliance

- **New component follows pattern:** `context-indicator.ts` in `src/components/core/chat/` alongside existing chat components [Source: project-context.md#Project-Structure]
- **Lucide icons:** Not needed for this component (pure CSS progress bar)
- **No inline styles:** Exception: bar width uses `style="width: ${percentage}%"` which is a dynamic value that cannot be expressed in static CSS. This is the standard pattern for progress bars.
- **Signal-driven rendering:** chat-panel is already a SignalWatcher; context percentage recalculates when conversation messages change [Source: chat-panel.ts]
- **Dark mode only (MVP):** All colors via design tokens [Source: project-context.md#Style-Rules]
- **Accessibility:** `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` as required by AC #6
- **Component receives props, not signals:** context-indicator is a "dumb" presentation component -- chat-panel passes computed percentage and model name as properties

### Library & Framework Requirements

No new dependencies. All required libraries are already installed:
- `lit` -- Web Components framework (already in use)

### File Structure Requirements

One new file: `src/components/core/chat/context-indicator.ts`. One new test file: `tests/frontend/components/context-indicator.test.ts`. One modified file: `chat-panel.ts`.

### Testing Requirements

**Create `tests/frontend/components/context-indicator.test.ts`:**

Add ~10 tests:

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import '../../../src/components/core/chat/context-indicator.js';
import type { ContextIndicator } from '../../../src/components/core/chat/context-indicator.js';

describe('context-indicator', () => {
  it('renders with role="meter" and aria attributes');
  it('displays bar with correct width percentage');
  it('applies context--low for 0-60%');
  it('applies context--medium for 60-80%');
  it('applies context--high for 80-95%');
  it('applies context--critical for 95-100%');
  it('shows tooltip on hover with percentage and model name');
  it('hides tooltip when not hovered');
  it('dispatches context-indicator-click on click');
  it('bar width never exceeds 100%');
});
```

**Modify `tests/frontend/components/chat-panel.test.ts`:**

Add ~2 integration tests:

```typescript
describe('context-indicator integration', () => {
  it('renders context-indicator when conversation has messages');
  it('does not render context-indicator when no messages');
});
```

[Source: tests/frontend/components/conversation-block.test.ts -- existing test patterns]

### Previous Story Intelligence

**From Story 3.6 (Thinking Content Display):**
- conversation-block modifications were straightforward -- single file, CSS-only animations
- Reuse of `<markdown-renderer>` worked well -- same pattern of simple property passing
- The code-simplifier found no issues, suggesting the codebase is clean
- Tests follow `@open-wc/testing` fixture pattern with `html` template tag

**From Story 3.5 (Markdown Renderer):**
- New shared components are created in `src/components/shared/`
- But context-indicator is NOT shared -- it is specific to chat, so it belongs in `src/components/core/chat/`
- Test structure: `describe('component-name', () => { it('...') })` with `@open-wc/testing`

**From Story 3.4 (Chat Panel & Conversation Blocks):**
- chat-panel.ts already manages `_conversationId`, message area, scroll-to-bottom
- The layout is: panel-header -> message-area-wrapper -> chat-input
- Context-indicator slots between message-area-wrapper and chat-input

**From Story 3.1 (WebSocket & Streaming):**
- `UsageStats` interface: `{ input_tokens: number, output_tokens: number }`
- Stored on Message at stream-end: `usage: payload.usage ?? undefined`
- Token data is available immediately after each response completes

### Existing Patterns to Follow

**Chat-panel render layout (context-indicator placement):**
```typescript
// Current:
//   panel-header
//   message-area-wrapper
//   chat-input
// After this story:
//   panel-header
//   message-area-wrapper
//   context-indicator   <-- NEW, between message area and input
//   chat-input
```

**Property passing pattern (from conversation-block):**
```typescript
// chat-panel passes data as properties:
<conversation-block .message=${msg}></conversation-block>
// Same pattern for context-indicator:
<context-indicator .percentage=${pct} .modelName=${model}></context-indicator>
```

### Anti-Patterns to Avoid

- **DO NOT** make context-indicator a SignalWatcher -- it should be a dumb component receiving props
- **DO NOT** modify conversation.ts types -- UsageStats already exists
- **DO NOT** modify chat.service.ts -- usage data already flows
- **DO NOT** modify backend -- this is frontend-only
- **DO NOT** implement compact/discard menu -- that is Story 3-9-conversation-lifecycle
- **DO NOT** implement the forced 100% modal -- that is Story 3-9-conversation-lifecycle
- **DO NOT** use inline styles except for bar width (dynamic percentage)
- **DO NOT** mix icon sets -- no icons needed for this component (pure CSS)
- **DO NOT** break existing tests

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.7 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/implementation-artifacts/3-6-thinking-content-display.md -- Previous story patterns and learnings]
- [Source: src/components/core/chat/chat-panel.ts -- Layout structure, SignalWatcher pattern, conversation management]
- [Source: src/types/conversation.ts -- UsageStats, Message.usage field]
- [Source: src/types/provider.ts -- Model.max_tokens (max output tokens, NOT context window)]
- [Source: backend/providers/claude.go -- claudeModels with MaxTokens values confirming these are output limits]
- [Source: src/services/chat.service.ts -- handleStreamEnd stores usage stats]
- [Source: src/state/chat.state.ts -- activeConversations, streamingConversationId signals]
- [Source: src/state/provider.state.ts -- modelsState, selectedModelState, activeProviderState]
- [Source: src/styles/tokens.css -- Design tokens for colors, spacing, typography]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Created `context-indicator.ts` web component with percentage and modelName properties. Renders a color-coded progress bar with `role="meter"` accessibility. Dispatches `context-indicator-click` on click. Shows tooltip on hover with percentage and model name.
- Task 2: Styled with four threshold levels: low (accent, 2px), medium (warning amber, 3px), high (orange, 4px), critical (red with pulse, 4px). Added prefers-reduced-motion support.
- Task 3: Integrated into chat-panel.ts. Added MODEL_CONTEXT_WINDOWS lookup map for known models. Added _getContextPercentage() method summing message token usage. Context-indicator renders between message area and chat input only when conversation has messages.
- Task 4: Created 15 tests for context-indicator covering aria attributes, bar width, all four threshold levels, boundary values, tooltip show/hide, click event, clamping at 0 and 100.
- Task 5: Added 2 integration tests to chat-panel.test.ts verifying context-indicator appears with messages and is absent without them.

### Change Log

- Created `src/components/core/chat/context-indicator.ts` -- new context usage progress bar component
- Modified `src/components/core/chat/chat-panel.ts` -- import context-indicator, add MODEL_CONTEXT_WINDOWS, add _getContextPercentage(), render context-indicator
- Created `tests/frontend/components/context-indicator.test.ts` -- 15 unit tests
- Modified `tests/frontend/components/chat-panel.test.ts` -- 2 integration tests

### File List

- src/components/core/chat/context-indicator.ts (CREATED)
- src/components/core/chat/chat-panel.ts (MODIFIED)
- tests/frontend/components/context-indicator.test.ts (CREATED)
- tests/frontend/components/chat-panel.test.ts (MODIFIED)

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. The component is a simple CSS progress bar with no libraries reinvented. The approach of passing percentage as a property from the parent is the minimal viable pattern.

#### Dependency Policy
No issues found. No new dependencies required. The component uses only Lit, which is already installed.

#### Effort-to-Value Ratio
No issues found. 5 tasks with subtasks. All tasks directly serve the acceptance criteria: Task 1 (component creation) -> AC #1,2,3,6, Task 2 (styling) -> AC #2, Task 3 (integration) -> AC #1,4,5, Tasks 4-5 (testing) are standard supporting work.

#### Scope Creep
No issues found. AC #4 (compact/discard menu click) and AC #5 (forced 100% modal) are explicitly deferred to Story 3-9-conversation-lifecycle with preparation markers. The story only implements the click event dispatch, not the menu itself.

#### Feasibility
No issues found. The original story assumed `Model.max_tokens` represented context window size, but investigation of the backend (`backend/providers/claude.go`) revealed it represents max output tokens (e.g., 32768 for Opus 4.5). This was corrected in the story to use a frontend `MODEL_CONTEXT_WINDOWS` lookup map instead. The correction is already applied in the story file.

### Summary

- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0

### Notes for Development

- The `MODEL_CONTEXT_WINDOWS` lookup map in chat-panel.ts will need updating when new models are added. This is acceptable for MVP but should be tracked as tech debt for a backend-provided context window field.
- Token summation (input + output across all messages) is an approximation. The actual context window usage includes system prompts and message framing overhead. This approximation is sufficient for the gas-gauge UX.
- The tooltip position (`.tooltip` absolute positioned above the bar) may need z-index adjustment if it overlaps with the scroll-to-bottom button. Test visually during implementation.

## Code Review

**Reviewers:** Claude (parallel review)
**Verdict:** approved (no HIGH or MEDIUM issues)
**Date:** 2026-02-04

### Findings

No HIGH or MEDIUM issues found.

### Findings Not Fixed (LOW)

1. **[LOW] Inline arrow functions for mouseenter/mouseleave event handlers** -- Creates new function instances on each render. However, this pattern is consistent with the existing codebase (used in chat-panel.ts and conversation-block.ts) and the performance impact is negligible for a single component instance.

2. **[LOW] MODEL_CONTEXT_WINDOWS is a static lookup map** -- Requires manual updating when new models are added to the backend. This is explicitly documented as tech debt in the story. The DEFAULT_CONTEXT_WINDOW fallback (200000) ensures graceful degradation for unknown models.
