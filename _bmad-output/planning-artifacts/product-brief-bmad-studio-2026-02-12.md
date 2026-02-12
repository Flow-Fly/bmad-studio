---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/planning-artifacts/brainstorming/brainstorming-session-2026-01-22.md
  - _bmad-output/planning-artifacts/product-brief-bmad-studio.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-12-orchestrator-pivot.md
  - _bmad-output/project-context.md
date: 2026-02-12
author: Flow
---

# Product Brief: bmad-studio

## Executive Summary

BMAD Studio is a developer cockpit for managing AI-assisted development across everything you're working on. It transforms the BMAD methodology — a structured approach to AI-driven software development — from a CLI-based experience into a visual orchestration platform where multiple features, explorations, and ideas each flow independently through the methodology pipeline.

The product addresses a gap that's emerged as AI coding tools mature: developers are productive with tools like OpenCode and Claude Code on individual tasks, but nobody's solving the meta-problem of coordinating AI-assisted work across multiple concurrent workstreams at project scale. BMAD Studio sits above the execution tools as the orchestration layer — telling you which tool to pick up, when, and why.

**Core shift:** From "a better way to chat with an AI about code" to "a better way to manage AI-assisted development across everything you're working on."

**Product Differentiator:** BMAD Studio combines three capabilities unavailable elsewhere:
1. **Multi-Stream Orchestration** — Each idea, feature, or exploration flows independently through BMAD phases, tied to git worktrees. See every workstream's status across every project at a glance.
2. **Methodology as Product** — BMAD's structured phases (Analysis → Planning → Solutioning → Implementation) aren't bolted on — they're the architecture. The product embodies years of teaching developers how to build things with AI in a structured way.
3. **Composable Execution** — OpenCode handles LLM conversations and tool execution. BMAD Studio orchestrates sessions programmatically — launching the right skill, with the right context, at the right point in the pipeline. If the execution layer improves, the cockpit improves for free.

---

## Core Vision

### Problem Statement

AI-assisted development today suffers from a missing layer. Developers have powerful execution tools — OpenCode, Claude Code, Cursor — that are excellent at individual tasks. But there's no orchestration layer between the developer's intent and these tools. The result:

1. **No spatial awareness across work.** Developers juggle multiple features, explorations, and ideas across multiple projects with no single place showing what state everything is in, what artifacts exist, and what the next step is for any thread of work. The "where am I?" tax is paid every context switch — 15-30 minutes of reconstruction each time.

2. **Methodology doesn't stick.** Structured approaches like BMAD exist, but the overhead of managing them manually is too high. Research gets done in one conversation and lost. PRDs get skipped because "I'll just start coding." Architecture decisions live in expired chat sessions. The methodology exists but doesn't get followed because there's no system enforcing the pipeline.

3. **AI tools are underutilized.** Developers use AI for the task immediately in front of them but never build the habit of structured, multi-phase development because orchestrating it is manual work. They're leaving 20-30% of their AI-assisted productivity on the table — spent on navigation and reconstruction instead of creation.

### Problem Impact

- **Solo developers** spend their first 20-30 minutes every session reconstructing where they were across branches, artifacts, and half-remembered conversations
- **Multi-project developers** pay the reconstruction tax multiplied — each project switch costs orientation time that compounds across a week
- **AI-adopting teams** have powerful tools but no shared visibility into structured development progress across workstreams
- **The methodology gap** means projects silently accumulate design debt: the architecture doc that would have caught the scaling issue never got written, the PRD that would have clarified edge cases got skipped

### Why Existing Solutions Fall Short

| Solution | What It Does Well | The Gap |
|----------|------------------|---------|
| **OpenCode / Claude Code** | Excellent AI execution within a single session | No cross-session state, no multi-stream awareness, no methodology pipeline |
| **Cursor / Windsurf** | AI-assisted coding inside an editor | No structured methodology, no project-level orchestration, no phase awareness |
| **Linear / Jira** | Project management and issue tracking | No AI integration, no methodology pipeline, no artifact generation |
| **Generic AI orchestrators** | Task automation and chaining | Task-focused, not methodology-driven — no development discipline, no spatial awareness |

Every tool in the market is building a better hammer. Nobody is building the construction management system that tells you which hammer to pick up, when, and why.

### Proposed Solution

BMAD Studio is a developer cockpit — the command center that sits above execution tools and provides spatial awareness of your entire development landscape:

