---
title: 'Tool Execution Layer — Backend Infrastructure'
slug: 'tool-execution-backend'
created: '2026-02-04'
completed: '2026-02-05'
status: 'done'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
tech_stack: ['Go 1.25', 'anthropic-sdk-go', 'openai-go', 'chi/v5', 'gorilla/websocket', 'SearXNG', 'Brave Search API']
files_to_modify:
  - 'backend/providers/provider.go'
  - 'backend/providers/claude.go'
  - 'backend/providers/openai.go'
  - 'backend/providers/ollama.go'
  - 'backend/services/chat_service.go'
  - 'backend/types/websocket.go'
  - 'backend/main.go'
files_to_create:
  - 'backend/tools/tool.go'
  - 'backend/tools/registry.go'
  - 'backend/tools/sandbox.go'
  - 'backend/tools/file_read.go'
  - 'backend/tools/file_write.go'
  - 'backend/tools/bash.go'
  - 'backend/tools/web_search.go'
  - 'backend/services/tool_orchestrator.go'
  - 'backend/types/tool.go'
code_patterns:
  - 'Buffered channel (32) for StreamChunk streaming'
  - 'send() helper with context cancellation check'
  - 'consumeStream relay pattern with switch on chunk.Type'
  - 'Hub.SendToClient for targeted WebSocket delivery'
  - 'NewXxxEvent constructors for typed WebSocket payloads'
  - 'Services injected at startup in main.go'
test_patterns:
  - 'Table-driven tests with anonymous struct slices'
  - 'mockClient + collectEvents helpers for streaming'
  - 'httptest.NewServer with SSE for provider mocking'
  - 'Context cancellation tests with done channels'
  - 'testutil/helpers.go for reusable assertions'
---

# Tech-Spec: Tool Execution Layer — Backend Infrastructure

**Created:** 2026-02-04

## Overview

### Problem Statement

bmad-studio agents can only stream text responses. They cannot read files, write code, execute shell commands, or search the web. The Go backend has no tool execution capability — no way for an LLM to request an action, have the system execute it, and feed the result back into the conversation loop.

### Solution

Add a tool execution layer to the Go backend: ToolRegistry for tool discovery, Sandbox for security, ToolOrchestrator for the execute-inject-continue loop, four core tools (file_read, file_write, bash, web_search), and WebSocket tool event emission. Web search uses SearXNG as the primary provider with Brave Search API as a configured fallback. MCP interface scaffolded for future extensibility.

### Scope

**In Scope:**
- StreamChunk type extension with tool_call_start, tool_call_delta, tool_call_end types
- Tool, ToolResult, ToolCategory, DangerLevel type definitions
- ToolRegistry with core registration and MCP scaffold interface
- Core tool implementations: file_read, file_write, bash, web_search
- Web search provider abstraction (SearXNG primary + Brave Search fallback)
- Sandbox with dual-path validation (project root + central storage)
- Bash sandboxing (cwd, env sanitization, timeout, output truncation)
- ToolOrchestrator service (tool execution dispatch)
- ChatService tool call loop integration
- Provider tool integration (Claude, OpenAI, Ollama tool chunk parsing)
- ChatRequest Tools field for provider tool definitions
- WebSocket tool event broadcasting (chat:tool-start, chat:tool-delta, chat:tool-result, chat:tool-confirm, chat:tool-approve)
- Tool permission model (workflow-scoped declarations)
- Trust level logic (Supervised/Guided/Autonomous) in orchestrator

**Out of Scope (Spec 2 — Frontend + Polish):**
- Frontend tool-call-block component rendering
- Frontend chat state MessageBlock[] model
- Ollama supportsTools capability metadata in model selector UI
- Context-aware loop budget tuning and gas gauge integration
- Trust level settings UI and confirmation dialog components

## Context for Development

### Existing Type Signatures (Ground Truth)

**StreamChunk** (`backend/providers/provider.go:25-33`):
```go
type StreamChunk struct {
    Type      string      `json:"type"`       // start, chunk, end, error, thinking
    Content   string      `json:"content"`
    MessageID string      `json:"message_id"`
    Index     int         `json:"index"`
    Usage     *UsageStats `json:"usage,omitempty"`
    Model     string      `json:"model,omitempty"`
}
```

**ChatRequest** (`backend/providers/provider.go:17-23`):
```go
type ChatRequest struct {
    Messages     []Message `json:"messages"`
    Model        string    `json:"model"`
    MaxTokens    int       `json:"max_tokens"`
    SystemPrompt string    `json:"system_prompt,omitempty"`
}
```

**Message** (`backend/providers/provider.go:49-53`):
```go
type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}
```

**Provider Interface** (`backend/providers/provider.go:5-15`):
```go
type Provider interface {
    SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)
    ValidateCredentials(ctx context.Context) error
    ListModels() ([]Model, error)
}
```

**ChatService** (`backend/services/chat_service.go:21-36`):
```go
type ChatService struct {
    providerService *ProviderService
    hub             *websocket.Hub
    activeStreams    map[string]context.CancelFunc
    mu              sync.RWMutex
}
```

**WebSocket Event Constants** (`backend/types/websocket.go:5-22`):
```go
const (
    EventTypeChatSend          = "chat:send"
    EventTypeChatCancel        = "chat:cancel"
    EventTypeChatStreamStart   = "chat:stream-start"
    EventTypeChatTextDelta     = "chat:text-delta"
    EventTypeChatThinkingDelta = "chat:thinking-delta"
    EventTypeChatStreamEnd     = "chat:stream-end"
    EventTypeChatError         = "chat:error"
)
```

### Codebase Patterns

**Streaming Pattern:** All three providers (Claude, OpenAI, Ollama) use identical channel architecture:
- Buffered channel `make(chan StreamChunk, 32)`
- Goroutine with `defer close(ch)`
- `send()` helper that does `select { case ch <- chunk: | case <-ctx.Done(): }` for cancellation-safe writes
- Claude: SDK event stream (`stream.Next()`) with typed events
- OpenAI: SDK stream (`stream.Next()`) with delta content
- Ollama: NDJSON over HTTP body (`bufio.NewScanner`) with `Done: true` termination

