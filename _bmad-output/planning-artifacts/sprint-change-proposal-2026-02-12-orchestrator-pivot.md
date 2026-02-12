# Sprint Change Proposal — Orchestrator Pivot: Streams, OpenCode & Developer Cockpit

**Date:** 2026-02-12
**Triggered By:** Architectural realization — BMAD phases are per-feature, not per-project
**Branch:** `feature/react-electron-migration`
**Scope Classification:** Major
**Author:** Flow + Correct Course Workflow

---

## Section 1: Issue Summary

### Problem Statement

BMAD Studio's current architecture models workflow phases as global project states ("research is done"), but the BMAD methodology supports multiple concurrent feature streams — each independently progressing through research, PRD, architecture, epics, and implementation. The app cannot track "an idea from creation to completion" when multiple ideas coexist within the same project.

Additionally, building a custom LLM chat harness duplicates what OpenCode already provides, while the app's real differentiator is workflow orchestration — not chat.

### Context

- **When discovered:** During active development (Epics 0-3 complete, 4-7 in backlog), through practical use of the methodology and a brainstorm session analyzing the product direction
- **Category:** Misunderstanding of original requirements + strategic pivot
- **Current state:** Epics 0-3 are fully implemented (BMAD Integration, Foundation, Phase Visualization, Chat Experience). Epics 4-7 are entirely in backlog.

### Evidence

1. A single "Research" phase node can't be "done" when you might research a new topic
2. Multiple PRDs exist when working on multiple features — same for architecture, epics, etc.
3. The brainstorm crystallized that BMAD Studio should be a "developer cockpit" — an orchestrator sitting above tools, not reimplementing them
4. OpenCode already provides a capable LLM chat experience; duplicating it adds complexity without differentiation

### The New Vision

BMAD Studio transforms from a "visual BMAD chat wrapper" to a **developer cockpit / orchestrator**:

1. **Streams** — Each idea/feature gets its own lifecycle through BMAD phases, tied to git worktrees
2. **Central artifact store** (`~/.bmad-studio/projects/`) — Artifacts live outside the repo
3. **OpenCode integration** — Delegate LLM chat/execution to OpenCode instead of building a full harness
4. **Multi-project/multi-stream dashboard** — The app becomes a cockpit, not a chat window
5. **Phase graph becomes per-stream**, not per-project

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status | Impact Level | Details |
|------|--------|-------------|---------|
| **Epic 0: BMAD Integration** | Done | **High** | Needs stream-aware artifact scanning; file watcher targets central store |
| **Epic 1: Foundation & Providers** | Done | **Medium** | Providers may be replaced by OpenCode; Electron shell needs worktree management |
| **Epic 2: Phase Graph** | Done | **High** | Phase graph goes per-project → per-stream; new multi-stream dashboard |
| **Epic 3: Chat Experience** | Done | **Critical** | Most components replaced by OpenCode integration |
| **Epic 4: Context Management** | Backlog | **High** | Context model fundamentally changes with OpenCode |
| **Epic 5: Workflow Execution** | Backlog | **High** | Becomes OpenCode session orchestration |
| **Epic 6: Artifact Management** | Backlog | **Critical** | Entire storage/project model redesigned around streams + central store |
| **Epic 7: Operational Awareness** | Backlog | **Medium** | Cost tracking still needed; offline depends on OpenCode |

### Story Impact — Completed Epics

**Epic 0 (BMAD Integration Layer):**
- Story 0.1 (Parse Config): Needs stream context parameter
- Story 0.4 (Workflow Status): Per-stream status files
- Story 0.5 (Artifact Registry): Scans central store per-stream, not `_bmad-output/`
- Story 0.6 (File Watcher): Watches `~/.bmad-studio/projects/{project}/streams/{stream}/`

**Epic 1 (Foundation & Providers):**
- Story 1.1 (Scaffolding): Electron shell needs worktree process management
- Stories 1.3-1.5 (Providers): May become unnecessary if OpenCode handles LLM; or repurposed for OpenCode config passthrough
- Story 1.6 (Provider Settings UI): Potentially delegates to OpenCode's configuration

