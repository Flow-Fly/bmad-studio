# Epic 7: OpenCode Session Orchestration

**Goal:** Users launch AI workflow sessions from the phase graph with one click — the right agent, right BMAD skill, right working directory, and right context from prior phases are configured automatically.

**FRs covered:** FR-O1, FR-WN4
**NFRs addressed:** NFR1 (1s to first output), NFR9 (configurable timeouts)
**Carry-forward:** ENTIRELY NEW (replaces old Epic 5 workflow execution concept)

## Story 7.1: IPC Bridge & Preload Setup

As a developer,
I want a typed IPC bridge between the React renderer and Electron main process,
So that the frontend can communicate with OpenCode securely without direct access.

**Acceptance Criteria:**

**Given** the Electron preload script
**When** `contextBridge.exposeInMainWorld` is called
**Then** it exposes a `window.opencode` API with typed methods: `createSession(opts)`, `sendPrompt(opts)`, `approvePermission(id, approved)`, `answerQuestion(id, answer)`, and `onEvent(channel, callback)` returning a cleanup function

**Given** the IPC channel naming convention (`namespace:kebab-case`)
**When** request/response operations are invoked
**Then** they use `ipcRenderer.invoke()` returning Promises (e.g., `opencode:create-session`, `opencode:send-prompt`)

**Given** event streams from main to renderer
**When** the main process forwards OpenCode events
**Then** they use `ipcRenderer.on()` with channels like `opencode:session-created`, `opencode:message-updated`, `opencode:part-updated`, `opencode:permission-asked`, `opencode:question-asked`, `opencode:error`

**Given** security requirements
**When** the preload is configured
**Then** `nodeIntegration` is disabled, `contextIsolation` is enabled, and the preload is the single IPC bridge — no direct `ipcRenderer` usage in React components

**Given** type definitions
**When** IPC payloads are defined
**Then** shared types in `src/types/ipc.ts` define all channel names, request shapes, and response shapes for both main and renderer

## Story 7.2: OpenCode SDK Client

As a developer,
I want the Electron main process to manage OpenCode SDK communication,
So that sessions can be created and prompted programmatically.

**Acceptance Criteria:**

**Given** the OpenCode server is running on a known port
**When** the SDK client initializes
**Then** it creates an `@opencode-ai/sdk` client instance with `{ baseUrl: "http://localhost:{port}" }`

**Given** a `opencode:create-session` IPC request with `{ "title", "workingDir" }`
**When** the main process handles it
**Then** it calls `client.session.create()` with the title
**And** returns `{ "sessionId", "title" }` to the renderer

**Given** a `opencode:send-prompt` IPC request with `{ "sessionId", "model", "parts" }`
**When** the main process handles it
**Then** it calls `client.session.prompt()` with the provided parameters
**And** subscribes to SSE events for that session

**Given** the OpenCode server is not running
**When** any SDK operation is attempted
**Then** the IPC handler returns an error `{ "code": "server_unavailable", "message": "OpenCode server is not running" }`

## Story 7.3: SSE Event Subscription & Forwarding

As a developer,
I want OpenCode session events streamed to the React UI in real-time,
So that I can see the AI conversation as it happens.

**Acceptance Criteria:**

**Given** an active OpenCode session with SSE subscription
**When** a `message.updated` event arrives from the SDK
**Then** the main process forwards it to the renderer via `opencode:message-updated` IPC with `{ "sessionId", "messageId", "parts" }`

**Given** a `message.part.updated` event arrives
**When** the part content changes (streaming text)
**Then** the main process forwards via `opencode:part-updated` with `{ "sessionId", "messageId", "partId", "content" }`

**Given** a `session.status` event changes to `idle`
**When** the session completes
**Then** the main process forwards `opencode:session-status` with `{ "sessionId", "status": "idle" }`
**And** the artifact watcher (Epic 3) detects any new artifacts in the stream's central store

**Given** a `permission.asked` event arrives
**When** the SDK needs user approval for a tool
**Then** the main process forwards `opencode:permission-asked` with `{ "permissionId", "tool", "params" }` (handled by Epic 9)

**Given** a `question.asked` event arrives
**When** the agent needs user input
**Then** the main process forwards `opencode:question-asked` with `{ "questionId", "question" }` (handled by Epic 9)

## Story 7.4: Workflow Launch from Phase Graph

As a developer,
I want to click a workflow node on the phase graph and have the right OpenCode session launch automatically,
So that I go from orientation to productive work in one click.

**Acceptance Criteria:**

**Given** a workflow node on the phase graph (e.g., "create-prd" in the Planning phase)
**When** the user clicks the node
**Then** the system creates an OpenCode session with title `"{stream-name} — {workflow-name}"`
**And** sends a prompt containing the BMAD skill command (e.g., `/bmad:bmm:workflows:prd`) plus context references to prior phase artifacts in the central store
**And** sets the working directory to the stream's worktree path (or project root if no worktree)

**Given** the prompt sent to OpenCode
**When** it includes context from prior phases
**Then** the prompt references the central store path: `~/.bmad-studio/projects/{project}-{stream}/`
**And** lists specific prior artifacts that are available (e.g., "Prior artifacts: brainstorm.md, research.md")

**Given** a session is launched
**When** the UI transitions
**Then** the view switches to conversation-dominant layout with the BreadcrumbStrip showing the current phase and workflow
**And** the `opencode.store.ts` tracks the active session ID linked to the active stream

**Given** OpenCode is not available (not installed or server down)
**When** the user clicks a workflow node
**Then** the click is disabled with a tooltip explaining why, and no session is created

---
