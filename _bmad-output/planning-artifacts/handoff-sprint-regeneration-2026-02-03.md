# Sprint Status Regeneration Handoff

**Date:** 2026-02-03
**From:** SM (Bob) -- Epic 3/4 rewrite session
**Action:** Run [SP] Sprint Planning to regenerate sprint-status.yaml

---

## Context: What Changed

A conversation model redesign (Sprint Change Proposal CP-5) cascaded through the entire planning stack. The PM, UX Designer, Architect, and SM all completed their workstreams. The story structure has changed significantly.

### Epic 3: Agent Conversation Experience (was 6 stories, now 11)

**Unchanged stories:**
- Story 3.1: WebSocket Connection & Streaming
- Story 3.2: Chat Service & Message Sending
- Story 3.4: Chat Panel & Conversation Blocks
- Story 3.5: Markdown Renderer
- Story 3.6: Thinking Content Display

**Rewritten story (was flagged for redesign):**
- Story 3.3: Agent Selection & Parallel Conversations (FR10, FR14) -- replaces old "Agent Selection & Badge" with parallel conversation support and ephemeral conversation model

**New stories (split from old 3.3):**
- Story 3.7: Context Indicator (FR19, FR20)
- Story 3.8: Text Highlighting in Conversations (FR21)
- Story 3.9: Conversation Lifecycle (FR15, FR20, FR22)
- Story 3.10: Insight Library (FR16)
- Story 3.11: Attach Context & Insight Injection (FR18)

**FRs now covered by Epic 3:** FR9-11, FR13-16, FR18-22

### Epic 4: Context & Knowledge Management (was 5 stories, now 2)

**Renamed from:** "Session Continuity & Context"

**Deleted stories:**
- Old 4.1 (Session Persistence) -- absorbed by Epic 3 Insight lifecycle
- Old 4.2 (Session Resume) -- replaced by Insight injection model
- Old 4.3 (Session List View) -- replaced by Insight Library (Epic 3, Story 3.10)

**Kept (renumbered):**
- Story 4.1: Context Injection (was 4.4) -- updated to include `<attached_insights>` in XML contract
- Story 4.2: Instant Resume Flow (was 4.5) -- rewritten for phase graph + Insight library + fresh conversation model

**FRs now covered by Epic 4:** FR12

### Supporting Files Already Updated
- `epic-list.md` -- Epic 3/4 FR coverage and title
- `requirements-inventory.md` -- FR Coverage Map, UX sections, component list
- Architecture docs (4 files) -- semantic rewrite completed by Architect
- PRD (all files) -- updated by PM
- UX spec (4 files) -- updated by UX Designer

---

## What To Do

Run [SP] Sprint Planning to regenerate sprint-status.yaml from the updated epic files. The epic files are the source of truth -- all stories are correctly defined and numbered. No manual adjustments should be needed beyond what the SP workflow produces.
