# Sprint Change Proposal — Frontend Technology Migration

**Date:** 2026-02-12
**Triggered By:** Strategic developer experience decision (between Epic 3 and Epic 4)
**Branch:** `feature/react-electron-migration`
**Scope Classification:** Moderate
**Author:** Flow + Correct Course Workflow

---

## Section 1: Issue Summary

### Problem Statement

The original technology stack (Lit Web Components + Tauri + Shoelace) was harder to work with than the React ecosystem for building a desktop application. With Epics 0-3 complete and 4 epics remaining in backlog, a strategic decision was made to migrate the frontend from Lit/Tauri to React/Electron/Tailwind CSS to improve development velocity and leverage a larger ecosystem.

### Context

- **When discovered:** During the gap between Epic 3 (done) and Epic 4 (backlog)
- **Motivation:** Developer experience — React has better tooling, larger ecosystem, more community resources, and Tailwind provides a more productive styling approach than Shoelace
- **Current state:** Migration is actively in progress on the `feature/react-electron-migration` branch

### Technology Changes

| Layer | Before | After |
|-------|--------|-------|
| **UI Framework** | Lit (Web Components) | React |
| **Styling** | Shoelace + CSS Custom Properties | Tailwind CSS |
| **State Management** | Lit Signals | Zustand / React hooks |
| **Desktop Shell** | Tauri (Rust) | Electron |
| **Build/Package** | Tauri CLI | electron-builder |
| **Component Naming** | `kebab-case` tags (`<phase-node>`) | PascalCase JSX (`<PhaseNode />`) |

### What Did NOT Change

- Go backend (100% unaffected)
- WebSocket protocol and events
- REST API endpoints
- Provider architecture (Claude, OpenAI, Ollama)
- Data architecture (JSON files, project registry)
- Tool execution layer architecture
- All functional requirements (FR1-FR37)
- All non-functional requirements (NFR1-NFR13)

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status | Impact Level | Notes |
|------|--------|-------------|-------|
| Epic 0: BMAD Integration Layer | Done | None | Pure backend — no frontend code |
| Epic 1: App Foundation & Providers | Done | Historical | Stories reference Lit/Tauri scaffolding |
| Epic 2: Phase Graph Visualization | Done | Historical | Stories reference Lit component names |
| Epic 3: Agent Conversation | Done | Historical | Stories reference Lit/Shoelace components |
| Epic 4: Context & Knowledge Mgmt | Backlog | Low | Mostly behavioral descriptions |
| Epic 5: Workflow Execution | Backlog | Medium | Phase graph UI interaction references |
| Epic 6: Artifact & Multi-Project | Backlog | Medium | Panel and selector component references |
| Epic 7: Operational Awareness | Backlog | Low | Status indicators, mostly behavioral |

### Artifact Conflicts

#### Architecture Documents (Highest Priority)

| Document | Conflict Level | Changes Needed |
|----------|---------------|----------------|
| `starter-template-evaluation.md` | **High** | Replace Lit+Tauri with React+Electron |
| `implementation-patterns-consistency-rules.md` | **High** | Replace Lit naming, Shoelace refs, Signals state mgmt |
| `project-structure-boundaries.md` | **High** | Replace entire frontend directory structure |
| `project-context-analysis.md` | **Medium** | Update technical constraints table |
| `core-architectural-decisions.md` | **Low** | Minimal — mostly backend/data decisions |
| `architecture-tool-execution-layer.md` | **Medium** | Update Pattern 7 (frontend rendering), file paths, boundary diagram |

#### PRD Documents

| Document | Conflict Level | Changes Needed |
|----------|---------------|----------------|
| `desktop-app-specific-requirements.md` | **Medium** | Tauri→Electron, Lit→React |
| `project-scoping-phased-development.md` | **Low** | Update risk mitigation (Tauri→Electron) |
| All other PRD sections | **None** | Technology-agnostic |

#### UX Documents

| Document | Conflict Level | Changes Needed |
|----------|---------------|----------------|
| `ux-pattern-analysis-inspiration.md` | **Low** | Acknowledge Electron anti-pattern trade-off |
| `ux-consistency-patterns.md` | **Low** | Replace Shoelace component references |

### Technical Impact

- **Code:** Migration already in progress — all frontend components being rewritten in React
- **Infrastructure:** `electron-builder.yml` replaces `tauri.conf.json`
- **Build pipeline:** `npm run build` + `electron-builder` replaces `tauri build`
- **Go sidecar bundling:** Electron bundles Go binary as external resource instead of Tauri's `externalBin`
- **Testing:** `@open-wc/testing` (Lit) replaced with React testing patterns (React Testing Library, Vitest)

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

