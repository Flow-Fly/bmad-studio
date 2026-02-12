# Requirements Inventory

## Functional Requirements

**Stream Management**
- FR-S1: User can create a new stream (name, flow template) within a project. MVP supports two flow templates: Full Flow (complete BMAD pipeline) and Quick Flow (two-step fast track — spec and dev). Users can skip phases manually in Full Flow.
- FR-S2: User can view all streams for a project with their current phase and status
- FR-S3: User can switch between streams; switching loads the stream's phase graph and artifact list
- FR-S4: User can archive a stream as completed or abandoned
- FR-S5: System persists stream metadata (status, creation date, current phase, associated branch) in the central store

**Worktree Management**
- FR-W1: System creates a git worktree when a stream is created (user-configurable, on by default)
- FR-W2: System cleans up the worktree when a stream is archived
- FR-W3: User can switch to a stream's worktree directory from the UI

**Project Management**
- FR-PM1: User can open an existing project folder containing BMAD configuration
- FR-PM2: User can view the project dashboard showing all streams and their current phases
- FR-PM3: User can switch between 2 or more registered projects
- FR-PM4: System maintains a project registry linking project folders to their central artifact store locations

**Workflow Navigation**
- FR-WN1: User can view the per-stream phase graph showing BMAD phases (Analysis, Planning, Solutioning, Implementation)
- FR-WN2: User can see which phase and workflow step is currently active for the selected stream
- FR-WN3: User can click a completed phase node to view its artifact (read-only), or click a current/upcoming phase node to see available BMAD skills/workflows for that phase
- FR-WN4: User can launch a BMAD workflow from the phase graph, which triggers the OpenCode session launcher for the corresponding skill

**OpenCode Integration**
- FR-O1: User can launch an OpenCode session for a specific BMAD skill. System creates an OpenCode session via SDK with the configured skill, working directory, and context from prior phases.
- FR-O2: User interacts with the OpenCode session through BMAD Studio's native chat UI, which renders streaming messages, tool calls, and tool results from the OpenCode SDK.
- FR-O3: When an OpenCode session ends, system reads produced artifacts from the stream's central store folder and updates the phase graph to reflect new artifacts.
- FR-O4: System detects and syncs with existing OpenCode configuration (agents, providers, keys) if already installed

**Provider Configuration**
- FR-PC1: User can configure initial LLM provider settings (API keys, model selection) through BMAD Studio during first-time setup or when OpenCode configuration is not detected
- FR-PC2: System syncs provider configuration with OpenCode — reads existing config on detection, writes new config on initial setup
- FR-PC3: System validates provider credentials before use
- FR-PC4: If OpenCode is not installed, system guides user through installation and initial provider setup

**Artifact Management**
- FR-AM1: User can view all artifacts produced within a stream, organized by type (brainstorm, PRD, architecture, epics, stories). Artifact viewing is read-only in MVP.
- FR-AM2: User can see which workflow/skill produced each artifact and when
- FR-AM3: Artifacts are stored in the centralized location: ~/.bmad-studio/projects/{project}/streams/{stream}/
- FR-AM4: System maintains artifact metadata linking each artifact to its source workflow, stream, and creation date
- FR-AM5: Central artifact store can be independently git-versioned

**Connectivity & Offline**
- FR-CO1: System detects when no internet connection is available
- FR-CO2: User can browse streams, artifacts, and the project dashboard in view-only mode when offline
- FR-CO3: System indicates which operations require connectivity (OpenCode sessions with cloud LLM providers)

**Cost Tracking**
- FR-CT1: User can view cost data from OpenCode sessions (token usage, estimated cost) when available from OpenCode's output
- FR-CT2: User can view cumulative cost data across a stream's sessions and across the project

## Non-Functional Requirements

**Performance**
- NFR1: OpenCode chat UI begins displaying the first streamed message within 1 second of session launch
- NFR2: UI interactions (clicks, navigation, stream switching) respond within 100ms
- NFR3: Per-stream phase graph renders within 1 second of stream selection
- NFR4: Multi-stream dashboard loads all stream statuses within 2 seconds regardless of stream count