**ChatService consumeStream Pattern** (`chat_service.go:88-191`):
- Creates intermediate relay channel
- Main loop switches on `chunk.Type` → emits typed WebSocket events via `cs.hub.SendToClient(client, event)`
- Context cancellation sends partial stream-end

**Service Initialization (main.go):**
- `hub → providerService → chatService`, then `hub.SetMessageHandler()` for event routing

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `backend/providers/provider.go` | StreamChunk, ChatRequest, Message, Provider interface | 5-53 |
| `backend/providers/claude.go` | Claude streaming — tool_use content blocks to parse | 101-182 |
| `backend/providers/openai.go` | OpenAI streaming — function_call deltas to parse | 109-184 |
| `backend/providers/ollama.go` | Ollama NDJSON streaming — native tools param | 189-265 |
| `backend/services/chat_service.go` | consumeStream loop — tool accumulation goes here | 88-191 |
| `backend/types/websocket.go` | Event type constants and payload structs | Full file |
| `backend/main.go` | Service wiring — init ToolRegistry/Sandbox/Orchestrator | 20-94 |
| `backend/api/websocket/hub.go` | SendToClient, HandleClientMessage | 177-214 |
| `backend/services/provider_service.go` | ProviderService.SendMessage — provider dispatch | 56-63 |
| `_bmad-output/planning-artifacts/architecture-tool-execution-layer.md` | Architecture decisions and patterns (binding) | Full file |
| `_bmad-output/planning-artifacts/research/technical-web-search-tools-for-llm-agents-research-2026-02-04.md` | Web search provider evaluation | Full file |
| `_bmad-output/project-context.md` | Project conventions | Full file |

### Technical Decisions

- **Architecture doc governs:** All 9 decisions and 9 patterns from the architecture doc are binding
- **Web search stack:** SearXNG (primary, free, self-hosted) + Brave Search API (fallback, $5/mo, BYOK)
- **No content extraction in v1:** web_search returns search results (titles, URLs, snippets). Content extraction (Crawl4AI) and local summarization deferred
- **MCP scaffold only:** RegisterMCP interface exists but is not wired to actual servers
- **Ollama native tools only:** Use /api/chat tools parameter for supported models. No text-parsing harness
- **ChatRequest not SendMessageRequest:** The existing type is `ChatRequest` — extend it, don't rename
- **No new Go dependencies for core tools:** stdlib only. web_search uses net/http
- **Conversation history via payload:** ChatSendPayload gains a `History []Message` field. Frontend sends prior messages. Tool loop appends tool exchanges internally during iterations. No server-side conversation store needed.

## Implementation Plan

### Tasks

#### Task 1: Foundation Types
Create `backend/types/tool.go` — all tool-related type definitions used across the system.

- [x] **1.1** Create `backend/types/tool.go`
  - File: `backend/types/tool.go` (NEW)
  - Action: Define the following types:
    - `ToolCategory` string type with constants: `"file"`, `"exec"`, `"search"`, `"mcp"`
    - `DangerLevel` string type with constants: `"safe"`, `"dangerous"`
    - `TrustLevel` string type with constants: `"supervised"`, `"guided"`, `"autonomous"`
    - `ToolScope` struct with `Permissions map[string]ToolPermission`
    - `ToolPermission` struct: `Allowed bool`, `Paths []string`, `Timeout string`
    - `ToolCall` struct: `ID string`, `Name string`, `Input json.RawMessage`
    - `ToolDefinition` struct: `Name string`, `Description string`, `InputSchema json.RawMessage`
  - Notes: All JSON tags use `camelCase`. These are shared between providers, tools, and orchestrator packages.

- [x] **1.2** Create `backend/types/tool_test.go`
  - File: `backend/types/tool_test.go` (NEW)
  - Action: Test JSON serialization of all types, verify `camelCase` tags, test zero-value behavior
  - Notes: Table-driven tests for each type's JSON marshal/unmarshal

#### Task 2: StreamChunk & Provider Type Extensions
Extend existing provider types for tool call support.

- [x] **2.1** Extend `StreamChunk`
  - File: `backend/providers/provider.go`
  - Action: Add two fields to `StreamChunk`:
    - `ToolID string json:"toolId,omitempty"` — unique per tool call, zero-value when not tool chunk
    - `ToolName string json:"toolName,omitempty"` — populated on tool_call_start only
  - Notes: Backwards compatible — existing consumers see zero values. Use `camelCase` JSON tags (matches architecture pattern 2).

- [x] **2.2** Add StreamChunk type constants
  - File: `backend/providers/provider.go`
  - Action: Add constants (alongside any existing chunk type references):
    ```
    ChunkTypeStart        = "start"
    ChunkTypeChunk        = "chunk"
    ChunkTypeThinking     = "thinking"
    ChunkTypeEnd          = "end"
    ChunkTypeError        = "error"
    ChunkTypeToolCallStart = "tool_call_start"
    ChunkTypeToolCallDelta = "tool_call_delta"
    ChunkTypeToolCallEnd   = "tool_call_end"
    ```
  - Notes: Existing code uses string literals. Add constants and migrate existing switch cases to use them. This is a cleanup + extension.

- [x] **2.3** Extend `ChatRequest` with Tools
  - File: `backend/providers/provider.go`
  - Action: Add `Tools []ToolDefinition json:"tools,omitempty"` field to `ChatRequest`. Import `ToolDefinition` from `backend/types` or define inline (prefer types package for cross-package sharing).
  - Notes: Providers map `ToolDefinition` to their own API format in `SendMessage`.

