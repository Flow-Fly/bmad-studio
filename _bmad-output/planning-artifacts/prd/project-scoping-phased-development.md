# Project Scoping & Phased Development

## MVP Strategy & Philosophy

**MVP Approach:** Developer cockpit MVP — minimum viable orchestrator that lets a solo developer manage BMAD streams, launch workflows via OpenCode, and organize artifacts in a central store.

**Resource Requirements:** Solo developer, leveraging existing BMAD methodology, OpenCode execution layer, and Electron desktop platform.

**Single-Developer Constraint:** Strictly single-developer for v1. Teams, collaboration, shared visibility — all deferred to v2+. The product must prove its value for one developer managing their own workstreams before adding multi-user complexity. This keeps the v1 scope honest and the architecture clean.

## MVP Feature Set (Phase 1)

**Four things must work. Everything else is enhancement:**

1. **Stream Lifecycle Management** — Create, view, switch, archive streams per project. Each stream gets a folder in the central artifact store and optionally a git worktree. MVP supports two flow templates: Full Flow (complete BMAD pipeline, users can skip phases manually) and Quick Flow (two-step fast track — spec and dev).

2. **Per-Stream Phase Graph** — Visual representation of where a stream is in the BMAD pipeline. Completed phases show as filled nodes (clickable to view artifact). Current/upcoming phases are clickable to launch the next workflow.

3. **OpenCode Session Integration** — Click a workflow node on the graph → BMAD Studio creates an OpenCode session via SDK (skill, working directory, prior phase context) → user works in BMAD Studio's native chat UI (streaming messages, tool calls, markdown rendering) → session ends → artifacts read from central store → phase graph updates. Integration boundary: SDK + SSE.

4. **Project + Stream Dashboard** — Home view showing all projects and their active streams with status. The "morning coffee" view: what needs attention, what's in progress, what's stalled.

**Technical Foundation:**
- Desktop app: Electron (Go backend + React frontend)
- Central artifact store: `~/.bmad-studio/projects/` — artifacts live outside the repo
- Git worktree management: each stream maps to a worktree and branch
- Platform: macOS primary, Linux supported, Windows deferred

## Out of Scope for MVP

| Feature | Rationale | Target |
|---------|-----------|--------|
| **Advanced chat features** | MVP chat UI renders messages, tool calls, and streaming text. Advanced features (message search, conversation export, multi-session view) deferred | v2 |
| **Annotation/highlight system** | Not essential for orchestration | v2+ |
| **Team features** | No shared state, no multi-user, no cross-developer visibility | Year 1-2 |
| **Enhanced git visualization** | Stream-level branch status only. Not a lazygit competitor | v2+ |
| **Spike stream type** | MVP has Full Flow and Quick Flow. Spike (research-only, auto-archives) deferred | v2 |
| **Mobile companion** | Desktop only | v2+ |
| **In-app artifact editing** | Artifact viewer is read-only. Editing via external editor or OpenCode session | v2 |
| **Smart suggestions** | No "you should do architecture next" intelligence. The graph shows phases, the user decides | v2+ |
| **Plugin/extension system** | BMAD agents are configurable via markdown, but no public API for extending Studio itself | Year 1-2 |

**Explicit "No" Decisions:**
- No advanced chat features (search, export, multi-session) until base chat UI is proven
- No team features until single-developer value is validated
- No mobile until desktop experience is polished
- No artifact editing until read-only viewing is solid
- No smart suggestions until the dumb version works

## MVP Success Criteria

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
- Core architecture supports v2 features (advanced chat, spike streams, custom flow templates) without rewrite

Pivot or pause if:
- Dogfooding reveals the SDK integration feels unreliable or limiting
- Native chat UI doesn't provide enough value over OpenCode's TUI
- The orchestration overhead exceeds the reconstruction tax it replaces

## Post-MVP Features

### Phase 2: Removing the Seams (v2, 3-6 months post-launch)

- **Advanced chat features:** Message search, conversation export, multi-session view, annotation/highlighting on messages.
- **Stream types:** Spike stream (research only, auto-archives). Custom user-defined flow templates.
- **"To explore" capture:** Lightweight mechanism to flag something during any phase as a future stream seed. Ideas stop getting lost.
- **Living artifacts:** Diffing between artifact versions, seeing how a PRD evolved across iterations, light inline commenting. Artifacts become living documents, not static outputs.
- **Stream merge with artifact distillation** — PRD → feature entry, architecture → ADR, living knowledge base.
- **BMAD agent-driven merge review** — what was implemented, issues during dev, new patterns → central project documentation.
- **Integrated Excalidraw diagramming**
- **Artifact and stream search**

### Phase 3: The Methodology Platform (Year 1-2)

- **Configurable workflow engine:** Phase pipeline becomes pluggable. Teams define their own workflows (research → RFC → implementation, mandatory security review phase). BMAD ships as the opinionated default.
- **Agent ecosystem:** Custom BMAD agents as a shareable ecosystem — a "Rails architecture agent," a "compliance review agent." Community-driven methodology layer, proprietary orchestration layer.
- **Team visibility:** Tech lead sees all streams across their team. Who's in architecture? Whose PRD needs review? Which features are close to merge?
- **Cloud sync and backup**
- **Windows platform support**
- **Auto-update via Electron updater**

### Phase 4: The AI Development Operating System (Year 2-3)

- **Tool-agnostic orchestration:** OpenCode is one backend. Claude Code is another. Cursor is another. The orchestration layer dispatches to whatever AI tool is best for the phase — reasoning model for research, fast coding model for implementation, different agent for review.
- **Project knowledge graph:** Artifacts become connected decisions. Architecture links to PRD links to research links to the brainstorm that spawned it. Trace any implementation decision back to its origin.
- **Methodology coach:** After 50 merged streams, the system knows your patterns — architecture phases take two sessions, you forget error handling in PRDs, your estimates are 40% optimistic. It coaches, not just tracks.

**Narrative Arc:**

| Phase | Experience |
|-------|------------|
| **MVP** | "I can see where I am and launch the right AI session" |
| **V2** | "It feels like one seamless product and captures ideas I'd otherwise lose" |
| **Year 1-2** | "My whole team uses this and the methodology adapts to how we work" |
| **Year 2-3** | "I can't imagine building software without an orchestration layer" |

## Risk Mitigation Strategy

**Technical Risks:**
- OpenCode integration boundary → Spike the SDK integration early; validate that session create + SSE streaming + artifact detection works end-to-end before building full chat UI
- Stream lifecycle complexity → Start with simple create/archive in MVP; defer merge distillation to Phase 2
- Worktree filesystem operations → Test cross-platform early; macOS symlink behavior requires validation
- Central store integrity → Atomic writes, file locking for concurrent stream operations

**Resource Risks:**
- Solo developer scope creep → Strict MVP discipline; OpenCode handles all LLM complexity so focus stays on orchestration
- Context switching overhead → Use BMAD Studio itself to build BMAD Studio (dogfooding)
