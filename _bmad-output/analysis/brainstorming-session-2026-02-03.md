---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Story 3.3 conceptual architecture - bubbles, agent-scoped conversations, party-mode-in-chat, conversation state lifecycle'
session_goals: 'Flesh out edge cases and interactions between concepts; refine initial positions on bubbles, agent scope, party-mode invocation, and discard vs save'
selected_approach: 'ai-recommended'
techniques_used: ['Assumption Reversal', 'Morphological Analysis', 'Chaos Engineering']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Flow
**Date:** 2026-02-03

## Session Overview

**Topic:** Story 3.3 conceptual architecture -- the mental models and mechanics of bubbles, agent-scoped conversations, party-mode-in-chat invocation, and conversation state lifecycle (discard vs. save)

**Goals:**
- Stress-test edge cases -- what breaks when these concepts collide with real usage?
- Map interactions -- how do bubbles, agent scope, party-mode, and state lifecycle affect each other?
- Refine initial positions -- sharpen the working definitions already established

### Context Guidance

_Story 3.3 needs conceptual refinement before formalization. Four core concepts need exploration:_
1. _Bubbles as extractable conversation summaries for later reuse_
2. _One conversation per agent model_
3. _Party-mode triggered internally by active agent on user mention_
4. _Discard vs. save as conversation lifecycle endpoints_

### Session Setup

_Session configured for edge-case exploration and concept refinement. Starting positions established as working hypotheses to pressure-test rather than fixed decisions._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Story 3.3 conceptual architecture with focus on edge cases, interactions, and position refinement

**Recommended Techniques:**

- **Assumption Reversal (deep):** Surface and challenge hidden assumptions in all 4 starting positions -- expose what's load-bearing vs. arbitrary
- **Morphological Analysis (deep):** Systematically map every combination of the 4 concept dimensions to reveal interaction edge cases
- **Chaos Engineering (wild):** Deliberately break the emerging model to find fragility points and stress-test robustness

**AI Rationale:** This is a pressure-testing session, not pure ideation. The sequence moves from exposing hidden assumptions, to systematically mapping the interaction space, to adversarially breaking what emerges. Each phase builds on the previous to produce a battle-tested conceptual model.

## Phase 1: Assumption Reversal Results

### Concept 1: Bubbles → Insights

**Key Refinements:**
- **Renamed to "Insights"** -- structured objects, not text blobs
- **Structured format:** Origin context (what was discussed) + extracted idea + tags
- **Dual compaction modes:** Passive (full summary when nothing selected) or Active (extract user-selected highlights)
- **Independent lifecycle:** Insights exist in their own layer, separate from conversations
- **Agent-agnostic:** Insights don't track which agent persona generated the idea
- **One Insight per extraction (v1):** One conversation compaction = one Insight artifact
- **Conversations are source material:** Ephemeral raw material; Insights are the durable artifact
- **Multi-topic conversations:** A single conversation can span multiple topics but still produces one Insight per extraction
- **Zero-Insight conversations:** Valid outcome -- not every conversation produces value

### Concept 2: One Conversation Per Agent → Disposable Sessions

**Key Refinements:**
- **Disposable sessions:** Conversations are temporary working sessions, not persistent records
- **Start blank:** New conversations have no automatic context from previous sessions
- **User-driven context:** Users manually inject Insights or prompt agent to search stored Insights
- **Parallel sessions:** Multiple agent conversations can run simultaneously
- **User as integration layer:** No cross-conversation awareness between parallel sessions; user carries context mentally
- **Provider-agnostic:** Architecture works with any LLM, not tied to specific provider features

### Concept 3: Party Mode In-Chat → Already Handled

**Key Refinements:**
- **BMAD-handled mechanic:** Party mode invocation and multi-agent persona management are existing features
- **Stateless persona loads:** Invoking an agent via party mode loads a fresh persona, no connection to parallel sessions
- **Party personas inherit full conversation context:** Can read back in conversation history and decide to load referenced files independently
- **No special Insight handling:** The conversation IS the shared context for party mode

