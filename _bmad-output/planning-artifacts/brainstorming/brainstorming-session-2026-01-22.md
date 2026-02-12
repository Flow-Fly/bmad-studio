---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad/context/prd.md
  - _bmad/context/bmad-studio-goals.md
  - _bmad/context/draft/lit-architecture-draft.md
  - _bmad/context/draft/go-backend-draft.md
  - _bmad/context/draft/workflow-service-draft.md
  - _bmad/context/draft/transferable-patterns.md
session_topic: 'BMAD Studio comprehensive vision refinement - UX paradigm, MVP prioritization, sidecar git architecture, mobile-first design, BMAD agent/workflow integration'
session_goals: 'Clarity on how to integrate BMAD files and agents into a visual workflow orchestration layer'
selected_approach: 'Progressive Technique Flow'
techniques_used:
  - "Phase 1: First Principles + What If Scenarios"
  - "Phase 2: Morphological Analysis"
  - "Phase 3: Six Thinking Hats"
  - "Phase 4: Decision Tree + Constraint Mapping"
ideas_generated: 90
session_status: COMPLETE
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Carson (Brainstorming Coach)
**Participant:** Flow
**Date:** 2026-01-22
**Status:** COMPLETE

## Session Overview

**Topic:** BMAD Studio comprehensive vision refinement — UX paradigm decisions, MVP feature prioritization, sidecar git architecture, mobile-first workflow design, and BMAD file/agent integration

**Goals:** Achieve clarity on how to integrate BMAD files and agents into a visual workflow orchestration layer that feels natural and powerful

### Context Documents Loaded
- PRD: BMAD Studio (Phase 1 MVP spec)
- BMAD Studio Goals (Automaker pattern study objectives)
- Draft: Lit architecture concepts
- Draft: Go backend concepts
- Draft: Workflow service design
- Draft: Transferable patterns from Automaker

### Session Approach
**Progressive Technique Flow** — Start with broad divergent exploration, then systematically narrow through structured analysis to actionable clarity.

---

## Phase 1: Expansive Exploration (COMPLETE)

**Technique:** First Principles Thinking + What If Scenarios
**Result:** 90 ideas generated across 10 categories

### Categories Explored

| Category | Ideas | Key Insights |
|----------|-------|--------------|
| Core Vision & Access | #1-7 | Democratize BMAD, conversation lineage, decision archaeology |
| Control & Automation | #8-11 | Human-at-gates, auto-mode with epic boundaries, control dial |
| Space & Metaphor | #12-18 | Orchestration layer, worktrees as universes, reality health |
| Agent Integration | #19-26 | Always-available agents, menus as node spawners, party mode |
| Time & History | #27-34 | Timelapse view, course correction nodes, decision replay |
| Knowledge & Storage | #35-42 | Reasoning as knowledge base, queryable history, pattern extraction |
| Git Workflow | #43-47 | Hierarchical branching, epic-level simplification, idea capture |
| UX Foundations | #48-73 | Two paradigms, progressive crystallization, expansion patterns |
| Visual Design | #74-78 | Neo-brutalist, floaty cards, typography-driven |
| Error & Edge Cases | #79-90 | Graceful degradation, recovery options, offline mode |

### Phase 1 Key Decisions

1. **Two-Paradigm UI Model**: Node Graph for Planning (Phases 1-3), Kanban for Implementation (Phase 4)
2. **Progressive Node Crystallization**: Ghost → Solid → Ported as conversation progresses
3. **Emergent Workflow**: Nodes spawn from agent conversations, not pre-designed by user
4. **Node-Expansion for Conversations**: Click node to expand, immersive focus, must escape to navigate
5. **Neo-Brutalist Visual Language**: Clean, typography-driven, color = meaning

### Core Vision Statement (Phase 1)

> **BMAD Studio is an orchestration layer you inhabit, not a tool you use.**
>
> Worktrees are parallel realities. Conversations with agents organically spawn nodes that record your decision journey. The workflow graph emerges from your choices — you don't design it, you discover it. Planning is creative and immersive (node graph), implementation is structured and actionable (kanban).

---

## Phase 2: Morphological Analysis (COMPLETE)

**Technique:** Systematic parameter combination mapping
**Result:** 6 dimensions mapped, key journeys traced, gaps resolved

