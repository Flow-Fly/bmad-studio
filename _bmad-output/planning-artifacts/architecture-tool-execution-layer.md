---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-02-04'
inputDocuments:
  - planning-artifacts/prd/index.md (8 files)
  - planning-artifacts/prd/executive-summary.md
  - planning-artifacts/prd/functional-requirements.md
  - planning-artifacts/prd/non-functional-requirements.md
  - planning-artifacts/prd/project-scoping-phased-development.md
  - planning-artifacts/prd/user-journeys.md
  - planning-artifacts/prd/success-criteria.md
  - planning-artifacts/prd/desktop-app-specific-requirements.md
  - planning-artifacts/architecture/index.md (6 files)
  - planning-artifacts/architecture/core-architectural-decisions.md
  - planning-artifacts/architecture/implementation-patterns-consistency-rules.md
  - planning-artifacts/architecture/project-structure-boundaries.md
  - planning-artifacts/product-brief-bmad-studio.md
  - planning-artifacts/research/technical-ollama-test-harness-research-2026-02-02.md
  - planning-artifacts/research/technical-streaming-conventions-research-2026-02-02.md
  - planning-artifacts/research/technical-claude-api-access-model-research-2026-02-02.md
  - project-context.md
  - implementation-artifacts/epic-3-retro-2026-02-04.md
  - docs/automaker-study/index.md
  - docs/automaker-study/provider-architecture.md
  - docs/automaker-study/event-websocket-architecture.md
  - docs/automaker-study/context-injection-pattern.md
workflowType: 'architecture'
project_name: 'bmad-studio'
user_name: 'Flow'
date: '2026-02-04'
scope: 'Tool Execution Layer — adding agentic tool use across cloud and local providers'
---

# Architecture Decision Document — Tool Execution Layer

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

_Scope: Adding a tool execution layer to bmad-studio that enables LLM agents to use tools (file read/write, bash, web search, MCP) across all providers (Claude, OpenAI, Ollama), integrated with the existing WebSocket streaming pipeline and BMAD workflow orchestration model._

## Project Context Analysis

### Requirements Overview

**Existing Functional Requirements (Relevant to Tool Execution):**
- FR9-FR13: Agent conversation streaming — the pipeline tool calls must flow through
- FR23-FR26: Provider configuration — tool calling capabilities vary per provider
- FR33-FR35: Offline/Ollama support — local models need harness for tool calling
- FR4-FR8: Workflow navigation — workflows should scope agent tool access

**New Functional Requirements (Tool Execution Layer):**
- Agents can invoke tools (file read/write, bash, web search) during conversations
- Tool calls and results stream through WebSocket to frontend in real-time
- Tool catalog is provider-agnostic — same tools available regardless of model
- BMAD workflows define which tools are available per agent/phase
- MCP servers extend the tool catalog without code changes
- Users see tool execution activity in the conversation UI
- Bash execution is sandboxed with configurable restrictions
- Tool approval model: per-call confirmation or pre-approved by workflow

**Non-Functional Requirements (Architectural Impact):**
- NFR1 (500ms first token) — tool call loop adds latency between turns; must not block streaming
- NFR5-NFR7 (Security) — tool execution introduces new attack surface (bash, file write)
- NFR8-NFR10 (Provider resilience) — tool call loop must handle provider errors mid-sequence
- NFR9 (120s timeout) — multi-turn tool loops can exceed this; need per-turn timeout, not per-conversation

**Scale & Complexity:**
- Primary domain: Full-stack (Go backend orchestration + TypeScript/React frontend)
- Complexity level: High — new execution engine, multi-turn protocol, provider bifurcation
- Estimated new architectural components: 6-8 (tool executor, tool registry, tool-call loop, MCP bridge, sandbox, frontend tool blocks, provider tool adapters, workflow tool scoping)

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|---|---|---|
| Provider interface is `<-chan StreamChunk` (text-only) | Existing architecture | Must extend StreamChunk for tool_call and tool_result types |
| ChatService is single-pass relay | Epic 3 implementation | Must refactor to support multi-turn tool-call loop |
| Ollama models vary in tool-calling support | Ollama research | Need dual strategy: native tools API + text-parsing harness |
| WebSocket is shared (chat: + artifact: + workflow:) | Streaming conventions research | Tool events use same chat: namespace with new event types |
| Conversations are ephemeral (in-memory) | Core architectural decisions | Tool execution state is also ephemeral — no persistence of tool results |
| Go backend runs as Electron child process | Desktop app requirements | Tool execution (bash, file I/O) runs in sidecar process context |
| BYOK model for API keys | Claude API research | Tool execution doesn't need API keys — runs locally |
| 468 existing tests, zero regressions | Epic 3 retro | New tool execution layer needs comprehensive test coverage |

