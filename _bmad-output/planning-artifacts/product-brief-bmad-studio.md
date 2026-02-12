---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/planning-artifacts/brainstorming/brainstorming-session-2026-01-22.md
  - _bmad-output/planning-artifacts/brainstorming/studio-activation-prototype.md
  - docs/automaker-study/index.md
  - docs/automaker-study/architecture-overview.md
  - docs/automaker-study/provider-architecture.md
  - docs/automaker-study/event-websocket-architecture.md
  - docs/automaker-study/context-injection-pattern.md
  - docs/automaker-study/session-management.md
  - docs/automaker-study/file-organization.md
  - docs/bmad-studio-goals.md
  - docs/prd.md
  - docs/draft/transferable-patterns-draft.md
  - docs/draft/go-backend-draft.md
  - docs/draft/workflow-service-draft.md
  - docs/draft/lit-architecture-draft.md
date: 2026-01-23
author: Flow
---

# Product Brief: bmad-studio

## Executive Summary

BMAD Studio is a visual workflow orchestration platform that brings the BMAD (Breakthrough Method of Agile AI-Driven Development) methodology to a broader audience beyond CLI power users. It transforms the fragmented experience of AI-assisted development—where conversations are lost between sessions, workflows are invisible, and diagramming lives in separate tools—into a unified ideation-to-prototype environment.

The platform addresses a fundamental gap in the AI development tooling landscape: powerful methodologies exist, but they're locked behind CLI interfaces and require users to mentally track state across disconnected conversations. BMAD Studio makes structured development visual, persistent, and accessible—preserving not just artifacts, but the thought flow that created them.

---

## Core Vision

### Problem Statement

AI-assisted development today suffers from three critical friction points:

1. **Conversation Amnesia**: BMAD methodology correctly persists context through structured artifacts—PRDs, architecture docs, stories. The "new agent for each task" pattern is intentional and valuable. What's lost is the *conversations themselves*: the thought process, the back-and-forth reasoning, the debugging discussions, the "aha" moments that led to decisions. Artifacts capture *what* was decided, but the *why* and *how we got there* evaporates when the session ends.

   BMAD Studio preserves and classifies these conversations—by subject, time, and involved agent—creating queryable access to the thought flow throughout a project. Not replacing BMAD's artifact-based persistence, but complementing it with conversational memory.

2. **Invisible Workflow State**: Structured methodologies like BMAD define clear phases (Analysis → Planning → Solutioning → Implementation), but there's no visual representation of where you are, what's complete, or what's blocked. Progress exists only in scattered documents and human memory.

3. **Tool Fragmentation**: Brainstorming happens in one tool, diagramming in another (Excalidraw, Figma), architecture docs in markdown, and AI conversations in CLI. Context-switching destroys flow, and diagrams become static screenshots that LLMs can't read or update.

### Problem Impact

- **Solo developers** lose the reasoning behind their own past decisions
- **Teams** lack shared visibility into AI-assisted development progress and thought history
- **Non-technical founders** are locked out of powerful methodologies that require CLI expertise
- **Everyone** discards valuable conversational context—only artifacts remain, not the journey

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| **Claude Code CLI** | Powerful but invisible state, conversations discarded, CLI-only audience |
| **Cursor / Windsurf** | AI-assisted coding without methodology—no structure, no workflow |
| **Excalidraw / Figma** | Standalone tools—LLMs can't read diagrams as context |
| **Generic AI orchestrators** | Task-focused, not methodology-driven—no development discipline |

The market has AI code editors and diagramming tools. It lacks **structured methodology as a product**—visual, persistent, and LLM-integrated.

### Proposed Solution

BMAD Studio is a full ideation-to-prototype platform built on BMAD conventions:

- **Visual Workflow Orchestration**: Interactive phase graph showing Analysis → Planning → Solutioning → Implementation with real-time progress, available workflows, and suggested next steps
- **Conversation Preservation**: Discussions compacted and classified by subject, time, and involved agent—queryable thought flow throughout the project lifecycle
- **Integrated Diagramming**: Excalidraw embedded and LLM-readable—diagrams as first-class context that agents can create, read, and update
- **Multi-Agent Chat**: Named BMAD agents (Analyst, PM, Architect, Dev, SM) with domain-specific personas, accessible through visual interface
- **BYOK Flexibility**: Bring your own API keys for Claude, OpenAI, or local models

