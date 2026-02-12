# Core User Experience

## Defining Experience

**Core Interaction:** "Switch to a stream and immediately know what to do next."

Every other interaction in the product serves this moment. The phase graph loads, Alex's brain clicks into place — "I'm in Solutioning, architecture is done, epics are next, John is up" — and he either clicks the next workflow node or reviews a past artifact. If that moment is instant and clear, the product works. If it requires scanning, reading, or remembering, it fails.

**The Core Loop:**

1. Open app → see multi-stream dashboard ("morning coffee" view)
2. Click into a stream → phase graph loads as the resume screen
3. Orient: phase containers show progress, workflow nodes show what's done/active/next, agent badges show who's at the controls
4. Act: click a workflow node to launch an OpenCode session or view an artifact
5. Work: conversation-dominant layout for 5-45 minute stretches with the BMAD agent
6. Complete: artifact saved, phase graph updates, return to orientation view

**Two-Level Phase Graph — The Product's Signature Element:**

The BMAD methodology topology reveals that the phase graph is not a simple linear pipeline. It's a two-level visualization:

- **Level 1: Phase containers** — Analysis (optional), Planning, Solutioning, Implementation. Displayed as horizontal swim lanes or columns. Each shows aggregate status (not started / in progress / complete).
- **Level 2: Workflow nodes inside phases** — Each node represents a specific BMAD workflow (brainstorm, create-prd, create-architecture, dev-story, etc.) with its assigned agent, output artifact, and status. Nodes have conditions (optional, conditional gates like "Has UI?"), and arrows show artifact flow between workflows.

**Flow Templates determine graph topology:**

- **Full Flow:** All 4 phases with all workflow nodes. The complete methodology pipeline.
- **Quick Flow:** Parallel track — Barry runs quick-spec → quick-dev. Two nodes, no planning phases. For small, well-understood changes.
- **Custom (future):** User-configured phase/workflow selection.

**Agent Assignment is Visible Context:**

Each workflow node shows its assigned BMAD agent (Mary for analysis, John for planning, Winston for architecture, Bob for sprint planning, Amelia for dev/review, Barry for quick flow). When Alex clicks a workflow node, the correct agent and skill are loaded automatically — no manual agent selection.

**Context Flow as Pre-Launch Confidence:**

Each workflow node shows (on hover or in a detail panel) which artifacts it will consume as context. Example: `create-story` loads epics, PRD, architecture, UX spec. This answers "does the agent have the context it needs?" before launching, preventing the frustrating discovery mid-session that critical upstream decisions weren't loaded.

## Platform Strategy

**Platform:** Electron desktop application (macOS primary, Linux supported, Windows deferred).

**Input model:** Hybrid — click-first for the phase graph (inherently spatial/visual), keyboard-first (`Cmd+K` command palette) for everything else (switch stream, switch project, search artifacts, quick actions). The phase graph is a cockpit you look at; the command palette is how you navigate between cockpits.

**Technical stack:** Go backend (port 3008), React + Tailwind frontend, native chat UI powered by OpenCode SDK + SSE for AI sessions. Central artifact store at `~/.bmad-studio/projects/`.

**Display:** Dark mode only for MVP. Optimized for typical developer monitor sizes (13" laptop to 27" external). The two-level phase graph needs horizontal space — wide viewport is the primary design target.

## Effortless Interactions

1. **Stream switching is instant.** Click a stream → phase graph loads → orientation in under 2 seconds. Always resets to the phase graph home view (not last-viewed artifact). The phase graph IS the resume screen. A subtle "last viewed" indicator on the relevant workflow node provides a breadcrumb for those who want to jump back.

2. **Workflow launching is one click.** Click a workflow node on the phase graph → view transitions to conversation-dominant layout → OpenCode session starts with the correct agent, skill, working directory, and upstream artifact context pre-loaded. Zero configuration by the user.

3. **Stream creation is fast but structured.** Linear-style modal: name → flow template (Full Flow / Quick Flow) → confirm. Three inputs, no wizard chrome. Template selection determines the phase graph topology — which phases, which workflow nodes, which agents.

4. **Phase graph updates itself.** When an OpenCode session produces an artifact, the corresponding workflow node updates to "complete" and the artifact becomes viewable. No manual status tracking.

5. **Navigation between cockpits via Cmd+K.** Switch streams, switch projects, search artifacts, launch workflows — all from the command palette. The phase graph is visual-first; everything else is keyboard-first.

## Critical Success Moments

1. **The 60-Second Resume (make-or-break).** Alex opens a stream he hasn't touched in two weeks. The phase graph shows Analysis ✓, Planning ✓, Solutioning in progress — create-architecture complete (Winston), create-epics-and-stories is next (John). He sees the agent, the status, and the artifacts that exist. He clicks create-epics-and-stories and is productive immediately. If this moment requires scanning or remembering, the product has failed its core promise.

2. **First Stream for Entry Point B (first-time success).** Alex (methodology-curious) creates his first stream. He picks "Full Flow" because the description makes it sound like the right choice. The phase graph materializes — four phases, workflow nodes with agent names, a clear starting point highlighted. It looks like a map, not a checklist. He clicks the first workflow node (brainstorm with Mary) and the session launches. The methodology feels like guidance, not bureaucracy.

3. **The OpenCode Transition (seamlessness test).** Clicking a workflow node smoothly transitions to conversation-dominant layout. The phase graph collapses into a compact horizontal breadcrumb strip at the top: `Analysis ✓ → Planning ✓ → [Solutioning: create-architecture 🔵] → Implementation`. The strip provides orientation without eating screen real estate during a 45-minute session. Clicking the strip expands back to the full phase graph. This must feel like one app, not two apps stitched together.

4. **Context Confidence Before Launch.** Before clicking "Start create-story," Alex hovers the node and sees: "Will load: epics.md, PRD.md, architecture.md, ux-spec.md." He knows the agent will have the right context. This prevents the mid-session frustration of "wait, it doesn't know about my architecture decisions."

5. **The Conditional Gate.** During Planning, the "Has UI?" gate appears after create-prd completes. If yes, create-ux-design (Sally) becomes available. If no, it's skipped. The gate should feel informative, not blocking — a smart fork in the road, not a bureaucratic checkpoint.

## Experience Principles

1. **Phase Graph is Home.** Every stream interaction begins and ends at the phase graph. It's the resume screen, the orientation tool, the launch pad, and the progress tracker. When in doubt, show the phase graph.

2. **One Click to Productive.** From the phase graph to a running agent session: one click. From the dashboard to a stream's phase graph: one click. Every extra click between "I want to work on this" and "I'm working on this" is a failure.

3. **Show, Don't Gate.** The methodology is visible — phases, workflows, agents, artifacts, context dependencies — but never blocking. Users can skip workflows. The graph communicates "here's what's available" not "you must do this next." Methodology sticks because it's the shortest path, not because it's enforced.

4. **Context is Always Visible.** Which stream am I in? Which phase? Which workflow? Which agent? What artifacts exist? What context will be loaded? These questions should be answerable by looking, never by clicking or remembering.

5. **Conversation Yields to Orientation.** Active OpenCode sessions are the primary workspace during execution, but they yield to the phase graph when the user needs to orient. The breadcrumb strip maintains orientation during sessions; expanding it returns to full spatial awareness. Two modes, one continuous workspace.