### Cross-Cutting Concerns Identified

1. **Security & Sandboxing** — Bash execution, file write access, and path traversal prevention must be designed from day one. This affects tool executor, workflow scoping, and frontend confirmation UI.

2. **Provider Abstraction for Tools** — The current Provider interface streams text. Tool calling requires extending it to emit tool_use content blocks and accept tool_result injections. Claude and OpenAI handle this natively; Ollama needs a harness layer.

3. **Multi-Turn Orchestration** — Tool use is inherently multi-turn: model requests tool → executor runs → result injected → model continues. This loop must integrate with the existing WebSocket streaming so the frontend sees each phase in real-time.

4. **Workflow-Scoped Tool Permissions** — Different BMAD agents and workflows need different tool access. The Architect might get read-only + search; the Dev agent gets full file write + bash. This connects the tool system to the workflow/agent configuration.

5. **MCP Protocol Bridge** — MCP (Model Context Protocol) is the emerging standard for extensible tool access. Supporting it means bmad-studio's tool catalog grows without code changes.

6. **Frontend Tool Visibility** — Users need to see tool invocations, parameters, and results in the conversation UI. This is a new rendering pattern beyond text/thinking blocks.

7. **Conversation Context Growth** — Each tool call/result pair adds to the conversation context. With multi-step tool use, context can grow rapidly, making the existing context indicator (FR19-FR20) even more critical.

## Starter Template Evaluation

### Primary Technology Domain

Brownfield project — existing React + Vite + Electron + Go stack with 3 completed epics and 468 tests. No starter template needed. The tool execution layer is an additive architectural concern on the existing codebase.

### New Technology Components for Tool Execution

**No new frontend dependencies.** Tool call rendering uses existing React components and markdown renderer.

**Backend additions:**

| Component | Technology | New Dependency? |
|---|---|---|
| Tool call parsing (Claude) | anthropic-sdk-go | No — already used |
| Tool call parsing (OpenAI) | openai-go | No — already used |
| Tool call harness (Ollama) | Custom Go code | No — extends existing Ollama provider |
| Bash execution | os/exec + sandbox wrapper | No — Go stdlib |
| File I/O | os + path sandboxing | No — Go stdlib |
| MCP client | mcp-go | Yes — new dependency |
| Web search | External API client | Depends on chosen search provider |

### Selected Approach: Extend Existing Stack

**Rationale:** The existing architecture is well-suited for tool execution. The Provider interface needs extension (not replacement). The ChatService needs a loop (not a rewrite). The WebSocket event schema already planned for tool events. The Go stdlib provides everything needed for file I/O and process execution.

**Key decision:** Zero new frontend dependencies. One potential new Go dependency (mcp-go for MCP support). All other tool execution capabilities come from extending existing code and Go stdlib.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Tool Call Loop Architecture — ToolOrchestrator service
2. Provider Interface Extension — Extend StreamChunk types
3. Tool Registry & Definition — Static core + dynamic MCP registry
4. Ollama Tool Strategy — Native tools API only + capability metadata
5. Security & Sandbox Model — Tiered (Supervised/Guided/Autonomous)

**Important Decisions (Shape Architecture):**
6. File Path Sandbox — Dual-path (project root + central storage)
7. WebSocket Tool Event Schema — Uniform start/delta/result pattern
8. Multi-Turn Loop Control — Context-window-aware budget
9. Core Tool Catalog v1 — File read, file write, bash, web search + MCP scaffold

**Deferred Decisions (Post-v1):**
- MCP server management & transport layer (scaffold in place)
- Ollama text-parsing harness for models without native tool support
- Container-based process isolation (v1 trusts desktop app boundary)

### Decision 1: Tool Call Loop Architecture

**Choice:** New ToolOrchestrator service (Option B)

**Rationale:** ChatService remains a streaming relay. ToolOrchestrator manages the execute → inject → continue loop as a dedicated service. Clean separation of concerns — ChatService handles streaming, ToolOrchestrator handles tool intelligence.