### Dimensions Mapped

| # | Dimension | Values |
|---|-----------|--------|
| D1 | Project State | Empty / Brownfield / Existing BMAD |
| D2 | Workflow Mode | Full Flow / Quick Flow |
| D3 | Automation Level | Manual / Gates / Epic-Auto / YOLO |
| D4 | View Mode | Planning (Nodes) / Implementation (Kanban) / Multiverse (Git+Knowledge) |
| D5 | Conversation State | Ghost / Active / Solid / Ported |
| D6 | Multiverse Focus | Worktrees / Knowledge Repo / Split |

### Three-Paradigm UI Model (Updated)

```
┌─────────────────────┬───────────────────┬───────────────────────┐
│   PLANNING          │   IMPLEMENTATION  │   MULTIVERSE          │
│   (Node Graph)      │   (Kanban)        │   (Git + Knowledge)   │
├─────────────────────┼───────────────────┼───────────────────────┤
│ Phases 1-3          │ Phase 4           │ Always available      │
│ Emergent flow       │ Story execution   │ Navigation & memory   │
│ Conversations →     │ Workflow chains   │ Worktrees + Knowledge │
│ nodes               │                   │ repo                  │
└─────────────────────┴───────────────────┴───────────────────────┘
```

### Architectural Decisions

#### Decision: View Switching
- **Resolution:** Top bar icons + `Cmd+1/2/3` keyboard shortcuts
- **Rationale:** Left rail for spatial hierarchy (projects/worktrees), top bar for mode switching

#### Decision: Knowledge Location — Symlink Strategy
- **Resolution:** `_bmad/` shared via symlink, `_bmad-output/` per-worktree via symlink
- **Rationale:** Users want clean project repos but versioned knowledge. Symlinks serve UX preference.

```
/documents/projects/myProject/          /bmad/project-knowledge/
├── _bmad → symlink ──────────────────→ myProject/_bmad/
├── _bmad-output → symlink ───────────→ myProject/main/_bmad-output/
└── src/

When in worktree "auth-feature":
├── _bmad → symlink ──────────────────→ myProject/_bmad/  (SHARED)
├── _bmad-output → symlink ───────────→ myProject/auth-feature/_bmad-output/
```

#### Decision: Worktree Knowledge — Branch Approach
- **Resolution:** Planning docs (`_bmad/`) shared, outputs (`_bmad-output/`) branched per worktree
- **Rationale:** PRD/Architecture are source of truth; implementation outputs are the divergent work

#### Decision: Workflow Upgrade Path
- **Resolution:** User can invoke ANY agent (Analyst, PM, Architect, etc.) when scope grows
- **Mechanism:** Spawn new node with prior conversation context injected
- **Rationale:** Quick Flow → Full Flow isn't fixed path; user picks what's missing

#### Decision: Brownfield Detection
- **Resolution:** 2-of-3 signals required: package file, git history (>5 commits), source files (>10)

```
if (has _bmad folder) → "Existing BMAD"
else if (2+ signals present) → "Brownfield"
else → "Empty"
```

### User Journeys Traced

**Journey A: Greenfield Full Flow**
Empty → Planning → Conversations → Nodes solidify → Implementation → Multiverse for worktree management

**Journey B: Brownfield Quick Capture**
Existing code → Quick spec → Fast implementation → Optional upgrade to Full Flow if scope grows

**Journey C: Knowledge Miner**
Browse cross-project patterns → Apply to current work → Informed by past decisions

### Gaps Resolved

| Gap | Resolution |
|-----|------------|
| G1: View transitions | Top bar icons + keyboard shortcuts |
| G2: Automation changes | Allowed mid-epic, affects queue behavior |
| G3: Knowledge location | Symlinks + branch approach |
| G4: Quick Flow specifics | Skips Brief/PRD/Architecture; upgrade path defined |
| G5: Brownfield detection | 2-of-3 signal logic |

---

## Phase 3: Six Thinking Hats (COMPLETE)

**Technique:** Multi-perspective stress testing
**Result:** All concepts validated with risks identified and mitigations defined

### White Hat (Facts & Data)