### Concept 4: Discard vs Save → Three-Part Lifecycle

**Key Refinements:**
- **Session-bound conversations:** App close = conversations gone (no persistence across app restarts)
- **Compact:** Extract Insights via dedicated extraction agent with fresh context, then conversation deleted
- **Discard:** Conversation deleted, nothing extracted, permanent, no undo (v1)
- **Keep working:** Conversation stays open until user decides
- **Context fill indicator:** UI shows context window usage as percentage, model-specific
- **Hard stop at context full:** Forced to compact/discard and start fresh
- **Minimal quit UX:** "Multiple conversations open, quit anyway? Yes/No" -- single prompt, user handles the rest

## Phase 2: Morphological Analysis Results

### Interaction Matrix -- Key Findings

**Extraction agent pattern (Refinement #15) resolved most dangerous combos:**
- Context full + any extraction → works fine, fresh agent handles it
- Party mode + extraction → fresh agent reads whole log, no persona tracking needed
- Long conversation + passive extraction → acceptable lossy summary; highlighting is the precision tool

**Insight injection interactions:**
- Injection shows context impact in UI before loading (% cost visible)
- Party personas invoked after injection can read back and see injected Insights in conversation history
- Injection consumes context proportionally -- matters more with smaller models

**App lifecycle interactions:**
- Graceful close → single warning prompt, user handles their conversations
- Force quit → everything lost, highlights included (v1)
- Highlights are ephemeral UI state, not persisted (Local Storage noted as cheap future improvement)

**Discard is permanent:**
- No trash bin, no undo, no grace period (v1)
- User was warned at the prompt moment

### Architecture Decisions That Held Under Pressure

1. **Extraction agent with fresh context** -- neutralized all context-full scenarios
2. **User as orchestrator** -- eliminated cross-session sync complexity
3. **One Insight per extraction** -- kept data model simple across all combos
4. **Conversations ephemeral / Insights durable** -- clean separation held in every scenario tested

## Phase 3: Chaos Engineering Results

### Scenarios Tested

| Scenario | What Breaks? | Resolution |
|---|---|---|
| **Insight Hoarder** (500+ Insights accumulate) | Search/browse becomes useless | User discipline + management tools: "used" tags, sort by recency, archive |
| **Model Swapper** (switch model mid-convo) | Context mismatch, history too large for new model | Model locked per conversation (v1) |
| **Extraction Agent Paradox** (convo too large for extraction agent) | Extraction agent can't process full conversation | Does its best with what it can read; highlighting compensates |
| **Party Crasher** (too many personas in party) | Context fills fast, conversation chaotic | BMAD-managed; user manages complexity |
| **Accidental Insight** (extraction misses important stuff) | Valuable ideas lost, conversation already deleted | Cost of not highlighting; no preview step |
| **Insight Injector Loop** (summary of summary of summary) | Signal degrades over telephone-game iterations | User-managed; system doesn't prevent |

### Design Philosophy Confirmed

Every chaos scenario produced the same answer: **The system is honest, simple, and visible. The user is in charge. V1 doesn't try to be smart.**

### V1 Feature Emerged from Chaos

**"Used" tag on Insights** -- when an Insight is injected into a conversation, it can be tagged as "used" with optional auto-archival. Lightweight lifecycle signal that helps with accumulation.

## Idea Organization and Prioritization

### Theme 1: The Insight System (PRIORITY -- Core Data Model)

The novel concept that everything else orbits around. This is the new thing that needs to be designed right.

- **Data shape:** Structured object -- origin context (what was discussed) + extracted idea + tags
- **Creation:** Dual compaction modes -- passive (full conversation summary) or active (user-selected highlights extraction)
- **Extraction:** Handled by a dedicated extraction agent with fresh context, decoupled from the original conversation's context limits
- **Granularity:** One Insight per extraction (v1). No auto-splitting by topic
- **Attribution:** Agent-agnostic -- tracks what was discussed, not which persona said it
- **Lifecycle:** Independent from conversations. Can be deleted by user. "Used" tag when injected into a conversation (optional auto-archival)
- **Management:** Sort by recency, tag-based grouping, user-managed accumulation
- **Injection:** User manually selects which Insights to load into new conversations; UI shows context cost percentage before injection

### Theme 2: Conversation Architecture

- One active disposable session per agent, multiple agents in parallel
- Start blank -- no automatic context from previous sessions
- User injects Insights manually or prompts agent to search stored Insights
- Model locked per conversation (v1)
- Provider-agnostic -- works with any LLM
- Context window = agent memory (has limits); UI scrollback = always available (no limits)
- User is the integration layer across parallel sessions

### Theme 3: UX & System Visibility

- Context fill percentage displayed in UI, model-specific
- Insight injection shows context cost before loading
- Hard stop at context full -- must compact or discard, start fresh
- Minimal quit prompt: "Multiple conversations open, quit anyway? Yes/No"
- No safety nets in v1: no undo on discard, no extraction preview, no trash bin
- Highlights are ephemeral UI state (v1)

### Theme 4: Party Mode Integration

- Fully BMAD-handled -- no new mechanics to design for Story 3.3
- Stateless persona loads, no connection to parallel sessions
- Full conversation context inherited including injected Insights
- No special Insight handling -- conversation IS the shared context
- Party size and chaos management is user's responsibility

### Theme 5: Design Philosophy

> **The system is honest, simple, and visible. The user is in charge. V1 doesn't try to be smart.**

- User as orchestrator / integration layer in every scenario
- System provides tools and visibility, not guardrails or automation
- Complexity deferred, not designed around
- User agency over system paternalism

### Deferred Enhancements (Not V1)

| Enhancement | Value | Complexity |
|---|---|---|
| Highlighting with semantic tags (important/remember/disagree) | Dramatically improves extraction precision | Medium -- UI + extraction agent awareness |
| Smart extraction (agent-detected interesting moments) | Reduces user effort for passive compaction | Medium -- extraction agent intelligence |
| Conversation persistence across app restarts | Resume sessions after closing app | High -- serialize/deserialize full state |
| Multi-Insight extraction from one conversation | Better for multi-topic conversations | Low -- extraction agent splitting logic |
| Trash bin / soft-delete grace period | Safety net for accidental discards | Low -- deferred deletion |
| Local Storage for highlight persistence | Survive force-quit | Low -- incremental save |
| Insight workspace analysis against product state | Auto-infer next actions from accumulated Insights | High -- requires product state awareness |

## Session Summary

### What Changed

| Concept | Before Session | After Session |
|---|---|---|
| Bubbles | Vague -- "compacted conversation summaries" | **Insights** -- structured objects with origin, idea, and tags in their own persistence layer |
| Conversations | Implied persistence, one per agent | **Disposable sessions** -- ephemeral, parallel, start blank, model-locked, session-bound |
| Party Mode | Needed design work | **Already solved** -- BMAD handles it, no special integration needed |
| Save/Discard | Binary choice | **Three-part lifecycle** with extraction agent, context indicators, and minimal quit UX |

### Key Architectural Decisions

1. **Extraction agent with fresh context** -- the single most impactful decision, neutralized all context-related edge cases
2. **User as orchestrator** -- eliminated cross-session sync and auto-magic complexity
3. **Conversations ephemeral / Insights durable** -- clean separation that held under every scenario tested
4. **One Insight per extraction (v1)** -- kept data model simple without blocking future enhancement

### Next Steps

1. **Refine Story 3.3** using this brainstorming output as input -- the conceptual model is now clear enough to formalize
2. **Design the Insight data model** -- the structured object shape (origin + idea + tags) needs concrete schema work
3. **Design the extraction agent** -- its behavior, what it reads, how it produces Insights
4. **Define the conversation lifecycle states** and transitions in the UI/backend
5. **Determine context percentage calculation** per model provider
