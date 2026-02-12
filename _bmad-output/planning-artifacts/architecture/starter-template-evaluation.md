# Starter Template Evaluation

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot. Original evaluated Lit+Tauri, then React+Electron. This version adds OpenCode SDK integration, which replaces the terminal embedding approach entirely.

## Primary Technology Domain

**Desktop Application** — Electron shell + Go backend sidecar + OpenCode server + React frontend

**Three-Process Model:**
1. **Electron main process** — Application shell, IPC hub, OpenCode SDK client
2. **Go sidecar** (port 3008) — Stream management, worktree operations, artifact watching, phase state, project registry
3. **OpenCode server** (`opencode serve --port <dynamic>`) — LLM execution, BMAD skill sessions, tool execution

## Selected Approach: Vite React-TS + Electron + OpenCode SDK

**Technology Stack:**

- **Frontend:** React + TypeScript via Vite (`react-ts` template)
- **Styling:** Tailwind CSS (utility-first)
- **State Management:** Zustand stores
- **Desktop Shell:** Electron (via electron-builder)
- **UI Components:** shadcn/ui primitives (`src/components/ui/`)
- **OpenCode Integration:** `@opencode-ai/sdk` — TypeScript SDK for OpenCode HTTP API + SSE event streaming

**Go Sidecar:** Bundled as external resource via `electron-builder.yml`. Electron main process spawns Go binary as child process on port 3008.

**OpenCode Server:** Spawned by Electron main process as child process (`opencode serve --port <random>`). SDK client in main process communicates via HTTP REST + SSE.

### Integration Architecture

```
Electron Main Process:
  ├── Spawn Go sidecar → localhost:3008 (REST + WebSocket)
  ├── Spawn `opencode serve --port <dynamic>` (child process)
  ├── Create SDK client → createOpencodeClient({ baseUrl })
  ├── Subscribe to SSE events → forward to renderer via IPC
  ├── Handle permission.asked / question.asked → prompt user in UI
  └── IPC bridge (contextBridge/preload) to React renderer

React Renderer:
  ├── Chat UI rendering structured message parts (text, tool calls, tool results)
  ├── Input → IPC → client.session.prompt()
  ├── Stream/phase graph → Go sidecar REST + WebSocket
  ├── Artifact viewer → Go sidecar REST
  └── Full design freedom — no terminal constraints

Go Sidecar (port 3008):
  ├── Stream CRUD + lifecycle state machine
  ├── Git worktree operations (os/exec calling git CLI)
  ├── Artifact store watching (fsnotify on ~/.bmad-studio/projects/)
  ├── Phase state derivation (artifact presence → phase completion)
  ├── Project registry management
  └── WebSocket events for real-time UI updates (artifact changes, phase state)
```

### Key Technology Decisions

**OpenCode SDK replaces terminal embedding:**

| Original Plan | SDK Path |
|---|---|
| xterm.js for terminal rendering | Not needed — custom React components |
| node-pty for PTY spawning | Not needed — `opencode serve` is a standard HTTP server |
| ANSI parsing, terminal sizing | Not needed — structured JSON data |
| "Thin wrapper" with limited interaction | Full programmatic control via REST + SSE |
| User sees OpenCode's TUI | User sees BMAD Studio's native UI powered by OpenCode |

**Dependencies added:**
- `@opencode-ai/sdk` — TypeScript SDK (Electron main process)
- `opencode` CLI — must be installed on user's machine (or bundled)

**Dependencies NOT needed:**
- xterm.js
- node-pty
- Any ANSI/terminal libraries

**Git operations:** `os/exec` calling `git` CLI from Go sidecar. Requires git installed on user's machine (reasonable assumption for developer tool).

**File watching:** Go's `fsnotify` in the sidecar — watches `~/.bmad-studio/projects/{project}/streams/` for artifact changes, broadcasts via WebSocket to frontend.

### OpenCode SDK Capabilities

The SDK provides structured access to OpenCode's full functionality:

**Session management:**
- `client.session.create()` — Create new session with title
- `client.session.prompt()` — Send prompt with model/provider selection
- `client.session.list()` — List existing sessions

**Real-time streaming via SSE:**
- `session.status` — idle/busy state
- `message.updated` / `message.part.updated` — Streaming message content
- `permission.asked` — Tool approval requests (render as native dialog)
- `question.asked` — Agent needs user input
- `todo.updated` — Task tracking updates

**Integration paths available:**
1. **HTTP Server + SDK** (primary) — Full interactive sessions with streaming
2. **`opencode run --format json`** (supplementary) — One-shot automated tasks, auto-approves permissions
3. **ACP via stdin/stdout** (not planned) — IDE plugin protocol, unnecessary for our use case

### PRD Alignment Note

The PRD (FR-O1, FR-O2) was written assuming terminal embedding ("launches OpenCode in an embedded terminal panel", "user interacts through OpenCode's own TUI"). The SDK discovery refines this: users interact through BMAD Studio's native React UI, which is powered by OpenCode's SDK under the hood. The intent is the same (delegate LLM execution to OpenCode), the mechanism is better (structured data instead of terminal emulation).

This also means "custom chat UI" — listed as out-of-scope for MVP in the PRD — is actually the natural integration path. It's not the complex from-scratch chat harness the PRD was deferring; it's rendering structured events from OpenCode's SDK, which is significantly simpler.