**Affects:** ChatService, new ToolOrchestrator service, Provider interaction pattern

### Decision 2: Provider Interface Extension

**Choice:** Extend StreamChunk with new types (Option A)

**Rationale:** Add `tool_call` and `tool_result` StreamChunk types to the existing `<-chan StreamChunk` channel. Backwards compatible — existing consumers ignore new types. ToolOrchestrator accumulates partial tool input from the channel and acts when a complete tool call is received.

**Affects:** StreamChunk type, all Provider implementations, ChatService relay logic

### Decision 3: Tool Registry & Definition

**Choice:** Static core + dynamic MCP extension (Option B)

**Rationale:** Core tools (file_read, file_write, bash, web_search) are compiled Go structs registered at startup. MCP tools discovered at runtime from connected servers and added to the same registry. Single `ToolRegistry` with `Get()` and `ListForScope()` interface regardless of tool origin.

**Affects:** New ToolRegistry component, tool executor dispatch, MCP bridge (future)

### Decision 4: Ollama Tool Strategy

**Choice:** Native tools API only + capability metadata (Option D)

**Rationale:** Use Ollama's `/api/chat` tools parameter for models that support it (Llama 3.1+, Mistral, Qwen 2.5+). Models without native tool support work for plain chat only. Model metadata exposes `supportsTools: boolean` so the UI shows which models enable agentic workflows. No fragile text-parsing harness.

**Affects:** Ollama provider, model configuration/metadata, model selector UI

### Decision 5: Security & Sandbox Model

**Choice:** Tiered model — Supervised / Guided / Autonomous (Option D)

**Rationale:** Workflow/agent definitions declare tool permissions as the floor. User trust level is the override:
- **Supervised:** Every tool call requires user confirmation
- **Guided (default):** Dangerous tools (bash, file_write) require confirmation; safe tools (file_read, web_search) auto-approved
- **Autonomous:** All tools pre-approved per workflow definition; only violations prompt

Even in Autonomous mode, agents cannot use tools not declared in their workflow definition.

**Affects:** ToolOrchestrator approval logic, workflow/agent definition schema, frontend confirmation UI, user settings

### Decision 6: File Path Sandbox

**Choice:** Dual-path sandbox (Option A)

**Rationale:** Tool sandbox allows writes to two zones per project:
1. **Project root** — source code, tests, configs
2. **`~/bmad-studio/projects/{project-name}/`** — planning artifacts, _bmad-output, insights

Both paths are known at conversation start (project is already selected). No sync mechanism needed. Path traversal prevention applies to both zones independently.

**Affects:** Tool executor path validation, project context resolution, file_read/file_write tool implementations

### Decision 7: WebSocket Tool Event Schema

**Choice:** Uniform start/delta/result pattern (Option A)

**Rationale:** All tool calls emit the same event sequence:
```
chat:tool-start   → { toolId, toolName, input }
chat:tool-delta   → { toolId, outputChunk }
chat:tool-result  → { toolId, result, status }
```
Tools with no streaming output (file_read) emit start then immediately result with no deltas. Tools with streaming output (bash, web_search) emit deltas during execution. Frontend renders uniformly regardless of tool type.

**Affects:** WebSocket event schema, Hub broadcasting, frontend message model, conversation block rendering

### Decision 8: Multi-Turn Loop Control

**Choice:** Context-window-aware budget (Option B)

**Rationale:** The ToolOrchestrator tracks cumulative token usage (tool calls + results grow context). The loop stops when remaining context drops below a configurable threshold. This works for both cloud providers (finite context + cost) and Ollama (free but finite context). Integrates with the existing context indicator (gas gauge) — the same data drives both the UI indicator and the loop governor. Per-tool-execution timeout (e.g., 60s) prevents individual tools from hanging.

**Affects:** ToolOrchestrator loop logic, token counting, context indicator integration, provider token reporting

### Decision 9: Core Tool Catalog — v1 Scope

**Choice:** Core four + MCP scaffold (Option D)

**Rationale:** v1 ships four working tools:
- **file_read** — Read file contents within sandbox paths
- **file_write** — Write/create files within sandbox paths
- **bash** — Execute shell commands with restrictions (per trust level)
- **web_search** — Search the web via configurable search API (BYOK pattern)

MCP bridge interface exists in ToolRegistry (`RegisterMCP()`) but is not wired to actual MCP server management. Architecture is ready for MCP in the next iteration without blocking core tool functionality.