**Epic 2 (Phase Visualization):**
- Story 2.1 (Project Open): Becomes project open + stream selection/creation
- Story 2.2 (Workflow State): Per-stream workflow state
- Story 2.3-2.4 (Phase Graph): Per-stream instance; need multi-stream overview
- Story 2.5 (App Shell): Needs stream navigator in layout

**Epic 3 (Chat Experience):**
- Stories 3.1-3.6 (WebSocket, Chat, Agents, Panel, Markdown, Thinking): Replaced by OpenCode
- Stories 3.7-3.8 (Context Indicator, Highlighting): Replaced by OpenCode
- Stories 3.9-3.11 (Lifecycle, Insights, Context Attach): Deferred or reimagined

### Artifact Conflicts

#### PRD

| Section | Conflict Level | Changes Needed |
|---------|---------------|----------------|
| Executive Summary | **Critical** | Vision rewrite: orchestrator cockpit, not chat wrapper |
| Functional Requirements | **Critical** | ~20 FRs need revision; ~10 new FRs needed for streams/worktrees/OpenCode |
| User Journeys | **High** | New personas: user as orchestrator, not chat participant |
| MVP Scope | **Critical** | Redefined: streams + dashboard + OpenCode, not chat + Insights |
| Desktop Requirements | **Medium** | OpenCode process management, worktree filesystem ops |

#### Architecture

| Section | Conflict Level | Changes Needed |
|---------|---------------|----------------|
| Conversation Model | **Critical** | OpenCode owns conversations, not our Go backend |
| Data Architecture | **Critical** | Stream hierarchy in central store |
| WebSocket Protocol | **High** | Chat events potentially removed; keep artifact/workflow events |
| REST API | **High** | Stream-based routes; no direct `/chat` endpoint |
| Provider Architecture | **Critical** | OpenCode handles LLM; providers may be removed or repurposed |
| Project Registry | **High** | Needs stream tracking per project |

#### UX Design

| Section | Conflict Level | Changes Needed |
|---------|---------------|----------------|
| Core User Experience | **Critical** | Multi-stream model; OpenCode integration panels |
| Phase Graph | **High** | Per-stream graphs + multi-stream dashboard |
| Conversation & Insight Model | **Critical** | OpenCode handles conversations |
| User Journey Flows | **High** | Stream-based journeys replace single-project flows |
| Component Strategy | **High** | Remove chat components; add stream management, OpenCode panel |

#### Epics

| Section | Conflict Level | Changes Needed |
|---------|---------------|----------------|
| Epic 0-2 (Done) | **High** | Refactoring needed for stream awareness |
| Epic 3 (Done) | **Critical** | Largely replaced by OpenCode |
| Epics 4-7 (Backlog) | **Critical** | Replace with new epic structure |

### Technical Impact

- **Go backend:** Stream management service, worktree operations, central store management. Chat service and provider streaming may be removed.
- **React frontend:** New stream management UI, multi-stream dashboard, OpenCode integration panel. Chat components removed or repurposed.
- **Electron shell:** OpenCode process management, worktree filesystem operations.
- **Data model:** New `Stream` entity, per-stream state, central store hierarchy.

---

## Section 3: Recommended Approach

### Selected Path: Hybrid (Selective Restructure + MVP Redefinition)

**Keep and refactor** Epics 0-2 infrastructure for stream awareness. **Selectively remove** Epic 3 chat components (replaced by OpenCode). **Replace** Epics 4-7 with new epic structure around streams, OpenCode, and orchestrator dashboard. **Redefine MVP** around the cockpit concept.

### Rationale

1. **Preserve investment:** Go backend, Electron shell, REST infrastructure, phase graph components, BMAD integration — all remain as foundation
2. **Eliminate dead weight:** Epic 3's chat system becomes redundant with OpenCode; maintaining parallel systems adds complexity without value
3. **Stronger differentiation:** "Orchestrator cockpit" is more compelling than "another chat UI with BMAD knowledge"
4. **Natural developer model:** Streams tied to worktrees match how developers actually work (feature branches)
5. **Comparable scope:** Trading chat complexity for stream/worktree complexity; net effort is similar

