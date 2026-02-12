---
project_name: "bmad-studio"
user_name: "Flow"
date: "2026-02-12"
sections_completed:
  [
    "technology_stack",
    "language_rules",
    "framework_rules",
    "testing_rules",
    "code_quality",
    "workflow_rules",
    "critical_rules",
  ]
status: "complete"
rule_count: 94
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

> **Update Note (2026-02-12):** Full rewrite for orchestrator pivot. Previous version referenced Lit, Tauri, Shoelace, conversations, insights, tool execution layer — all replaced.

---

## Technology Stack & Versions

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | React + Vite | 19.2.4 / 5.1.0 | JSX, strict mode |
| **State** | Zustand | 5.0.11 | One store per domain |
| **UI** | Radix UI + shadcn/ui | Various | `cn()` helper for Tailwind merge |
| **Styling** | Tailwind CSS v4 | 4.1.18 | `@tailwindcss/vite` plugin |
| **Desktop** | Electron | 35.1.2 | Three-process model |
| **Backend** | Go + chi | 1.25.6 / v5.2.4 | REST + WebSocket sidecar on port 3008 |
| **WebSocket** | gorilla/websocket | 1.5.3 | Hub-based broadcast |
| **File Watch** | fsnotify | 1.7.0 | Central store watcher |
| **Markdown** | marked + highlight.js + DOMPurify | 17.0.1 / 11.11.1 / 3.3.1 | Sanitized rendering |
| **Icons** | Lucide React | 0.563.0 | Single icon set |
| **Build** | electron-builder | 26.0.12 | Go binary in `extraResources` |
| **AI Integration** | OpenCode SDK | Via HTTP + SSE | IPC-mediated through Electron main |

---

## Language-Specific Rules

### TypeScript (Frontend)