**Affects:** Tool executor implementations, ToolRegistry initialization, web search API configuration, MCP interface stub

### Decision Impact Analysis

**Implementation Sequence:**
1. StreamChunk type extension (Decision 2) — foundation for everything
2. ToolRegistry + core tool implementations (Decisions 3, 9)
3. ToolOrchestrator service (Decision 1) — the loop engine
4. Sandbox + path validation (Decisions 5, 6)
5. WebSocket tool events (Decision 7) — backend → frontend bridge
6. Frontend tool block rendering — UI for tool visibility
7. Ollama capability metadata (Decision 4) — provider-specific
8. Context-aware loop control (Decision 8) — tuning
9. Trust level UI + confirmation dialogs (Decision 5) — user settings

**Cross-Component Dependencies:**
- ToolOrchestrator depends on ToolRegistry (tool lookup) and StreamChunk extension (detection)
- WebSocket tool events depend on ToolOrchestrator (source of events)
- Frontend rendering depends on WebSocket events (data to display)
- Sandbox depends on project context (path resolution)
- Loop control depends on provider token reporting (context tracking)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**9 conflict areas identified** where AI agents implementing different parts of the tool execution layer could make incompatible choices. Each pattern below is mandatory for all agents.

### Pattern 1: Tool Definition & Registration

Every tool follows a single struct shape. No variations.

```go
type Tool struct {
    Name        string
    Description string
    InputSchema json.RawMessage
    Category    ToolCategory    // "file", "exec", "search", "mcp"
    DangerLevel DangerLevel     // "safe", "dangerous"
    Execute     func(ctx context.Context, input json.RawMessage) (*ToolResult, error)
}

type ToolResult struct {
    Output   string
    Metadata map[string]any
    IsError  bool
}
```

- Each tool in its own file: `backend/tools/file_read.go`, `backend/tools/bash.go`, etc.
- Registration at startup via `registry.RegisterCore(...)`
- MCP tools added via `registry.RegisterMCP(server)` (scaffold only in v1)

### Pattern 2: StreamChunk Tool Types

New `StreamChunk.Type` values for tool calls:

| Type | Fields Populated | Purpose |
|---|---|---|
| `tool_call_start` | `ToolID`, `ToolName` | Tool call block begins |
| `tool_call_delta` | `ToolID`, `Content` (partial JSON) | Incremental tool input |
| `tool_call_end` | `ToolID` | Tool call block complete, input ready to parse |

Extended `StreamChunk` fields:
```go
ToolID    string  // unique per tool call, zero-value when not tool chunk
ToolName  string  // populated on tool_call_start only
```

**Rule:** Providers that don't stream tool input incrementally (Ollama) emit `tool_call_start` → single `tool_call_delta` with full input → `tool_call_end`. Same sequence, no special case.

### Pattern 3: WebSocket Tool Event Payloads

```
chat:tool-start   → { messageId, toolId, toolName, input }
chat:tool-delta   → { messageId, toolId, chunk }
chat:tool-result  → { messageId, toolId, status, result, metadata? }
```

- `messageId` ties tool events to the parent assistant message
- `toolId` is unique per tool call within a message
- `input` is parsed JSON object, not string
- `metadata` is optional, tool-specific (file path, exit code, line count)
- `status` is `"success"` or `"error"`
- All field names: `camelCase` (unified convention across Go and TS)

### Pattern 4: ToolOrchestrator Loop

ChatService owns the loop. ToolOrchestrator owns individual executions.

```
ChatService.handleMessage(userMsg):
  1. Build messages array (history + userMsg)
  2. Add tool definitions from registry.ListForScope(workflow.ToolScope)
  3. Call provider.SendMessage(ctx, req) → stream channel
  4. Relay text/thinking chunks to Hub (existing behavior)
  5. Accumulate tool_call chunks by ToolID
  6. On tool_call_end:
     a. Broadcast chat:tool-start to Hub
     b. Check trust level → if confirmation needed, wait for approval
     c. Call orchestrator.HandleToolCall(ctx, conv, toolCall)
     d. Broadcast chat:tool-delta during execution (if streaming)
     e. Broadcast chat:tool-result when done
     f. Append tool_call + tool_result to messages array
     g. Check context budget → if over threshold, force text response
     h. GOTO step 3 (new provider call with updated messages)
  7. On stream end with no tool calls → relay chat:stream-end (done)
```