- [x] **2.4** Extend `Message` for tool roles
  - File: `backend/providers/provider.go`
  - Action: Extend `Message` struct:
    - Add `ToolCallID string json:"toolCallId,omitempty"` — set when Role is "tool" (result message)
    - Add `ToolCalls []ToolCall json:"toolCalls,omitempty"` — set when assistant requests tool use
    - Add `ToolName string json:"toolName,omitempty"` — tool name for result messages
  - Notes: `ToolCall` imported from `backend/types`. Message.Content remains the primary text content. For tool result messages: `Role: "tool"`, `ToolCallID: "toolu_xxx"`, `Content: "result text"`.

- [x] **2.5** Extend provider type tests
  - File: `backend/providers/provider_test.go`
  - Action: Add tests for new StreamChunk fields and Message fields. Verify JSON serialization with tool fields populated and with tool fields empty (backwards compat).

#### Task 3: WebSocket Tool Event Types
Add tool-specific event types, payloads, and constructors.

- [x] **3.1** Add tool event type constants
  - File: `backend/types/websocket.go`
  - Action: Add to the const block:
    ```
    EventTypeChatToolStart   = "chat:tool-start"
    EventTypeChatToolDelta   = "chat:tool-delta"
    EventTypeChatToolResult  = "chat:tool-result"
    EventTypeChatToolConfirm = "chat:tool-confirm"
    EventTypeChatToolApprove = "chat:tool-approve"
    ```
  - Notes: `chat:tool-confirm` (server → client) and `chat:tool-approve` (client → server) are the trust level handshake pair.

- [x] **3.2** Add tool event payload structs
  - File: `backend/types/websocket.go`
  - Action: Add payload structs:
    ```go
    type ChatToolStartPayload struct {
        ConversationID string                 `json:"conversationId"`
        MessageID      string                 `json:"messageId"`
        ToolID         string                 `json:"toolId"`
        ToolName       string                 `json:"toolName"`
        Input          map[string]interface{} `json:"input"`
    }

    type ChatToolDeltaPayload struct {
        ConversationID string `json:"conversationId"`
        MessageID      string `json:"messageId"`
        ToolID         string `json:"toolId"`
        Chunk          string `json:"chunk"`
    }

    type ChatToolResultPayload struct {
        ConversationID string                 `json:"conversationId"`
        MessageID      string                 `json:"messageId"`
        ToolID         string                 `json:"toolId"`
        Status         string                 `json:"status"` // "success" or "error"
        Result         string                 `json:"result"`
        Metadata       map[string]interface{} `json:"metadata,omitempty"`
    }

    type ChatToolConfirmPayload struct {
        ConversationID string                 `json:"conversationId"`
        MessageID      string                 `json:"messageId"`
        ToolID         string                 `json:"toolId"`
        ToolName       string                 `json:"toolName"`
        Input          map[string]interface{} `json:"input"`
    }

    type ChatToolApprovePayload struct {
        ToolID   string `json:"toolId"`
        Approved bool   `json:"approved"`
    }
    ```
  - Notes: All fields `camelCase`. Follow existing payload struct conventions. `conversationId` not `conversation_id` — matching project convention of `camelCase` JSON everywhere. **IMPORTANT:** Verify existing payload structs use `conversationId` vs `conversation_id` and match. Investigation shows existing uses `conversation_id` — use `conversation_id` for consistency with existing payloads unless project-context says otherwise. Actually project-context.md says `camelCase` everywhere. Check actual code — existing structs use `json:"conversation_id"`. Follow existing pattern: use `snake_case` in JSON tags to match what's already there. **Resolution:** Read the actual websocket.go payload tags and match them exactly.

- [x] **3.3** Add tool event constructor functions
  - File: `backend/types/websocket.go`
  - Action: Add constructors following existing `NewChatXxxEvent` pattern:
    - `NewChatToolStartEvent(conversationID, messageID, toolID, toolName string, input map[string]interface{}) *WebSocketEvent`
    - `NewChatToolDeltaEvent(conversationID, messageID, toolID, chunk string) *WebSocketEvent`
    - `NewChatToolResultEvent(conversationID, messageID, toolID, status, result string, metadata map[string]interface{}) *WebSocketEvent`
    - `NewChatToolConfirmEvent(conversationID, messageID, toolID, toolName string, input map[string]interface{}) *WebSocketEvent`

- [x] **3.4** Add tool event tests
  - File: `backend/types/websocket_test.go`
  - Action: Extend existing tests. Verify each constructor creates correct event type and payload. Test JSON marshaling of tool payloads.

- [x] **3.5** Extend ChatSendPayload with history
  - File: `backend/types/websocket.go`
  - Action: Add `History []Message json:"history,omitempty"` field to `ChatSendPayload` where `Message` is imported from the providers package (or define a local WebSocket message type that maps to it).
  - Notes: Frontend sends conversation history with each message. This enables the tool loop to have full context. If circular import issue with providers package, define a local `ChatMessage` struct in types and have ChatService convert.

#### Task 4: Sandbox
Dual-path file system sandbox for all tool I/O.

- [x] **4.1** Create `backend/tools/sandbox.go`
  - File: `backend/tools/sandbox.go` (NEW)
  - Action: Implement:
    ```go
    type Sandbox struct {
        projectRoot string
        centralRoot string
    }

    func NewSandbox(projectRoot, centralRoot string) *Sandbox

    // ValidatePath resolves symlinks, checks containment, rejects dangerous paths.
    // Returns the resolved absolute path or error.
    func (s *Sandbox) ValidatePath(path string, write bool) (string, error)

    // ValidateBashEnv returns a sanitized copy of the environment,
    // stripping variables matching API_KEY, TOKEN, SECRET patterns.
    func (s *Sandbox) ValidateBashEnv(env []string) []string
    ```
  - Validation order per architecture pattern 5:
    1. Resolve symlinks and `..` to absolute path via `filepath.EvalSymlinks` + `filepath.Abs`
    2. Check resolved path starts with `projectRoot` OR `centralRoot`
    3. Reject writes outside both zones
    4. Reject known dangerous paths: `.env`, `.git/config`, any file matching `*credential*`, `*secret*`
  - Notes: `centralRoot` is `~/bmad-studio/projects/{project-name}/`. Both paths known at conversation start from ProjectManager.