- **Strict mode:** `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `useUnknownInCatchVariables`
- **Component files:** `PascalCase.tsx` — `StreamCard.tsx`, `PhaseGraph.tsx`
- **Service files:** `{name}.service.ts` — `stream.service.ts`
- **Store files:** `{name}.store.ts` — `stream.store.ts`
- **Hook files:** `use{Name}.ts` — `useAutoScroll.ts`
- **UI primitives:** `lowercase.tsx` — `button.tsx`, `dialog.tsx` (shadcn convention)
- **Variables:** `camelCase` — `streamId`, `phaseState`
- **Types/interfaces:** `PascalCase` — `Stream`, `PhaseState`, `ArtifactMetadata`
- **Electron main process:** separate `tsconfig.json` targeting CommonJS + ES2020

### Go (Backend)

- **File naming:** `snake_case.go` — `stream_service.go`
- **Exports:** `PascalCase` — `type Stream struct`, `func CreateStream()`
- **JSON tags:** `camelCase` — `json:"projectId"` (matches frontend, no translation needed)
- **Error handling:** Always return `(result, error)` — never panic
- **Dates:** ISO 8601 format — `"2026-02-12T10:30:00Z"`

---

## Framework-Specific Rules

### React + Zustand

- **Store per domain:** `project.store.ts`, `stream.store.ts`, `opencode.store.ts`, `connection.store.ts`, `settings.store.ts`
- **Store pattern:** `interface State` + `create<State>((set, get) => ({...}))` with actions on the store
- **Selectors:** Components subscribe via `useStreamStore(s => s.streams)`
- **Stateless services:** All state lives in Zustand stores — services are pure functions
- **No direct fetching:** Components never fetch directly — always go through services

### Service Layer Separation

- **Go sidecar services:** Use `fetch()` for REST calls to `localhost:3008`
- **OpenCode service:** Uses `window.opencode.*` (IPC bridge via Electron preload)
- **No cross-imports:** Services never import from each other — stores coordinate cross-service operations

### Electron IPC

- **Preload bridge:** `contextBridge.exposeInMainWorld('opencode', {...})` — typed API
- **Request/response:** `ipcRenderer.invoke()` (returns Promise)
- **Event streams:** `ipcRenderer.on()` with cleanup function returned
- **Channel naming:** `namespace:kebab-case` — `opencode:session-created`, `opencode:message-updated`
- **Security:** No `nodeIntegration` — preload is the single IPC bridge

### Phase Derivation

- **Go backend ONLY** — frontend renders what backend reports
- **Derived from artifact presence** using glob patterns (not explicit state flags)
- **Triggers:** fsnotify events AND stream load
- **Both formats:** Flat files (`prd.md`) and sharded folders (`prd/index.md`)

### WebSocket Protocol

All payload fields use `camelCase`. Event names use `namespace:kebab-case`.

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

### REST API Conventions

- **Endpoints:** Plural nouns, lowercase — `/projects/:id/streams`
- **Route params:** `:id` format — `/projects/:id/streams/:sid`
- **Success:** Direct payload, no wrapper
- **Errors:** `{ "error": { "code": "...", "message": "..." } }`
- **Null fields:** Omit from JSON (`omitempty` in Go) rather than sending `null`

---

## Testing Rules

### Backend Tests (Go)

- **Location:** `tests/backend/services/`, `tests/backend/storage/`
- **Table-driven tests:** Use Go's idiomatic pattern
- **Temp directories:** Always resolve with `filepath.EvalSymlinks` on macOS — `t.TempDir()` returns `/var/folders/...` but macOS resolves to `/private/var/folders/...`, breaking path containment checks
- **Test file naming:** `{service}_test.go`

### Frontend Tests (TBD)

- Test framework not yet configured — establish during implementation
- Component testing for React components
- Service mocking for backend communication

### Test Boundaries

- **Unit tests:** Individual services, handlers, stores
- **Integration tests:** Service → Storage, API → Handler → Service chains
- **WebSocket tests:** Test streaming with mock connections

---

## Code Quality & Style Rules

### JSON Convention (CRITICAL)

**`camelCase` for ALL JSON fields everywhere** — Go struct tags, REST responses, WebSocket payloads, IPC messages. No `snake_case`. No exceptions. This resolves a historical inconsistency in the codebase.

### Naming Summary

| Area | Convention | Example |
|------|-----------|---------|
| REST endpoints | Plural nouns, lowercase | `/projects/:id/streams` |
| WebSocket events | `namespace:kebab-case` | `stream:phase-changed` |
| IPC channels | `namespace:kebab-case` | `opencode:create-session` |
| JSON fields | `camelCase` | `projectId`, `streamId` |
| Go files | `snake_case.go` | `stream_service.go` |
| React components | `PascalCase.tsx` | `StreamCard.tsx` |
| Stores | `{name}.store.ts` | `stream.store.ts` |
| Services | `{name}.service.ts` | `stream.service.ts` |
| Hooks | `use{Name}.ts` | `useAutoScroll.ts` |
| UI primitives | `lowercase.tsx` | `button.tsx` |

### Atomic JSON Writes

All JSON metadata files (`stream.json`, `project.json`, `registry.json`) use write-to-temp-then-rename:
1. Write to `path.tmp`
2. `fsync`
3. Rename `path.tmp` → `path` (atomic on POSIX)

Never write directly to the target file. Crash at any point leaves either old or new file — never corrupt.

### Project Structure

```
src/                               # React Frontend
├── components/
│   ├── dashboard/                 # Multi-project home view
│   ├── streams/                   # Stream management
│   ├── phase-graph/               # Per-stream phase visualization
│   ├── opencode/                  # OpenCode session UI (SDK-driven chat)
│   ├── artifacts/                 # Artifact browsing (read-only)
│   ├── layout/                    # App shell (sidebar + content)
│   ├── settings/                  # Settings UI
│   ├── shared/                    # MarkdownRenderer
│   └── ui/                        # shadcn/ui primitives
├── hooks/                         # useAutoScroll, useOpenCodeEvents, useKeyboardShortcuts
├── lib/                           # cn() helper, shared utils
├── services/                      # Backend communication (REST + IPC)
├── stores/                        # Zustand global state (5 stores)
├── styles/                        # globals.css, markdown.css
└── types/                         # stream, project, artifact, opencode, ipc, phases

electron/                          # Electron Shell
├── main.ts                        # Spawns Go sidecar + OpenCode server
├── preload.ts                     # IPC bridge (contextBridge)
├── opencode-client.ts             # OpenCode SDK client
└── process-manager.ts             # Child process lifecycle