- **Multi-Stream Dashboard:** See all projects, each with their active streams (features, explorations, spikes). Each stream independently progresses through BMAD phases. Kanban-like overview of where everything stands.
- **Per-Stream Phase Graph:** Drill into any stream and see its interactive phase graph — what's complete, what's in progress, what's next, what's blocked. Click a node to view the artifact or launch the next workflow.
- **OpenCode Orchestration:** Click "Start Architecture" and BMAD Studio launches an OpenCode session pre-loaded with the right BMAD skill, the right context from prior phases, and output directed to the stream's artifact store. You're producing in seconds, not reconstructing.
- **Git Worktree Management:** Each stream maps to a git worktree. Create a stream, get a worktree. Merge a stream, clean up the worktree. The branching model you already use, made visual and managed.
- **Central Artifact Store:** All BMAD artifacts live in `~/.bmad-studio/projects/`, outside the repo. Per-stream isolation. Artifacts consolidated into project-level docs on merge. Clean repos, organized knowledge.

### Key Differentiators

1. **Methodology IS the Product.** Not a plugin, not an integration, not a template library. BMAD's structured phases, agent personas, and workflow engine are the architecture of the application. Years of teaching developers how to build with AI — distilled into a product.

2. **Orchestrator, Not Executor.** BMAD Studio doesn't chat with LLMs — OpenCode does. BMAD Studio orchestrates: which session to launch, with what context, at what point in the pipeline. This means the product's value is independent of any specific LLM or chat tool. If OpenCode improves, BMAD Studio improves for free.

3. **Multi-Stream by Design.** Every other tool assumes one active task. BMAD Studio assumes you're juggling multiple features, explorations, and ideas — because that's how development actually works. Streams are the core data model, not an afterthought.

4. **Composable Execution Layer.** AI coding tools just became composable — OpenCode's typed SDK, Claude Code's client-server architecture. Six months ago, you couldn't programmatically orchestrate AI coding sessions. Now you can. BMAD Studio is built for this inflection point.

5. **Developer-Native Workflow.** Streams map to git worktrees. Artifacts map to markdown files. The phase graph maps to BMAD methodology. Nothing invented, everything composed from tools developers already use and understand.

---

## Target Users

### Primary Users

#### Alex — The AI-Native Developer

**One persona, two entry points.** The product is identical. The marketing funnel is different.

**Profile:**
- Developer who uses AI coding tools (OpenCode, Claude Code, Cursor) daily
- Multiple features, explorations, and ideas in flight across one or more projects
- Believes good process produces better outcomes but finds process overhead too high
- Wants to be a "Dev 2.0" — orchestrating AI rather than just prompting it

**Entry Point A — The Methodology Adopter:**
Already knows BMAD or a similar structured approach. Uses it via CLI. Knows it works but can't sustain it manually across multiple concurrent workstreams. Arrives searching for "BMAD tools" or through the BMAD community.

**Entry Point B — The Methodology-Curious:**
Productive with AI coding tools but has no structured approach. Ships features but skips architecture docs, loses context between sessions, and accumulates design debt silently. Arrives searching for "AI development workflow" or "manage AI coding projects." Doesn't know BMAD yet — discovers the methodology through the product.

**Current Pain:**
- Six terminal tabs open, each a different feature branch at a different stage, no single view of what state anything is in
- First 20-30 minutes of every session spent reconstructing: "Where was I? What did I decide? What's next?"
- Methodology doesn't stick — the architecture doc that would have caught the scaling issue never gets written because there's no system enforcing the pipeline
- Research happens in one AI conversation and gets lost. PRDs get skipped because "I'll just start coding."
- AI tools are underutilized — 20-30% of productive time spent on navigation and reconstruction instead of creation

**Success Vision:**
Opens BMAD Studio, sees every project with every active stream and its current phase. Clicks into a stream and immediately knows: what's done, what's in progress, what's next. Clicks "Start Architecture" and an OpenCode session launches pre-loaded with the right skill and context. Productive in 60 seconds, not 30 minutes.

### Secondary Users

**Strictly single-developer for v1.** Teams, collaboration, shared visibility — all deferred to v2+. The product must prove its value for one developer managing their own workstreams before adding multi-user complexity. This keeps the v1 scope honest and the architecture clean.

### User Journey