### Alternatives Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| **Direct Adjustment** (graft streams onto existing) | Viable but messy | Leaves dead chat code, unclear OpenCode boundary |
| **Full Rollback** | Overkill | Epics 0-2 are genuinely useful infrastructure |
| **MVP Scope Reduction only** | Incomplete | Doesn't address the fundamental per-project vs per-stream mismatch |

### Effort Estimate

- **Re-planning phase:** Medium (rewrite PRD, Architecture, Epics) — this is the priority
- **Foundation refactoring (Epics 0-2):** Medium (stream awareness, central store)
- **Chat removal (Epic 3):** Low (delete components, clean up)
- **New features (streams, OpenCode, dashboard):** High (new development)

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| OpenCode integration boundary unclear | Medium | Spike the integration early; define thin/thick/middle boundary |
| Stream lifecycle complexity | Medium | Start with simple create/archive; defer merge distillation to post-MVP |
| Scope creep from "enhanced lazygit" vision | High | Defer git visualization to post-MVP; MVP = basic worktree create/switch |
| Losing working chat functionality | Low | OpenCode provides equivalent; existing code preserved in git history |

### Timeline Impact

Remaining Epics 4-7 were already in backlog. This replaces them with a different set of work. The re-planning phase is new overhead (~1-2 workflow sessions per artifact), but implementation scope is comparable.

---

## Section 4: Detailed Change Proposals

### New Conceptual Model

```
~/.bmad-studio/
  registry.json                         # All known projects
  config.json                           # Global settings
  projects/
    {project-name}/                     # Matches a git repo
      project.json                      # Repo path, settings
      streams/
        {stream-name}/                  # Matches a worktree + branch
          stream.json                   # Status, type, created, phase, branch
          brainstorm.md
          research.md
          prd.md
          architecture.md
          epics/
            epic-1.md
      archive/                          # Completed or abandoned streams
        {stream-name}/
          stream.json                   # outcome: merged | abandoned
          ...artifacts
      main/                             # Living project-level docs
        features.md                     # Consolidated from merged streams
        architecture-decisions.md       # ADR-style log
```

### Stream Types

| Type | Description | Phases Required |
|------|-------------|-----------------|
| **Full** | Complete BMAD flow | Research → PRD → Architecture → Epics → Implementation |
| **Light** | Quick feature | Epics → Implementation (skip planning) |
| **Spike** | Exploration only | Research only; may promote to Full |

### New Functional Requirements (Proposed)

