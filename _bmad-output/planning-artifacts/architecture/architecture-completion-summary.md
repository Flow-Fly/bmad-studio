# Architecture Completion Summary

> **Update Note (2026-02-12):** Rewritten for orchestrator pivot architecture.

## Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-02-12
**Document Location:** `_bmad-output/planning-artifacts/architecture/index.md`
**Scope:** Orchestrator Pivot — streams, OpenCode integration, central artifact store, worktree management

## Final Deliverables

### Complete Architecture Document (Sharded)

| Document | Content |
|----------|---------|
| `project-context-analysis.md` | 25 FRs across 9 domains, 13 NFRs, 9 technical constraints, 6 cross-cutting concerns |
| `starter-template-evaluation.md` | Three-process model (Electron + Go + OpenCode), SDK integration paths, dependency analysis |
| `core-architectural-decisions.md` | 10 critical decisions — central store layout, phase derivation, REST API, WebSocket events, OpenCode integration, worktree lifecycle |
| `implementation-patterns-consistency-rules.md` | Naming conventions, API conventions, IPC patterns, Zustand store patterns, service layer separation, phase derivation, atomic writes |
| `project-structure-boundaries.md` | Complete directory tree, "What's Removed" table, 7 architectural boundaries, FR-to-structure mapping |
| `architecture-validation-results.md` | Coherence confirmed, all FRs/NFRs covered, 3 gaps resolved, implementation readiness assessment |

### Key Architecture Decisions

1. **Stream Storage** — JSON metadata + flat markdown artifacts (Git-friendly, no database)
2. **Central Store Layout** — Flat siblings under `~/.bmad-studio/projects/` (mirrors worktree convention)
3. **Phase Derivation** — Artifact presence → phase state (single source of truth)
4. **Two-Backend Model** — Go sidecar (REST/WebSocket) + OpenCode (IPC-mediated via Electron main)
5. **OpenCode SDK** — HTTP server + SSE events, custom React UI rendering structured message parts
6. **camelCase Everywhere** — All JSON across Go struct tags, REST, WebSocket, IPC
7. **Atomic JSON Writes** — Write-temp-rename for all metadata files
8. **fsnotify Watcher** — Go backend watches central store, derives phase state, broadcasts events
9. **Worktree Decoupling** — Streams and worktrees are distinct; not every stream needs a worktree
10. **IPC Security** — Renderer never talks to OpenCode directly; Electron main holds SDK client

### Implementation Sequence

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

## Implementation Handoff

**For AI Agents:**
This architecture document is the complete guide for implementing BMAD Studio's orchestrator pivot. Follow all decisions, patterns, and structures exactly as documented.

**Enforcement Rules:**
- `camelCase` for ALL JSON fields — no exceptions
- Service layer separation — Go sidecar via REST, OpenCode via IPC — never cross
- Phase derivation in Go backend only — frontend renders what backend reports
- Atomic JSON writes for all metadata files
- One Zustand store per domain, actions on the store, selectors in components
- IPC channels use `namespace:kebab-case`
- Electron preload is the single IPC bridge — no `nodeIntegration`

## Quality Assurance

**Coherence** — All 10 decisions work together without conflicts. Three-process model, flat store layout, IPC-mediated OpenCode, and fsnotify-driven phase derivation form a consistent architecture.

**Coverage** — All 25 FRs and 13 NFRs are architecturally supported. 2 FRs deferred with clear rationale (cost tracking).

**Readiness** — AI agents can implement consistently using documented patterns, naming conventions, and the complete project directory structure.

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Create epics and stories from architectural decisions, then begin implementation.

**Document Maintenance:** Update this architecture when major technical decisions change during implementation.