### Key Differentiators

1. **BMAD Conventions as Backbone**: Not generic AI orchestration—structured phases, defined agents, clear artifact expectations. Development discipline built into the product.

2. **Conversational Memory**: Preserves and classifies the discussions that led to artifacts. Access the thought flow, not just the final documents.

3. **LLM-Readable Diagrams**: Excalidraw integration where diagrams are context, not screenshots. Agents can reference, create, and modify visual artifacts.

4. **Visual State Persistence**: See where you are in the methodology. Progress survives session boundaries. Reasoning is preserved alongside artifacts.

5. **Non-CLI Accessibility**: Democratizes rigorous development methodology. Solo devs, teams, and non-technical founders can all use structured AI-assisted development without terminal expertise.

6. **Hot Market Timing**: AI-assisted development tools are exploding, but none offer methodology + visual orchestration + conversational memory + integrated diagramming in one platform.

---

## Target Users

### Primary Users

#### The Orchestrator Dev ("Alex")

**Profile:**
- Solo developer working on open source projects and client work
- Already familiar with BMAD methodology, uses it via CLI
- Believes in structured development, frustrated by "vibe-coded" chaos
- Juggles multiple projects simultaneously
- Wants to develop "Dev 2.0" skills—orchestrating AI rather than just prompting it

**Current Pain:**
- Switches between projects and forgets where each one is in the workflow
- Digs through `_bmad-output` folders trying to reconstruct state
- Knows BMAD documentation exists but context-switches to find it
- Conversations with agents disappear—only artifacts remain
- Mental overhead of tracking phase progress across multiple codebases

**Success Vision:**
Opens BMAD Studio, sees all projects with visual phase indicators. Clicks into a client project and immediately knows: "I'm in Solutioning, Architecture is complete, Epics & Stories is next." The conversation that shaped the architecture decision is one click away.

**"Finally!" Moment:**
"All the BMAD workflows in a UI where I can see progress, next steps, and pick up exactly where I left off—without digging through docs."

---

#### The Domain Expert ("Sam")

**Profile:**
- Product manager, business analyst, or developer from another field (data science, hardware, etc.)
- Has a specific idea they want to validate and prototype
- Understands their domain deeply but lacks full-stack app development experience
- Comfortable with technology but CLI feels foreign and intimidating

**Current Pain:**
- Knows AI can help build apps but doesn't know where to start
- CLI tools like Claude Code feel hidden and weird—everything is invisible
- Doesn't realize documentation is being generated or how to access it
- No mental model for structured development phases
- Gives up or produces "vibe-coded" prototypes that can't evolve

**Success Vision:**
Opens BMAD Studio, sees a clear starting point. Clicks "Create Product Brief" and a friendly Analyst agent walks them through discovery questions. Watches their idea take shape as real artifacts—brief, PRD, architecture—all visible and navigable.

**"Finally!" Moment:**
"I don't need to be a terminal expert to build something real. The methodology is surfaced, not buried. I can see what's happening."

---

### Secondary Users

#### Teams (Future Consideration)

Team collaboration—shared visibility, multi-user workflows, handoffs between agents—is a natural extension of BMAD Studio's architecture. However, the initial release focuses on single-user workflows.

**Future exploration:**
- Shared project state across team members
- Role-based agent access (PM sees different view than Dev)
- Conversation history as team knowledge base
- Async handoffs with context preservation

This segment will be validated and developed as the product matures.

---

### User Journey

#### Alex (Orchestrator Dev) Journey

| Stage | Experience |
|-------|------------|
| **Discovery** | Hears about BMAD Studio in dev community, already knows BMAD methodology |
| **Onboarding** | Connects existing BMAD project, sees workflow state visualized instantly |
| **Core Usage** | Opens project → sees phase graph → clicks suggested workflow → chats with agent → artifact generated |
| **"Aha!" Moment** | Switches to second project, immediately sees different phase state—no mental reconstruction needed |
| **Long-term** | All projects managed through Studio, conversation history becomes project memory |

