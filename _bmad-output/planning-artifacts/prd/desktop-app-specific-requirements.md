# Desktop App Specific Requirements

## Platform Support

| Platform | MVP Status | Notes |
|----------|------------|-------|
| macOS | Primary | Development environment |
| Linux | Supported | Full parity with macOS |
| Windows | Deferred | Symlink and worktree handling to investigate |

## Update Strategy

- **MVP:** Manual download from releases page
- **Post-MVP:** Auto-update via Electron's electron-updater

## System Integration

- **MVP:** OpenCode process management (spawn, monitor, terminate sessions via SDK), git worktree filesystem operations, central store file management
- **Post-MVP:** File associations for BMAD project files, menu bar quick access

## Offline Capability

| Scenario | Behavior |
|----------|----------|
| OpenCode available with local models | Full functionality using local LLM |
| No local models, no internet | View-only mode: browse streams, read artifacts, view dashboard |
| Internet restored | Resume normal operation, OpenCode sessions available |

## Technical Architecture

- **Backend:** Go service (port 3008) — stream management, worktree operations, artifact organization, project registry, OpenCode process orchestration
- **Frontend:** React + Tailwind (Vite dev server port 3007)
- **Desktop:** Electron (via electron-builder) — IPC bridge for OpenCode SDK, filesystem operations
- **Integration:** OpenCode SDK via HTTP + SSE (IPC-mediated through Electron main process); native React chat UI renders structured message parts; WebSocket for real-time stream/artifact events; REST for CRUD operations.
- **Data Storage:** Central store (`~/.bmad-studio/projects/`), stream-based artifact hierarchy per project