Update all planning artifacts to reflect the React + Tailwind + Electron stack. No rollback, no MVP scope change.

### Rationale

1. **Migration is already done** — the code has been rewritten; artifacts should match reality
2. **Remaining epics (4-7) need accurate references** — developers implementing these stories need correct component names, patterns, and file paths
3. **Zero functional impact** — every FR and NFR remains achievable with React/Electron
4. **Low effort** — document updates only, no code changes
5. **Low risk** — changes are descriptive, reflecting what already exists

### Effort Estimate: Low

- Architecture docs: ~2 hours of updates
- PRD docs: ~30 minutes
- Epic docs (backlog): ~1 hour
- UX docs: ~30 minutes

### Risk Assessment: Low

- No functionality changes
- No new technical risks beyond standard Electron considerations (bundle size, memory)
- Electron is a proven desktop app framework (VS Code, Slack, Discord)

### Trade-offs Acknowledged

| Concern | Mitigation |
|---------|------------|
| Electron bundle size (larger than Tauri) | Acceptable for desktop app; optimize with tree-shaking |
| Electron memory usage | React virtualization for long lists, lazy loading |
| Electron security model differs from Tauri | Follow Electron security best practices (contextIsolation, nodeIntegration: false) |
| Loss of Tauri's auto-updater | Electron has mature auto-update via `electron-updater` |

---

## Section 4: Detailed Change Proposals

### Architecture Documents

#### A1: `architecture/starter-template-evaluation.md`

**Section:** Primary Technology Domain + Selected Approach

OLD:
> **Desktop Application** — Tauri shell + Go backend sidecar + Lit frontend
> **Selected Approach: Vite Lit-TS + Tauri**
> npm create vite@latest bmad-studio -- --template lit-ts
> npm install lit @shoelace-style/shoelace @lit-labs/signals @lit-labs/context

NEW:
> **Desktop Application** — Electron shell + Go backend sidecar + React frontend
> **Selected Approach: Vite React-TS + Electron**
> Initialized with Vite React-TS template, Tailwind CSS, electron-builder
> Go sidecar bundled as external resource via electron-builder

**Rationale:** Original stack replaced for improved developer experience. Larger React ecosystem enables faster development of remaining 4 epics.

---

#### A2: `architecture/implementation-patterns-consistency-rules.md`

**Section:** Naming Conventions

OLD:
> | **Lit components** | `kebab-case` tag, `PascalCase` class | `<phase-node>`, `class PhaseNode` |
> | **CSS custom props** | `--bmad-{category}-{name}` | `--bmad-color-accent` |

NEW:
> | **React components** | `PascalCase` file + component | `PhaseNode.tsx`, `ChatPanel.tsx` |
> | **Styling** | Tailwind utility classes | `className="flex items-center gap-2"` |

**Section:** State Management

OLD:
> ## State Management (Lit Signals)
> - Signal naming: `{noun}State` for stores, `{noun}$` for derived
> - Immutable updates: `signal.value = [...signal.value, newItem]`

NEW:
> ## State Management (React)
> - Zustand stores in `src/stores/` for global state
> - React hooks in `src/hooks/` for shared logic
> - Component-local state via `useState`/`useReducer`

**Rationale:** Reflects actual technology in use. Guides AI agents implementing Epics 4-7.

---

#### A3: `architecture/project-structure-boundaries.md`

**Section:** Complete Project Directory Structure

Replace the entire frontend section to match current React/Electron layout:
- `src/app-shell.ts` → `src/App.tsx`
- `src/components/core/` → `src/components/` (React component folders)
- `src/state/` → `src/stores/` (Zustand)
- `src/styles/tokens.css`, `shoelace-theme.css` → `src/styles/globals.css` + Tailwind config
- `src-tauri/` → `electron/`
- `tests/frontend/` → React Testing Library patterns

**Section:** Architectural Boundaries

OLD:
> | **Tauri ↔ Frontend** | WebView loads frontend; minimal Rust IPC |
> | **Tauri ↔ Backend** | Tauri spawns Go binary as sidecar |

NEW:
> | **Electron ↔ Frontend** | BrowserWindow loads frontend; IPC via contextBridge |
> | **Electron ↔ Backend** | Electron spawns Go binary as child process |

**Rationale:** Directory structure is a primary reference for all implementation work.

---

#### A4: `architecture/project-context-analysis.md`

**Section:** Technical Constraints & Dependencies

