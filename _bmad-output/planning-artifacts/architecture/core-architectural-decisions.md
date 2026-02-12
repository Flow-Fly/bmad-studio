# Core Architectural Decisions

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot. Previous decisions covered conversation model, insight storage, chat WebSocket protocol, provider abstraction. This version reflects the developer cockpit model with streams, OpenCode SDK integration, and central artifact store.

## Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Stream Storage** | JSON metadata + flat markdown artifacts | Transparent, Git-friendly, no database |
| **Central Store Layout** | Flat siblings: `{project}-{stream}` | Mirrors git worktree convention, simple filesystem ops |
| **Phase State** | Derived from artifact presence | Single source of truth, no sync issues |
| **Project Registry** | `~/.bmad-studio/registry.json` + `.bmad-studio` marker | Central index + project-root discovery |
| **REST API** | Resource-oriented routes | `/projects/:id/streams/:sid/artifacts` |
| **WebSocket Protocol** | Stream/artifact events (no chat events) | Real-time UI updates for phase changes and artifact detection |
| **OpenCode Integration** | SDK via HTTP server + SSE | Full programmatic control, custom React UI |
| **OpenCode Communication** | IPC-mediated (main process holds SDK) | Security boundary — renderer never talks to OpenCode directly |
| **Git Operations** | `os/exec` calling git CLI | Simple, reliable, requires git installed |
| **File Watching** | Go fsnotify on central store | Detects artifacts, derives phase state, broadcasts events |

## Data Architecture

### Central Store Layout

```
~/.bmad-studio/
├── registry.json                              # All known projects
├── config.json                                # Global settings
└── projects/
    ├── my-app/                                # Main/trunk context for "my-app" project
    │   ├── project.json                       # Repo path, settings, stream index
    │   ├── brainstorm.md                      # Artifacts for trunk work
    │   ├── research.md
    │   └── prd/                               # Sharded artifact (folder + index)
    │       ├── index.md
    │       ├── executive-summary.md
    │       └── functional-requirements.md
    ├── my-app-payment-integration/            # Stream for "payment-integration"
    │   ├── stream.json                        # Status, type, created, phase, branch
    │   ├── brainstorm.md
    │   ├── prd.md
    │   └── architecture.md
    ├── my-app-auth-refactor/                  # Stream for "auth-refactor"
    │   ├── stream.json
    │   └── research.md
    └── archive/
        └── my-app-dashboard-widget/           # Archived stream
            ├── stream.json                    # outcome: merged | abandoned
            └── ...artifacts
```

**Key design rules:**
- Flat siblings under `projects/` — project name is prefix, stream name is suffix
- Main/trunk context directory has `project.json` (not `stream.json`)
- Stream directories have `stream.json` (not `project.json`)
- `archive/` holds completed/abandoned streams (moved on archive)
- No `main/` living docs directory — dropped from scope

### Stream Metadata (`stream.json`)

```json
{
  "name": "payment-integration",
  "project": "my-app",
  "status": "active",
  "type": "full",
  "phase": "solutioning",
  "branch": "stream/payment-integration",
  "worktree": "/path/to/bmad-wt-payment-integration",
  "createdAt": "2026-02-12T10:30:00Z",
  "updatedAt": "2026-02-12T14:00:00Z"
}
```

**`status`** values: `active` | `archived`
**`type`** values: `full` (MVP — only type)
**`phase`** values: derived from artifact presence, stored as cache for quick dashboard loads
**`worktree`** and **`branch`**: nullable — not every stream requires a worktree

### Project Metadata (`project.json`)

```json
{
  "name": "my-app",
  "repoPath": "/Users/flow/code/my-app",
  "createdAt": "2026-02-12T09:00:00Z",
  "settings": {}
}
```

### Project Registry (`registry.json`)

```json
{
  "projects": [
    {
      "name": "my-app",
      "repoPath": "/Users/flow/code/my-app",
      "storePath": "~/.bmad-studio/projects/my-app"
    }
  ]
}
```

### Artifact Storage

Artifacts are markdown files produced by OpenCode sessions running BMAD workflows. Both flat files and sharded folders are supported:

| Format | Example | Detection |
|--------|---------|-----------|
| **Flat file** | `prd.md` | File exists with matching name |
| **Sharded folder** | `prd/index.md` | Folder with `index.md` inside |

The artifact watcher handles both patterns. Phase derivation checks for the file OR the folder:

```
Phase complete if: exists("{store}/prd.md") OR exists("{store}/prd/index.md")
```

### Phase → Artifact Mapping

| Phase | Artifacts Checked | Complete When |
|-------|-------------------|---------------|
| **Analysis** | `brainstorm.md`, `research.md` | At least one exists |
| **Planning** | `prd.md` OR `prd/index.md` | PRD exists |
| **Solutioning** | `architecture.md` OR `architecture/index.md` | Architecture exists |
| **Implementation** | `epics/` folder with at least one file | Epics exist |

**Note:** Artifact names may vary between workflow runs (course changes, architecture pivots). The watcher uses pattern matching, not exact filenames. Glob patterns per phase provide flexibility.

## API & Communication

### REST Endpoints

```
# Project Management
GET    /projects                                    # List registered projects
POST   /projects                                    # Register project (repo path)
GET    /projects/:id                                # Project details + stream summary
DELETE /projects/:id                                # Unregister project

# Stream Management
GET    /projects/:id/streams                        # List streams for project
POST   /projects/:id/streams                        # Create stream (name, type, worktree?)
GET    /projects/:id/streams/:sid                   # Stream detail (phase state, artifacts)
PUT    /projects/:id/streams/:sid                   # Update stream metadata
POST   /projects/:id/streams/:sid/archive           # Archive stream

# Worktree Operations (decoupled from stream — not every stream has one)
POST   /projects/:id/streams/:sid/worktree          # Create worktree for stream
DELETE /projects/:id/streams/:sid/worktree           # Remove worktree
POST   /projects/:id/streams/:sid/worktree/switch   # Switch to stream's worktree

# Artifacts
GET    /projects/:id/streams/:sid/artifacts          # List artifacts in stream
GET    /projects/:id/streams/:sid/artifacts/*path    # Read artifact content (supports nested paths)

# Settings
GET    /settings                                     # Global config
PUT    /settings                                     # Update global config
```

**Conventions (carried forward):**
- Plural nouns, lowercase endpoints
- Route params: `:id` format
- JSON fields: `camelCase`
- Dates: ISO 8601
- Errors: `{ "error": { "code": "...", "message": "..." } }`
- Success: Direct payload, no wrapper

### WebSocket Events

Chat events (`chat:*`) are removed. Stream and artifact events replace them:

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

### Two-Backend Communication

```
React Renderer
  │
  ├──── REST + WebSocket ────► Go Sidecar (port 3008)
  │                             Stream CRUD, worktrees, artifacts, phases
  │
  └──── IPC (contextBridge) ──► Electron Main Process
                                  │
                                  ├── OpenCode SDK client
                                  │   └── HTTP + SSE ──► OpenCode Server (dynamic port)
                                  │
                                  └── Forwards events to renderer via IPC
```

**Boundary rule:** The renderer communicates with Go sidecar directly (REST/WebSocket). The renderer communicates with OpenCode ONLY through Electron main process IPC. The main process holds the SDK client.

## OpenCode Integration

### Server Lifecycle

- Electron main process spawns `opencode serve --port <random>` on app startup
- One server instance shared across all sessions/streams
- Server stays alive for the app's lifetime
- If it crashes, Electron detects (child process exit) and restarts it
- On app quit, server process is terminated

### Session ↔ Stream Mapping

Each BMAD workflow launch creates a new OpenCode session:
1. User clicks phase node on phase graph
2. Frontend sends IPC request to main process
3. Main process calls `client.session.create()` with title: `"{stream-name} — {workflow-name}"`
4. Main process calls `client.session.prompt()` with:
   - Model/provider from user's OpenCode config
   - Prompt containing BMAD skill command + context references
5. SSE events stream back through IPC to renderer
6. Renderer displays messages in custom chat UI

Sessions are NOT persisted across app restarts in MVP.

### BMAD Skill Invocation

The prompt sent to OpenCode includes the skill command and context:

```
/bmad:bmm:workflows:prd Create the PRD for the "payment-integration" feature.

Prior artifacts are available at: ~/.bmad-studio/projects/my-app-payment-integration/
The project codebase is at: /Users/flow/code/my-app/
```

