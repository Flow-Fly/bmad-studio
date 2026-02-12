# Sprint Change Proposal: Epic 3 Research Alignment

**Date:** 2026-02-03
**Triggered By:** Three technical research spikes completed 2026-02-02
**Change Scope:** Moderate
**Affected Epics:** Epic 3 (primary), Epic 7 (minor), Architecture doc

---

## Section 1: Issue Summary

### Problem Statement

Three technical research spikes were completed on 2026-02-02, prior to Epic 3 (Agent Conversation Experience) sprint start:

1. **Claude API Access Model** -- Establishes BYOK (Bring Your Own Key) as the sole auth model for Epic 3. Direct OAuth/subscription usage is explicitly prohibited by Anthropic.
2. **Ollama Test Harness** -- Defines a two-layer testing strategy (mock NDJSON server + real Ollama) for zero-cost streaming tests.
3. **Streaming Conventions** -- Proposes specific WebSocket protocol (`chat:*` namespace), Go pipeline architecture, provider interface, and conversation storage patterns.

The research findings reveal that Epic 3's current story acceptance criteria use outdated protocol naming, miss key capabilities (cancel/stop), and lack specificity about the provider abstraction and streaming architecture. Since Epic 3 has not yet started implementation, this is the optimal time to align stories with research.

### Evidence

- Research documents located at: `_bmad-output/planning-artifacts/research/technical-*-2026-02-02.md`
- All three documents are high-confidence, multi-source-verified technical research
- Protocol naming conflict: Stories use `message:*`, research establishes `chat:*` namespace
- Missing cancel functionality: No story covers stream cancellation
- Architecture doc's provider interface doesn't match research recommendation

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact Level | Details |
|------|-------------|---------|
| **Epic 3** | **Significant** | 4 of 6 stories need AC updates; cancel capability added; protocol naming aligned |
| **Epic 7** | Minor | Story 7.4 event name reference update (`message:end` -> `chat:stream-end`) |
| **Epic 4** | None | Storage location confirmed as centralized (`~/bmad-studio/`); no changes needed |
| **Epics 0,1,2,5,6** | None | No impact |

### Story Impact (Epic 3)

| Story | Change Type | Summary |
|-------|------------|---------|
| **3.1 WebSocket Streaming** | AC update + addition | Protocol names, cancel AC, pipeline architecture, timeout |
| **3.2 Chat Service** | AC update | Provider interface details, SDK reference, event types |
| **3.3 Agent Selection** | AC update + flag | Agent selection = new conversation; flagged for full redesign |
| **3.4 Chat Panel** | No change | ACs remain valid as-is |
| **3.5 Markdown Renderer** | No change | ACs remain valid as-is |
| **3.6 Thinking Display** | AC update | `chat:thinking-delta` streaming protocol alignment |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| `core-architectural-decisions.md` | WebSocket event names (`message:*` vs `chat:*`) and Provider interface signature | Update to match research |
| PRD | No conflict | FRs are high-level enough; no changes needed |
| UX Design Spec | No conflict | Research aligns with UX patterns |
| Epics/Stories doc | See story impact above | Update specific ACs |

### Technical Impact

- No code changes required (Epic 3 not yet implemented)
- Architecture document needs protocol section update
- No infrastructure or deployment changes

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

**Rationale:**
- Epic 3 is pre-implementation -- ideal time for refinement
- Changes are AC updates, not structural rewrites
- Research is high-confidence and well-sourced
- No timeline impact
- Risk: Low -- all changes are additive or corrective

**Effort Estimate:** Low -- story AC edits and one architecture doc update
**Risk Level:** Low -- no implementation to rework
**Timeline Impact:** None -- these are pre-sprint refinements

### Alternatives Considered

- **Rollback:** N/A -- no implementation exists
- **MVP Review:** N/A -- MVP scope is not reduced; research enhances Epic 3

---

## Section 4: Detailed Change Proposals

### CP-1: Story 3.1 -- WebSocket Protocol Event Names

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.1, Acceptance Criteria (second block)

**OLD:**
```
**Given** a WebSocket connection exists
**When** a message is sent
**Then** the backend emits `message:start` with session_id, message_id, agent
**And** `message:chunk` events stream content fragments with index
**And** `message:end` signals completion with optional usage stats
**And** `message:error` is emitted if an error occurs
```

