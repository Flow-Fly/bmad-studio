# Project Structure & Boundaries

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot. Previous structure centered on chat components, insight management, and LLM provider abstraction. This version reflects the developer cockpit model with stream management, OpenCode SDK integration, and central artifact store.

## Complete Project Directory Structure

```
bmad-studio/
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── electron-builder.yml              # Electron packaging config (bundles Go sidecar)
├── .env.example
├── .gitignore
│
├── electron/                          # Electron Shell
│   ├── main.ts                        # Main process — spawns Go sidecar + OpenCode server + BrowserWindow
│   ├── preload.ts                     # Context bridge — IPC for OpenCode SDK + Go sidecar bridge
│   ├── opencode-client.ts             # OpenCode SDK client — session management, SSE subscription
│   ├── process-manager.ts             # Child process lifecycle — Go sidecar + OpenCode server
│   └── tsconfig.json
│
├── src/                               # React Frontend
│   ├── main.tsx                       # App entry point (React root)
│   ├── App.tsx                        # Root component (layout + routing)
│   │
│   ├── components/
│   │   ├── dashboard/                          # Multi-project, multi-stream home view
│   │   │   ├── Dashboard.tsx                   # Main dashboard — projects + streams overview
│   │   │   └── ProjectOverview.tsx             # Single project card with stream summary
│   │   │
│   │   ├── streams/                            # Stream management
│   │   │   ├── StreamList.tsx                  # Stream list for active project
│   │   │   ├── StreamCard.tsx                  # Individual stream summary (phase, status)
│   │   │   ├── StreamCreate.tsx                # Create stream dialog (name, worktree toggle)
│   │   │   └── StreamDetail.tsx                # Stream detail view (phase graph + artifacts + chat)
│   │   │
│   │   ├── phase-graph/                        # Per-stream phase visualization
│   │   │   ├── PhaseGraph.tsx                  # Phase graph container (per-stream)
│   │   │   └── PhaseNode.tsx                   # Individual phase node (clickable → launch workflow)
│   │   │
│   │   ├── opencode/                           # OpenCode session UI (SDK-driven chat)
│   │   │   ├── ChatPanel.tsx                   # Chat view — messages, input, streaming
│   │   │   ├── MessageBlock.tsx                # Single message (text parts, tool calls, results)
│   │   │   ├── ChatInput.tsx                   # Prompt input field
│   │   │   ├── PermissionDialog.tsx            # Tool approval dialog (from permission.asked)
│   │   │   └── QuestionDialog.tsx              # Agent question dialog (from question.asked)
│   │   │
│   │   ├── artifacts/                          # Artifact browsing (read-only)
│   │   │   ├── ArtifactList.tsx                # List artifacts for a stream
│   │   │   └── ArtifactViewer.tsx              # Read-only artifact content (markdown rendered)
│   │   │
│   │   ├── layout/                             # App shell layout
│   │   │   ├── AppShell.tsx                    # Main layout — sidebar + content area
│   │   │   └── ActivityBar.tsx                 # Mode switching sidebar (dashboard, stream, settings)
│   │   │
│   │   ├── settings/                           # Settings UI
│   │   │   └── SettingsPanel.tsx               # Global settings, OpenCode config status
│   │   │
│   │   ├── shared/
│   │   │   └── MarkdownRenderer.tsx            # Markdown rendering (artifact viewer + chat)
│   │   │
│   │   └── ui/                                 # Reusable UI primitives (shadcn/ui)
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── popover.tsx
│   │       ├── select.tsx
│   │       ├── tabs.tsx
│   │       ├── tooltip.tsx
│   │       └── ...                             # Additional primitives as needed
│   │
│   ├── hooks/                           # Custom React hooks
│   │   ├── useAutoScroll.ts             # Auto-scroll for chat panel
│   │   ├── useOpenCodeEvents.ts         # Subscribe to IPC OpenCode events
│   │   └── useKeyboardShortcuts.ts      # Global keyboard shortcuts
│   │
│   ├── lib/                             # Utilities
│   │   └── utils.ts                     # cn() helper, shared utils
│   │
│   ├── services/                        # Backend communication
│   │   ├── project.service.ts           # Project CRUD (REST → Go sidecar)
│   │   ├── stream.service.ts            # Stream CRUD (REST → Go sidecar)
│   │   ├── worktree.service.ts          # Worktree operations (REST → Go sidecar)
│   │   ├── artifact.service.ts          # Artifact listing/reading (REST → Go sidecar)
│   │   ├── opencode.service.ts          # OpenCode session management (IPC → Electron main)
│   │   ├── websocket.service.ts         # WebSocket connection + event subscription (Go sidecar)
│   │   └── settings.service.ts          # Settings CRUD (REST → Go sidecar)
│   │
│   ├── stores/                          # Zustand global state
│   │   ├── project.store.ts             # Project registry, active project
│   │   ├── stream.store.ts              # Streams, active stream, phase state
│   │   ├── opencode.store.ts            # OpenCode session, messages, connection status
│   │   ├── connection.store.ts          # Go sidecar WebSocket status
│   │   └── settings.store.ts            # Global configuration
│   │
│   ├── styles/
│   │   ├── globals.css                  # Global styles + Tailwind directives
│   │   └── markdown.css                 # Markdown rendering styles
│   │
│   └── types/
│       ├── stream.ts                    # Stream, PhaseState, StreamStatus types
│       ├── project.ts                   # Project, ProjectRegistry types
│       ├── artifact.ts                  # ArtifactMetadata, ArtifactList types
│       ├── opencode.ts                  # OpenCode session, message, part types
│       ├── ipc.ts                       # IPC channel types (shared with electron/)
│       └── phases.ts                    # Phase enum, phase-artifact mapping (display only)
│
├── backend/                             # Go Backend Sidecar
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                          # Entry point — starts HTTP server, watcher, WebSocket hub
│   │
│   ├── api/
│   │   ├── router.go                    # Route definitions
│   │   ├── handlers/
│   │   │   ├── projects.go              # Project CRUD endpoints
│   │   │   ├── streams.go               # Stream CRUD + archive endpoints
│   │   │   ├── worktrees.go             # Worktree create/delete/switch endpoints
│   │   │   ├── artifacts.go             # Artifact listing + content reading endpoints
│   │   │   └── settings.go              # Global settings endpoints
│   │   └── middleware/
│   │       └── cors.go                  # CORS middleware
│   │
│   ├── services/
│   │   ├── stream_service.go            # Stream lifecycle — create, list, archive, phase derivation
│   │   ├── worktree_service.go          # Git worktree operations — create, switch, cleanup
│   │   ├── watcher_service.go           # fsnotify watcher — artifact detection, phase re-derivation
│   │   ├── project_service.go           # Project registration, discovery, listing
│   │   └── websocket_hub.go             # WebSocket hub — broadcast events to connected clients
│   │
│   ├── storage/
│   │   ├── registry.go                  # Project registry (registry.json read/write)
│   │   ├── stream_store.go              # Stream metadata (stream.json read/write)
│   │   ├── config_store.go              # Global config (config.json read/write)
│   │   └── json_writer.go              # Atomic JSON write helper (write-temp-rename)
│   │
│   └── types/
│       ├── project.go                   # Project, ProjectRegistry types
│       ├── stream.go                    # Stream, StreamStatus, Phase types
│       ├── artifact.go                  # ArtifactMetadata, phase-artifact mapping
│       └── websocket.go                 # WebSocket event types, payloads, constructors
│
└── tests/
    └── backend/
        ├── services/
        │   ├── stream_service_test.go
        │   ├── worktree_service_test.go
        │   ├── watcher_service_test.go
        │   └── project_service_test.go
        └── storage/
            ├── registry_test.go
            ├── stream_store_test.go
            └── json_writer_test.go
```

