# Semantic Rewrite Handoff Brief

**Date:** 2026-02-03
**From:** PM (John) -- PRD Edit + Impact Scan session
**Triggered by:** Conversation model redesign (Sprint Change Proposal CP-5, Story 3.3 redesign)

---

## Context: What Already Happened

1. **Brainstorming session** explored four fuzzy concepts from Story 3.3's redesign flag
2. **UX Designer session** formalized interaction design -- updated 4 UX spec files
3. **PM session (this one)** updated the PRD across 6 files and did FR renumbering across all downstream artifacts

### The Core Model Shift

Conversations changed from persistent (archived, resumable) to **ephemeral** (session-bound, gone on app close). Durable knowledge now lives in **Insights** -- structured objects extracted from conversations via a dedicated extraction agent.

### What's Already Updated and Consistent

- **PRD** (all 7 files): FR14-FR22 rewritten for Insight model, FR23-FR37 renumbered, NFRs updated
- **FR numbers** in all downstream docs: Mechanically renumbered (old FR18-32 → FR23-37)
- **requirements-inventory.md**: Full content sync with updated PRD
- **UX Design Specification** (4 files): Already updated by UX Designer session

### What Still Has STALE CONTENT (numbers correct, semantics wrong)

These documents reference the correct FR numbers but their **story content, architectural patterns, and design decisions** still assume the OLD persistent-session model.

---

## Workstream 1: Architecture Semantic Rewrite

**Agent:** Architect
**Scope:** Update architecture documents to reflect the new conversation/Insight model

### Files to Update

**1. `core-architectural-decisions.md`**
- "Session Storage: JSON files" → Needs to become: Conversations are in-memory only. Insights are stored as JSON files.
- REST endpoint `/projects/:id/sessions/:id` → Replace with `/projects/:id/conversations` (ephemeral) + `/projects/:id/insights` (persistent CRUD)
- Storage structure `sessions/{session-id}.json` → Replace with `insights/{insight-id}.json`
- "Session Format: JSON with messages array" → Replace with Insight format (structured object with origin, extracted content, tags, highlights)
- The Decision Summary table row "Session Storage" needs reframing

