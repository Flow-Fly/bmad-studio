# Defining Interaction

## The Defining Experience

**"Look at the map. Click the next node. The right agent starts working."**

This is what Alex describes to a friend. Not "it manages my streams" (infrastructure). Not "it integrates with OpenCode" (plumbing). The pitch is: you see a visual map of your development work, you click the next thing, and the right AI agent launches with the right context. The reconstruction tax drops to zero.

The closest analogy: a GPS navigation system. You don't think about route calculation, satellite signals, or map rendering. You look at the screen, see where you are, and follow the highlighted path. BMAD Studio is GPS for AI-assisted development — the phase graph is the map, the highlighted node is "turn here," and clicking it starts the journey.

## User Mental Model

**What users bring to this product:**

Alex already has a mental model for structured development — it's just not formalized:

| Mental Model Element | What Alex Already Knows | How BMAD Studio Maps It |
|---------------------|------------------------|------------------------|
| **Feature branches** | Each feature gets its own branch | Each stream gets its own worktree + branch |
| **Development phases** | "I should research before I code" (but often doesn't) | Phase graph makes phases visible and launchable |
| **AI chat sessions** | One-off conversations that lose context | OpenCode sessions tied to streams that persist context |
| **Project boards** | Kanban columns showing work status | Dashboard showing streams with phase status |
| **Agent specialization** | Different prompts for different tasks | Named agents (Mary, John, Winston) assigned per workflow |

**Where the mental model is new:**

The two-level phase graph (phases containing workflow nodes) has no direct precedent in tools Alex uses today. The closest patterns:

- **CI/CD pipeline visualizations** (GitHub Actions, GitLab CI) — stages containing jobs. Alex understands this topology but associates it with automation, not interactive work.
- **Kanban boards** (Linear, Trello) — columns containing cards. Alex understands the spatial layout but expects to drag/drop, not click-to-launch.
- **Game skill trees** — branching node graphs with prerequisites. Alex understands progression and unlocking, but BMAD Studio's phases aren't gated.

The UX challenge: borrow enough from CI pipelines and Kanban that the topology feels immediately readable, but make it clear these are interactive launch points, not status cards or automated jobs.

**Where users currently struggle:**

| Current Pain | Root Cause | BMAD Studio Solution |
|-------------|-----------|---------------------|
| "Where was I on this feature?" | No persistent visual state | Phase graph shows exactly what's done, what's active, what's next |
| "Which agent/prompt do I need?" | Manual agent selection per session | Agent auto-assigned per workflow node — click and it's loaded |
| "Did I already do architecture for this?" | Artifacts scattered across conversations | Artifact indicators on workflow nodes — filled = exists |
| "What context does this agent need?" | Context management is manual | Context dependency tooltip shows what will be loaded |
| "I'll skip the PRD, I'll just start coding" | Methodology feels like overhead | Phase graph makes the PRD node visible and one-click — lower friction than skipping |

## Success Criteria

**The core interaction succeeds when:**

1. **Recognition is instant (< 2 seconds).** Alex switches to a stream and knows: which phase he's in, which workflows are complete, which is next, and who the agent is. No reading paragraphs. No expanding panels. The phase graph communicates status through visual weight — filled vs. unfilled nodes, phase container coloring, agent badges.

2. **Action is one click.** From "I see where I am" to "the agent is running" is a single click on a workflow node. No configuration dialog. No "select your model." No "choose your context files." BMAD Studio handles all of that based on the workflow definition and the stream's artifact history.

3. **Context is trustworthy.** When the OpenCode session starts, the agent has the right BMAD skill loaded and the right upstream artifacts in context. Alex never has to manually attach files or explain prior decisions to the agent. The context dependency tooltip gave him confidence before clicking; the agent's behavior confirms it.

4. **Completion is visible.** When a workflow session ends and produces an artifact, the phase graph updates without user action. The node fills in, the artifact becomes viewable, and the next available workflow subtly highlights. The stream's progress is immediately legible to anyone looking at the dashboard.

5. **Resumption is effortless.** A stream untouched for two weeks looks exactly like a stream used yesterday — same phase graph, same information density, same interaction model. There is no "stale stream" penalty. The graph is the resume screen, and it's always current.

## Novel UX Patterns

**Pattern Classification:**

| Element | Classification | Approach |
|---------|---------------|----------|
| Phase graph topology (phases → workflow nodes) | **Novel composition** of established patterns | Borrows from CI pipeline visualization + Kanban spatial layout + node graph interactivity. No single product does all three |
| Click-to-launch on graph nodes | **Novel for this context** | CI pipelines show status but don't launch interactive sessions. BMAD Studio's nodes are launch buttons, not status indicators |
| Agent badges on workflow nodes | **Novel** | No dev tool shows "who" is handling each step as a named persona with a visual identity. Closest: GitHub's assignee avatars, but those are humans |
| Context dependency tooltips | **Novel** | No tool shows "what context will be loaded" before launching an AI session. This is a trust-building pattern specific to orchestration products |
| Breadcrumb strip (collapsed phase graph) | **Adapted from established** | Zed's collapsed panel strip + breadcrumb navigation. Novel combination: phase progress as a collapsible breadcrumb during active sessions |
| Command palette (`Cmd+K`) | **Established** | Direct adoption from Linear/Zed/Warp. No innovation needed — the pattern is proven for this user persona |
| Stream list with inline badges | **Established** | Linear's list view pattern with phase-colored badges |
| Modal for creation | **Established** | Linear's create modal pattern |

**Teaching the Novel Patterns:**

The two-level phase graph is the only pattern that might need explanation for Entry Point B users. Strategy:

- **First stream creation** materializes the graph with a subtle "start here" indicator on the first available workflow node. No tutorial, no tooltip tour — just a visual affordance that says "this node is your next step."
- **Node hover** reveals a minimal tooltip: workflow name, agent name, output artifact, context dependencies. This teaches the graph's information model through progressive discovery, not upfront explanation.
- **Completed nodes** look obviously different from pending nodes (filled vs. outline). The visual language is self-explanatory: filled = done, highlighted = active, outline = available, dimmed = not yet relevant.

## Experience Mechanics

**The Core Interaction Flow — Step by Step:**

### 1. Initiation: Stream Selection

```
Trigger:     Alex clicks a stream in the sidebar or dashboard
System:      Loads stream metadata, artifact inventory, phase state
Display:     Phase graph renders as the stream's home view
Duration:    < 1 second from click to fully rendered graph
```

The phase graph is the first and only thing that appears. No intermediate "stream detail" page. No "loading stream..." state. Click → graph.

### 2. Orientation: Phase Graph Reading

```
User reads:  Phase containers (left to right: Analysis → Planning → Solutioning → Implementation)
User sees:   Workflow nodes inside each phase — filled (complete), highlighted (active/next), outline (available), dimmed (not yet)
User sees:   Agent badges on each node (colored initial: M, J, W, B, A, S)
User sees:   Artifact indicators (small icon showing artifact type when complete)
User sees:   Arrow connections showing artifact flow between workflows
Duration:    < 2 seconds to full orientation ("I'm in Solutioning, architecture is done, epics are next with John")
```

No clicking required for orientation. All status information is visible on the graph surface.

### 3. Pre-Launch: Context Confidence

```
User hovers: The next workflow node (e.g., create-epics-and-stories)
Tooltip:     "Agent: John (PM) | Skill: /bmad:bmm:workflows:create-epics-and-stories
              Will load: architecture.md, PRD.md, ux-spec.md
              Produces: epics.md → (used by create-story, check-implementation-readiness)"
Duration:    Tooltip appears after 300ms hover delay
```

This step is optional but trust-building. Power users (Entry Point A) will skip it after learning the system. New users (Entry Point B) will use it frequently during their first few streams.

### 4. Launch: One Click

```
Trigger:     User clicks the workflow node
Transition:  Phase graph animates to breadcrumb strip at top of viewport
             Conversation panel expands to fill the workspace
             OpenCode session starts with pre-configured:
               - BMAD skill (e.g., /bmad:bmm:workflows:create-epics-and-stories)
               - Working directory (stream's worktree)
               - Context files (artifacts from prior workflows in this stream)
               - Agent persona (John)
Display:     Breadcrumb strip: Analysis ✓ → Planning ✓ → [Solutioning: create-epics-and-stories 🔵] → Implementation
             Conversation panel: OpenCode TUI with streaming output
Duration:    < 1 second from click to first streaming output visible
```

The transition is the seamlessness test. Phase graph → breadcrumb strip must feel like zooming in, not switching apps.

### 5. Work: Conversation Focus

```
User works:  In the OpenCode TUI within the conversation panel
             Answering agent questions, reviewing output, providing direction
Chrome:      Breadcrumb strip (top) — phase orientation, click to expand back to graph
             Minimal status bar (bottom) — stream name, session duration, token usage if available
Duration:    5 to 45+ minutes depending on workflow complexity
```

During active work, BMAD Studio is invisible. The conversation panel IS the app. The breadcrumb strip is the only reminder that you're in an orchestrated session.

### 6. Completion: Artifact Capture and Graph Update

```
Trigger:     OpenCode session ends (user completes the workflow or exits)
System:      Reads produced artifacts from the stream's central store folder
             Updates stream metadata with new artifact and workflow completion
Display:     Conversation panel contracts
             Phase graph expands from breadcrumb strip back to full view
             Completed workflow node animates to filled state
             Artifact indicator appears on the node
             Next available workflow node subtly highlights
Duration:    < 500ms from session end to updated graph
```

The completion moment should produce micro-momentum. The node filling in is the "check" moment. The next node highlighting is the "what's next" invitation. Together they create a feeling of forward motion.