| Concept | Known Facts | Assumptions to Validate |
|---------|-------------|------------------------|
| Three-Paradigm UI | Users switch mental modes between planning/execution | Three modes won't feel fragmented |
| Symlink Architecture | BMAD uses `{project-root}` templating | Windows handling won't be blocker |
| Node Crystallization | Ghost→Solid concept validated in Phase 1 | Port appearance timing is clear |
| Workflow Upgrade | User chooses ANY agent, not fixed path | Context summary sufficient for target agent |

### Red Hat (Emotions & Intuition)

**Feels RIGHT:**
- Multiverse view is exciting — "command center for parallel realities"
- Ghost nodes feel mysterious and alive
- "Expand to Full Flow" feels empowering

**Feels UNCERTAIN:**
- Symlinks feel fragile
- Three views might feel disjointed

### Black Hat (Risks & Mitigations)

| Risk | Mitigation |
|------|------------|
| Symlink Fragility | Validate on project open, clear error + one-click repair |
| Three-View Cognitive Load | Strong visual differentiation, persistent breadcrumb |
| Node Crystallization Timing | Clear visual states, explicit "Finalize" option, auto-save |
| Knowledge Repo Bloat | Archive after merge, periodic cleanup prompts |
| Workflow Upgrade Context Loss | Include FULL conversation, architect confirms understanding |

### Yellow Hat (Benefits)

| Concept | Primary Value |
|---------|---------------|
| Three-Paradigm UI | Mental model matches workflow phase |
| Multiverse View | Git becomes approachable, even exciting |
| Symlink Architecture | Agents work unchanged, knowledge portable |
| Node Crystallization | Progress visible, commitment clear |
| Workflow Upgrade | No penalty for starting small |

### Green Hat (Alternatives Considered)

- **Virtual File System** instead of symlinks — save for v2 if symlinks problematic
- **Unified Canvas with Layers** — interesting but three views cleaner for MVP
- **Card States** instead of crystallization — loses the "emerging" magic
- **Parallel Tracks** instead of upgrade — power user feature for later

### Blue Hat (Process Reflection)

- **Core value:** Orchestration + Lineage
- **MVP scope risk:** Multiverse adds complexity, keep tight
- **Biggest unknown:** Symlink reliability needs technical spike

### Stress Test Verdict

| Concept | Survives? | Key Risk |
|---------|-----------|----------|
| Three-Paradigm UI | ✅ YES | Cognitive load — need strong visual differentiation |
| Symlink Architecture | ✅ YES | Fragility — validate on open, easy repair |
| Node Crystallization | ✅ YES | Timing clarity — clear visual states essential |
| Workflow Upgrade | ✅ YES | Context completeness — include full conversation |
| Knowledge Repo | ✅ YES | Bloat — need archive/cleanup strategy |

---

## Phase 4: Decision Tree + Roadmap (COMPLETE)

**Technique:** Dependency mapping, constraint analysis, implementation sequencing
**Result:** MVP scope defined, build order established, critical path identified

### MVP Scope Tiers

#### MVP v0.1 — "It Works" (10 weeks)

| Feature | Status |
|---------|--------|
| Project State Detection | ✅ Included |
| Planning View (Nodes) | ✅ Included |
| Node Crystallization | ✅ Included |
| Agent Conversations | ✅ Included |
| Basic Worktree Awareness | ✅ Included |
| Implementation View (Kanban) | ⚠️ Minimal |
| Multiverse View | ❌ Deferred |
| Knowledge Repo (external) | ❌ Deferred |
| Symlink Architecture | ❌ Deferred |

**MVP Principle:** Planning View + Agents + Basic Kanban. Prove the node graph is magical.

#### v0.2 — "It's Powerful" (+6 weeks)

- Full Kanban (Story Chain)
- Multiverse View
- Symlink Architecture
- Workflow Upgrade Path
- Knowledge Repo Browse
- Manual + Gates automation

#### v1.0 — "It's Complete" (+8 weeks)

- All Automation Levels (including YOLO)
- Knowledge Graph View (Obsidian-style)
- Cross-Project Patterns
- Epic Completion Workflows
- Course Correction Nodes
- Timelapse View

### Implementation Sequence (MVP)