backend/                           # Go Backend Sidecar
├── api/handlers/                  # projects, streams, worktrees, artifacts, settings
├── services/                      # stream, worktree, watcher, project, websocket_hub
├── storage/                       # registry, stream_store, config_store, json_writer
└── types/                         # project, stream, artifact, websocket
```

---

## Development Workflow Rules

### Git Strategy

- **main branch:** Always stable, deployable. PRs from dev only.
- **dev branch:** Integration. PRs from epic branches.
- **Epic branches:** `epic/X-epic-name` from dev
- **Story branches:** `story/X-Y-story-name` from epic
- **PR flow:** story → epic → dev → main
- **Atomic commits.** Never commit directly to `dev` or `main`.
- **Before merging epic to dev:** Run code-simplifier on the epic branch.

### Development Process

- **No build verification:** Don't run build commands to check if code works — user tests during implementation
- **Backend-first for new features:** Go handler → service → storage, then frontend
- **Feature work in branches or git worktrees**

### Code Preparation Convention

- **Future story prep:** Annotate with `// Prepared for Story {story_key}: {brief reason}`
- **Code review verifies** these markers against epics — invalid markers flagged as dead code

### Central Store Layout

- **Location:** `~/.bmad-studio/`
- **Registry:** `~/.bmad-studio/registry.json` — all known projects
- **Config:** `~/.bmad-studio/config.json` — global settings
- **Flat siblings:** `projects/my-app/` (trunk, has `project.json`), `projects/my-app-feature/` (stream, has `stream.json`)
- **Archive:** `projects/archive/` — completed/abandoned streams
- **Project markers:** `.bmad-studio` marker file in project roots for detection

### Build & Run

- **Frontend dev:** `vite` on port 3007 (proxies `/api` and `/ws` to 3008)
- **Backend dev:** `go run main.go` from `backend/` on port 3008
- **Electron dev:** `npm run electron:dev` (compiles electron TS, runs Vite + Electron concurrently)

---

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

- **DO NOT** mix icon sets — Lucide React only
- **DO NOT** fetch data directly in components — always through services
- **DO NOT** use Go panic — always return errors
- **DO NOT** wrap successful API responses — return payload directly
- **DO NOT** derive phase state in frontend — Go backend only
- **DO NOT** let renderer talk to OpenCode directly — IPC through Electron main only
- **DO NOT** use `snake_case` in JSON — `camelCase` everywhere, no exceptions
- **DO NOT** write JSON metadata files directly — use atomic write-temp-rename

### Architectural Boundaries

| Boundary | Protocol |
|----------|----------|
| React Renderer ↔ Go Sidecar | REST + WebSocket on `localhost:3008` |
| React Renderer ↔ Electron Main | IPC via `contextBridge`/preload |
| Electron Main ↔ OpenCode Server | SDK client via HTTP + SSE on dynamic port |
| Electron Main ↔ Go Sidecar | Child process management only (no API calls) |
| Go Services ↔ Storage | Atomic JSON writes only |
| Go Watcher ↔ Hub | fsnotify → phase derivation → WebSocket broadcast |
| Stores ↔ Services | Stores call services; components subscribe to stores |

### Security Rules

- **BYOK model:** API keys managed via OpenCode config — not by BMAD Studio
- **No `nodeIntegration`** in Electron — preload is the only bridge
- **IPC-mediated OpenCode** — renderer never holds SDK client
- **Local-first data** — all project data stays on user's machine

### Edge Cases

- **OpenCode not installed:** App works for stream/artifact management; workflow buttons disabled with message
- **OpenCode server crash:** Electron detects child process exit, restarts automatically
- **Port collision:** Random port per spawn, retry up to 3 times, clear error message
- **File watcher:** Debounce 100ms, ignore `.tmp` files (atomic write pattern)
- **macOS temp dir symlinks:** Resolve with `filepath.EvalSymlinks` in tests
- **Dirty worktree on archive:** Warn user, don't force delete
- **Git not installed:** Worktree features disabled with clear message

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Reference architecture at `_bmad-output/planning-artifacts/architecture/index.md` for full details

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules

---

_Last Updated: 2026-02-12_