**Rules:**
- Each loop iteration is a fresh `provider.SendMessage` with full updated history
- Loop exits when: model responds text-only, OR context budget exceeded, OR safety max (200 turns)
- Cancellation via `ctx` kills loop and in-flight tool execution
- Existing 5-minute conversation timeout applies to entire loop

### Pattern 5: Sandbox & Path Validation

Single `Sandbox` struct shared by all tools. Tools never validate paths themselves.

```go
type Sandbox struct {
    projectRoot  string   // /path/to/user/project
    centralRoot  string   // ~/bmad-studio/projects/{project-name}
}

func (s *Sandbox) ValidatePath(path string, write bool) (string, error)
```

**Validation order:**
1. Resolve symlinks and `..` to absolute path
2. Check resolved path within `projectRoot` OR `centralRoot`
3. Reject writes outside both zones
4. Reject known dangerous paths: `.env`, `.git/config`, credential files

**Bash sandbox:**
- `cwd` set to `projectRoot`
- Environment sanitized (strip `API_KEY`, `TOKEN`, `SECRET` patterns)
- Per-execution timeout (60s default, configurable)
- Output truncated at 100KB to prevent context explosion

### Pattern 6: Tool Permission Declaration

```yaml
# In workflow/agent definition
tool_permissions:
  file_read: { allowed: true }
  file_write: { allowed: true, paths: ["src/**", "_bmad-output/**"] }
  bash: { allowed: true, timeout: 120s }
  web_search: { allowed: true }
```

**Rules:**
- Absent `tool_permissions` defaults to read-only (`file_read` + `web_search`)
- `paths` globs evaluated against **both** sandbox zones (project root + central storage)
- `paths: ["**"]` means full access within sandbox boundary
- `registry.ListForScope(permissions)` returns only permitted tools
- LLM provider request only includes permitted tool definitions — model never sees unavailable tools
- Trust level adds confirmation prompts but never expands permissions

### Pattern 7: Frontend Tool Block Rendering

```typescript
interface ToolCallBlock {
  type: 'tool_call'
  tool_id: string
  tool_name: string
  input: Record<string, unknown>
  status: 'running' | 'success' | 'error'
  output?: string
  result?: string
  metadata?: Record<string, unknown>
}
```

**Rendering rules:**
- Tool blocks render inline in assistant message, in order of occurrence
- Each block: collapsible details component — expanded while running, collapsed after completion
- Header: tool icon + name + status (spinner / checkmark / X)
- Body: input parameters + output/result (code block for file/bash, plain for search)
- Component: `<ToolCallBlock>` in `src/components/chat/ToolCallBlock.tsx`
- State: chat service accumulates tool events by `tool_id` into `ToolCallBlock` within Zustand chat store

### Pattern 8: Provider Tool Integration

All providers produce identical StreamChunk sequences. ToolOrchestrator is provider-agnostic.

| Provider | Tool call detection | Tool input streaming | Tool result injection |
|---|---|---|---|
| Claude | `content_block_start` type `tool_use` | `input_json_delta` → `tool_call_delta` | `role: "user"` with `tool_result` content block |
| OpenAI | `tool_calls` array in delta | `function.arguments` delta → `tool_call_delta` | `role: "tool"` message |
| Ollama | `message.tool_calls` (native models only) | No streaming — single delta with full input | `role: "tool"` message |

**Rule:** Provider-specific translation stays inside the provider. Everything downstream sees only StreamChunk types. Each provider's `SendMessage` formats tool results for its own API — caller passes generic `Message{Role: "tool"}`.

### Pattern 9: Tool Execution Error Handling

Two distinct error types — agents must not conflate them.

**Tool errors** (expected failures — file not found, bash non-zero exit, no search results):
- Return `ToolResult{Output: "error message", IsError: true}`
- Loop continues — result injected into messages, LLM sees it and adapts strategy
- WebSocket: `chat:tool-result` with `status: "error"`
- The model decides next action (retry, different tool, or respond with explanation)

**System errors** (infrastructure failures — sandbox violation, tool not found, timeout):
- Return `(nil, error)` — Go error
- Sandbox violations: hard stop — terminate loop entirely
- Other system errors: inject error message, loop continues

**Rule:** Tool implementors return `ToolResult` with `IsError: true` for expected failures. Go errors only for infrastructure breakage. The LLM always sees tool errors and gets to respond.