| Stage | Experience |
|-------|------------|
| **Discovery** | Entry A: Finds BMAD Studio through BMAD community or searching for methodology tools. Entry B: Finds it searching for "AI development workflow" or "organize AI coding projects" |
| **Onboarding** | Connects an existing project (or creates one), creates first stream, sees phase graph materialize. Entry B discovers BMAD methodology through the product — phases make sense because they're visual |
| **Core Usage** | Opens app → sees multi-stream dashboard → drills into a stream → sees phase graph → clicks next workflow → OpenCode session launches with right context → artifact produced → phase graph updates |
| **"Aha!" Moment #1** | Completes a full stream — merges it — and sees the structured decision history: every phase, every artifact, the reasoning trail from brainstorm to shipped feature. "This is what I've been losing." |
| **"Aha!" Moment #2** | Opens a 2-week-old stream they haven't touched. Phase graph shows exactly where they left off. Artifact viewer shows what exists. Productive in 60 seconds. "I can't go back to reconstructing from memory." |
| **Long-term** | All projects managed through Studio. Streams are how they think about work. The methodology becomes invisible — it's just how development works. The reconstruction tax drops to zero |

---

## Success Metrics

### User Success Metrics

Success is measured by what Alex **stops doing**, not what he starts doing.

| Signal | Before BMAD Studio | After BMAD Studio | Measurable Proxy |
|--------|-------------------|-------------------|-----------------|
| **Session reconstruction** | 15-20 minutes grep-ing chat logs, reading old branches, reconstructing state | Opens stream, sees phase graph, productive immediately | Time to first productive action < 2 minutes |
| **Methodology skipping** | Skips architecture/PRD because "too much overhead to set up the agent with the right context" | Workflow graph surfaces next step; clicking it launches the right session | Percentage of streams that follow full methodology flow |
| **Idea loss** | Insights from mid-conversation get lost when session ends | Artifacts captured per-stream in central store | Ideas that survive across sessions (stream artifact completeness) |
| **Context switch cost** | Each project/feature switch costs full orientation cycle | Stream dashboard shows state across all work | Number of stream switches per session without reconstruction delay |

**Core metric:** Time from sitting down to first productive action drops from 15-20 minutes to under 2 minutes.

**Trust indicator:** Alex's instinct is to open BMAD Studio first — not because he has to, but because it's faster than not doing it. The methodology stops feeling like overhead and starts feeling like the shortest path. The moment he catches himself thinking "I almost started coding without doing the architecture phase, glad the workflow graph reminded me" — the tool has changed his behavior, not just his tooling.

### Business Objectives

BMAD Studio follows a **dogfood → open source → career catalyst** trajectory. Each phase has distinct success criteria:

#### Phase 1: Dogfooding (Month 1-2)

**Core question:** Does it actually make your development faster and more organized?

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Daily usage | Using BMAD Studio for 100% of personal BMAD projects | If the creator isn't using it, nothing else matters |
| Natural reach | Reaching for it instinctively, not forcing yourself | Habit formation = genuine value |
| Stream resumption | Pick up any stream after a week away and be productive immediately | Proves the spatial awareness thesis |
| End-to-end completion | Complete OpenCode integration and real features through the cockpit | Artifacts tell a coherent story of how the project evolved |

**Go/no-go:** Honest self-assessment. Are you using it daily? Are you reaching for it naturally?

#### Phase 2: Open Source / Early Adopters (Month 3-6)

**Core question:** Do other developers complete streams, not just download the app?

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Second stream creation | Track users who create a 2nd stream | First stream is curiosity. Second stream means it worked |
| Full lifecycle completion | Users who complete idea → merge → archive | Equivalent of activation in a SaaS funnel |
| Retention over downloads | Returning users, not star count | Stars are vanity. Retention is value |
| Community signal | Users writing their own BMAD agents/skills | They've bought the methodology, not just the tool |

**Anti-metrics:** GitHub stars, download counts, social media impressions. These are vanity. Ignore them.

#### Phase 3: Career Catalyst (Month 6-12)

**Core question:** Does BMAD Studio demonstrate systems-level thinking about AI-assisted development?

| Metric | Signal | Why It Matters |
|--------|--------|---------------|
| Portfolio narrative | Project demonstrates product thinking + technical depth + user empathy | Shows you think about AI development at systems level, not prompt level |
| Inbound interest | Interviews, contracts, or conversations opened by the project | The project opens doors |
| Hiring signal | Someone hires you partly because of this project | Strongest possible validation |

### Key Performance Indicators

