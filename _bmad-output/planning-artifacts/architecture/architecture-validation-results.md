# Architecture Validation Results

> **Update Note (2026-02-12):** Revalidated for orchestrator pivot architecture.

## Validation Status: PASSED

**Coherence:** All decisions work together without contradictions
**Coverage:** All 25 FRs and 13 NFRs architecturally supported (2 FRs deferred with rationale)
**Readiness:** AI agents can implement consistently using documented patterns and structure

## Coherence Validation

**Decision Compatibility:** All technology choices interlock — three-process model (Electron + Go + OpenCode), React/Zustand frontend, REST + WebSocket + IPC communication, fsnotify-driven phase derivation. No conflicts between any decisions.

**Pattern Consistency:** `camelCase` JSON everywhere (resolved historical inconsistency), `namespace:kebab-case` for both WebSocket and IPC events, uniform store pattern across all domains, clean service layer separation (REST vs IPC).

**Structure Alignment:** Every FR maps to specific files. Every boundary is documented. "What's Removed" table prevents zombie components. No orphaned files in the tree.

## Requirements Coverage

All 25 functional requirements across 9 domains are architecturally supported. Cost tracking (FR-CT1–CT2) is deferred with clear rationale. All 13 non-functional requirements are addressed through specific architectural decisions (atomic writes for NFR11–12, IPC-mediated access for NFR5–7, pre-derived phase state for NFR3, etc.).

## Gap Analysis

**Critical Gaps: None.**

**Important Gaps Resolved:**

1. **Concurrent sessions** → One active session displayed at a time, tied to active stream. Background sessions continue on OpenCode server. `opencode.store` holds multi-session state.
2. **Session discovery on restart** → MVP ignores. OpenCode server is freshly spawned as child process. Known limitation.
3. **Port collision** → Random port per spawn, retry on failure (up to 3), clear error message.

## Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (25 FRs, 13 NFRs, 9 technical constraints)
- [x] Scale and complexity assessed (Medium — OpenCode boundary is complexity driver)
- [x] Technical constraints identified (three-process model, central store, macOS-first)
- [x] Cross-cutting concerns mapped (6 concerns: stream lifecycle, central store, OpenCode boundary, worktree coupling, phase derivation, offline)

**Architectural Decisions**
- [x] 10 critical decisions documented with rationale
- [x] Technology stack fully specified (React + Electron + Go + OpenCode SDK)
- [x] Integration patterns defined (REST + WebSocket + IPC, two-backend model)
- [x] Security model specified (IPC-mediated OpenCode, keychain, no telemetry)

**Implementation Patterns**
- [x] Naming conventions established (all layers, camelCase enforcement)
- [x] Communication patterns specified (IPC channels, WebSocket events, REST conventions)
- [x] State management patterns defined (5 Zustand stores, service layer separation)
- [x] Error handling documented (per-layer patterns, error categories)
- [x] Phase derivation pattern specified (Go backend, glob-based, fsnotify-driven)
- [x] Atomic file operations pattern specified (write-temp-rename for all JSON)

**Project Structure**
- [x] Complete directory structure defined (every file named)
- [x] Component boundaries established (7 boundaries documented)
- [x] FR to structure mapping complete (9 FR domains → specific files)
- [x] Removed components documented (prevents zombie code)

## Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean separation of concerns — Go sidecar handles state/filesystem, OpenCode handles LLM, Electron orchestrates
- OpenCode SDK integration eliminates the complexity of building a custom chat harness
- Phase derivation from artifact presence is a simple, reliable source of truth
- Flat central store layout mirrors git worktree convention — developers will find it intuitive
- Stream ↔ worktree decoupling keeps the domain model honest
- Atomic JSON writes prevent corruption without database overhead

**Areas for Future Enhancement:**
- Frontend test organization (establish during implementation)
- CI/CD pipeline (define when distribution is needed)
- Stream types beyond full pipeline (v2 feature)
- Native provider integration (v2, when custom chat matures beyond OpenCode SDK rendering)

## Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries — check "What's Removed" before creating files
- Use the service layer separation strictly — Go sidecar via REST, OpenCode via IPC
- Derive phase state in Go backend only — frontend renders what backend reports
- Use atomic JSON writes for all metadata files

**Implementation Sequence:**
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
