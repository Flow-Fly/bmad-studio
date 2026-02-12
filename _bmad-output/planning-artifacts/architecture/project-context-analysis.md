# Project Context Analysis

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot. Previous context analysis covered chat-centric model (conversations, insights, provider abstraction). This version reflects the developer cockpit model (streams, OpenCode integration, central artifact store).

## Requirements Overview

**Functional Requirements:**

The updated PRD defines 25 functional requirements across 9 domains:

| Domain | FRs | Architectural Impact |
|--------|-----|---------------------|
| **Stream Management** | FR-S1–S5 | Core data model — stream entity, lifecycle state machine, metadata persistence |
| **Worktree Management** | FR-W1–W3 | Git operations — worktree create/cleanup tied to stream lifecycle |
| **Project Management** | FR-PM1–PM4 | Project registry with stream tracking, multi-project switching |
| **Workflow Navigation** | FR-WN1–WN4 | Per-stream phase graph, artifact-driven state, workflow launcher |
| **OpenCode Integration** | FR-O1–O4 | Process management — spawn, configure, monitor OpenCode sessions in embedded terminal |
| **Provider Configuration** | FR-PC1–PC4 | Passthrough layer — detect/sync OpenCode config, initial setup convenience |
| **Artifact Management** | FR-AM1–AM5 | Central store hierarchy, artifact metadata, read-only viewing, git-versioned store |
| **Connectivity & Offline** | FR-CO1–CO3 | View-only degradation, connectivity detection |
| **Cost Tracking** | FR-CT1–CT2 | Read cost data from OpenCode output, aggregate per-stream/project |

**Non-Functional Requirements:**

| NFR Category | Requirements | Architectural Driver |
|--------------|--------------|---------------------|
| **Performance** | NFR1–4 | 1s OpenCode launch, 100ms UI interactions, 1s phase graph render, 2s dashboard load |
| **Security** | NFR5–7 | OS keychain for API keys, no credential exposure, local-first (no telemetry) |
| **Integration** | NFR8–10 | OpenCode failure handling with retry, configurable session timeouts (default 120s), provider switching without restart |
| **Reliability** | NFR11–13 | Immediate stream metadata persistence, crash-safe artifact store, corrupted stream tolerance |

**Scale & Complexity:**

- Primary domain: **Desktop Application (Full-stack orchestrator)**
- Complexity level: **Medium** — well-scoped MVP with clear feature boundaries; OpenCode integration boundary is the complexity driver
- Estimated architectural components: **~15** (backend services, frontend components, shared types)

## Technical Constraints & Dependencies

| Constraint | Source | Impact |
|------------|--------|--------|
| **Go backend on port 3008** | PRD, existing implementation | Backend service architecture, REST + WebSocket API design |
| **React + Tailwind frontend via Vite** | Migration decision (2026-02-12) | Component architecture, Zustand state management |
| **Electron packaging (electron-builder)** | Migration decision (2026-02-12) | IPC layer, embedded terminal, Go sidecar spawning |
| **OpenCode as execution layer** | Orchestrator pivot (2026-02-12) | Thin wrapper model — Studio launches and configures OpenCode, never talks to LLMs directly |
| **Central artifact store (`~/.bmad-studio/projects/`)** | PRD | All artifacts outside repo, stream-scoped hierarchy |
| **macOS primary, Linux supported, Windows deferred** | PRD | File system assumptions, keychain APIs, worktree behavior |
| **Single developer** | PRD | Strictly single-user for v1 — no collaboration, no shared state |
| **BYOK model** | PRD | API keys managed via OS keychain, synced with OpenCode config |
| **Git worktrees per stream** | PRD | Filesystem operations, branch management, cleanup on archive |

## Cross-Cutting Concerns Identified

1. **Stream Lifecycle Management** — Stream creation, phase progression, archival, and worktree coupling touch every layer: UI (dashboard, phase graph), backend services (stream service, worktree service), filesystem (central store, git operations), and state management (Zustand stores). This is the central architectural spine.

2. **Central Artifact Store Topology** — The `~/.bmad-studio/projects/{project}/streams/{stream}/` hierarchy is a new storage model. Artifact reading, metadata tracking, file watching, and phase state derivation all depend on this structure. Must handle concurrent stream operations atomically.

3. **OpenCode Integration Boundary** — The thin wrapper model means Studio configures and launches OpenCode but doesn't intercept its conversation. The boundary questions: How does Studio know a session ended? How does it detect new artifacts? How does it pass context from prior phases? This boundary is the primary technical risk.

4. **Worktree ↔ Stream Coupling** — Each stream optionally maps to a git worktree and branch. Creation, switching, and cleanup operations are filesystem-level and can fail (dirty worktrees, branch conflicts). Error handling for git operations is a new concern.

5. **Phase State Derivation** — The phase graph shows which phases are complete based on artifact presence in the central store. This requires a reliable mapping from artifact types (brainstorm.md, prd.md, architecture.md, etc.) to BMAD phases, and must update when artifacts are created or modified.

6. **Offline Capability** — View-only mode when OpenCode/internet is unavailable. Must separate UI state (always available) from operations that require OpenCode (launching sessions) or connectivity (cloud LLM providers).
