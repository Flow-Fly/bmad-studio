# Epic 8: Session Chat UI

**Goal:** Users interact with AI sessions through a native, polished interface — streaming messages, tool call visualization, and markdown rendering within BMAD Studio's design language.

**FRs covered:** FR-O2
**NFRs addressed:** NFR1 (1s to first output), NFR2 (100ms UI interactions)
**Carry-forward:** Rework — old Epic 3 chat patterns partially applicable, but fundamentally different (SDK structured events vs custom WebSocket streaming)

## Story 8.1: OpenCode Store & Event Hook

As a developer,
I want session state and streaming messages managed centrally,
So that all chat UI components render consistently from a single source of truth.

**Acceptance Criteria:**

**Given** the `opencode.store.ts` Zustand store
**When** it initializes
**Then** it manages: `activeSessionId`, `sessionStatus` (idle/busy), `messages` array (each with `messageId`, `role`, `parts`), `loading`, and `error`

**Given** a `useOpenCodeEvents` custom hook
**When** a component mounts with this hook
**Then** it subscribes to IPC events (`opencode:message-updated`, `opencode:part-updated`, `opencode:session-status`, `opencode:error`) via `window.opencode.onEvent()`
**And** dispatches updates to the opencode store
**And** returns a cleanup function that unsubscribes on unmount

**Given** a `opencode:message-updated` event arrives
**When** the store processes it
**Then** it upserts the message in the `messages` array by `messageId`, replacing parts with the latest state

**Given** a `opencode:part-updated` event with streaming text
**When** the store processes it
**Then** it updates the specific part within the specific message, enabling incremental rendering without full message replacement

**Given** a `opencode:session-status` event with `"idle"`
**When** the session ends
**Then** the store sets `sessionStatus` to idle and the UI can transition back to the phase graph

## Story 8.2: Chat Panel & Message Rendering

As a developer,
I want to see the AI conversation rendered with proper formatting — text, code blocks, tool calls, and tool results,
So that I can follow the agent's work clearly.

**Acceptance Criteria:**

**Given** the `ChatPanel` component
**When** an active session has messages
**Then** it renders a scrollable list of `MessageBlock` components, with user messages visually distinct from assistant messages (different background/alignment)

**Given** a `MessageBlock` with text parts
**When** the message renders
**Then** text content is passed through `MarkdownRenderer` supporting headings, lists, code blocks (syntax-highlighted), bold, italic, links, and tables

**Given** a `MessageBlock` with a tool call part
**When** the message renders
**Then** it shows the tool name and parameters in a collapsible section with a distinct visual treatment (bordered container, monospace for parameters)

**Given** a `MessageBlock` with a tool result part
**When** the message renders
**Then** it shows the result content below the corresponding tool call, visually linked, with success/error styling

**Given** a message is still streaming (session status is busy)
**When** the latest assistant message renders
**Then** text appears incrementally as `part-updated` events arrive
**And** a typing/streaming indicator is visible

**Given** the conversation panel header
**When** an active session is running
**Then** it displays the agent badge, workflow name, and phase label from the active stream context

## Story 8.3: Chat Input & Session Interaction

As a developer,
I want to send messages to the agent during an active session,
So that I can collaborate with the BMAD agent interactively.

**Acceptance Criteria:**

**Given** the `ChatInput` component during an active session
**When** the user types a message and presses Enter
**Then** the system sends the prompt via `window.opencode.sendPrompt()` with the active session ID
**And** the input field clears and disables until the session returns to idle

**Given** the session status is `busy` (agent is responding)
**When** the input field renders
**Then** it shows a disabled state with a subtle pulse indicator
**And** the user cannot send another prompt until the current response completes

**Given** the session status is `idle`
**When** the agent finishes responding
**Then** the input field re-enables and auto-focuses for the next prompt

**Given** keyboard shortcuts
**When** the user presses `Escape` during an active session
**Then** focus returns to the phase graph (BreadcrumbStrip expansion)

## Story 8.4: Conversation Layout & Auto-scroll

As a developer,
I want the conversation view to scroll smoothly and use screen space effectively,
So that I can focus on the AI interaction during 5-45 minute work sessions.

**Acceptance Criteria:**

**Given** an active session
**When** the conversation-dominant layout renders
**Then** the ChatPanel fills the main content area, with the BreadcrumbStrip (36px) at the top maintaining phase orientation
**And** the stream list collapses or narrows to maximize conversation space

**Given** new messages arrive or existing messages stream content
**When** the user is scrolled to the bottom
**Then** the view auto-scrolls to keep the latest content visible

**Given** the user has scrolled up to review earlier messages
**When** new content arrives
**Then** auto-scroll is paused (user is reviewing)
**And** a "scroll to bottom" affordance appears to resume auto-scroll

**Given** markdown content in messages
**When** code blocks render
**Then** they use `markdown.css` styling with syntax highlighting, horizontal scroll for wide content, and monospace font

---