```
WEEK 1-2: Foundation
├── Project scaffolding (Lit + Go backend)
├── Project state detection (G5 logic)
├── Basic routing (which view to show)
└── BMAD integration spike (can we spawn agents?)

WEEK 3-4: Planning View Core
├── Canvas component (pan, zoom)
├── Node component (ghost state)
├── Agent conversation panel
├── Node solidification (on output)
└── Port appearance (on completion)

WEEK 5-6: Agent Integration
├── Agent spawning from UI
├── Conversation streaming
├── Output capture (md files created)
├── Node-to-file linking
└── Basic persistence (what nodes exist)

WEEK 7-8: Implementation View (Minimal)
├── Story list from epics
├── Status indicators
├── Action buttons (create/dev/review)
├── Side panel for details
└── View switching (Planning ↔ Implementation)

WEEK 9-10: Polish + Testing
├── Error states (agent failure, etc.)
├── Onboarding flow (empty project)
├── Visual polish (neo-brutalist style)
└── User testing feedback loop
```

### Critical Path

```
Agent Spawning ──► Conversation Capture ──► Node Creation
      │                    │                     │
      ▼                    ▼                     ▼
 "Can we talk       "Do we get the      "Does the graph
  to BMAD?"          outputs?"           feel magical?"
```

### Technical Spikes (Risk-Ordered)

| Spike | Question | Success Criteria |
|-------|----------|------------------|
| Spike 1 | Can we spawn BMAD agents from Go backend? | Agent responds, conversation streams |
| Spike 2 | Can we detect when agent writes files? | File creation triggers event to UI |
| Spike 3 | Does Lit canvas perform with 50+ nodes? | Smooth pan/zoom, no jank |
| Spike 4 | Can we intercept agent menu choices? | Know when user picks "Create PRD" |

---

## Final Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BMAD STUDIO ROADMAP                               │
├──────────────┬──────────────────────────────────────────────────────────────┤
│   MVP v0.1   │  Planning View + Node Crystallization + Basic Kanban        │
│   (10 weeks) │  → Prove the magic                                          │
├──────────────┼──────────────────────────────────────────────────────────────┤
│   v0.2       │  + Multiverse View + Symlink Architecture + Workflow Upgrade│
│   (+6 weeks) │  → Add the power                                            │
├──────────────┼──────────────────────────────────────────────────────────────┤
│   v1.0       │  + Knowledge Graph + Full Automation + Timelapse            │
│   (+8 weeks) │  → Complete the vision                                      │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## Session Artifacts

### Design Preferences Observed (Flow)

1. **Simplicity over flexibility** — Consistently chose simpler, more constrained paths
2. **Leverage, don't reinvent** — Orchestrate existing tools (BMAD, Wispr Flow), don't rebuild
3. **Friction as feature** — Intentional constraints that protect focus

### Key Tensions Navigated

| Tension | Resolution |
|---------|------------|
| Node crystallization: at start vs at end? | Hybrid: Ghost at start, solid at output, ports at completion |
| Same UX for planning vs implementation? | No: Node graph (immersive) vs Kanban (quick review) |
| Conversation: immersive vs glanceable? | Depends on mode: Expansion for planning, side panel for kanban |
| Worktree creation: manual vs automatic? | Triggered: Created when md file crystallizes from conversation |
| Knowledge in project vs external? | External by default (symlinks), user can choose local |

### Unresolved / Future Exploration

- Mobile/VPS "code from your phone" — Trust/security concerns noted, not explored
- Party Mode visualization — Mentioned as "multi-agent node" but not detailed
- Specific BMAD file mapping — Which files trigger which UI states
- Knowledge graph connections — Obsidian-style linking for v1.0

---

## Architecture Addendum: BMAD Menu System Discovery

**Discovery Date:** 2026-01-22 (post-session exploration)

### Key Finding: Menus Are Already Structured

BMAD agent files contain **structured XML** defining menus, not just text output. Example from `pm.md`:

```xml
<menu>
  <item cmd="CP or fuzzy match on create-prd"
        exec="{project-root}/_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md">
    [CP] Create Product Requirements Document (PRD)
  </item>
  <item cmd="ES or fuzzy match on epics-stories"
        exec="{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md">
    [ES] Create Epics and User Stories from PRD
  </item>
</menu>
```

### Handler Types (from `agent-menu-patterns.md`)