**North Star Metric: Streams completed per user per month.**

Not started — **completed**. A completed stream means:
- The user trusted the methodology enough to follow it through
- The orchestration worked well enough to not get in the way
- The result was a merged feature with documented decisions

Everything else is a leading indicator for that.

**Leading Indicators:**

| KPI | What It Predicts | Measurement |
|-----|-----------------|-------------|
| Time to first productive action | User trust and spatial awareness working | Timestamp: app open → first meaningful action |
| Streams created per user | Adoption breadth | Count of new streams |
| Methodology step completion rate | Methodology sticking, not being skipped | Phases completed vs phases available per stream |
| Stream resumption time | Context preservation working | Time from opening dormant stream to productive action |
| Stream lifecycle completion rate | Full value delivery | Streams merged or archived vs streams created |

**Lagging Indicators (Phase 2+):**

| KPI | What It Confirms | Measurement |
|-----|-----------------|-------------|
| Second stream creation rate | Product proved value on first stream | Users who create stream #2 |
| Community contribution rate | Methodology adoption beyond tool adoption | Custom agents/skills shared |
| Retention (30-day) | Sustained value, not novelty | Users active after 30 days |

---

## MVP Scope

### Core Features

Four things must work. Everything else is enhancement.

#### 1. Stream Lifecycle Management

- **Create a stream:** Generates a git worktree + a folder in the central artifact store (`~/.bmad-studio/projects/{project}/streams/{stream}/`)
- **View all streams:** See every stream for a project with its current phase at a glance
- **Switch between streams:** Load a stream's phase graph and artifacts instantly
- **Archive on merge:** When a stream's feature branch merges, archive the stream and its artifacts

Without this, there's no orchestration — you're just a chat app.

**Stream types:** v1 has one stream type: full BMAD pipeline. Users can skip phases manually, but there's no formal "spike" or "light" template.

#### 2. Per-Stream Phase Graph

- Visual representation of where this stream is in the BMAD pipeline
- Completed phases (have artifacts): filled nodes
- Current phase: highlighted
- Upcoming phases: visible but dimmed
- Clickable nodes: view the artifact (read-only) or launch the next phase

This is the "zero reconstruction" promise — you look at it and you know exactly where you are.

#### 3. OpenCode Session Launcher

- Click "Start [phase]" on the graph
- BMAD Studio configures the right agent, command, and context (writes `opencode.json`, points to the right directory, pre-loads the right BMAD skill)
- Opens an OpenCode session in an embedded terminal panel
- User does the actual work through OpenCode's TUI (chatting, answering questions, reviewing output)
- When the session ends, BMAD Studio reads the output artifact from the central store
- Phase graph updates to reflect the new artifact

**Integration boundary: thin wrapper.** Embed a terminal panel that runs OpenCode. BMAD Studio handles setup and teardown; OpenCode handles the conversation. This gets 90% of the value at 20% of the cost of a custom chat UI. The risk of feeling like "two apps stitched together" is mitigated by seamless transitions — click a button, terminal opens with OpenCode already running, do the work, close it, graph updates.

#### 4. Project + Stream Dashboard

- Home view showing all projects and their active streams with status
- The "morning coffee" view: what needs attention, what's in progress, what's stalled
- Click into any project to see its streams; click into any stream to see its phase graph

**Technical Foundation:**
- **Desktop app:** Electron (Go backend + React frontend)
- **Central artifact store:** `~/.bmad-studio/projects/` — artifacts live outside the repo
- **Git worktree management:** Each stream maps to a worktree and branch
- **Platform:** macOS primary, Linux supported, Windows deferred

### Out of Scope for MVP

| Feature | Rationale | Target |
|---------|-----------|--------|
| **Custom chat UI** | OpenCode's TUI handles the conversation. No message rendering, no streaming tokens, no tool call visualization in-app | v2 |
| **Annotation/highlight system** | Potentially a separate product. Not essential for orchestration | v2+ |
| **Team features** | No shared state, no multi-user, no cross-developer visibility | Year 1-2 |
| **Enhanced git visualization** | Stream-level branch status only. Not a lazygit competitor | v2+ |
| **Light/spike stream types** | v1 has one stream type (full pipeline). Users skip phases manually | v2 |
| **Mobile companion** | Desktop only | v2+ |
| **In-app artifact editing** | View artifacts in BMAD Studio, edit them in your editor or via OpenCode session. Artifact viewer is read-only | v2 |
| **Smart suggestions** | No "you should do architecture next" intelligence. The graph shows phases, the user decides. Guidance comes from BMAD agents during sessions, not from the UI | v2+ |
| **Plugin/extension system** | BMAD agents are configurable via markdown, but no public API for extending BMAD Studio itself | Year 1-2 |