- [x] **4.2** Create `backend/tools/sandbox_test.go`
  - File: `backend/tools/sandbox_test.go` (NEW)
  - Action: Table-driven tests covering:
    - Read within project root → allowed
    - Write within project root → allowed
    - Read within central root → allowed
    - Write within central root → allowed
    - Path traversal via `../../etc/passwd` → rejected
    - Symlink pointing outside sandbox → rejected
    - Write to `.env` → rejected
    - Write to `.git/config` → rejected
    - Read outside both zones → rejected
    - Empty path → rejected
    - Relative path resolution → correct absolute path returned
    - `ValidateBashEnv` strips `API_KEY`, `TOKEN`, `SECRET` pattern variables
    - `ValidateBashEnv` preserves non-sensitive variables
  - Notes: Use `t.TempDir()` for test filesystem. Create real symlinks for symlink tests.

#### Task 5: Tool Types & Registry
Tool struct definition and registry for tool discovery.

- [x] **5.1** Create `backend/tools/tool.go`
  - File: `backend/tools/tool.go` (NEW)
  - Action: Define per architecture pattern 1:
    ```go
    package tools

    type Tool struct {
        Name        string
        Description string
        InputSchema json.RawMessage
        Category    types.ToolCategory
        DangerLevel types.DangerLevel
        Execute     func(ctx context.Context, input json.RawMessage) (*ToolResult, error)
    }

    type ToolResult struct {
        Output   string
        Metadata map[string]interface{}
        IsError  bool
    }

    // ToDefinition converts a Tool to a ToolDefinition for provider requests.
    func (t *Tool) ToDefinition() types.ToolDefinition
    ```
  - Notes: `Execute` is a function field, not a method on an interface. This matches the architecture decision for simple registration.

- [x] **5.2** Create `backend/tools/registry.go`
  - File: `backend/tools/registry.go` (NEW)
  - Action: Implement:
    ```go
    type ToolRegistry struct {
        tools   map[string]*Tool
        mu      sync.RWMutex
    }

    func NewRegistry() *ToolRegistry

    // RegisterCore registers a built-in tool.
    func (r *ToolRegistry) RegisterCore(tool *Tool) error

    // RegisterMCP is a scaffold for future MCP tool registration.
    // Returns error indicating MCP not yet implemented.
    func (r *ToolRegistry) RegisterMCP(serverName string) error

    // Get returns a tool by name, or nil if not found.
    func (r *ToolRegistry) Get(name string) *Tool

    // ListForScope returns tools permitted by the given ToolScope.
    // If scope is nil, returns all tools.
    func (r *ToolRegistry) ListForScope(scope *types.ToolScope) []*Tool

    // ListDefinitionsForScope returns ToolDefinitions for provider requests.
    func (r *ToolRegistry) ListDefinitionsForScope(scope *types.ToolScope) []types.ToolDefinition
    ```
  - Notes: `ListForScope` filters by `scope.Permissions[toolName].Allowed`. Tools not in permissions map are excluded. Absent `tool_permissions` in workflow defaults to read-only (file_read + web_search allowed). Thread-safe via RWMutex.

- [x] **5.3** Create `backend/tools/registry_test.go`
  - File: `backend/tools/registry_test.go` (NEW)
  - Action: Tests for:
    - Register a tool → Get returns it
    - Get unknown tool → returns nil
    - Register duplicate name → returns error
    - ListForScope with all allowed → returns all
    - ListForScope with partial permissions → returns only permitted tools
    - ListForScope with nil scope → returns all tools
    - ListForScope with empty permissions → returns only safe defaults (file_read, web_search)
    - ListDefinitionsForScope returns valid ToolDefinition structs
    - RegisterMCP returns not-implemented error
    - Thread safety: concurrent Register + Get don't panic

#### Task 6: file_read Tool
Read file contents within sandbox paths.

- [x] **6.1** Create `backend/tools/file_read.go`
  - File: `backend/tools/file_read.go` (NEW)
  - Action: Implement file_read tool:
    - Name: `"file_read"`
    - Category: `ToolCategoryFile`
    - DangerLevel: `DangerLevelSafe`
    - InputSchema: `{ "type": "object", "properties": { "path": { "type": "string", "description": "Absolute or relative path to read" } }, "required": ["path"] }`
    - Execute: Parse input → `sandbox.ValidatePath(path, false)` → `os.ReadFile` → return content as `ToolResult.Output`
    - Error handling: File not found → `ToolResult{IsError: true, Output: "file not found: ..."}`. Sandbox violation → return Go error.
    - Constructor: `func NewFileReadTool(sandbox *Sandbox) *Tool`
  - Notes: Relative paths resolved against sandbox.projectRoot. Large files (>1MB) truncated with note.

- [x] **6.2** Create `backend/tools/file_read_test.go`
  - File: `backend/tools/file_read_test.go` (NEW)
  - Action: Table-driven tests:
    - Read existing file → success with content
    - Read non-existent file → ToolResult.IsError true
    - Read outside sandbox → Go error (not ToolResult)
    - Read with relative path → resolves correctly
    - Read large file → truncated with message
    - Read binary file → returns content (no special handling)

#### Task 7: file_write Tool
Write/create files within sandbox paths.

- [x] **7.1** Create `backend/tools/file_write.go`
  - File: `backend/tools/file_write.go` (NEW)
  - Action: Implement file_write tool:
    - Name: `"file_write"`
    - Category: `ToolCategoryFile`
    - DangerLevel: `DangerLevelDangerous`
    - InputSchema: `{ "type": "object", "properties": { "path": { "type": "string" }, "content": { "type": "string" } }, "required": ["path", "content"] }`
    - Execute: Parse input → `sandbox.ValidatePath(path, true)` → create parent dirs if needed (`os.MkdirAll`) → `os.WriteFile` with 0644 perms → return `ToolResult{Output: "wrote N bytes to path"}`
    - Error handling: Write outside sandbox → Go error. Permission denied → `ToolResult{IsError: true}`.
    - Constructor: `func NewFileWriteTool(sandbox *Sandbox) *Tool`