**Security**
- NFR5: API keys are stored encrypted in OS keychain (macOS Keychain, Linux Secret Service)
- NFR6: API keys are never logged or exposed in UI
- NFR7: No telemetry or data leaves the local machine without explicit user action

**Integration**
- NFR8: When an OpenCode process fails, system displays an error message identifying the failure reason and offers a retry option within 2 seconds
- NFR9: OpenCode session timeouts are configurable (default: 120 seconds for long-running workflow steps)
- NFR10: Provider switching through OpenCode configuration does not require application restart

**Reliability**
- NFR11: Stream metadata persists immediately upon creation or state change (no batching)
- NFR12: Application crash does not corrupt stream state or artifact data in the central store
- NFR13: Corrupted stream data does not prevent application startup; system skips the corrupted stream, loads remaining streams, and displays a warning identifying the affected stream

## Additional Requirements

**From Architecture — Three-Process Model:**
- Electron main process: application shell, IPC hub, OpenCode SDK client
- Go sidecar (port 3008): stream management, worktree operations, artifact watching, phase state, project registry
- OpenCode server (`opencode serve --port <dynamic>`): LLM execution, BMAD skill sessions

**From Architecture — Central Store:**
- Flat siblings under `~/.bmad-studio/projects/`: `{project}-{stream}` naming convention
- `stream.json` for stream metadata (status, type, phase, branch, worktree)
- `project.json` for project metadata (name, repoPath)
- `registry.json` for project registry at `~/.bmad-studio/`
- Atomic JSON writes (write-temp-rename) for all metadata files
- Both flat files and sharded folders for artifacts

**From Architecture — Phase Derivation:**
- Phase state derived from artifact presence (single source of truth)
- Phase → artifact mapping: Analysis (brainstorm/research), Planning (prd), Solutioning (architecture), Implementation (epics)
- Glob patterns for flexibility
- fsnotify watcher on central store, debounced 100ms

**From Architecture — Communication:**
- REST API: resource-oriented routes (`/projects/:id/streams/:sid/artifacts`)
- WebSocket events: `artifact:created/updated/deleted`, `stream:phase-changed/created/archived/updated`, `connection:status`
- IPC for OpenCode: `namespace:kebab-case` channels
- `camelCase` for ALL JSON fields (enforcement rule, replaces historical snake_case)

**From Architecture — OpenCode SDK Integration:**
- SDK via HTTP server + SSE (replaces terminal embedding)
- IPC-mediated: renderer never talks to OpenCode directly
- Session create/prompt via SDK, events forwarded to renderer
- Permission handling: `permission.asked` events → UI dialog → response
- Custom React chat UI rendering structured message parts (SDK path makes this the natural integration, not out-of-scope)

**From Architecture — Worktree Operations:**
- Naming: `{repo-parent}/bmad-wt-{stream-name}/`, branch: `stream/{stream-name}`
- Decoupled from streams (not every stream needs a worktree)
- Archive behavior: prompt for unmerged changes, move to `archive/`
- Git operations via `os/exec` calling git CLI

**From Architecture — 11-Step Implementation Sequence:**
1. Central store + registry (foundation)
2. Stream CRUD (core entity)
3. REST API + WebSocket (communication layer)
4. Artifact watcher + phase derivation (real-time state)
5. Phase graph per-stream (frontend visualization)
6. Worktree operations (git integration)
7. OpenCode server lifecycle (process management)
8. OpenCode session management (SDK client + SSE)
9. Chat UI (rendering OpenCode message parts)
10. Permission handling (tool approval dialogs)
11. Multi-stream dashboard (home view)

**From UX — Core Experience Patterns:**
- Two-level phase graph: phase containers + workflow nodes inside
- Flow templates: Full Flow (4 phases, all workflows) and Quick Flow (2 nodes: spec + dev)
- Agent assignment visible on workflow nodes (Mary, John, Winston, Sally, Bob, Amelia, Barry)
- Context dependency tooltip on workflow nodes (pre-launch confidence)
- BreadcrumbStrip during active sessions (collapsed phase graph, 36px)
- StreamCard for dashboard (phase dots, project, flow type, last activity)
- Stream creation modal (name + flow template selector + worktree checkbox)
- Cmd+K command palette for keyboard navigation
- Dark mode only for MVP
- Linear-inspired density, Zed-inspired panel philosophy