### Enforcement Guidelines

**All AI agents implementing tool execution layer MUST:**
- Use the `Tool` struct shape exactly as defined — no custom tool interfaces
- Route all file I/O through `sandbox.ValidatePath()` — no direct path access
- Emit the exact StreamChunk type sequence for tool calls — no shortcuts
- Use `camelCase` for all WebSocket event payload fields
- Return `ToolResult` for expected failures, Go errors for system failures only
- Keep provider-specific logic inside providers — ToolOrchestrator is provider-agnostic

## Project Structure & Boundaries

### New Files & Directories

```
backend/
│   ├── tools/                           # NEW — Tool execution layer
│   │   ├── tool.go                      # Tool, ToolResult, ToolCategory, DangerLevel types
│   │   ├── registry.go                  # ToolRegistry (core + MCP scaffold)
│   │   ├── sandbox.go                   # Sandbox (dual-path validation)
│   │   ├── file_read.go                 # file_read tool implementation
│   │   ├── file_write.go               # file_write tool implementation
│   │   ├── bash.go                      # bash tool implementation
│   │   └── web_search.go               # web_search tool implementation
│   │
│   ├── services/
│   │   └── tool_orchestrator.go         # NEW — ToolOrchestrator service
│   │
│   └── types/
│       └── tool.go                      # NEW — ToolCall, ToolScope, TrustLevel types

src/
│   ├── components/
│   │   └── core/
│   │       └── chat/
│   │           └── ToolCallBlock.tsx     # NEW — Tool call rendering component
│   │
│   └── types/
│       └── tool.ts                      # NEW — ToolCallBlock, frontend tool types

tests/
│   ├── backend/
│   │   ├── tools/                       # NEW — Tool unit tests
│   │   │   ├── registry_test.go
│   │   │   ├── sandbox_test.go
│   │   │   ├── file_read_test.go
│   │   │   ├── file_write_test.go
│   │   │   ├── bash_test.go
│   │   │   └── web_search_test.go
│   │   └── services/
│   │       └── tool_orchestrator_test.go # NEW
│   │
│   └── frontend/
│       └── components/
│           └── ToolCallBlock.test.tsx   # NEW
```

### Modified Files

| File | Change |
|---|---|
| `backend/providers/provider.go` | Extend `StreamChunk` with `ToolID`, `ToolName` fields + new type constants |
| `backend/providers/claude.go` | Parse `tool_use` content blocks → emit tool StreamChunk types |
| `backend/providers/openai.go` | Parse `function_call` deltas → emit tool StreamChunk types |
| `backend/providers/ollama.go` | Add native `tools` param support + `supportsTools` capability metadata |
| `backend/services/chat_service.go` | Add tool call accumulation + loop (delegate to ToolOrchestrator) |
| `backend/types/message.go` | Add `Role: "tool"`, `ToolID`, `ToolName` fields to Message |
| `backend/api/handlers/chat.go` | Broadcast `chat:tool-start`, `chat:tool-delta`, `chat:tool-result` events |
| `backend/main.go` | Initialize ToolRegistry, Sandbox, ToolOrchestrator; wire into ChatService |
| `src/services/chat.service.ts` | Handle tool WebSocket events, accumulate ToolCallBlocks in messages |
| `src/services/websocket.service.ts` | Register new `chat:tool-*` event listeners |
| `src/stores/chat.store.ts` | Extend message model to support `MessageBlock[]` (text + thinking + tool_call) |
| `src/types/conversation.ts` | Add `MessageBlock` union type |
| `src/components/chat/ConversationBlock.tsx` | Render `ToolCallBlock` components inline with text blocks |

### Architectural Boundaries — Tool Execution Layer

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend (React)                                                  │
│  ConversationBlock.tsx → ToolCallBlock.tsx                        │
│  chat.service.ts ← WebSocket tool events                         │
│  chat.store.ts (MessageBlock[] with ToolCallBlock)                │
└──────────────────────┬───────────────────────────────────────────┘
                       │ WebSocket: chat:tool-start/delta/result