- [x] **7.2** Create `backend/tools/file_write_test.go`
  - File: `backend/tools/file_write_test.go` (NEW)
  - Action: Table-driven tests:
    - Write new file → creates file with content
    - Write to existing file → overwrites content
    - Write with nested path → creates parent directories
    - Write outside sandbox → Go error
    - Write to .env → Go error (dangerous path)
    - Write with empty content → creates empty file

#### Task 8: bash Tool
Execute shell commands with sandboxing.

- [x] **8.1** Create `backend/tools/bash.go`
  - File: `backend/tools/bash.go` (NEW)
  - Action: Implement bash tool:
    - Name: `"bash"`
    - Category: `ToolCategoryExec`
    - DangerLevel: `DangerLevelDangerous`
    - InputSchema: `{ "type": "object", "properties": { "command": { "type": "string", "description": "Shell command to execute" }, "timeout": { "type": "integer", "description": "Timeout in seconds (default 60, max configurable)" } }, "required": ["command"] }`
    - Execute:
      1. Create `exec.CommandContext(ctx, "sh", "-c", command)`
      2. Set `cmd.Dir = sandbox.projectRoot`
      3. Set `cmd.Env = sandbox.ValidateBashEnv(os.Environ())`
      4. Set per-execution timeout: `context.WithTimeout(ctx, timeout)` (default 60s)
      5. Capture combined stdout+stderr
      6. Truncate output at 100KB
      7. Return `ToolResult{Output: output, Metadata: {"exitCode": code}}`
    - Error handling: Non-zero exit → `ToolResult{Output: stderr, IsError: true, Metadata: {"exitCode": code}}`. Timeout → `ToolResult{Output: "command timed out", IsError: true}`. Context cancelled → Go error.
    - Constructor: `func NewBashTool(sandbox *Sandbox) *Tool`
  - Notes: No command blocklist in v1. Security is via trust level (user confirms dangerous tools) + sandbox env sanitization.

