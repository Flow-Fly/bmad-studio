# Implementation Patterns & Consistency Rules

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot. Previous patterns covered chat streaming, provider abstraction, tool execution. This version covers stream management, OpenCode SDK integration, IPC communication, and central artifact store patterns.

## Naming Conventions

| Area | Convention | Example |
|------|------------|---------|
| **Go files** | `snake_case.go` | `stream_service.go`, `worktree_service.go` |
| **Go exports** | `PascalCase` | `type Stream struct`, `func CreateStream()` |
| **Go JSON tags** | `camelCase` | `json:"projectId"`, `json:"streamId"` |
| **React components** | `PascalCase.tsx` file + component | `PhaseGraph.tsx`, `StreamList.tsx` |
| **TS service files** | `{name}.service.ts` | `stream.service.ts`, `opencode.service.ts` |
| **TS store files** | `{name}.store.ts` | `stream.store.ts`, `project.store.ts` |
| **TS hook files** | `use{Name}.ts` | `useStream.ts`, `usePhaseState.ts` |
| **TS variables** | `camelCase` | `streamId`, `phaseState`, `artifactList` |
| **TS types/interfaces** | `PascalCase` | `Stream`, `PhaseState`, `ArtifactMetadata` |
| **Styling** | Tailwind utility classes | `className="flex items-center gap-2"` |
| **UI primitives** | `lowercase.tsx` in `components/ui/` | `button.tsx`, `dialog.tsx` |
| **IPC channels** | `kebab-case` with namespace prefix | `opencode:session-created`, `opencode:message-updated` |
| **WebSocket events** | `namespace:kebab-case` | `stream:phase-changed`, `artifact:created` |
| **REST endpoints** | Plural nouns, lowercase | `/projects/:id/streams` |
| **JSON fields (everywhere)** | `camelCase` | `projectId`, `streamId`, `createdAt` |

**Enforcement rule:** `camelCase` for ALL JSON — Go struct tags, REST responses, WebSocket payloads, IPC messages. No exceptions. This resolves the historical `snake_case` inconsistency in the codebase.

## API Conventions

**Endpoints:** Plural nouns, lowercase (`/projects`, `/streams`, `/artifacts`)
**Route params:** `:id` format (`/projects/:id/streams/:sid`)
**JSON fields:** `camelCase` (all layers)
**Dates:** ISO 8601 (`"2026-02-12T10:30:00Z"`)
**Errors:** `{ "error": { "code": "not_found", "message": "Stream not found" } }`
**Success:** Direct payload, no wrapper
**Null fields:** Omit from JSON (`omitempty` in Go) rather than sending `null`

## WebSocket Events

| Event | Payload | Direction |
|-------|---------|-----------|
| `artifact:created` | `{ projectId, streamId, filename, phase }` | Server → Client |
| `artifact:updated` | `{ projectId, streamId, filename, phase }` | Server → Client |
| `artifact:deleted` | `{ projectId, streamId, filename }` | Server → Client |
| `stream:phase-changed` | `{ projectId, streamId, phase, artifacts }` | Server → Client |
| `stream:created` | `{ projectId, streamId, name }` | Server → Client |
| `stream:archived` | `{ projectId, streamId, outcome }` | Server → Client |
| `stream:updated` | `{ projectId, streamId, changes }` | Server → Client |
| `connection:status` | `{ status }` | Server → Client |

**Rules:**
- All payload fields are `camelCase`
- Event names use `namespace:kebab-case`
- Every event that references a stream includes both `projectId` and `streamId`

## IPC Communication Patterns (Electron Main ↔ Renderer)

### Channel Naming

IPC channels use `namespace:action` format:

```
# OpenCode SDK operations (renderer → main)
opencode:create-session       → { title, workingDir }
opencode:send-prompt          → { sessionId, model, parts }
opencode:approve-permission   → { permissionId, approved }
opencode:answer-question      → { questionId, answer }

# OpenCode events (main → renderer)
opencode:session-created      → { sessionId, title }
opencode:session-status       → { sessionId, status }
opencode:message-updated      → { sessionId, messageId, parts }
opencode:part-updated         → { sessionId, messageId, partId, content }
opencode:permission-asked     → { permissionId, tool, params }
opencode:question-asked       → { questionId, question }
opencode:error                → { code, message }

# OpenCode lifecycle (main → renderer)
opencode:server-ready         → { port }
opencode:server-error         → { code, message }
opencode:server-restarting    → {}
```

### IPC Bridge Pattern

Electron preload exposes a typed API via `contextBridge`:

```typescript
// preload.ts
contextBridge.exposeInMainWorld('opencode', {
  createSession: (opts: CreateSessionOpts) => ipcRenderer.invoke('opencode:create-session', opts),
  sendPrompt: (opts: SendPromptOpts) => ipcRenderer.invoke('opencode:send-prompt', opts),
  approvePermission: (id: string, approved: boolean) => ipcRenderer.invoke('opencode:approve-permission', { permissionId: id, approved }),
  answerQuestion: (id: string, answer: string) => ipcRenderer.invoke('opencode:answer-question', { questionId: id, answer }),
  onEvent: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data))
    return () => ipcRenderer.removeListener(channel, callback)
  }
})
```

**Rules:**
- Request/response operations use `ipcRenderer.invoke()` (returns Promise)
- Event streams use `ipcRenderer.on()` with cleanup function
- All IPC payloads are plain objects (no classes, no functions)
- Type definitions shared between main and renderer via `src/types/ipc.ts`

## State Management (Zustand + React Hooks)

### Store Organization

| Store | File | Purpose |
|-------|------|---------|
| `useProjectStore` | `project.store.ts` | Project registry, active project selection |
| `useStreamStore` | `stream.store.ts` | Stream CRUD, active stream, phase state |
| `useOpenCodeStore` | `opencode.store.ts` | Active session, messages, connection status |
| `useConnectionStore` | `connection.store.ts` | Go sidecar WebSocket status |
| `useSettingsStore` | `settings.store.ts` | Global configuration |

**Removed stores:** `chat.store.ts`, `insight.store.ts`, `agent.store.ts`, `provider.store.ts`, `workflow.store.ts`, `phases.store.ts`

### Store Pattern

```typescript
// Example: stream.store.ts
interface StreamState {
  streams: Stream[]
  activeStreamId: string | null
  loading: boolean
  error: string | null

  // Actions
  fetchStreams: (projectId: string) => Promise<void>
  createStream: (projectId: string, opts: CreateStreamOpts) => Promise<Stream>
  archiveStream: (projectId: string, streamId: string) => Promise<void>
  setActiveStream: (streamId: string | null) => void
}

export const useStreamStore = create<StreamState>((set, get) => ({
  // ... implementation
}))
```

**Rules:**
- One store per domain (not per component)
- Actions are async methods on the store (not separate action creators)
- Loading/error state per store (not global)
- Components subscribe via `useStore()` hook with selectors: `useStreamStore(s => s.streams)`

## Service Layer Separation

Frontend services are split by backend:

### Go Sidecar Services (REST + WebSocket)

| Service | File | Responsibility |
|---------|------|----------------|
| `ProjectService` | `project.service.ts` | Project CRUD via REST `/projects` |
| `StreamService` | `stream.service.ts` | Stream CRUD via REST `/projects/:id/streams` |
| `WorktreeService` | `worktree.service.ts` | Worktree operations via REST |
| `ArtifactService` | `artifact.service.ts` | Artifact listing/reading via REST |
| `WebSocketService` | `websocket.service.ts` | WebSocket connection, event subscription |
| `SettingsService` | `settings.service.ts` | Settings via REST `/settings` |

### OpenCode Services (IPC)

| Service | File | Responsibility |
|---------|------|----------------|
| `OpenCodeService` | `opencode.service.ts` | Session management, prompt sending via IPC bridge |