The exact prompt engineering for context injection is an implementation detail.

### OpenCode Working Directory

- Set to the **worktree path** (or project root if no worktree)
- Central store path passed as **explicit context in the prompt**
- OpenCode's tools operate against the codebase naturally
- Artifacts get written to the central store because the BMAD workflow directs them there
- fsnotify watches the central store for new/changed artifacts

### Permission Handling

OpenCode `permission.asked` events forwarded to React UI as native dialogs:
1. OpenCode SSE emits `permission.asked` event
2. Electron main process forwards to renderer via IPC
3. React renders approval dialog (tool name, parameters, risk level)
4. User approves/denies
5. Response sent back through IPC → SDK → OpenCode

### OpenCode Not Installed

If `opencode` CLI is not found on PATH:
- App starts normally (Go sidecar still works)
- Stream management, artifact viewing, phase graph all functional
- "Launch workflow" buttons disabled with message: "OpenCode not detected — install to enable AI sessions"
- Settings page links to OpenCode installation instructions

## Worktree Lifecycle

### Naming Convention

- **Worktree directory:** `{repo-parent}/bmad-wt-{stream-name}/`
- **Branch name:** `stream/{stream-name}`
- Example: stream "payment-integration" → worktree at `/Users/flow/code/bmad-wt-payment-integration/`, branch `stream/payment-integration`

### Decoupling from Streams

Streams and worktrees are related but distinct:
- A stream is the idea/creation flow (always exists)
- A worktree is the isolation mechanism (optional)
- Creating a stream does NOT automatically create a worktree
- User explicitly requests worktree creation (default on, configurable)
- A stream can exist without a worktree (working on main branch)

### Archive Behavior

On stream archive:
1. If worktree exists and branch has unmerged changes → prompt user (delete/keep/merge first)
2. If worktree exists and branch is merged → delete worktree and branch
3. Move stream folder to `archive/`
4. Update `stream.json` with outcome (`merged` | `abandoned`)

### Error Handling

- Worktree creation fails (branch exists, path conflict) → surface error in UI, let user resolve
- Dirty worktree on archive → warn user, don't force delete
- Git not installed → worktree features disabled with clear message

## Deferred Decisions (Post-MVP)

| Decision | Rationale | Target |
|----------|-----------|--------|
| **Stream merge / artifact distillation** | No living docs in MVP | v2 |
| **Stream types** (light, spike) | MVP has one type: full pipeline | v2 |
| **Native provider integration** | OpenCode SDK handles LLM; revisit when custom chat matures | v2+ |
| **Cost tracking implementation** | Depends on what OpenCode SDK exposes | v2 |
| **Auto-update** | Manual download for MVP | v2 |
| **Windows support** | Worktree + symlink behavior needs investigation | v2+ |
| **MCP support** | Available through OpenCode already | v2+ |

## Decision Impact Analysis

### Implementation Sequence

1. **Central store + registry** — Foundation: create/read `~/.bmad-studio/` structure
2. **Stream CRUD** — Core entity: create, list, archive streams with `stream.json`
3. **REST API + WebSocket** — Communication layer for frontend
4. **Artifact watcher (fsnotify)** — Detect artifacts, derive phase state
5. **Phase graph (per-stream)** — Frontend visualization driven by artifact state
6. **Worktree operations** — Git CLI integration for stream isolation
7. **OpenCode server lifecycle** — Spawn, monitor, restart `opencode serve`
8. **OpenCode session management** — SDK client, session create/prompt, SSE forwarding
9. **Chat UI** — React components rendering OpenCode message parts
10. **Permission handling** — Forward `permission.asked` to UI, return responses
11. **Multi-stream dashboard** — Home view with all projects and streams

### Cross-Component Dependencies

- Artifact watcher depends on central store layout (knows where to watch)
- Phase state depends on artifact watcher (artifact presence → phase derivation)
- Phase graph depends on phase state (renders what watcher reports)
- OpenCode sessions depend on stream context (reads prior artifacts for prompt)
- Chat UI depends on OpenCode SDK events (renders message parts)
- Worktree operations depend on stream existence (but not vice versa)