## What's Removed (from previous architecture)

| Component | Reason |
|-----------|--------|
| `src/components/chat/` (ChatPanel, ChatInput, ConversationBlock, etc.) | Replaced by `src/components/opencode/` using SDK events |
| `src/components/insights/` (InsightPanel, InsightCard, AttachContextPicker) | Deferred to post-MVP |
| `src/components/navigation/AgentBadge.tsx` | No agent selection — OpenCode handles model choice |
| `src/components/workflow/WorkflowStatusDisplay.tsx` | Replaced by per-stream phase graph |
| `src/stores/chat.store.ts` | Replaced by `opencode.store.ts` |
| `src/stores/insight.store.ts`, `agent.store.ts`, `provider.store.ts` | Removed — not needed |
| `src/stores/workflow.store.ts`, `phases.store.ts` | Consolidated into `stream.store.ts` |
| `src/services/chat.service.ts`, `insight.service.ts`, `agent.service.ts` | Replaced by new services |
| `src/services/provider.service.ts`, `keychain.service.ts` | Removed — OpenCode handles providers |
| `src/services/dialog.service.ts`, `file.service.ts` | Removed — functionality handled differently |
| `src/types/conversation.ts`, `tool.ts`, `provider.ts` | Replaced by new types |
| `backend/services/chat_service.go`, `conversation_service.go`, `insight_service.go` | Removed |
| `backend/providers/` (claude.go, openai.go, ollama.go, provider.go) | Removed — OpenCode handles LLM |
| `backend/api/handlers/chat.go`, `conversations.go`, `insights.go`, `providers.go` | Replaced |
| `backend/storage/insight_store.go` | Removed |
| `backend/tools/` (entire tool execution layer) | Removed — OpenCode handles tools |
| `backend/types/conversation.go`, `insight.go`, `message.go` | Replaced |

