# Detailed User Experience

## Defining Experience

**The Core Interaction:**

> "Open the app → see exactly where you were → continue in under 60 seconds"

This is the **Instant Resume** moment. If we nail this, everything else follows.

**How Alex describes it:**
> "It's like Lazygit but for BMAD workflows. I open it, see my phase graph, start a fresh conversation, inject the Insights from my last session, and I'm productive in under a minute."

## User Mental Model

**Current pain (CLI BMAD):**
- Digs through `_bmad-output/` folders to remember state
- Re-reads artifacts to reconstruct context
- Starts new agent conversation, re-explains everything
- Mental overhead tracking phase across multiple projects

**Expected experience (BMAD Studio):**
- Visual state that survives sessions (phase graph)
- Accumulated knowledge that survives sessions (Insights)
- Start fresh with context injection in < 60 seconds
- Conversations are working sessions, Insights are the memory

**Frustration moments to eliminate:**
- "I know I discussed this architecture decision somewhere..."
- "Which workflow was I in for the client project?"
- "The agent doesn't know about the PRD we finalized last week"

## Success Criteria

| Criteria | Target |
|----------|--------|
| **Resume Speed** | < 60 seconds from app open to productive work |
| **Context Recognition** | Phase graph shows current workflow at a glance |
| **Knowledge Access** | Find relevant Insight in < 3 clicks |
| **Project Switching** | Full context switch in < 2 seconds |
| **Context Injection** | Attach Insights and start productive conversation in < 30 seconds |

## Novel UX Patterns

| Component | Pattern Type | Design Approach |
|-----------|--------------|-----------------|
| **Phase Graph** | Novel | Detailed workflow nodes, expandable dev loop, dependency arrows |
| **Insight System** | Novel | Structured knowledge extraction, library browsing, context injection |
| **Context Indicator** | Novel-ish | Gas gauge metaphor for conversation capacity with color thresholds |
| **Highlight-to-Extract** | Novel | In-conversation text highlighting with color-coded semantic meaning, feeds extraction agent |
| **Compact/Discard Lifecycle** | Novel-ish | Three-part conversation endpoint with Insight extraction |
| **Command Palette** | Established | Raycast/VS Code pattern |
| **Panel Layout** | Established | Lazygit/VS Code dense panels |

## Experience Mechanics: Phase Graph

**Graph Structure (Detailed View)**

All workflows shown as nodes, organized by phase:

```
ANALYSIS          PLANNING              SOLUTIONING              IMPLEMENTATION
┌─────────┐      ┌─────────┐           ┌─────────────┐          ┌──────────────┐
│Research │─────▶│  PRD    │─────┬────▶│Architecture │────┬────▶│Sprint Planning│
└─────────┘      └─────────┘     │     └─────────────┘    │     └──────────────┘
     │                │          │            │           │            │
     ▼                ▼          │            ▼           │            ▼
┌─────────┐      ┌─────────┐    │     ┌─────────────┐    │     ┌────────────────┐
│ Brief   │      │UX Design│────┘     │Epics/Stories│────┤     │   DEV LOOP     │
└─────────┘      └─────────┘          └─────────────┘    │     │  ┌──────────┐  │
                  (optional)                 │           │     │  │  Story   │  │
                                            ▼           │     │  └────┬─────┘  │
                                    ┌─────────────┐     │     │       ▼        │
                                    │ Readiness   │─────┘     │  ┌──────────┐  │
                                    │   Check     │           │  │   Dev    │  │
                                    └─────────────┘           │  └────┬─────┘  │
                                      [GATE]                  │       ▼        │
                                                              │  ┌──────────┐  │
                                                              │  │  Review  │──┤
                                                              │  └──────────┘  │
                                                              │       │ ↺      │
                                                              └───────┴────────┘
```

**Node States:**

| State | Visual | Meaning |
|-------|--------|---------|
| Empty | Outline only | Not started |
| Partial fill | Half-filled | In progress |
| Full fill | Solid | Complete |
| Highlighted | Accent color border | Current position |
| Dimmed | Muted colors | Available, not started |
| Locked | Lock icon, grayed | Dependencies not met |

**Phase 4 Expansion:**

When user is in Implementation phase, the dev loop expands to show:
- Current story in cycle
- Story → Dev → Review loop visualization
- Sprint progress indicator
- "Continue dev" / "Next story" / "Review" actions

**TestArch:** Hidden by default. Power users can toggle visibility in settings or via command palette.

**Branching Visualization:**

- PRD → UX Design path shown as optional branch (dashed line or "recommended" label)
- PRD → Architecture direct path shown as alternative
- User's chosen path highlighted, other dimmed

## Experience Mechanics: Instant Resume Flow

Two modes: **same session** (app backgrounded) restores exact state. **New session** (app was closed) uses phase graph + Insights as anchors.

**1. App Open (New Session)**

| State | What User Sees |
|-------|----------------|
| **Single project** | Full phase graph + current node highlighted |
| **Multiple projects** | Project list with mini phase indicators, most recent first |
| **Mid-workflow** | Phase graph highlights current node + Insight injection suggested |
| **In dev loop** | Expanded loop view + current story + sprint progress |

**2. Getting Productive**

| Input | Result |
|-------|--------|
| Click highlighted node | Start new conversation with that workflow's agent |
| Press `r` (global) | Start conversation with last workflow's agent |
| Click any node | Navigate to that workflow (if unlocked) |
| Cmd+K → workflow name | Fuzzy search to any workflow |
| Open Insight library | Browse accumulated knowledge from prior sessions |

**3. Feedback**

| Type | Implementation |
|------|----------------|
| **Visual** | Current node pulses or has accent border |
| **Context** | Insight library shows accumulated knowledge from prior work |
| **Progress** | Node fill level shows workflow completion |
| **Dependencies** | Locked nodes show what's needed to unlock |

**4. Completion**

| Indicator | Meaning |
|-----------|---------|
| Node fills completely | Workflow done, artifact produced |
| Next nodes unlock | Dependencies satisfied |
| Graph animates transition | Visual confirmation of progress |
| Insight created | Reasoning behind artifact captured for future use |

## BMAD Workflow Reference

**Phase 1: Analysis**
- Research → Product Brief → [Gate]

**Phase 2: Planning**
- PRD (create/validate/edit)
- [Optional branch] UX Design (recommended for UI products)

**Phase 3: Solutioning**
- Architecture ← requires PRD
- Epics & Stories ← requires Architecture
- Implementation Readiness Check [GATE: pass/fail]

**Phase 4: Implementation**
- Sprint Planning (once)
- Dev Loop: Create Story → Dev Story → Code Review → Sprint Status (repeat)
- Correct Course (if needed)
- Retrospective (per epic)

**Agent Assignments:**

| Phase | Primary Agent |
|-------|---------------|
| Analysis | Analyst (Mary) |
| Planning | PM (John), UX Designer (Sally) |
| Solutioning | Architect (Winston), PM |
| Implementation | SM (Bob), Dev (Amelia) |
