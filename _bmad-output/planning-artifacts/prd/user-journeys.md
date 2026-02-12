# User Journeys

## Journey 1: Alex — The Methodology Adopter (Entry Point A)

**Persona:** Alex, senior developer — uses BMAD via OpenCode/Claude Code CLI, manages multiple features simultaneously across two projects

**Opening Scene:**
Alex has three features in flight: auth refactoring, payment integration, and a new dashboard widget. In his current workflow, that means six terminal tabs, three worktrees, and a mental model of which feature is in which BMAD phase. He forgot where the auth PRD left off and accidentally ran an architecture workflow against the wrong project context. First 20 minutes of every session: reconstructing state.

**Rising Action:**
Alex opens BMAD Studio. The multi-stream dashboard shows all three streams at a glance: auth is in Solutioning (architecture complete), payment is in Planning (PRD in progress), dashboard widget is in Analysis (research phase). He clicks the payment stream and the per-stream phase graph loads, showing the PRD phase highlighted as in-progress.

**Climax:**
Alex clicks "Start PRD" on the phase graph node. BMAD Studio creates an OpenCode session via SDK — right BMAD skill, right working directory, right context from prior phases — and the native chat UI appears. He picks up exactly where he left off, working directly in BMAD Studio's conversation panel with streaming messages, tool calls, and markdown rendering. When the PRD is complete, the artifact saves to the payment stream's central store folder automatically. The phase graph updates to show PRD as complete.

**Resolution:**
Alex switches to the auth stream, launches the architecture review, then checks the dashboard widget stream's research notes — all without leaving the cockpit. Each stream's worktree is ready when he needs to code. Productive in 60 seconds, not 30 minutes. The reconstruction tax drops to zero.

## Journey 2: Alex — The Methodology-Curious (Entry Point B)

**Persona:** Alex, mid-level developer — productive with AI coding tools (Cursor, Claude Code) but no structured methodology. Ships features but skips planning docs and loses context between sessions.

**Opening Scene:**
Alex has been using Claude Code daily for six months. He ships fast but keeps hitting the same pattern: he starts a feature, gets deep into implementation, realizes he missed an edge case that would have been caught by a proper architecture review, and spends two days reworking. His last three features all had this problem. He searches for "AI development workflow" and finds BMAD Studio.

**Rising Action:**
Alex installs BMAD Studio and opens his current project. He creates his first stream — "user notifications" — and the UI shows a phase graph: Analysis → Planning → Solutioning → Implementation. He's used to jumping straight to coding, but the graph makes the phases visible and approachable. He clicks "Start Analysis" and an OpenCode session launches with the brainstorming skill. He describes his feature naturally and gets structured research output he's never had before.

**Climax:**
Over several sessions, Alex progresses the notification stream through Research → PRD → Architecture → Epics. Each time he opens the stream, the phase graph shows exactly where he is and what's next. When he reaches Implementation, his epics reference decisions made in earlier phases. He catches the edge case during PRD review — the one that would have cost two days in code. The methodology didn't feel like overhead because the cockpit made it the shortest path.

**Resolution:**
Alex opens a stream he hasn't touched in two weeks. Phase graph shows exactly where he left off. Artifact viewer shows what exists. Productive in 60 seconds. He creates a second stream for his next feature — this time, he doesn't even consider skipping the planning phases. The methodology stuck because the product made it invisible.

## User Journey Lifecycle

| Stage | Experience |
|-------|------------|
| **Discovery** | Entry A: Finds BMAD Studio through BMAD community or methodology tools search. Entry B: Finds it searching for "AI development workflow" or "organize AI coding projects" |
| **Onboarding** | Connects an existing project, creates first stream, sees phase graph materialize. Entry B discovers BMAD methodology through the product — phases make sense because they're visual |
| **Core Usage** | Opens app → sees multi-stream dashboard → drills into a stream → sees phase graph → clicks next workflow → OpenCode session launches in native chat UI with right context → artifact produced → phase graph updates |
| **"Aha!" Moment #1** | Completes a full stream and sees the structured decision history: every phase, every artifact, the reasoning trail from brainstorm to shipped feature. "This is what I've been losing." |
| **"Aha!" Moment #2** | Opens a 2-week-old stream. Phase graph shows exactly where they left off. Artifact viewer shows what exists. Productive in 60 seconds. "I can't go back to reconstructing from memory." |
| **Long-term** | All projects managed through Studio. Streams are how they think about work. The methodology becomes invisible — it's just how development works. The reconstruction tax drops to zero |

## Journey Requirements Summary

| Capability | Priority | Notes |
|------------|----------|-------|
| Multi-stream dashboard | Critical | The "morning coffee" view — what needs attention across all work |
| Per-stream phase graph | Critical | Zero-reconstruction promise — look at it and know where you are |
| OpenCode session orchestration | Critical | Click a phase, OpenCode session launches with right context in native chat UI |
| Stream creation & lifecycle | Critical | Create, view, switch, archive streams |
| Worktree management | Critical | Each stream maps to a git worktree |
| Artifact organization & browsing (read-only) | Critical | View artifacts organized by stream and phase |
| Guided workflow progression | Important | Phase graph surfaces next step; clicking it launches the right session |
| Provider config sync | Important | Detect and sync OpenCode configuration |
| Stream merge & distillation | Post-MVP | Merge stream artifacts into project-level docs |
| Cost visibility | Nice-to-have | View cost data from OpenCode sessions if available |