**From UX — Component Requirements:**
- shadcn/ui as component library (Button, Dialog, Command, Tooltip, Popover, Badge, ScrollArea, Input, Checkbox, Separator, Tabs, Resizable)
- Custom: PhaseGraph, WorkflowNode, BreadcrumbStrip, StreamCard, AgentBadge, ArtifactViewer, ConversationPanel, StreamCreationModal, FlowTemplateSelector, PhaseDotIndicator, ContextDependencyTooltip
- Component layering: Layer 0 (design tokens) → Layer 1 (primitives) → Layer 2 (domain components) → Layer 3 (pages)
- Design tokens as CSS custom properties + Tailwind config extensions

**From UX — Accessibility & Responsive:**
- WCAG 2.1 AA compliance target
- Keyboard navigation: arrow keys on phase graph, Enter to launch, Tab between regions, Cmd+K palette
- Minimum window 1024x768
- Breakpoints: Compact (1024-1279), Standard (1280-1439), Full (1440+)
- Respect `prefers-reduced-motion`

## FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR-S1 | Epic 2 | Create streams (name, type) |
| FR-S2 | Epic 2 | View all streams with phase/status |
| FR-S3 | Epic 2 + Epic 4 | Switch between streams (backend: Epic 2, frontend: Epic 4) |
| FR-S4 | Epic 2 | Archive stream (completed/abandoned) |
| FR-S5 | Epic 2 | Persist stream metadata in central store |
| FR-W1 | Epic 5 | Create git worktree on stream creation |
| FR-W2 | Epic 5 | Cleanup worktree on archive |
| FR-W3 | Epic 5 | Switch to stream's worktree from UI |
| FR-PM1 | Epic 1 | Open existing project folder |
| FR-PM2 | Epic 10 | View project dashboard with all streams |
| FR-PM3 | Epic 10 | Switch between registered projects |
| FR-PM4 | Epic 1 | Project registry linking folders to store |
| FR-WN1 | Epic 4 | View per-stream phase graph |
| FR-WN2 | Epic 3 + Epic 4 | See active phase/step (backend derives: Epic 3, frontend renders: Epic 4) |
| FR-WN3 | Epic 4 | Click phase node to view artifact or available workflows |
| FR-WN4 | Epic 7 | Launch BMAD workflow from phase graph via OpenCode |
| FR-O1 | Epic 7 | Launch OpenCode session for specific BMAD skill |
| FR-O2 | Epic 8 + Epic 9 | Interact with OpenCode session (Chat UI: Epic 8, Permissions: Epic 9) |
| FR-O3 | Epic 3 | System reads produced artifacts and updates phase graph |
| FR-O4 | Epic 6 | Detect and sync existing OpenCode configuration |
| FR-PC1 | Epic 11 | Configure initial LLM provider settings |
| FR-PC2 | Epic 11 | Sync provider config with OpenCode |
| FR-PC3 | Epic 11 | Validate provider credentials |
| FR-PC4 | Epic 6 | Guide user through OpenCode installation |
| FR-AM1 | Epic 3 + Epic 10 | View artifacts organized by type (backend: Epic 3, UI: Epic 10) |
| FR-AM2 | Epic 3 | See which workflow produced each artifact |
| FR-AM3 | Epic 1 | Artifacts in centralized store location |
| FR-AM4 | Epic 3 | Artifact metadata (source workflow, stream, date) |
| FR-AM5 | Epic 1 | Central store independently git-versioned |
| FR-CO1 | Epic 11 | Detect no internet connection |
| FR-CO2 | Epic 11 | View-only mode when offline |
| FR-CO3 | Epic 11 | Indicate which operations require connectivity |
| FR-CT1 | Epic 11 | View cost data from OpenCode sessions |
| FR-CT2 | Epic 11 | View cumulative cost data |