OLD:
> | **Lit + Signals frontend** | UX Spec | Component architecture, state management pattern |
> | **Tauri packaging** | PRD | IPC layer, desktop integration, build pipeline |

NEW:
> | **React + Tailwind frontend** | Migration decision | Component architecture, state management pattern |
> | **Electron packaging** | Migration decision | IPC layer, desktop integration, build pipeline |

---

#### A5: `architecture-tool-execution-layer.md`

**Section:** Pattern 7 (Frontend Tool Block Rendering)

OLD:
> - Component: `<tool-call-block>` in `src/components/core/chat/tool-call-block.ts`
> - Each block: collapsible `<sl-details>` — expanded while running

NEW:
> - Component: `<ToolCallBlock>` in `src/components/chat/ToolCallBlock.tsx`
> - Each block: collapsible details component — expanded while running

**Section:** Boundary Diagram

> Frontend (Lit) → Frontend (React)

**Section:** Modified Files table — update frontend file paths

---

### PRD Documents

#### P1: `prd/desktop-app-specific-requirements.md`

**Section:** Technical Architecture

OLD:
> - **Frontend:** Lit + Signals (Vite dev server port 3007, proxied in dev)
> - **Packaging:** Tauri (Rust shell wrapping the web UI)

NEW:
> - **Frontend:** React + Tailwind (Vite dev server port 3007, proxied in dev)
> - **Packaging:** Electron (via electron-builder)

**Section:** Update Strategy

OLD:
> **Post-MVP:** Auto-update via Tauri's built-in updater (nice-to-have)

NEW:
> **Post-MVP:** Auto-update via Electron's electron-updater (nice-to-have)

---

#### P2: `prd/project-scoping-phased-development.md`

**Section:** Risk Mitigation Strategy

OLD:
> - Tauri + Go + Lit integration complexity → Spike early, validate architecture before full build

NEW:
> - Electron + Go + React integration complexity → Validated via migration; proven stack

**Section:** Post-MVP Features

OLD:
> - Auto-update via Tauri updater

NEW:
> - Auto-update via Electron updater

---

### Epic Documents

#### E1-E4: Backlog Epics (4-7)

For each backlog epic, update:
- Lit component tag references → React component names
- Shoelace component references → React/Tailwind equivalents
- State management references (Signals → Zustand/hooks)
- File path references to match new structure

#### E5: Done Epics (0-3)

Add a note at the top of each completed epic:

> **Technology Note (2026-02-12):** Implementation technology migrated from Lit/Tauri/Shoelace to React/Electron/Tailwind during the Epic 3→4 gap. Story acceptance criteria accurately describe delivered behavior. Technology-specific references (component names, framework patterns) reflect the original Lit stack but the functionality has been re-implemented in React.

---

### UX Documents

#### U1: `ux-pattern-analysis-inspiration.md`

Update anti-patterns table — replace "Electron bloat" with a note acknowledging the trade-off:

> **Note:** Migrated to Electron for developer experience benefits. Bundle size and memory trade-offs mitigated via Vite tree-shaking, React lazy loading, and component virtualization. Performance NFRs (100ms UI interactions) remain the target.

#### U2: `ux-consistency-patterns.md`

Replace Shoelace-specific references:
- `sl-color-picker` → React color picker component
- `sl-details` → Collapsible/Accordion component

---

## Section 5: Implementation Handoff

### Change Scope: Moderate

Documentation updates across multiple planning artifacts. No code changes needed (migration already in progress).

### Handoff Recipients

| Role | Responsibility |
|------|---------------|
| **Developer (Flow)** | Execute document updates; verify React migration completeness |
| **Architect (agent)** | Validate architecture doc updates maintain coherence |
| **SM (agent)** | Update sprint status if needed; verify epic doc accuracy |

### Action Plan

1. **Immediate:** Update architecture documents (highest priority — these guide implementation)
2. **Next:** Update PRD documents (desktop requirements, scoping)
3. **Then:** Update backlog epic documents (4-7)
4. **Then:** Add historical notes to done epic documents (0-3)
5. **Finally:** Update UX documents

### Success Criteria

- [ ] All architecture documents reference React/Electron/Tailwind (not Lit/Tauri/Shoelace)
- [ ] Project structure document matches actual `src/` and `electron/` layout
- [ ] Backlog epic stories use correct React component names and patterns
- [ ] Done epics have migration context note
- [ ] PRD technical sections reference Electron (not Tauri)
- [ ] No broken references to deleted files or obsolete patterns

---

**Proposal Status:** Ready for review
**Generated by:** Correct Course Workflow (2026-02-12)