- [x] **8.2** Create `backend/tools/bash_test.go`
  - File: `backend/tools/bash_test.go` (NEW)
  - Action: Table-driven tests:
    - `echo hello` → success with "hello\n"
    - `exit 1` → ToolResult.IsError true with exit code 1
    - Command with timeout → times out, returns error result
    - `pwd` → returns sandbox.projectRoot
    - Large output → truncated at 100KB
    - Verify env sanitized (set TEST_API_KEY, verify it's stripped)
    - Context cancellation → Go error

#### Task 9: web_search Tool
Web search with SearXNG primary and Brave Search fallback.

- [x] **9.1** Create `backend/tools/web_search.go`
  - File: `backend/tools/web_search.go` (NEW)
  - Action: Implement web_search tool with provider abstraction:
    ```go
    // SearchProvider is the interface for pluggable search backends.
    type SearchProvider interface {
        Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error)
        Name() string
    }

    type SearchResult struct {
        Title   string `json:"title"`
        URL     string `json:"url"`
        Content string `json:"content"` // snippet text
        Score   float64 `json:"score,omitempty"`
    }

    // SearXNGProvider calls a local SearXNG instance.
    type SearXNGProvider struct {
        baseURL string // e.g., "http://localhost:8080"
        client  *http.Client
    }

    func NewSearXNGProvider(baseURL string) *SearXNGProvider

    // BraveSearchProvider calls the Brave Search API.
    type BraveSearchProvider struct {
        apiKey string
        client *http.Client
    }

    func NewBraveSearchProvider(apiKey string) *BraveSearchProvider
    ```
  - Tool definition:
    - Name: `"web_search"`
    - Category: `ToolCategorySearch`
    - DangerLevel: `DangerLevelSafe`
    - InputSchema: `{ "type": "object", "properties": { "query": { "type": "string" }, "max_results": { "type": "integer", "default": 5 } }, "required": ["query"] }`
  - Execute logic:
    1. Try primary provider (SearXNG)
    2. If primary fails, try fallback (Brave) if configured
    3. Format results as readable text for LLM: numbered list with title, URL, snippet
    4. Return `ToolResult{Output: formattedResults, Metadata: {"provider": providerName, "resultCount": N}}`
  - SearXNG API: `GET {baseURL}/search?q={query}&format=json&engines=bing,duckduckgo,brave`
  - Brave API: `GET https://api.search.brave.com/res/v1/web/search?q={query}` with `X-Subscription-Token` header
  - Constructor: `func NewWebSearchTool(providers []SearchProvider) *Tool`

- [x] **9.2** Create `backend/tools/web_search_test.go`
  - File: `backend/tools/web_search_test.go` (NEW)
  - Action: Tests using httptest.NewServer to mock APIs:
    - SearXNG returns results → formatted output
    - SearXNG down, Brave returns results → fallback works
    - Both providers fail → ToolResult.IsError true
    - Empty query → ToolResult.IsError true
    - SearXNG returns empty results → tries fallback
    - Brave API returns error status → ToolResult.IsError true
    - max_results parameter respected
    - Verify output format is LLM-readable (numbered list)

#### Task 10: ToolOrchestrator Service
Executes individual tool calls, manages trust level checks.

- [x] **10.1** Create `backend/services/tool_orchestrator.go`
  - File: `backend/services/tool_orchestrator.go` (NEW)
  - Action: Implement:
    ```go
    type ToolOrchestrator struct {
        registry *tools.ToolRegistry
        sandbox  *tools.Sandbox
        hub      *websocket.Hub
    }

    func NewToolOrchestrator(registry *tools.ToolRegistry, sandbox *tools.Sandbox, hub *websocket.Hub) *ToolOrchestrator

    // HandleToolCall executes a single tool call and returns the result.
    // Broadcasts tool-start and tool-result events via Hub.
    // For dangerous tools in Guided/Supervised mode, sends tool-confirm
    // and blocks until tool-approve received or timeout.
    func (o *ToolOrchestrator) HandleToolCall(
        ctx context.Context,
        client *websocket.Client,
        conversationID string,
        messageID string,
        toolCall types.ToolCall,
        trustLevel types.TrustLevel,
    ) (*tools.ToolResult, error)

    // NeedsConfirmation returns true if the tool requires user approval
    // given the current trust level.
    func (o *ToolOrchestrator) NeedsConfirmation(toolName string, trustLevel types.TrustLevel) bool
    ```
  - HandleToolCall flow:
    1. Look up tool via `registry.Get(toolCall.Name)` → not found = system error
    2. Check trust level: `NeedsConfirmation()` → if yes, broadcast `chat:tool-confirm`, wait on approval channel (30s timeout)
    3. Broadcast `chat:tool-start` with tool name and parsed input
    4. Call `tool.Execute(ctx, toolCall.Input)`
    5. Broadcast `chat:tool-result` with output and status
    6. Return `ToolResult` (or error for system failures)
  - NeedsConfirmation logic per architecture decision 5:
    - Supervised: always true
    - Guided: true if tool.DangerLevel == "dangerous"
    - Autonomous: always false
  - Approval channel: map of `toolID → chan bool`, created when confirm sent, cleaned up after

- [x] **10.2** Create `backend/services/tool_orchestrator_test.go`
  - File: `backend/services/tool_orchestrator_test.go` (NEW)
  - Action: Tests:
    - Execute known tool → returns result, tool-start and tool-result events sent
    - Execute unknown tool → returns error
    - Tool returns IsError → result forwarded with status "error", no system error
    - Tool returns Go error (sandbox violation) → system error returned
    - Guided mode + safe tool → no confirmation needed
    - Guided mode + dangerous tool → confirmation required
    - Supervised mode → all tools need confirmation
    - Autonomous mode → no tools need confirmation
    - Confirmation timeout (30s) → tool not executed, error result
    - Context cancellation during execution → error returned

#### Task 11: Provider Tool Integration — Claude
Parse Claude's tool_use streaming events into StreamChunk tool types.

- [x] **11.1** Extend `claude.go` SendMessage for tool calls
  - File: `backend/providers/claude.go`
  - Action: In the streaming goroutine, extend the event switch:
    - `ContentBlockStartEvent` with block type `"tool_use"`: emit `StreamChunk{Type: "tool_call_start", ToolID: block.ID, ToolName: block.Name, MessageID: messageID}`
    - `ContentBlockDeltaEvent` with delta type `InputJSONDelta`: emit `StreamChunk{Type: "tool_call_delta", ToolID: currentToolID, Content: delta.PartialJSON, MessageID: messageID}`
    - `ContentBlockStopEvent` for tool blocks: emit `StreamChunk{Type: "tool_call_end", ToolID: currentToolID, MessageID: messageID}`
  - Also: When `ChatRequest.Tools` is populated, convert `ToolDefinition` to Anthropic tool format and pass to the SDK's message creation.
  - Also: Format tool result messages — when `Message.Role == "tool"`, create Anthropic `tool_result` content block with `ToolCallID` as `tool_use_id`.
  - Notes: Track `currentToolID` across delta events (set on start, cleared on end). Multiple tool calls per message are possible — track by index.

- [x] **11.2** Extend Claude provider tests
  - File: `backend/providers/claude_test.go`
  - Action: Add SSE test server that returns tool_use events:
    - `content_block_start` with type `tool_use` → verify `tool_call_start` chunk emitted
    - `content_block_delta` with `input_json_delta` → verify `tool_call_delta` chunks
    - `content_block_stop` → verify `tool_call_end` chunk
    - Mixed text + tool_use blocks → verify correct interleaving
    - Tool definitions passed in request → verify Anthropic API format

#### Task 12: Provider Tool Integration — OpenAI
Parse OpenAI's function calling deltas into StreamChunk tool types.

- [x] **12.1** Extend `openai.go` SendMessage for tool calls
  - File: `backend/providers/openai.go`
  - Action: In the streaming goroutine, detect tool calls:
    - Check `chunk.Choices[0].Delta.ToolCalls` array
    - For each tool call: on first appearance, emit `tool_call_start` with function name and ID
    - On subsequent deltas with `Function.Arguments`, emit `tool_call_delta`
    - On `FinishReason == "tool_calls"`, emit `tool_call_end` for each active tool
  - Also: Convert `ToolDefinition` to OpenAI function format when tools present in ChatRequest.
  - Also: Format tool result messages — when `Message.Role == "tool"`, create OpenAI tool message format.

- [x] **12.2** Extend OpenAI provider tests
  - File: `backend/providers/openai_test.go`
  - Action: Add streaming test with tool_calls in delta. Verify chunk sequence.

#### Task 13: Provider Tool Integration — Ollama
Add native tools parameter support for compatible models.

- [x] **13.1** Extend `ollama.go` SendMessage for tool calls
  - File: `backend/providers/ollama.go`
  - Action:
    - When `ChatRequest.Tools` is populated, include `tools` array in the Ollama `/api/chat` request body, formatted per Ollama API spec.
    - In the NDJSON parsing loop, check `chatResp.Message.ToolCalls`:
      - If present, emit `tool_call_start` → single `tool_call_delta` with full input JSON → `tool_call_end` for each tool call (Ollama doesn't stream tool input incrementally).
    - Format tool result messages for Ollama's `role: "tool"` format.
  - Notes: Ollama tool calls appear in the final response (when `Done: false` but `Message.ToolCalls` is non-empty). Not all models support tools — this is handled by the frontend in Spec 2 (supportsTools metadata).

- [x] **13.2** Extend Ollama provider tests
  - File: `backend/providers/ollama_test.go`
  - Action: Add NDJSON test response with tool_calls field. Verify chunk sequence.

#### Task 14: ChatService Tool Call Loop
Refactor consumeStream to support the multi-turn tool execution loop.

- [x] **14.1** Extend ChatService struct
  - File: `backend/services/chat_service.go`
  - Action:
    - Add `orchestrator *ToolOrchestrator` field to ChatService struct
    - Update `NewChatService` to accept orchestrator parameter
    - Add `registry *tools.ToolRegistry` field (or access via orchestrator)

- [x] **14.2** Extend HandleMessage for conversation history
  - File: `backend/services/chat_service.go`
  - Action: Update HandleMessage to:
    - Extract `History` from ChatSendPayload (if present)
    - Build messages array: history messages + current user message
    - Pass full messages to ChatRequest

- [x] **14.3** Refactor consumeStream for tool loop
  - File: `backend/services/chat_service.go`
  - Action: Restructure consumeStream to implement the tool call loop per architecture pattern 4:
    1. Relay text/thinking chunks to Hub (existing behavior — unchanged)
    2. Accumulate tool_call chunks by ToolID (new):
       - `tool_call_start`: create accumulator entry `{toolID, toolName, inputParts: []}`
       - `tool_call_delta`: append to accumulator's inputParts
       - `tool_call_end`: parse accumulated input, tool call is complete
    3. On stream end with pending tool calls:
       a. For each complete tool call: call `orchestrator.HandleToolCall()` (broadcasts events)
       b. Append assistant message with ToolCalls to messages array
       c. Append tool result messages to messages array
       d. Check safety max (200 iterations) — if exceeded, force text response by removing tools from request
       e. Call `providerService.SendMessage()` again with updated messages → new stream
       f. Loop back to step 1 with new stream
    4. On stream end with no tool calls → relay `chat:stream-end` (done — existing behavior)
  - Notes: The loop counter, messages array, and tool accumulators are local variables within consumeStream. Each loop iteration creates a fresh provider call. Context cancellation kills the entire loop. The existing relay channel pattern wraps the inner provider stream — recreated each iteration.

- [x] **14.4** Extend ChatService tests
  - File: `backend/services/chat_service_test.go`
  - Action: New test cases:
    - Stream with no tool calls → existing behavior preserved (regression check)
    - Stream with tool_call chunks → tool events emitted, loop continues
    - Multi-turn loop: tool call → result → text response → done
    - Safety max exceeded → loop exits with text
    - Context cancellation during tool execution → clean shutdown
    - Unknown tool in stream → error result injected, loop continues

#### Task 15: main.go Wiring
Initialize all tool services and wire them together.

- [x] **15.1** Wire tool services in main.go
  - File: `backend/main.go`
  - Action: Add initialization between providerService and chatService:
    ```go
    // Tool execution layer
    projectRoot := projectManager.CurrentProject().ProjectRoot  // or equivalent
    centralRoot := filepath.Join(os.Getenv("HOME"), "bmad-studio", "projects", projectManager.CurrentProject().ProjectName)
    sandbox := tools.NewSandbox(projectRoot, centralRoot)
    registry := tools.NewRegistry()

    // Register core tools
    registry.RegisterCore(tools.NewFileReadTool(sandbox))
    registry.RegisterCore(tools.NewFileWriteTool(sandbox))
    registry.RegisterCore(tools.NewBashTool(sandbox))

    // Web search providers
    var searchProviders []tools.SearchProvider
    searchProviders = append(searchProviders, tools.NewSearXNGProvider("http://localhost:8080"))
    // Brave fallback configured if API key available (from config store)
    if braveKey := configStore.Get("brave_search_api_key"); braveKey != "" {
        searchProviders = append(searchProviders, tools.NewBraveSearchProvider(braveKey))
    }
    registry.RegisterCore(tools.NewWebSearchTool(searchProviders))

    orchestrator := services.NewToolOrchestrator(registry, sandbox, hub)
    chatService := services.NewChatService(providerService, hub, orchestrator)
    ```
  - Notes: ProjectManager must be loaded before tool init. Handle case where no project is loaded (sandbox with empty paths — tools disabled). SearXNG URL should be configurable (config store or env var). Brave key from config store (BYOK pattern).

- [x] **15.2** Handle tool-approve WebSocket events
  - File: `backend/main.go`
  - Action: In the `hub.SetMessageHandler` switch, add:
    ```go
    case types.EventTypeChatToolApprove:
        // Parse ChatToolApprovePayload
        // Route to orchestrator's approval channel for the given toolID
    ```

### Acceptance Criteria

#### Foundation & Types
- [x] AC-1: Given a fresh codebase, when all new type files compile, then `go build ./...` succeeds with no errors and no import cycles between packages.
- [x] AC-2: Given a ToolDefinition with name/description/inputSchema, when serialized to JSON, then all fields use `camelCase` tags matching project convention.

#### Sandbox
- [x] AC-3: Given a path `../../etc/passwd`, when `sandbox.ValidatePath(path, false)` is called, then an error is returned indicating path traversal.
- [x] AC-4: Given a symlink inside projectRoot pointing to `/etc/passwd`, when `sandbox.ValidatePath(symlinkPath, false)` is called, then an error is returned indicating the resolved path is outside sandbox.
- [x] AC-5: Given a valid path inside projectRoot, when `sandbox.ValidatePath(path, true)` is called, then the resolved absolute path is returned with no error.
- [x] AC-6: Given a path to `.env` inside projectRoot, when `sandbox.ValidatePath(path, true)` is called, then an error is returned indicating a dangerous path.
- [x] AC-7: Given an environment with `MY_API_KEY=secret` and `PATH=/usr/bin`, when `sandbox.ValidateBashEnv(env)` is called, then the result contains `PATH` but not `MY_API_KEY`.

#### Tool Registry
- [x] AC-8: Given 4 core tools registered, when `registry.ListForScope(nil)` is called, then all 4 tools are returned.
- [x] AC-9: Given a ToolScope allowing only file_read and web_search, when `registry.ListForScope(scope)` is called, then only those 2 tools are returned.
- [x] AC-10: Given a ToolScope with empty permissions, when `registry.ListForScope(scope)` is called, then only safe defaults (file_read, web_search) are returned.
- [x] AC-11: Given `registry.RegisterMCP("server")` is called, then a "not implemented" error is returned.

#### Core Tools
- [x] AC-12: Given a file at `{projectRoot}/test.txt` with content "hello", when file_read is executed with `{"path": "test.txt"}`, then ToolResult.Output is "hello" and IsError is false.
- [x] AC-13: Given no file at path, when file_read is executed, then ToolResult.IsError is true with "file not found" message.
- [x] AC-14: Given `{"path": "new/dir/file.txt", "content": "data"}`, when file_write is executed, then the file exists with content "data" and parent directories were created.
- [x] AC-15: Given `{"command": "echo hello"}`, when bash is executed, then ToolResult.Output contains "hello" and Metadata.exitCode is 0.
- [x] AC-16: Given `{"command": "exit 42"}`, when bash is executed, then ToolResult.IsError is true and Metadata.exitCode is 42.
- [x] AC-17: Given a command that runs longer than timeout, when bash is executed with `{"command": "sleep 300", "timeout": 1}`, then ToolResult.IsError is true with timeout message.
- [x] AC-18: Given SearXNG is reachable and returns results, when web_search is executed with `{"query": "test"}`, then ToolResult.Output contains formatted search results and IsError is false.
- [x] AC-19: Given SearXNG is down and Brave is configured, when web_search is executed, then Brave results are returned as fallback.
- [x] AC-20: Given both search providers fail, when web_search is executed, then ToolResult.IsError is true.

#### ToolOrchestrator
- [x] AC-21: Given trust level "guided" and tool "file_read" (safe), when HandleToolCall is invoked, then the tool executes without confirmation and tool-start + tool-result events are broadcast.
- [x] AC-22: Given trust level "guided" and tool "bash" (dangerous), when HandleToolCall is invoked, then a tool-confirm event is broadcast and execution waits for approval.
- [x] AC-23: Given trust level "autonomous", when HandleToolCall is invoked for any tool, then no confirmation is required.
- [x] AC-24: Given a tool execution that returns IsError: true, when HandleToolCall completes, then tool-result with status "error" is broadcast and no Go error is returned (loop continues).

#### Provider Tool Integration
- [x] AC-25: Given a Claude API stream with a `tool_use` content block, when the provider processes the stream, then `tool_call_start`, `tool_call_delta`, and `tool_call_end` StreamChunks are emitted with correct ToolID and ToolName.
- [x] AC-26: Given an OpenAI API stream with `tool_calls` in the delta, when the provider processes the stream, then matching tool StreamChunk types are emitted.
- [x] AC-27: Given an Ollama response with `message.tool_calls`, when the provider processes it, then `tool_call_start` → single `tool_call_delta` → `tool_call_end` are emitted.
- [x] AC-28: Given ChatRequest with Tools populated, when each provider's SendMessage is called, then the tools are formatted in the provider's native API format.

#### ChatService Tool Loop
- [x] AC-29: Given a provider stream with only text chunks (no tool calls), when consumeStream runs, then existing behavior is preserved — text deltas and stream-end emitted. (Regression)
- [x] AC-30: Given a provider stream with tool_call chunks followed by text-only response, when consumeStream runs, then: tool events broadcast → tool executed → result injected → provider called again → text response streamed → stream-end emitted.
- [x] AC-31: Given a tool loop that reaches 200 iterations, when the safety max is hit, then the loop exits and a stream-end is emitted.
- [x] AC-32: Given context cancellation during tool execution, when the context is cancelled, then consumeStream returns cleanly with a partial stream-end.

#### Wiring
- [x] AC-33: Given a loaded project, when the backend starts, then ToolRegistry has 4 core tools registered and Sandbox is configured with correct paths.
- [x] AC-34: Given a `chat:tool-approve` WebSocket event, when received by the backend, then it routes to the orchestrator's approval channel for the correct toolID.

## Additional Context

### Dependencies

- No new frontend dependencies
- No new Go dependencies for core tools (stdlib: os, os/exec, path/filepath, net/http, encoding/json)
- SearXNG Docker container (external service, user-managed, `http://localhost:8080` default)
- Brave Search API key (user-provided via config store, BYOK pattern)
- MCP scaffold defines interface only — no `mcp-go` dependency in v1

### Testing Strategy

- **Tool unit tests:** Table-driven with `t.TempDir()` for filesystem tests, `httptest.NewServer` for web_search mocking
- **Sandbox tests:** Adversarial path traversal, symlinks, dangerous path patterns
- **Registry tests:** Scope filtering, concurrent access, MCP scaffold
- **Orchestrator tests:** Mock tools + mock Hub, trust level matrix, approval timeout
- **ChatService tests:** Extend existing patterns — mock provider with tool chunks, verify event sequence, test full loop termination
- **Provider tests:** Extend existing httptest servers with tool-use SSE/NDJSON fixtures
- **Zero regressions:** All 32 existing tests must pass. All existing streaming behavior preserved.
- **Follow existing patterns:** `mockClient`, `collectEvents`, table-driven, `httptest.NewServer`, `t.Helper()`

### Notes

- **Architecture doc is source of truth** for all type shapes, patterns, and decisions. This spec operationalizes the architecture into implementation tasks.
- **Spec 1 of 2.** Spec 2 covers: frontend tool-call-block component, frontend MessageBlock[] state model, Ollama supportsTools metadata in model selector, context-aware loop budget, trust level settings UI.
- **Conversation history gap:** Current ChatSendPayload has no history field. Task 3.5 adds it. Frontend changes to send history are minimal but technically out of scope for this backend spec — the payload field is ready, frontend wiring is Spec 2.
- **SearXNG config:** URL should default to `http://localhost:8080` but be configurable via config store. If SearXNG is unreachable, web_search falls back to Brave only.
- **No command blocklist for bash:** v1 relies on trust levels (user confirms dangerous tools) rather than command filtering. The sandbox prevents env variable leaks and restricts working directory.
- **Parallel tool execution:** Architecture doesn't specify parallel execution. v1 executes tool calls sequentially within a message. Parallel execution is a future optimization.