**Explicit "No" Decisions:**
- No custom chat UI until orchestration model is proven
- No team features until single-developer value is validated
- No mobile until desktop experience is polished
- No artifact editing until read-only viewing is solid
- No smart suggestions until the dumb version works

### MVP Success Criteria

**The Scope Test:** Can Flow use this MVP to manage bmad-studio's own development with multiple streams, and find it genuinely faster than the current workflow of mental notes + terminal tabs + scattered conversations? If yes, MVP is right-sized. If no, something essential is missing.

**Dogfooding Validation:**
- [ ] Creator uses BMAD Studio for 100% of personal BMAD projects
- [ ] Stream creation → OpenCode session → artifact produced → phase graph updated works end-to-end
- [ ] Pick up any stream after a week away and be productive in under 2 minutes
- [ ] Multiple streams managed simultaneously without reconstruction overhead

**Distribution Readiness:**
- [ ] Electron packaging produces working `.dmg` / `.AppImage`
- [ ] Installation works for someone other than the creator
- [ ] First external user creates and completes a stream

**Go/No-Go Decision Point:**

Proceed beyond MVP if:
- Creator cannot imagine returning to unorchestrated development
- At least one external user validates the stream lifecycle experience
- Core architecture supports v2 features (custom chat UI, stream types) without rewrite

Pivot or pause if:
- Dogfooding reveals the thin wrapper feels too disjointed
- OpenCode integration proves unreliable or limiting
- The orchestration overhead exceeds the reconstruction tax it replaces

### Future Vision

#### Version 2: Removing the Seams (3-6 months post-launch)

- **Native chat UI:** Replace embedded terminal with SDK-driven custom chat — SSE streaming, custom message rendering, tool call visualization, all within BMAD Studio's design language. One cohesive product, not two apps stitched together.
- **Stream types:** Full BMAD pipeline, light stream (skip to epic + implementation), spike (research only, auto-archives).
- **"To explore" capture:** Lightweight mechanism to flag something during any phase as a future stream seed. Ideas stop getting lost.
- **Living artifacts:** Diffing between artifact versions, seeing how a PRD evolved across iterations, light inline commenting. Artifacts become living documents, not static outputs.

#### Year 1-2: The Methodology Platform

- **Configurable workflow engine:** Phase pipeline becomes pluggable. Teams define their own workflows (research → RFC → implementation, mandatory security review phase, etc.). BMAD ships as the opinionated default.
- **Agent ecosystem:** Custom BMAD agents as a shareable ecosystem — a "Rails architecture agent," a "compliance review agent" for regulated industries. Community-driven methodology layer, proprietary orchestration layer.
- **Team visibility:** Tech lead sees all streams across their team. Who's in architecture? Whose PRD needs review? Which features are close to merge? AI development visibility that no PM tool has.

#### Year 2-3: The AI Development Operating System

- **Tool-agnostic orchestration:** OpenCode is one backend. Claude Code is another. Cursor is another. The orchestration layer dispatches to whatever AI tool is best for the phase — reasoning model for research, fast coding model for implementation, different agent for review.
- **Project knowledge graph:** Artifacts become connected decisions. Architecture links to PRD links to research links to the brainstorm that spawned it. Trace any implementation decision back to its origin. New team members onboard by walking the graph.
- **Methodology coach:** After 50 merged streams, the system knows your patterns — architecture phases take two sessions, you forget error handling in PRDs, your estimates are 40% optimistic. It coaches, not just tracks.

**The Narrative Arc:**

| Phase | Experience |
|-------|------------|
| **MVP** | "I can see where I am and launch the right AI session" |
| **V2** | "It feels like one seamless product and captures ideas I'd otherwise lose" |
| **Year 1-2** | "My whole team uses this and the methodology adapts to how we work" |
| **Year 2-3** | "I can't imagine building software without an orchestration layer" |

**The category bet:** Orchestration becomes a recognized category in developer tools, the same way CI/CD became a category that didn't exist before Jenkins made it obvious. BMAD Studio's play is to define that category before anyone else realizes it needs to exist.