#### Sam (Domain Expert) Journey

| Stage | Experience |
|-------|------------|
| **Discovery** | Searching for "AI app builder" or "prototype with AI"—finds BMAD Studio |
| **Onboarding** | Creates new project, guided to "Start with Product Brief" |
| **Core Usage** | Answers Analyst questions → sees brief form → clicks to PRD → watches structure emerge |
| **"Aha!" Moment** | Realizes the phases aren't arbitrary—each artifact unlocks the next, methodology makes sense |
| **Long-term** | Graduates from prototyping to real development, methodology becomes intuitive |

---

## Success Metrics

### User Success Metrics

#### Alex (Orchestrator Dev) Success

| Metric | Definition | Target |
|--------|------------|--------|
| **Project Resume Speed** | Time from opening project to productive work | < 60 seconds (vs. minutes digging through folders) |
| **Multi-Project Management** | Actively manages 2+ projects without losing context | Switches projects without mental reconstruction |
| **Conversation Recall** | Accesses past reasoning when needed | Finds relevant discussion within 3 clicks |
| **CLI Abandonment** | Uses Studio instead of raw CLI for BMAD workflows | 90%+ of workflow interactions through Studio |

**Success Indicator:** "I can't imagine going back to CLI-only BMAD."

#### Sam (Domain Expert) Success

| Metric | Definition | Target |
|--------|------------|--------|
| **First Artifact Completion** | Generates first PRD through UI | Completed without touching terminal |
| **Phase Comprehension** | Understands why phases exist | Articulates "brief unlocks PRD unlocks architecture" |
| **Methodology Adoption** | Continues using structured approach | Returns for second project using same workflow |
| **Confidence Progression** | Moves from confused to capable | Self-selects next workflow without guidance |

**Success Indicator:** "I built something real without being a terminal expert."

---

### Business Objectives

BMAD Studio follows a **dogfood → open source → career catalyst** trajectory:

| Phase | Timeframe | Objective | Success Looks Like |
|-------|-----------|-----------|-------------------|
| **Dogfooding** | Month 1-2 | Personal validation | Using BMAD Studio exclusively for own projects |
| **Open Source Launch** | Month 3-4 | Community seeding | Public repo, compelling README, first external user |
| **Community Traction** | Month 6 | Adoption proof | 10+ active users, meaningful contributions |
| **Career Catalyst** | Month 12 | Professional opportunity | Portfolio piece leads to job, contracts, or visibility |

**Anti-Goals:**
- Not optimizing for social media metrics
- Not tracking vanity metrics (downloads without usage)
- Not pursuing growth at the expense of quality

---

### Key Performance Indicators

#### Dogfooding Phase (Month 1-2)
- [ ] BMAD Studio used for 100% of personal BMAD projects
- [ ] Core workflows functional: Product Brief, PRD, Architecture
- [ ] Conversation history retrievable and useful

#### Open Source Phase (Month 3-4)
- [ ] GitHub repository public with clear documentation
- [ ] Installation/setup works for someone other than creator
- [ ] First external user completes a workflow

#### Traction Phase (Month 6)
- [ ] 10+ users who have completed at least one workflow
- [ ] 3+ contributors (bug reports, PRs, or documentation)
- [ ] Creator cannot imagine returning to CLI-only workflow

#### Catalyst Phase (Month 12)
- [ ] Project referenced in professional context (portfolio, interviews)
- [ ] Community self-sustaining (issues answered by non-creator)
- [ ] Career opportunity directly attributable to BMAD Studio visibility

---

## MVP Scope

### Core Features

#### Visual Workflow Orchestration
- **Phase Graph**: Interactive visualization of BMAD phases (Analysis → Planning → Solutioning → Implementation)
- **Workflow State**: Real-time progress indicators showing completed, in-progress, and available workflows
- **Suggested Next**: Clear "what's next?" guidance based on current project state

#### Agent Chat Interface
- **BMAD Personas**: Named agents (Analyst, PM, Architect, Dev, SM) with domain-specific behavior
- **Streaming Responses**: Real-time message streaming via WebSocket
- **Conversation History**: Retrievable past discussions per session (basic, not classified)

