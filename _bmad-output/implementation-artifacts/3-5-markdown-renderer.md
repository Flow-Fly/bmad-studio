# Story 3.5: Markdown Renderer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **agent responses rendered as formatted Markdown**,
So that **code, lists, and formatting are readable**.

## Acceptance Criteria

1. **Given** an agent response contains Markdown, **When** the message renders, **Then** headings, bold, italic, lists are properly formatted **And** code blocks have syntax highlighting **And** links are clickable and open in external browser.

2. **Given** a code block is displayed, **When** I hover over it, **Then** a "Copy" button appears **And** clicking it copies the code to clipboard.

3. **Given** the response contains potentially unsafe HTML, **When** rendering, **Then** HTML is sanitized to prevent XSS.

4. **Given** the user has prefers-reduced-motion enabled, **When** animations would occur, **Then** they are disabled or minimized.

## Tasks / Subtasks

- [x] Task 1: Create `<markdown-renderer>` shared component (AC: #1, #3)
  - [x] 1.1: Create `src/components/shared/markdown-renderer.ts` as a Lit web component (`MarkdownRenderer` class, `<markdown-renderer>` tag)
  - [x] 1.2: Add `marked` npm dependency for CommonMark-compliant Markdown parsing
  - [x] 1.3: Add `DOMPurify` npm dependency for HTML sanitization to prevent XSS
  - [x] 1.4: Implement `content` string property -- when set, parse Markdown via `marked.parse()` then sanitize via `DOMPurify.sanitize()`, render result via Lit's `unsafeHTML` directive
  - [x] 1.5: Configure `marked` options: `gfm: true` (GitHub Flavored Markdown), `breaks: true` (line breaks as `<br>`)
  - [x] 1.6: Configure `DOMPurify` to allow safe HTML tags (headings, lists, code, pre, a, strong, em, blockquote, table, img) and strip dangerous tags (script, iframe, object, embed, form)
  - [x] 1.7: Add link handling -- intercept `<a>` clicks, prevent default, and dispatch a `link-click` CustomEvent with the URL so the parent can open it externally (Tauri `shell.open`)
  - [x] 1.8: Add `@media (prefers-reduced-motion: reduce)` to disable any transitions

- [x] Task 2: Add syntax highlighting for code blocks (AC: #1)
  - [x] 2.1: Add `highlight.js` npm dependency (lightweight, supports many languages, tree-shakeable)
  - [x] 2.2: Import a dark theme CSS from highlight.js that matches the dark mode palette (e.g., `github-dark` or `atom-one-dark`)
  - [x] 2.3: Configure `marked` with a custom renderer for code blocks: use `hljs.highlight(code, { language })` when language is specified, `hljs.highlightAuto(code)` for unspecified languages
  - [x] 2.4: Register only commonly-needed languages to minimize bundle size: `typescript`, `javascript`, `go`, `json`, `yaml`, `html`, `css`, `bash`, `markdown`, `python`, `sql`, `xml`
  - [x] 2.5: Style code blocks with `--bmad-font-family-mono`, `--bmad-color-bg-tertiary` background, `--bmad-radius-md` border radius, `--bmad-spacing-md` padding

- [x] Task 3: Add copy button on code blocks (AC: #2)
  - [x] 3.1: After markdown rendering, query all `<pre><code>` elements and inject a copy button positioned absolute top-right of each `<pre>` block
  - [x] 3.2: Reuse the copy pattern from `conversation-block.ts`: Lucide copy/check SVG icons, `navigator.clipboard.writeText()`, "Copied!" feedback (1.5s)
  - [x] 3.3: Style copy button with same design tokens as conversation-block copy button: `opacity: 0` default, visible on `pre:hover` or `:focus-visible`, `--bmad-color-bg-elevated` background
  - [x] 3.4: Add `aria-label="Copy code"` (changes to `"Copied"` on copy)

- [x] Task 4: Integrate markdown-renderer into conversation-block (AC: #1, #3)
  - [x] 4.1: Import `../shared/markdown-renderer.js` in `conversation-block.ts`
  - [x] 4.2: Replace the plain text `<div class="content">${message.content}</div>` with `<markdown-renderer .content=${message.content}></markdown-renderer>`
  - [x] 4.3: Remove `white-space: pre-wrap` and `word-break: break-word` from `.content` CSS (markdown-renderer handles its own styling)
  - [x] 4.4: Handle `link-click` event from markdown-renderer -- for now, open links via `window.open(url, '_blank')` (Tauri will override with shell.open in later epic)
  - [x] 4.5: Verify streaming content still displays correctly -- markdown-renderer should handle partial markdown gracefully (incomplete blocks render as text until complete)

- [x] Task 5: Style markdown output for dark mode (AC: #1)
  - [x] 5.1: Style headings (h1-h6) with proper hierarchy: `--bmad-font-size-xl` for h1 down to `--bmad-font-size-md` for h6, `--bmad-color-text-primary`, appropriate margin
  - [x] 5.2: Style inline code with `--bmad-font-family-mono`, `--bmad-color-bg-tertiary` background, `--bmad-radius-sm` padding
  - [x] 5.3: Style blockquotes with left border in `--bmad-color-border-primary`, italic text, slightly muted color
  - [x] 5.4: Style tables with `--bmad-color-border-primary` borders, alternating row backgrounds using `--bmad-color-bg-secondary`
  - [x] 5.5: Style links with `--bmad-color-accent`, underline on hover
  - [x] 5.6: Style lists (ul/ol) with proper indentation and bullet/number styling
  - [x] 5.7: Style horizontal rules with `--bmad-color-border-primary`
  - [x] 5.8: Ensure all text inherits `--bmad-color-text-primary` and `--bmad-font-size-md` base

- [x] Task 6: Write frontend tests (AC: #1, #2, #3, #4)
  - [x] 6.1: Create `tests/frontend/components/markdown-renderer.test.ts`
  - [x] 6.2: Test basic markdown rendering: headings, bold, italic, lists render correct HTML
  - [x] 6.3: Test code block rendering: code block has syntax highlighting classes, is wrapped in `<pre><code>`
  - [x] 6.4: Test code block copy button: button appears on code block, click copies code content
  - [x] 6.5: Test HTML sanitization: script tags are stripped, safe HTML is preserved
  - [x] 6.6: Test link handling: clicking a link dispatches `link-click` event with URL
  - [x] 6.7: Test empty/null content: component renders nothing or empty when content is empty
  - [x] 6.8: Update `conversation-block.test.ts` to verify messages now render through `<markdown-renderer>` instead of plain text
  - [x] 6.9: Verify 0 regressions on existing frontend tests

## Dev Notes

### Critical Architecture Patterns

**This story creates a NEW shared component (`<markdown-renderer>`) and integrates it into the existing conversation-block.** The markdown-renderer is designed as a reusable shared component because it will also be used by the artifact-panel (Story 6.1) and insight-card (Story 3.10) in future stories.

**Three new npm dependencies are required:**
1. `marked` -- CommonMark-compliant Markdown parser (fast, lightweight, widely used)
2. `DOMPurify` -- HTML sanitizer to prevent XSS attacks from rendered markdown
3. `highlight.js` -- Syntax highlighting for code blocks (tree-shakeable, many language support)

**The conversation-block currently renders messages as plain text** with `white-space: pre-wrap`. This story replaces that with markdown rendering while preserving all existing functionality (copy-on-hover, error states, typing indicator, streaming).

**Streaming content must work with markdown rendering.** During streaming, partial markdown will be rendered on every update. The `marked` library handles incomplete markdown gracefully -- unterminated code blocks or lists render as regular text until the closing syntax arrives. Since conversation-block already re-renders on every signal update (via chat-panel's SignalWatcher), the markdown will progressively render as content streams in.

[Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#Markdown-Renderer, _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.5]

### Project Structure Notes

**Files to CREATE:**

```
src/
└── components/
    └── shared/
        └── markdown-renderer.ts    # NEW: Reusable markdown rendering component

tests/
└── frontend/
    └── components/
        └── markdown-renderer.test.ts  # NEW: Tests for markdown-renderer
```

**Files to MODIFY:**

```
src/
└── components/
    └── core/
        └── chat/
            └── conversation-block.ts  # MODIFY: Replace plain text with <markdown-renderer>

tests/
└── frontend/
    └── components/
        └── conversation-block.test.ts  # MODIFY: Update tests for markdown rendering

package.json                           # MODIFY: Add marked, dompurify, highlight.js dependencies
```

**Files to NOT Touch:**

```
src/services/chat.service.ts            # DO NOT MODIFY -- streaming handlers complete
src/state/chat.state.ts                 # DO NOT MODIFY -- chat signals complete
src/types/conversation.ts               # DO NOT MODIFY -- Message type has all needed fields
src/components/core/chat/chat-panel.ts  # DO NOT MODIFY -- already uses repeat() and conversation-block
src/components/core/chat/chat-input.ts  # DO NOT MODIFY -- input logic complete
src/components/core/navigation/agent-badge.ts  # DO NOT MODIFY
src/styles/tokens.css                   # DO NOT MODIFY -- use existing tokens
backend/                                # DO NOT MODIFY -- backend complete for chat
```

[Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md, _bmad-output/project-context.md#Code-Quality-Style-Rules]

### Technical Requirements

#### Frontend Stack

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Lit | `lit` | ^3.1.0 | Web Components framework |
| Lit unsafeHTML | `lit/directives/unsafe-html.js` | ^3.1.0 | Render sanitized HTML from markdown |
| marked | `marked` | ^15.0.0 | CommonMark Markdown parser |
| DOMPurify | `dompurify` | ^3.2.0 | HTML sanitization (XSS prevention) |
| highlight.js | `highlight.js` | ^11.11.0 | Syntax highlighting for code blocks |
| Lucide | `lucide` | ^0.563.0 | Copy/check icons for code block copy |

**Install command:** `npm install marked dompurify highlight.js && npm install -D @types/dompurify`

#### marked Configuration

```typescript
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
// Import only needed languages
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import go from 'highlight.js/lib/languages/go';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
// ... register all languages

marked.setOptions({ gfm: true, breaks: true });

// Custom renderer for syntax highlighting
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }) {
  const language = lang && hljs.getLanguage(lang) ? lang : undefined;
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : hljs.highlightAuto(text).value;
  return `<pre class="code-block"><code class="hljs language-${lang || 'auto'}">${highlighted}</code></pre>`;
};
```

#### DOMPurify Configuration

```typescript
import DOMPurify from 'dompurify';

const purifyConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'del', 's', 'mark',
    'ul', 'ol', 'li',
    'pre', 'code', 'span',
    'blockquote',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};
```

#### Backend Stack -- NO CHANGES NEEDED

This story is **frontend-only**. No backend modifications required.

### Architecture Compliance

- **Shared component location:** `src/components/shared/markdown-renderer.ts` -- shared components go in `shared/` directory per project structure [Source: project-context.md#Project-Structure]
- **Component naming:** `kebab-case` tag (`<markdown-renderer>`), `PascalCase` class (`MarkdownRenderer`) [Source: project-context.md#TypeScript]
- **No inline styles:** All styling via CSS custom properties and design tokens [Source: project-context.md#Style-Rules]
- **Lucide icons only:** Copy/check icons reuse same SVG pattern from conversation-block [Source: project-context.md#Anti-Patterns]
- **Service layer pattern:** Component receives content via property, no direct fetching [Source: project-context.md#Framework-Specific-Rules]
- **Signal-driven rendering:** conversation-block receives Message via `@property()` and passes content to markdown-renderer -- re-renders automatically on signal updates [Source: conversation-block.ts]
- **Dark mode only (MVP):** All markdown styles target dark mode [Source: project-context.md#Style-Rules]

### Library & Framework Requirements

| Library | Version to Install | Purpose |
|---|---|---|
| marked | ^15.0.0 | CommonMark Markdown parsing with GFM support |
| dompurify | ^3.2.0 | HTML sanitization preventing XSS |
| @types/dompurify | ^3.2.0 | TypeScript type definitions for DOMPurify (devDep) |
| highlight.js | ^11.11.0 | Syntax highlighting with tree-shakeable language imports |

**Why these libraries:**
- `marked` is fast, lightweight (~35KB), CommonMark compliant, supports custom renderers for code blocks
- `DOMPurify` is the industry standard for HTML sanitization, works in all browsers
- `highlight.js` supports tree-shaking (import only needed languages), has dark themes matching our palette, widely used

### File Structure Requirements

New file follows established naming: `markdown-renderer.ts` in `src/components/shared/` (kebab-case, shared directory for reusable components). Test file follows existing pattern: `markdown-renderer.test.ts` in `tests/frontend/components/`.

[Source: project-context.md#Language-Specific-Rules, project-context.md#File-Organization-Rules]

### Testing Requirements

**Frontend tests (@open-wc/testing):**
- Location: `tests/frontend/components/` (new test file + modified existing)
- Pattern: Use `@open-wc/testing` fixtures for Lit component tests
- Side-effect imports needed due to esbuild tree-shaking

**Test scenarios for markdown-renderer.test.ts (~10 new tests):**
- Renders heading tags (h1 through h3) from markdown content
- Renders bold and italic text correctly
- Renders ordered and unordered lists
- Renders code blocks with syntax highlighting classes
- Code block copy button appears and copies code content
- HTML is sanitized: script tags are stripped
- Links dispatch `link-click` event with URL
- Empty content renders empty/nothing
- Inline code renders with correct styling class
- Blockquotes render correctly

**Update conversation-block.test.ts (~2-3 modified tests):**
- Update existing content rendering test to verify `<markdown-renderer>` is used instead of plain text div
- Verify copy button on conversation-block still works (copies raw message content, not rendered HTML)
- Verify streaming messages render through markdown-renderer

**Current test count: ~320 frontend tests passing.** This story should add ~10 new tests and modify ~2-3 existing tests.

[Source: _bmad-output/project-context.md#Testing-Rules, tests/frontend/components/conversation-block.test.ts]

### Previous Story Intelligence

**From Story 3.4 (Chat Panel & Conversation Blocks):**
- **~320 frontend tests passing** -- do NOT regress
- **conversation-block.ts** has copy-on-hover button with Lucide copy/check icons, clipboard API, "Copied!" feedback
- The copy button copies `this.message.content` (raw text) -- this should STAY AS-IS even after markdown integration (user copies raw markdown, not rendered HTML)
- **Code-simplifier pass** removed deprecated `document.execCommand('copy')` fallback -- Tauri WebView fully supports Clipboard API
- The `.content` CSS class currently has `white-space: pre-wrap; word-break: break-word;` -- these should be removed when integrating markdown-renderer (markdown handles its own whitespace)
- The `_renderContent()` method currently returns plain text div -- replace with `<markdown-renderer>`
- The `_hasCopyableContent()` check should remain unchanged

**From Story 3.3 & 3.2:**
- Signal-driven rendering pipeline is working: chat.service.ts -> chat.state.ts -> chat-panel -> conversation-block
- Streaming content updates trigger re-renders automatically via SignalWatcher
- The `repeat()` directive provides keyed rendering in chat-panel -- each conversation-block updates independently

[Source: _bmad-output/implementation-artifacts/3-4-chat-panel-conversation-blocks.md, _bmad-output/implementation-artifacts/3-3-agent-selection-parallel-conversations.md]

### Existing Patterns to Follow

**Lucide icon SVG pattern (reuse from conversation-block.ts):**
```typescript
const ICONS = {
  'copy': [
    ['rect', { x: '8', y: '8', width: '14', height: '14', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  'check': [
    ['path', { d: 'M20 6 9 17l-5-5' }],
  ],
} as const;
```

**Lit unsafeHTML directive pattern:**
```typescript
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// In render():
return html`<div class="markdown-body">${unsafeHTML(this._renderedHtml)}</div>`;
```

**Clipboard copy pattern (from conversation-block.ts):**
```typescript
private async _handleCodeCopy(code: string, button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    // Show "Copied!" feedback
  } catch {
    // Silent failure
  }
}
```

**CSS dark mode styling pattern for markdown:**
```css
.markdown-body h1 { font-size: var(--bmad-font-size-xl); }
.markdown-body code { font-family: var(--bmad-font-family-mono); }
.markdown-body pre { background: var(--bmad-color-bg-tertiary); }
.markdown-body a { color: var(--bmad-color-accent); }
```

### Anti-Patterns to Avoid

- **DO NOT** modify any backend files -- this is frontend-only
- **DO NOT** modify `chat.service.ts`, `chat.state.ts`, or `conversation.ts` types
- **DO NOT** modify `chat-panel.ts` -- it already passes message to conversation-block correctly
- **DO NOT** modify `chat-input.ts` or `agent-badge.ts`
- **DO NOT** modify `tokens.css` -- use existing design tokens
- **DO NOT** render raw HTML without sanitization -- always use DOMPurify
- **DO NOT** use inline styles -- use CSS custom properties
- **DO NOT** mix icon libraries -- Lucide only
- **DO NOT** create a separate markdown service -- the component handles its own rendering
- **DO NOT** change the conversation-block copy button behavior -- it should still copy raw `message.content`, not rendered HTML
- **DO NOT** implement thinking content display -- that is Story 3.6
- **DO NOT** implement highlight support in markdown -- that is Story 3.8
- **DO NOT** break the existing ~320 frontend tests
- **DO NOT** import all highlight.js languages -- tree-shake by importing only needed ones

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.5 -- Story requirements and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md#Markdown-Renderer -- Component specification, props, features]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md -- Naming conventions, component patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md -- File structure, shared component location]
- [Source: _bmad-output/project-context.md -- All project rules, conventions, anti-patterns]
- [Source: _bmad-output/implementation-artifacts/3-4-chat-panel-conversation-blocks.md -- Previous story patterns, copy button, current rendering]
- [Source: src/components/core/chat/conversation-block.ts -- Current implementation, icon pattern, _renderContent()]
- [Source: src/components/core/chat/chat-panel.ts -- Parent component, repeat() directive, signal-driven rendering]
- [Source: src/styles/tokens.css -- Available design tokens (colors, spacing, radius, fonts)]
- [Source: package.json -- Current dependencies, no marked/dompurify/highlight.js yet]

## Story Review

**Verdict:** approved
**Iteration:** 1/3
**Date:** 2026-02-04

### Findings

#### Over-Engineering
No issues found. The story correctly uses established libraries (marked, DOMPurify, highlight.js) rather than building custom implementations. Tree-shaking for highlight.js languages is pragmatic.

#### Dependency Policy
No issues found. No unbacked dependency restrictions. The three new dependencies (marked, dompurify, highlight.js) are justified and widely used.

#### Effort-to-Value Ratio
No issues found. 6 tasks with 39 subtasks. All tasks directly serve the four acceptance criteria. Task breakdown is proportionate to complexity: core rendering (Task 1), syntax highlighting (Task 2), code copy (Task 3), integration (Task 4), styling (Task 5), testing (Task 6).

#### Scope Creep
No issues found. All tasks trace to acceptance criteria: Tasks 1/4/5 -> AC #1 (formatting), Task 3 -> AC #2 (code copy), Task 1 -> AC #3 (sanitization), Task 1 -> AC #4 (reduced motion). Task 6 (testing) is standard supporting work.

#### Feasibility
No issues found. Libraries are compatible with the Lit/TypeScript/Vite stack. The `unsafeHTML` directive is the correct Lit approach for rendering sanitized HTML. Streaming compatibility is addressed in dev notes.

### Summary

- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0

### Notes for Development

- During streaming, partially-formed markdown (e.g., an incomplete fenced code block) may briefly render oddly. The `marked` library handles this gracefully in most cases, but the dev should test edge cases like partial code blocks mid-stream.
- The `marked` v12+ API changed the `renderer.code` method signature to accept an object parameter `{ text, lang }` rather than positional arguments. Ensure the version installed matches the API used in the code examples.
- Consider adding a `will-change: contents` CSS property on the markdown-body container if streaming re-renders cause layout thrashing.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Task 1: Created `<markdown-renderer>` shared component with Lit, `marked` for GFM parsing, `DOMPurify` for XSS sanitization, `unsafeHTML` directive for rendering, link-click event dispatch, prefers-reduced-motion support
- Task 2: Added `highlight.js` with tree-shaken language imports (ts, js, go, json, yaml, xml/html, css, bash, markdown, python, sql), custom marked renderer for syntax-highlighted code blocks, dark mode hljs theme via CSS overrides
- Task 3: Added code block copy buttons injected after render via `updated()` lifecycle, reusing Lucide copy/check SVG icons, clipboard API, "Copied!" feedback (1.5s), hover-reveal pattern
- Task 4: Integrated markdown-renderer into conversation-block -- replaced plain text div with `<markdown-renderer>`, removed pre-wrap styling, added link-click handler opening in new window
- Task 5: Styled all markdown elements for dark mode using project design tokens -- headings, inline code, code blocks, blockquotes, tables, links, lists, horizontal rules, strong/em, images, strikethrough
- Task 6: Created 10 markdown-renderer tests (headings, bold/italic, lists, code blocks, sanitization, link events, empty content, inline code, blockquotes, tables), updated 2 conversation-block tests for markdown-renderer integration

### Code-Simplifier Pass

- Replaced dynamic `import('lit')` in `updated()` with statically imported `litRender` to avoid unnecessary async overhead
- Removed inline positioning styles from code-copy-container div (positioning handled by CSS `.code-copy-button` rules)
- Simplified `_renderIcon` type casts with a shared `attrs` helper function
- Files modified: src/components/shared/markdown-renderer.ts

### Change Log

- Created `src/components/shared/markdown-renderer.ts` -- reusable markdown rendering component
- Modified `src/components/core/chat/conversation-block.ts` -- integrated markdown-renderer, removed pre-wrap styling, added link-click handler
- Added npm dependencies: `marked`, `dompurify`, `highlight.js`, `@types/dompurify`
- Created `tests/frontend/components/markdown-renderer.test.ts` -- 10 new tests
- Modified `tests/frontend/components/conversation-block.test.ts` -- updated streaming content test, added markdown-renderer integration test

### File List

- src/components/shared/markdown-renderer.ts (CREATED)
- src/components/core/chat/conversation-block.ts (MODIFIED)
- package.json (MODIFIED)
- package-lock.json (MODIFIED)
- tests/frontend/components/markdown-renderer.test.ts (CREATED)
- tests/frontend/components/conversation-block.test.ts (MODIFIED)

## Code Review

**Reviewers:** Claude + Gemini (parallel adversarial review)
**Verdict:** approved (all HIGH/MEDIUM issues fixed)
**Date:** 2026-02-04

### Findings Fixed

1. **[MEDIUM][Both] Redundant HTML entity double-decode in data-code attribute** -- `getAttribute()` already decodes HTML entities; manual `.replace()` calls were unnecessary and could corrupt code containing literal `&quot;` or `&#39;`. Removed the redundant replacements.

2. **[MEDIUM][Both] DOM thrashing on copy state change** -- `_copiedBlockIndex` was decorated with `@state()`, causing Lit to re-render the entire markdown body via `unsafeHTML` every time a copy button was clicked. Changed to a plain property with imperative `_updateCopyButtons()` method to re-render only the copy buttons without full markdown re-render.

3. **[MEDIUM][Claude] Missing code block copy button test** -- Task 6.4 required testing copy button presence and clipboard copy. Added two tests: button renders with correct aria-label, and click copies code content via clipboard API.

### Findings Not Fixed (LOW)

4. **[LOW][Gemini] Class attribute in DOMPurify ALLOWED_ATTR** -- The `class` attribute is allowed to support hljs syntax highlighting classes, which also allows crafted markdown to reference internal component CSS classes. Impact is minimal due to Shadow DOM scoping.

5. **[LOW][Claude] Incomplete HTML entity escaping in code renderer data-code attribute** -- Only `"` and `'` are escaped when embedding code in `data-code`, not `<`, `>`, `&`. DOMPurify processes the full output so this is safe in practice.