| ID | Requirement |
|----|-------------|
| FR-S1 | User can create a new stream (name, type, optional worktree creation) |
| FR-S2 | User can view all streams for a project with their current phase |
| FR-S3 | User can switch between streams (loads stream's phase graph and artifacts) |
| FR-S4 | User can archive a stream (completed or abandoned) |
| FR-S5 | User can merge a stream's artifacts into project main docs |
| FR-W1 | System creates a git worktree when a stream is created (optional) |
| FR-W2 | System cleans up worktree when stream is merged or archived |
| FR-W3 | User can switch worktrees from the UI |
| FR-O1 | User can launch an OpenCode session with a specific BMAD skill |
| FR-O2 | System displays OpenCode session output in the UI |
| FR-O3 | User can trigger BMAD workflows from the phase graph via OpenCode |
| FR-O4 | OpenCode session artifacts are saved to the stream's central store folder |

### Revised FRs (Key Changes)

| Original FR | Current | Proposed Change |
|-------------|---------|-----------------|
| FR1 | Open project folder | Open project + select/create stream |
| FR2 | View project workflow state | View per-stream workflow state |
| FR3 | Switch between projects | Switch between projects AND streams |
| FR4-5 | Project-level phase graph | Per-stream phase graph |
| FR6-8 | Workflow navigation | Navigate to launch OpenCode session |
| FR9-13 | Agent conversation (built-in chat) | Replaced by OpenCode integration (FR-O1 to FR-O4) |
| FR14-22 | Conversation lifecycle, Insights | Deferred to post-MVP |
| FR23-26 | Provider configuration | Delegated to OpenCode config |
| FR27-32 | Artifact management | Per-stream artifacts in central store |

### Proposed New Epic Structure

| Epic | Title | Description |
|------|-------|-------------|
| **Epic 0** | BMAD Integration Layer (Refactor) | Add stream awareness, central store scanning |
| **Epic 1** | Foundation (Refactor) | Electron worktree management, remove unused providers |
| **Epic 2** | Phase Graph (Refactor) | Per-stream graphs, multi-stream overview |
| **Epic N1** | Stream Management | Stream CRUD, central store, worktree lifecycle |
| **Epic N2** | OpenCode Integration | Session orchestration, output display, skill launching |
| **Epic N3** | Orchestrator Dashboard | Multi-project, multi-stream overview, artifact viewer |
| **Epic N4** | Operational Awareness | Cost tracking, offline handling (adapted for OpenCode) |

### What Gets Removed from Codebase

| Component | Reason |
|-----------|--------|
| `src/components/chat/` (most of it) | Replaced by OpenCode |
| `src/stores/chat.store.ts` | Conversations managed by OpenCode |
| `src/services/chat.service.ts` | OpenCode handles LLM communication |
| `backend/services/chat_service.go` | No longer needed |
| `backend/providers/claude.go`, `openai.go` | OpenCode handles providers (keep ollama.go TBD) |
| WebSocket `chat:*` events | OpenCode handles streaming |
| Insight system (components, services, stores) | Deferred to post-MVP |

### What Gets Added

| Component | Purpose |
|-----------|---------|
| `src/components/streams/` | Stream creation, list, detail, archive |
| `src/components/dashboard/` | Multi-project, multi-stream overview |
| `src/components/opencode/` | OpenCode session panel, output display |
| `src/stores/stream.store.ts` | Stream state management |
| `src/services/stream.service.ts` | Stream CRUD, worktree operations |
| `src/services/opencode.service.ts` | OpenCode session management |
| `backend/services/stream_service.go` | Stream lifecycle, central store management |
| `backend/services/worktree_service.go` | Git worktree operations |

---

## Section 5: Implementation Handoff

### Change Scope: Major

Fundamental replan of product direction affecting PRD, Architecture, UX, and Epic structure. Existing code (Epics 0-3) needs partial refactoring. New development for streams, OpenCode, and dashboard.

### Handoff Plan

| Step | Action | Agent/Workflow |
|------|--------|----------------|
| 1 | **Rewrite PRD** — Update vision, FRs, user journeys, MVP scope | PRD workflow (edit mode) |
| 2 | **Rewrite Architecture** — Streams, OpenCode boundary, central store, data model | Architecture workflow |
| 3 | **Rewrite Epics & Stories** — New epic structure with stream/OpenCode epics | Epics & Stories workflow |
| 4 | **Implementation Readiness Check** — Validate before dev | Readiness check workflow |
| 5 | **Refactor Epics 0-2** — Stream awareness, central store | Dev workflow |
| 6 | **Remove Epic 3 chat** — Clean up replaced components | Dev workflow |
| 7 | **Build new epics** — Streams, OpenCode, Dashboard | Dev workflow |

### Open Design Questions (for Planning Phase)

1. **OpenCode integration boundary:** Thin wrapper (embedded terminal), thick wrapper (headless + custom UI), or middle ground (visible panel + orchestration chrome)?
2. **Stream ↔ worktree linkage:** Name-mirroring (v1) vs content-addressable mapping (later)?
3. **What happens on stream merge?** Distill artifacts into `main/` docs? Archive raw artifacts? Both?
4. **Insight system:** Defer entirely? Or build a lighter version that works with OpenCode's output?
5. **Provider config:** Remove entirely (OpenCode handles) or keep as a passthrough/convenience layer?

### Success Criteria

- [ ] PRD updated with streams, OpenCode, orchestrator vision
- [ ] Architecture redesigned for stream lifecycle, central store, OpenCode boundary
- [ ] New epic structure defined and validated
- [ ] Implementation readiness check passed
- [ ] Foundation refactored for stream awareness
- [ ] Chat components removed, OpenCode integrated
- [ ] Multi-stream dashboard operational
- [ ] User can create stream → trigger BMAD workflow via OpenCode → view artifacts

---

**Proposal Status:** Awaiting approval
**Generated by:** Correct Course Workflow (2026-02-12)