| Handler | Meaning | Studio Action |
|---------|---------|---------------|
| `exec="path.md"` | Execute workflow markdown file | Load file, run workflow |
| `workflow="path.yaml"` | Execute via workflow.xml engine | Load YAML, run structured workflow |
| `action="#prompt-id"` | Run referenced prompt | Send prompt to agent |
| `action="inline text"` | Simple instruction | Send to agent |
| `data="path"` | Pass data file to workflow | Load and inject |

### Reserved Menu Codes (Auto-Injected)

- `MH` - Menu Help (redisplay)
- `CH` - Chat with agent
- `PM` - Party Mode
- `DA` - Dismiss Agent

### How It Works Today vs. BMAD Studio

**Current Flow (Claude Code CLI):**
```
Agent file loaded → Sent to LLM → LLM INTERPRETS XML →
LLM renders menu as text → User types "BS" or "3" →
LLM matches handler → LLM executes workflow
```

The XML is processed by the **LLM**, not the CLI. Claude Code just loads files and displays output.

**BMAD Studio Options:**

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A: LLM-Interprets** | Same as today, LLM renders text menu | Works now, no parsing | Text-based, not clickable |
| **B: Studio-Parses** | Studio parses XML, renders native buttons | Native UI, clickable | Needs XML parser |
| **C: Hybrid** | Studio parses + renders, tells LLM what was clicked | Best UX, structured handoff | More orchestration |

**Recommended: Hybrid Approach**
```
Studio loads agent file → Parses <menu> XML → Renders as clickable buttons
User clicks [CP] → Studio sends to LLM: "User selected Create PRD, handler: exec=path/to/workflow.md"
LLM receives structured input → Executes workflow with full context
```

### Workflow Execution Engine

BMAD has a central workflow engine (`workflow.xml`) that:
- Executes steps in order
- Handles user confirmation at checkpoints
- Supports YOLO mode (skip confirmations)
- Manages template outputs and variable resolution

Studio can leverage this engine directly — no need to reinvent workflow logic.

### Technical Spike Updates

| Original Spike | Original Question | Updated Answer |
|----------------|-------------------|----------------|
| Menu Detection | Parse agent text output? | **NO** — parse agent.md file XML directly |
| Choice Injection | Send "user chose 2" to agent? | **Hybrid** — extract handler, tell LLM what was selected |
| Menu Consistency | Consistent format? | **YES** — `<menu><item cmd="..." handler="...">` is standard |

### Menu Rendering Strategy (Revised)

**Key Realization:** The XML in agent files is instructions FOR the LLM. The LLM outputs TEXT, and that's all the UI layer receives. Menus can also be modified dynamically by the LLM during conversation.

**MVP Approach: RegExp Parsing**
```javascript
// Parse [XX] patterns from LLM text output
const menuPattern = /\[([A-Z]{2})\]\s*\*?\*?([^*\n]+)/g;
```
- Works with existing agents unchanged
- Catches standard BMAD menu format `[XX] Label`
- Falls back to plain text if no pattern match

**Future Approach: Structured Output Protocol**

Since agents live in `_bmad/` folder and are fully modifiable, a "BMAD Studio Edition" could enhance agents to output structured data:

```markdown
<!--BMAD_MENU
[{"code":"BS","label":"Brainstorm","handler":"exec","path":"..."}]
BMAD_MENU-->

What would you like to do?
1. [BS] Brainstorm
```

Or use tool/function calling for native menu rendering.

**The agents are local code — they can evolve with Studio.**

### Implication for Node Crystallization

With menu parsing (RegExp or structured), Studio can:
1. **Detect menu rendering** — when agent would show a menu, Studio shows buttons
2. **User clicks button** — creates visual connection in graph
3. **Extract handler** — knows exactly what workflow/action runs next
4. **On `template-output`** — solidify node (from workflow.xml pattern)
5. **On completion** — show next menu as ports

**The graph emergence is PREDICTABLE because the menu structure is known upfront.**

---

## Next Steps

1. **Architecture Document** — Extract decisions into formal architecture spec
2. **Technical Spikes** — Validate critical path unknowns (agent spawning, file detection)
3. **UX Wireframes** — Create wireframes for Planning View, node states, crystallization flow
4. **PRD Update** — Align PRD with MVP scope decisions
5. **BMAD Epics** — Create epics for MVP implementation sequence
6. **Menu Parser Prototype** — Build XML parser for agent menu extraction (new spike)