**Rules:**
- Go sidecar services use `fetch()` for REST calls
- OpenCode service uses `window.opencode.*` (IPC bridge)
- Services never import from each other — stores coordinate cross-service operations
- Services are stateless — all state lives in Zustand stores

## Phase Derivation Pattern

Phase state is derived in the Go sidecar and communicated to the frontend via WebSocket.

### Artifact → Phase Mapping (Go backend)

```go
// Phase derivation rules — single source of truth
var phaseArtifacts = map[Phase][]ArtifactPattern{
    PhaseAnalysis:       {glob("brainstorm*"), glob("research*")},
    PhasePlanning:       {glob("prd.md"), glob("prd/index.md")},
    PhaseSolutioning:    {glob("architecture*"), glob("ux-design*")},
    PhaseImplementation: {glob("epics/*")},
}

// Phase is complete when at least one matching artifact exists
func DerivePhase(storePath string) Phase {
    // Walk phases in order, return highest complete phase
}
```

**Rules:**
- Phase mapping lives in Go backend ONLY — frontend renders what backend reports
- Glob patterns for flexibility (artifact names may vary)
- Both flat files and sharded folders checked
- Phase derivation runs on fsnotify events AND on stream load

## Central Store File Operations

### Atomic JSON Writes

All JSON metadata files (`stream.json`, `project.json`, `registry.json`) use write-to-temp-then-rename:

```go
func WriteJSON(path string, data any) error {
    tmp := path + ".tmp"
    // Write to tmp file
    // fsync
    // Rename tmp → path (atomic on POSIX)
}
```

**Rules:**
- Never write directly to the target file
- Always fsync before rename
- Crash at any point leaves either old or new file — never corrupt
- JSON is pretty-printed (human-readable, Git-friendly)

### File Watcher Pattern

```go
// Watcher watches a project's stream directories for artifact changes
type Watcher struct {
    fsWatcher *fsnotify.Watcher
    hub       *Hub  // WebSocket broadcast
}

// On file event:
// 1. Determine which stream the file belongs to (from path)
// 2. Re-derive phase state for that stream
// 3. If phase changed → broadcast stream:phase-changed
// 4. Broadcast artifact:created/updated/deleted
```

**Rules:**
- One watcher per registered project (watches all stream dirs under that project's store prefix)
- Debounce events (100ms) to handle rapid file writes
- Ignore `.tmp` files (atomic write pattern)
- Re-derive phase on every artifact event (cheap operation)

## Error Handling

| Layer | Pattern |
|-------|---------|
| **Go services** | Return `(result, error)` — never panic |
| **Go handlers** | Map errors to HTTP status codes + error JSON |
| **Frontend services** | Throw errors (caught by stores or components) |
| **Zustand stores** | Set `error` state, components render error UI |
| **IPC (OpenCode)** | `invoke()` rejects on error, caught in service layer |
| **Electron main** | Log to file, surface critical errors via IPC to renderer |

### Error Categories

| Category | Go HTTP Status | Frontend Handling |
|----------|---------------|-------------------|
| Not found | 404 | Show "not found" message |
| Validation error | 400 | Show field-level errors |
| Git operation failed | 500 + specific code | Show error with git output |
| OpenCode not installed | N/A (IPC) | Disable workflow buttons |
| OpenCode server crash | N/A (IPC) | Show "reconnecting" banner |
| Filesystem error | 500 | Show error with path context |

## Enforcement Guidelines

**All AI agents implementing BMAD Studio MUST:**
- Use `camelCase` for ALL JSON fields — Go struct tags, REST, WebSocket, IPC. No `snake_case`.
- Use the service layer separation — Go sidecar via REST, OpenCode via IPC. Never cross.
- Derive phase state in Go backend only — frontend renders what backend reports.
- Use atomic JSON writes for all metadata files — write-temp-then-rename.
- Follow the store pattern — one store per domain, actions on the store, selectors in components.
- Follow the IPC channel naming — `namespace:kebab-case`.
- Keep Electron preload as the single IPC bridge — no `nodeIntegration`, no direct `ipcRenderer` in components.