**NEW:**
```
**Given** a WebSocket connection exists
**When** a message is sent
**Then** the backend emits `chat:stream-start` with conversationId, messageId, model
**And** `chat:text-delta` events stream content fragments
**And** `chat:thinking-delta` events stream thinking/reasoning content when available
**And** `chat:stream-end` signals completion with token usage stats
**And** `chat:error` is emitted with error code if an error occurs
**And** all chat events use the `chat:` namespace prefix on the shared WebSocket
```

**Justification:** Research establishes `chat:*` namespace to coexist with existing `artifact:*` and `workflow:*` events. `conversationId` replaces `session_id` for clarity. Thinking deltas are a distinct event type per Claude API SSE format.

---

### CP-2: Story 3.1 -- Add Cancel/Stop Streaming

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.1, New acceptance criteria block

**ADD:**
```
**Given** a streaming response is in progress
**When** the user sends a `chat:cancel` message with conversationId
**Then** the backend cancels the active LLM request via context cancellation
**And** a `chat:stream-end` event is emitted with partial content flagged
**And** the partial response is preserved in the conversation
**And** the user can send a new message immediately after cancellation
```

**Justification:** Cancel is a core requirement for bidirectional WebSocket. Go pipeline uses `context.WithCancel` for teardown. Standard in all reference apps.

---

### CP-3: Story 3.1 -- Streaming Pipeline & Timeout

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.1, Acceptance Criteria (fourth block)

**OLD:**
```
**Given** a streaming response is in progress
**When** chunks arrive
**Then** they are assembled in order using the index field
**And** provider timeouts are supported up to 120 seconds for long responses (NFR9)
```

**NEW:**
```
**Given** a streaming response is in progress
**When** chunks arrive
**Then** text deltas are appended to the in-progress message
**And** the Go backend uses a goroutine pipeline: Provider -> ChatService -> Hub
**And** a buffered channel (size 64) decouples provider HTTP I/O from WebSocket I/O
**And** provider timeouts are enforced via `context.WithTimeout` up to 5 minutes for extended thinking responses
```

**Justification:** Go pipeline architecture with channel-based streaming. 120s timeout too short for extended thinking. Append-based model replaces index-based assembly.

---

### CP-4: Story 3.2 -- Provider Abstraction Details

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.2, Acceptance Criteria (first block)

**OLD:**
```
**Given** I have a configured provider and open project
**When** I type a message and press Enter (or Cmd+Enter for multi-line)
**Then** the message is sent to the backend
**And** the backend routes it to the selected provider
**And** my message appears in the conversation immediately
```

**NEW:**
```
**Given** I have a configured provider (API key validated) and open project
**When** I type a message and press Enter (or Cmd+Enter for multi-line)
**Then** the message is sent via `chat:send` WebSocket event with conversationId, message content, model, and provider
**And** the backend ChatService routes it through the Provider interface (`StreamChat(ctx, messages, options) -> chan StreamEvent`)
**And** the Go backend consumes the Claude API SSE stream using `anthropic-sdk-go` and translates to `chat:*` WebSocket events
**And** my message appears in the conversation immediately (optimistic UI)
```

**Justification:** Specifies provider interface, SDK, and event types per research. "API key validated" emphasizes BYOK from Claude API Access research.

---

### CP-5: Story 3.3 -- Agent Selection Model Update

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.3, Acceptance Criteria (third block)

**OLD:**
```
**Given** I select a different agent
**When** the selection is made
**Then** the agent badge updates to show the new agent
**And** subsequent messages go to the new agent
**And** the conversation continues (context preserved)
```

**NEW:**
```
**Given** I select a different agent
**When** the selection is made
**Then** the agent badge updates to show the new agent
**And** a new conversation is initiated with the selected agent
**And** the previous conversation is preserved and accessible
```

**FLAGGED FOR REDESIGN:** This story needs a deeper design pass to address:
- Agent selection = new conversation (not mid-conversation switch)
- Multi-agent invocation within a conversation (party-mode style)
- Conversation lifecycle: save as "bubble" (compacted brief), discard, start fresh
- Context management across agent switches
- How returning to a previous agent/topic works

This redesign should happen before Epic 3 sprint starts, potentially as a mini design session.

**Justification:** User's vision for conversation model differs from original story assumptions. Minimal update applied; full redesign flagged.

---

### CP-6: Story 3.6 -- Thinking Content Protocol

**File:** `epics/epic-3-agent-conversation-experience.md`
**Section:** Story 3.6, Acceptance Criteria (first block)

**OLD:**
```
**Given** the provider returns thinking/reasoning content
**When** the message renders
**Then** thinking content is displayed in a collapsible section
**And** it is visually distinct (muted, different background)
```