## Architectural Boundaries

| Boundary | Description |
|----------|-------------|
| **React Renderer ↔ Go Sidecar** | REST + WebSocket on `localhost:3008`. All stream, project, artifact, worktree operations. |
| **React Renderer ↔ Electron Main** | IPC via `contextBridge`/preload. All OpenCode operations (sessions, prompts, events). |
| **Electron Main ↔ Go Sidecar** | Child process management (spawn, health check, restart). No direct API calls from main to sidecar. |
| **Electron Main ↔ OpenCode Server** | SDK client via HTTP + SSE on dynamic port. Session management, prompt sending, event streaming. |
| **Go Services ↔ Storage** | Services call storage layer for JSON read/write. Storage handles atomic writes. |
| **Go Watcher ↔ Hub** | Watcher detects file changes, derives phase state, broadcasts via WebSocket hub. |
| **Stores ↔ Services** | Zustand stores call service methods. Components subscribe to stores via selectors. Services are stateless. |

## FR to Structure Mapping

| PRD Category | Frontend Location | Backend Location |
|--------------|-------------------|------------------|
| **Stream Management (FR-S1–S5)** | `components/streams/`, `stores/stream.store.ts`, `services/stream.service.ts` | `handlers/streams.go`, `services/stream_service.go`, `storage/stream_store.go` |
| **Worktree Management (FR-W1–W3)** | `services/worktree.service.ts` (store actions in `stream.store.ts`) | `handlers/worktrees.go`, `services/worktree_service.go` |
| **Project Management (FR-PM1–PM4)** | `components/dashboard/`, `stores/project.store.ts`, `services/project.service.ts` | `handlers/projects.go`, `services/project_service.go`, `storage/registry.go` |
| **Workflow Navigation (FR-WN1–WN4)** | `components/phase-graph/`, `stores/stream.store.ts` (phase state) | `services/stream_service.go` (phase derivation), `services/watcher_service.go` |
| **OpenCode Integration (FR-O1–O4)** | `components/opencode/`, `stores/opencode.store.ts`, `services/opencode.service.ts` | N/A (Electron main: `opencode-client.ts`, `process-manager.ts`) |
| **Provider Configuration (FR-PC1–PC4)** | `components/settings/SettingsPanel.tsx` | Delegated to OpenCode config detection |
| **Artifact Management (FR-AM1–AM5)** | `components/artifacts/`, `services/artifact.service.ts` | `handlers/artifacts.go`, `services/watcher_service.go` |
| **Connectivity & Offline (FR-CO1–CO3)** | `stores/connection.store.ts`, offline detection in `App.tsx` | WebSocket hub status |
| **Cost Tracking (FR-CT1–CT2)** | Deferred — future addition to `opencode.store.ts` | N/A (data from OpenCode SDK) |