**2. `project-structure-boundaries.md`**
- Frontend file structure: `session.service.ts` → `conversation.service.ts` + `insight.service.ts`
- Frontend state: `session.state.ts` → `conversation.state.ts` + `insight.state.ts`
- Frontend types: `session.ts` → `conversation.ts` + `insight.ts`
- Backend handlers: `sessions.go` → `conversations.go` + `insights.go`
- Backend services: `session_service.go` → `conversation_service.go` + `insight_service.go`
- Backend storage: `session_store.go` → `insight_store.go` (conversations don't persist)
- Backend types: `session.go` → `conversation.go` + `insight.go`
- FR to Structure Mapping: "Session Management (FR14-17)" label → "Conversation & Insight Management (FR14-22)"
- Add new components from UX spec: `context-indicator`, `highlight-popover`, `insight-panel`, `insight-card`, `attach-context-picker`

**3. `implementation-patterns-consistency-rules.md`**
- TS variable example `currentSession` → `currentConversation` or `activeConversation`
- Endpoint naming `/sessions` → `/conversations` + `/insights`
- WebSocket event `message:start` payload `session_id` → `conversation_id`

**4. `project-context-analysis.md`**
- "Session Management FR14-17" label → "Conversation & Insight Management FR14-22"
- "Session Persistence" in cross-cutting concerns → "Insight Persistence" (conversations are ephemeral)
- FR count: 32 → 37

### Reference Documents
- Updated PRD: `_bmad-output/planning-artifacts/prd/` (see functional-requirements.md for new FR14-22)
- Updated UX spec: `_bmad-output/planning-artifacts/ux-design-specification/` (see component-strategy.md for new components and state architecture)
- Brainstorming output: `_bmad-output/analysis/brainstorming-session-2026-02-03.md`

---

## Workstream 2: Epic 3 Story 3.3 Split + Epic 4 Rewrite

**Agent:** SM (or PM with ES workflow)
**Scope:** Rewrite Epic 4 stories and split Story 3.3 into multiple stories based on brainstorming + UX outputs

### Epic 3 -- Story 3.3 Split

Story 3.3 is currently "Agent Selection & Badge" with a redesign flag. Based on brainstorming + UX work, it likely needs to become multiple stories. The flag text lists:
- Agent selection = new conversation (not mid-conversation switch)
- Multi-agent invocation (party-mode style)
- Conversation lifecycle: compact into Insight, discard, keep working
- Context management across agent switches
- How returning to a previous agent/topic works

**Suggested story breakdown** (PM recommendation, SM should validate):
- **Story 3.3a:** Agent Selection with Parallel Conversation Support (agent selection starts a new conversation, previous conversation enters lifecycle prompt)
- **Story 3.3b:** Context Indicator Component (gas-gauge context window usage display)
- **Story 3.3c:** Text Highlighting in Conversations (select + color-highlight passages)
- **Story 3.3d:** Conversation Lifecycle (keep working / compact / discard prompt)
- **Story 3.3e:** Insight Creation via Compaction (extraction agent reads conversation + highlights, produces structured Insight)
- **Story 3.3f:** Insight Library Panel (browse, filter, manage Insights per project)
- **Story 3.3g:** Attach Context / Insight Injection (attach Insights, project files, uploads to new conversations with context cost preview)

These may need renumbering (3.3, 3.4, 3.5...) depending on whether they should be new stories or sub-stories.

**New FRs these stories must cover:**
- FR14: Conversations are session-bound
- FR15: Compact conversation into Insight
- FR16: Browse/manage Insight library
- FR18: Attach context with cost preview
- FR19: Context window usage indicator
- FR20: Force compact/discard at 100% context
- FR21: Text highlighting
- FR22: End-of-conversation lifecycle actions

### Epic 4 -- Complete Rewrite

Epic 4 "Session Continuity & Context" is built entirely on the old persistent-session model. Every story except 4.4 needs fundamental redesign.

**Story 4.1 (Session Persistence):** DELETE or fundamentally rewrite. Old: auto-save conversations to JSON. New: Conversations are ephemeral. Insight persistence is handled by the extraction agent + compaction flow (covered by new Epic 3 stories). Story 4.1 may become about crash recovery for in-flight conversations (auto-draft).

**Story 4.2 (Session Resume):** DELETE or fundamentally rewrite. Old: load full conversation history. New: Users start fresh conversations and inject Insights for context. No "resume" in the traditional sense.

**Story 4.3 (Session List View):** DELETE. Replaced by Insight Library Panel (new Epic 3 story).

**Story 4.4 (Context Injection):** KEEP with updates. The XML injection pattern is still valid. Update language: "start or resume a conversation" → "start a conversation." Add: Insight injection as additional context source alongside project state/artifacts.

**Story 4.5 (Instant Resume Flow):** FUNDAMENTALLY REWRITE. Old: reopen app → resume last session. New: reopen app → see phase graph + Insight library → start fresh conversation with relevant Insights attached. The "productive in 60 seconds" goal survives but the mechanism changes.

**Consider:** Epic 4 may need a new name. "Session Continuity & Context" assumes sessions continue. Something like "Context & Knowledge Management" or "Insight-Driven Context" might fit better. Or parts may fold into Epic 3 if the story split absorbs the Insight lifecycle.

### Reference Documents
- Updated PRD: `_bmad-output/planning-artifacts/prd/` (all files updated)
- Updated UX spec: `_bmad-output/planning-artifacts/ux-design-specification/` (4 files updated -- see index.md)
- Brainstorming output: `_bmad-output/analysis/brainstorming-session-2026-02-03.md`
- Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-03.md`
- Updated requirements-inventory: `_bmad-output/planning-artifacts/epics/requirements-inventory.md`

### Important: What NOT to Reference
- Do NOT use old FR numbers from architecture docs' session model descriptions -- those are semantically stale
- Do NOT reference Epic 4's current story content as a starting point -- it assumes the old model
- DO use the PRD's functional-requirements.md as the source of truth for FR content
- DO use the UX spec's component-strategy.md for component definitions and state architecture
- DO use the brainstorming output for the conceptual model

---

## Execution Order Recommendation

1. **Architecture first** -- so that when stories are written, they can reference correct architectural patterns
2. **Epic 3 Story 3.3 split second** -- defines the new Insight/conversation components
3. **Epic 4 rewrite last** -- may shrink significantly once Epic 3 absorbs Insight lifecycle stories