**NEW:**
```
**Given** the provider streams `chat:thinking-delta` events during a response
**When** thinking deltas arrive
**Then** thinking content accumulates in a separate section from the main text
**And** thinking content is displayed in a collapsible section with muted styling
**And** it is visually distinct (different background, smaller font)
**And** thinking content streams in real-time alongside text content (not after)
```

**Justification:** Claude's SSE sends `thinking_delta` as a separate interleaved content block. Research maps this to `chat:thinking-delta` WebSocket events that stream in real-time alongside text.

---

### CP-7: Architecture Doc -- Protocol & Provider Update

**File:** `architecture/core-architectural-decisions.md`
**Section:** API & Communication + Provider Architecture

**OLD WebSocket Events:**
```
- `message:start` -- Begin streaming response
- `message:chunk` -- Content fragment
- `message:end` -- Response complete
- `message:error` -- Error occurred
- `connection:status` -- Health/reconnection
```

**NEW WebSocket Events:**
```
**Chat Namespace (Epic 3):**
- `chat:stream-start` -- Begin streaming response (conversationId, messageId, model)
- `chat:text-delta` -- Text content fragment
- `chat:thinking-delta` -- Thinking/reasoning content fragment
- `chat:tool-start` / `chat:tool-delta` / `chat:tool-end` -- Tool call streaming
- `chat:stream-end` -- Response complete with token usage stats
- `chat:error` -- Error with code (provider_timeout, rate_limited, overloaded)
- `chat:send` -- Client->Server: send user message
- `chat:cancel` -- Client->Server: cancel in-progress stream

**Existing Events (unchanged):**
- `artifact:created/updated/deleted` -- File system artifact changes
- `workflow:status-changed` -- Workflow state transitions
- `connection:status` -- Health/reconnection
```

**OLD Provider Interface:**
```go
type Provider interface {
    SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)
    ValidateCredentials() error
    ListModels() ([]Model, error)
}
```

**NEW Provider Interface:**
```go
type Provider interface {
    StreamChat(ctx context.Context, messages []Message, options ChatOptions) (<-chan StreamEvent, error)
    ValidateCredentials() error
    ListModels() ([]Model, error)
}
```

**Justification:** Aligns architecture with streaming conventions research. `chat:` namespace coexists with `artifact:` and `workflow:` namespaces. `StreamChat` emphasizes streaming-first design.

---

### CP-8: Epic 7 (Story 7.4) -- Event Name Reference

**File:** `epics/epic-7-operational-awareness.md`
**Section:** Story 7.4, last acceptance criteria

**OLD:**
```
**Given** a streaming response completes
**When** `message:end` includes usage stats
**Then** the session cost updates in real-time
```

**NEW:**
```
**Given** a streaming response completes
**When** `chat:stream-end` includes usage stats
**Then** the session cost updates in real-time
```

**Justification:** Event name consistency with the new `chat:*` namespace.

---

## Section 5: Implementation Handoff

### Change Scope Classification: Moderate

**Rationale:**
- Multiple stories across one epic need AC updates
- Architecture document needs protocol section update
- One story (3.3) flagged for full redesign
- No code changes needed (pre-implementation)

### Handoff Plan

| Recipient | Responsibility | Deliverable |
|-----------|---------------|-------------|
| **PM / Analyst** | Update Story 3.3 with full conversation model redesign | Redesigned Story 3.3 + potential new stories for conversation lifecycle |
| **Dev Team** | Apply CP-1 through CP-8 to epic and architecture files | Updated `epic-3-agent-conversation-experience.md`, `epic-7-operational-awareness.md`, `core-architectural-decisions.md` |
| **Architect** | Review architecture doc changes for consistency with overall system | Validated architecture update |

### Success Criteria

- [ ] All 8 CPs applied to their respective files
- [ ] Story 3.3 redesign completed before Epic 3 sprint starts
- [ ] Architecture doc protocol section matches epic story ACs
- [ ] No conflicting event names remain across epics
- [ ] Research documents linked as references in updated stories

### Recommended Next Steps

1. **Apply CPs 1-8** to the epic and architecture files (direct edits)
2. **Redesign Story 3.3** conversation model based on user's vision (agent selection = new conversation, bubbles, party-mode invocation)
3. **Create tech-spec or story for API key settings UI** if not already covered by Epic 1's provider configuration stories (FR18-21)
4. **Begin Epic 3 sprint planning** with updated stories