┌──────────────────────┴───────────────────────────────────────────┐
│ Backend (Go)                                                      │
│                                                                    │
│  chat_service.go ─── tool call loop ──► tool_orchestrator.go     │
│       │                                       │                   │
│       │                                       ├── registry.go     │
│       │                                       │    └── Get()      │
│       │                                       │    └── ListFor()  │
│       │                                       │                   │
│       │                                       ├── sandbox.go      │
│       │                                       │    └── Validate() │
│       │                                       │                   │
│       │                                       └── tools/          │
│       │                                            ├── file_read  │
│       │                                            ├── file_write │
│       │                                            ├── bash       │
│       │                                            └── web_search │
│       │                                                           │
│  providers/ ◄──── StreamChunk (tool types) ───── tool loop        │
│  ├── claude.go                                                    │
│  ├── openai.go                                                    │
│  └── ollama.go                                                    │
└──────────────────────────────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   Project Root              ~/bmad-studio/projects/
   (code, tests)             (planning artifacts,
                              insights, _bmad-output)
```

### Component Boundaries

| Boundary | Rule |
|---|---|
| **Tools ↔ Sandbox** | Tools call `sandbox.ValidatePath()` — never access filesystem directly |
| **ToolOrchestrator ↔ Registry** | Orchestrator looks up tools via `registry.Get()` — never instantiates directly |
| **ChatService ↔ ToolOrchestrator** | ChatService detects tool chunks, delegates execution to Orchestrator |
| **Providers ↔ ToolOrchestrator** | No direct contact — communicate via StreamChunk channel only |
| **Backend ↔ Frontend (tools)** | WebSocket `chat:tool-*` events only — no REST endpoints for tool execution |
| **ToolOrchestrator ↔ Hub** | Orchestrator broadcasts tool events via Hub — same pattern as text streaming |

### FR to Structure Mapping — Tool Execution Layer

| New Requirement | Location |
|---|---|
| Tool execution engine | `backend/tools/`, `backend/services/tool_orchestrator.go` |
| Tool call streaming | `backend/providers/*.go` (modified), `backend/services/chat_service.go` (modified) |
| WebSocket tool events | `backend/api/handlers/chat.go` (modified) |
| Frontend tool rendering | `src/components/chat/ToolCallBlock.tsx` |
| Sandbox & security | `backend/tools/sandbox.go` |
| Ollama capability metadata | `backend/providers/ollama.go` (modified) |
| Trust level settings | `backend/api/handlers/settings.go` (modified), frontend settings UI (future) |
| Tool permissions per workflow | `backend/types/tool.go` (ToolScope), workflow definition schema |

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All 9 decisions interlock without contradiction.
- ToolOrchestrator (D1) + Loop Pattern (P4) — orchestrator executes, ChatService loops. Clean split.
- StreamChunk extension (D2) + WebSocket events (D7, P3) — chunks map 1:1 to events.
- Registry (D3) + Core tools (D9) — four tools registered at startup, MCP interface ready but unconnected.
- Ollama native-only (D4) + Provider integration (P8) — Ollama emits same chunk sequence, just no incremental streaming.
- Tiered security (D5) + Dual-path sandbox (D6) + Permissions (P6) — three layers without conflict.
- Context budget (D8) + Loop control (P4 step 6g) — budget check built into loop.

**Pattern Consistency:** All 9 patterns use established project conventions — `snake_case` Go, `camelCase` TS, same WebSocket event naming, same service/state/component boundaries.

**Structure Alignment:** New files follow existing organization. Tools in own package, ToolOrchestrator joins services, frontend component follows chat co-location.

### Requirements Coverage

| New Requirement | Covered By |
|---|---|
| Agents invoke tools | D1, D3, D9, P1, P4 |
| Tool calls stream via WebSocket | D7, P3 |
| Provider-agnostic tool catalog | D3, P8 |
| Workflow-scoped tool access | D5, P6 |
| MCP extensibility | D3, D9 (scaffold) |
| Tool activity visible in UI | D7, P7 |
| Bash sandboxed | D5, D6, P5 |
| Tool approval model | D5 |

**NFR Coverage:**

| NFR | Status |
|---|---|
| NFR1 (500ms first token) | Covered — tool loop latency is between turns, not before first response |
| NFR5-7 (Security) | Covered — sandbox + trust levels + permission declarations |
| NFR8-10 (Resilience) | Covered — per-tool 60s timeout, context budget, ctx cancellation |

### Gap Analysis

**Critical Gaps: None.**

**Important Gaps (3):**

**Gap 1: Conversation timeout for agentic workflows.**
Existing 5-minute timeout may be too short for complex multi-tool workflows.
**Resolution:** Make conversation timeout configurable per workflow. Default 5 minutes for plain chat, longer (30 min) or context-budget-only for agentic workflows.

**Gap 2: Trust level confirmation WebSocket flow.**
Architecture doesn't specify the exact handshake for user approval of dangerous tools.
**Resolution:** Two new events:
```
chat:tool-confirm  → { messageId, toolId, toolName, input }   // backend → frontend
chat:tool-approve  → { toolId, approved: boolean }              // frontend → backend
```
ToolOrchestrator blocks on channel until approval or 30s timeout.

**Gap 3: SendMessageRequest tool definitions.**
Provider's `SendMessageRequest` needs a `Tools []ToolDefinition` field.
**Resolution:** Add field; each provider maps `ToolDefinition` to its own API format.

**Nice-to-Have Gaps:**
- Web search provider selection (defer to implementation, start with one)
- MCP server lifecycle management (deferred by design)
- Tool execution telemetry/logging (useful but not blocking)

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (22 input documents)
- [x] Scale and complexity assessed (High — 6-8 new components)
- [x] Technical constraints identified (8 constraints mapped)
- [x] Cross-cutting concerns mapped (7 concerns)

**Architectural Decisions**
- [x] 9 critical decisions documented with rationale
- [x] Technology stack fully specified (no new frontend deps, one new Go dep)
- [x] Integration patterns defined (provider → chunk → orchestrator → event → frontend)
- [x] Security model fully specified (sandbox + permissions + trust levels)

**Implementation Patterns**
- [x] 9 mandatory patterns established
- [x] Naming conventions consistent with existing codebase
- [x] Communication patterns specified (StreamChunk types, WebSocket events)
- [x] Error handling pattern specified (tool errors vs system errors)

**Project Structure**
- [x] All new files and directories defined (13 new files, 13 modified)
- [x] Component boundaries established (6 boundary rules)
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean separation of concerns — each component has single responsibility
- Provider-agnostic design — ToolOrchestrator doesn't know about Claude/OpenAI/Ollama
- Extends existing architecture without breaking changes — StreamChunk extension is backwards compatible
- Security designed from the start — three-layer model (sandbox, permissions, trust)
- Honest about Ollama limitations — no fragile hacks

**Areas for Future Enhancement:**
- MCP server management (scaffold ready, implementation deferred)
- Ollama text-parsing harness (if ecosystem doesn't improve native support)
- Container-based isolation (if bmad-studio moves to multi-user/server deployment)

### Implementation Handoff

**First Implementation Priority:**
1. StreamChunk type extension
2. ToolRegistry + core tool implementations
3. ToolOrchestrator service
4. Sandbox + path validation
5. WebSocket tool events
6. Frontend tool block rendering
7. Ollama capability metadata
8. Context-aware loop control
9. Trust level UI + confirmation dialogs

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-02-04
**Document Location:** `_bmad-output/planning-artifacts/architecture-tool-execution-layer.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- 9 architectural decisions documented with rationale
- 9 implementation patterns ensuring AI agent consistency
- Complete project structure (13 new files, 13 modified files)
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 4 core tools (file_read, file_write, bash, web_search) + MCP scaffold
- 3-layer security model (sandbox, permissions, trust levels)
- Provider-agnostic ToolOrchestrator
- Uniform WebSocket event schema for tool visibility
- Context-window-aware loop control

**AI Agent Implementation Guide**
- Tool struct shape and registration pattern
- StreamChunk type extensions
- WebSocket event payloads
- Error handling (tool errors vs system errors)
- Sandbox path validation
- Provider integration mapping

### Development Sequence

1. StreamChunk type extension — foundation for everything
2. ToolRegistry + core tool implementations
3. ToolOrchestrator service — the loop engine
4. Sandbox + path validation
5. WebSocket tool events — backend to frontend bridge
6. Frontend tool block rendering
7. Ollama capability metadata
8. Context-aware loop control
9. Trust level UI + confirmation dialogs

### Relationship to Existing Architecture

This document is **additive** to the existing architecture (`_bmad-output/planning-artifacts/architecture/`). It does not replace or modify existing architectural decisions. It extends the system with a new capability layer — tool execution — that integrates with the existing Provider, ChatService, WebSocket, and frontend component architecture.

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Create epics and stories for the tool execution layer, then proceed to implementation.