#### Workflow Execution
- **Core Workflows**: Product Brief, PRD, Architecture, Epics & Stories
- **Artifact Generation**: Markdown documents created in project's `_bmad-output/` folder
- **State Tracking**: Workflow progress persisted and visible across sessions

#### Project Management
- **Create Project**: Initialize new BMAD project through UI
- **Open Existing**: Connect to existing BMAD projects
- **Multi-Project**: Switch between projects with instant state visualization
- **External Storage**: State persisted in `~/.bmad-studio/` (keeps project folders clean)

#### Settings Interface
- **Project Config**: Edit project name, output folder, communication language, skill level
- **API Keys**: BYOK management for Claude, OpenAI, Ollama
- **Model Selection**: Choose model per workflow execution
- **Read-Only Agents**: Built-in BMAD agents (no customization in MVP)

#### Technical Foundation
- **Go Backend**: API server with provider abstraction, event bus, session management
- **React Frontend**: Reactive UI with Zustand state management + Tailwind CSS
- **BYOK Support**: Bring your own API keys (Claude, OpenAI, Ollama)
- **Electron Packaging**: Desktop distribution (development uses web + local server)

---

### Out of Scope for MVP

| Feature | Rationale | Target |
|---------|-----------|--------|
| **Excalidraw Integration** | Key differentiator but adds complexity; core workflow must work first | v2 |
| **Conversation Classification** | Nice-to-have; basic history sufficient for dogfooding | v2 |
| **Agent Customization** | Built-in agents sufficient; customization adds complexity | v2 |
| **Workflow Editor** | Built-in workflows sufficient; editing adds complexity | v2 |
| **Mobile Integration** | Desktop-first; mobile adds distribution complexity | v2+ |
| **VPS / Self-Hosting** | Local-first; cloud deployment is separate concern | v2+ |
| **Team Collaboration** | Single-user focus; validate core value first | Future |
| **Advanced Search** | Basic navigation sufficient for MVP | v2 |

**Explicit "No" Decisions:**
- No mobile app until desktop proven
- No cloud hosting until local experience polished
- No team features until solo workflow validated
- No diagram integration until core chat/workflow stable
- No agent/workflow customization until built-in experience validated

---

### MVP Success Criteria

#### Dogfooding Validation (Month 1-2)
- [ ] Creator uses BMAD Studio for 100% of personal BMAD projects
- [ ] Core workflows execute successfully: Product Brief → PRD → Architecture
- [ ] Project switching feels instant (< 60 seconds to productive work)
- [ ] Conversation history is retrievable and useful

#### Distribution Readiness (Month 3-4)
- [ ] Electron packaging produces working `.dmg` / `.exe`
- [ ] Installation works for someone other than creator
- [ ] README clearly explains setup and usage
- [ ] First external user completes a workflow

#### Go/No-Go Decision Point
**Proceed beyond MVP if:**
- Creator cannot imagine returning to CLI-only BMAD
- At least one external user validates the workflow experience
- Core architecture supports planned v2 features without rewrite

**Pivot or pause if:**
- Dogfooding reveals fundamental UX issues
- Technical architecture blocks key v2 features
- No external interest after 3 months public

---

### Future Vision

#### Version 2: Integration & Intelligence
- **Excalidraw Integration**: LLM-readable diagrams as first-class context
- **Conversation Classification**: Auto-categorize by subject, time, agent
- **Search & Query**: "Find the discussion where we decided on Go"
- **Agent Customization**: Edit agent prompts, create custom agents
- **Workflow Editor**: Modify workflow steps, create custom workflows

#### Version 3: Platform & Scale
- **Team Collaboration**: Shared projects, role-based views, async handoffs
- **Cloud Option**: Optional hosted version for non-technical users
- **Mobile Companion**: Read-only project view, notifications
- **Plugin System**: Community-contributed workflows and integrations

#### Long-Term Vision (2-3 Years)
If wildly successful, BMAD Studio becomes the **default interface for structured AI-assisted development**:
- Methodology-agnostic (BMAD is one option, users can define others)
- Ecosystem of workflows, agents, and integrations
- Standard for "Dev 2.0" orchestration tools
- Career platform: portfolio visibility, community recognition
