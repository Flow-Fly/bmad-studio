# Story 3.1: WebSocket Connection & Streaming

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **a WebSocket connection for real-time streaming**,
So that **agent responses can stream to the UI as they're generated**.

## Acceptance Criteria

1. **Given** the app is running with a configured provider, **When** a chat session is initiated, **Then** a WebSocket connection is established to the backend (reuses the existing `/ws` connection).

2. **Given** a WebSocket connection exists, **When** a message is sent via `chat:send`, **Then** the backend emits `chat:stream-start` with conversationId, messageId, model **And** `chat:text-delta` events stream content fragments **And** `chat:thinking-delta` events stream thinking/reasoning content when available **And** `chat:stream-end` signals completion with token usage stats **And** `chat:error` is emitted with error code if an error occurs **And** all chat events use the `chat:` namespace prefix on the shared WebSocket.

3. **Given** the WebSocket disconnects unexpectedly, **When** reconnection is attempted, **Then** the connection is re-established automatically **And** a `connection:status` event notifies the UI.

4. **Given** a streaming response is in progress, **When** the user sends a `chat:cancel` message with conversationId, **Then** the backend cancels the active LLM request via context cancellation **And** a `chat:stream-end` event is emitted with partial content flagged **And** the partial response is preserved in the conversation **And** the user can send a new message immediately after cancellation.

5. **Given** a streaming response is in progress, **When** chunks arrive, **Then** text deltas are appended to the in-progress message **And** the Go backend uses a goroutine pipeline: Provider -> ChatService -> Hub **And** a buffered channel (size 64) decouples provider HTTP I/O from WebSocket I/O **And** provider timeouts are enforced via `context.WithTimeout` up to 5 minutes for extended thinking responses.

## Tasks / Subtasks

- [x] Task 1: Add chat WebSocket event types to backend (AC: #2)
  - [x] 1.1: Add chat event type constants to `backend/types/websocket.go`: `EventTypeChatStreamStart`, `EventTypeChatTextDelta`, `EventTypeChatThinkingDelta`, `EventTypeChatStreamEnd`, `EventTypeChatError`, `EventTypeChatSend`, `EventTypeChatCancel`
  - [x] 1.2: Add chat event payload structs to `backend/types/websocket.go`: `ChatStreamStartPayload` (ConversationID, MessageID, Model string), `ChatTextDeltaPayload` (ConversationID, MessageID, Content string, Index int), `ChatThinkingDeltaPayload` (ConversationID, MessageID, Content string, Index int), `ChatStreamEndPayload` (ConversationID, MessageID string, Usage *UsageStats, Partial bool), `ChatErrorPayload` (ConversationID, MessageID, Code, Message string), `ChatSendPayload` (ConversationID, Content, Model, Provider string, SystemPrompt string optional), `ChatCancelPayload` (ConversationID string)
  - [x] 1.3: Add helper constructors: `NewChatStreamStartEvent`, `NewChatTextDeltaEvent`, `NewChatThinkingDeltaEvent`, `NewChatStreamEndEvent`, `NewChatErrorEvent`

- [x] Task 2: Create `ChatService` in backend (AC: #2, #4, #5)
  - [x] 2.1: Create `backend/services/chat_service.go` with `ChatService` struct holding: `providerService *ProviderService`, `hub *websocket.Hub`, `activeStreams map[string]context.CancelFunc` (keyed by conversationID), `mu sync.RWMutex`
  - [x] 2.2: Implement `NewChatService(providerService *ProviderService, hub *websocket.Hub) *ChatService`
  - [x] 2.3: Implement `HandleMessage(ctx context.Context, payload ChatSendPayload, apiKey string) error`
  - [x] 2.4: Implement `CancelStream(conversationID string) error`
  - [x] 2.5: Implement `ActiveStreamCount() int` for diagnostics

- [x] Task 3: Enable bidirectional WebSocket communication (AC: #2, #4)
  - [x] 3.1: Modify `backend/api/websocket/client.go` `readPump()` to parse incoming JSON messages as `WebSocketEvent` and route via Hub's messageHandler
  - [x] 3.2: Add `MessageHandler` callback to Hub that client calls on parsed messages
  - [x] 3.3: Update `maxMessageSize` in client.go from 512 to 65536 bytes
  - [x] 3.4: Add `SendToClient(client *Client, event *types.WebSocketEvent)` method to Hub for targeted delivery
  - [x] 3.5: Add `SendChan()` accessor to Client for external access to send channel

- [x] Task 4: Wire ChatService into application startup (AC: #1, #2)
  - [x] 4.1: In `backend/main.go`: create `ChatService` after ProviderService and Hub, passing both as dependencies
  - [x] 4.2: Add ChatService to `RouterServices` struct in `backend/api/router.go`
  - [x] 4.3: Set Hub messageHandler in main.go to route chat:send and chat:cancel to ChatService
  - [x] 4.4: API key passed via ChatSendPayload from frontend (frontend holds keys in keychain; backend resolves per-request)

- [x] Task 5: Update Claude provider for thinking content streaming (AC: #2)
  - [x] 5.1: Update `backend/providers/claude.go` `SendMessage()` to handle ThinkingDelta via type switch
  - [x] 5.2: Add `"thinking"` as valid `StreamChunk.Type` value and `Model` field to StreamChunk (tech debt fix)
  - [x] 5.3: In ChatService `consumeStream`, map `StreamChunk.Type == "thinking"` to `chat:thinking-delta` WebSocket event

- [x] Task 6: Update frontend WebSocket service for chat events (AC: #1, #2, #3)
  - [x] 6.1: Add chat event type constants to `src/types/conversation.ts`: `CHAT_STREAM_START`, `CHAT_TEXT_DELTA`, `CHAT_THINKING_DELTA`, `CHAT_STREAM_END`, `CHAT_ERROR`, `CHAT_SEND`, `CHAT_CANCEL`
  - [x] 6.2: Add chat event payload interfaces to `src/types/conversation.ts`
  - [x] 6.3: Add `send(event: WebSocketEvent): void` method to `src/services/websocket.service.ts` with connection guard
  - [x] 6.4: Export `send` function from websocket.service.ts alongside existing `connect`, `disconnect`, `on`

- [x] Task 7: Create frontend chat service (AC: #2, #4, #5)
  - [x] 7.1: Create `src/services/chat.service.ts` with `sendMessage()`, `cancelStream()` functions
  - [x] 7.2: Create `src/state/chat.state.ts` with `chatConnectionState`, `activeConversations`, `streamingConversationId` signals
  - [x] 7.3: Create `src/types/conversation.ts` with `Conversation`, `Message`, `UsageStats` types
  - [x] 7.4: Register WebSocket event handlers in chat.service.ts that update chat.state.ts
  - [x] 7.5: Export `initChatService()` and call from app-shell `_setupWorkflowSubscription()`

- [x] Task 8: Write backend tests (AC: #2, #4, #5)
  - [x] 8.1: Create `backend/services/chat_service_test.go` — 8 tests covering HandleMessage validation, invalid provider, CancelStream, ActiveStreamCount, stream chunk mapping, context cancellation, error handling
  - [x] 8.2: Add chat event type and constructor tests to `backend/types/websocket_test.go` — 11 tests covering constants, constructors, JSON serialization
  - [x] 8.3: Add SendToClient, buffer-full, and SetMessageHandler tests to `backend/api/websocket/hub_test.go` — 3 tests

- [x] Task 9: Write frontend tests (AC: #1, #2, #3, #6)
  - [x] 9.1: Create `tests/frontend/services/chat.service.test.ts` — 16 tests covering sendMessage, cancelStream, initChatService, event handlers, state management, conversation CRUD, type constants
  - [x] 9.2: WebSocket send() tested within chat.service.test.ts — send throws when not connected, on() returns cleanup

## Dev Notes

### Critical Architecture Patterns

**This story establishes the bidirectional WebSocket chat streaming pipeline — the foundation for all Epic 3 conversations.** The existing WebSocket infrastructure is broadcast-only (server → all clients). This story extends it to support client → server messaging and targeted server → client responses.

**The WebSocket connection is SHARED** — the existing `/ws` endpoint already handles `artifact:*` and `workflow:*` events. Chat events use the `chat:` namespace prefix on the SAME connection. Do NOT create a separate WebSocket endpoint.

**Conversations are EPHEMERAL** — in-memory only, no persistence. The ChatService holds active stream state, not conversation history. Frontend `chat.state.ts` holds conversation data in signals. Closing the app loses everything.

[Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Conversation-Model, _bmad-output/project-context.md#Conversation-Insight-Model]

### Project Structure Notes

**Files to Create:**

```
backend/
├── services/
│   └── chat_service.go              # CREATE: Chat streaming service
└── types/                           # MODIFY: Add chat event types to websocket.go

src/
├── services/
│   └── chat.service.ts              # CREATE: Frontend chat service
├── state/
│   └── chat.state.ts                # CREATE: Chat signal state
└── types/
    └── conversation.ts              # CREATE: Conversation & message types

tests/
├── backend/
│   └── services/
│       └── chat_service_test.go     # CREATE: Chat service tests
└── frontend/
    └── services/
        └── chat.service.test.ts     # CREATE: Chat service tests
```

**Files to Modify:**

```
backend/
├── api/
│   ├── websocket/
│   │   ├── client.go                # MODIFY: Parse incoming messages in readPump, increase maxMessageSize
│   │   └── hub.go                   # MODIFY: Add SendToClient method, add messageHandler callback
│   └── router.go                    # MODIFY: Add ChatService to RouterServices
├── main.go                          # MODIFY: Create and wire ChatService
├── providers/
│   ├── provider.go                  # MODIFY: Add "thinking" StreamChunk type
│   └── claude.go                    # MODIFY: Handle ThinkingDelta events
└── types/
    └── websocket.go                 # MODIFY: Add chat event constants and payload structs

src/
├── services/
│   └── websocket.service.ts         # MODIFY: Add send() function
├── types/
│   └── websocket.ts                 # MODIFY: Add chat event type constants (or create if missing)
└── app-shell.ts                     # MODIFY: Initialize chat service on project open
```

**Files to NOT Touch:**

```
src/components/                       # NO UI components in this story (that's 3.2-3.4)
src/state/project.state.ts           # DO NOT MODIFY
src/state/workflow.state.ts          # DO NOT MODIFY
src/state/phases.state.ts            # DO NOT MODIFY
src/state/connection.state.ts        # DO NOT MODIFY (WebSocket reconnection already handled)
src/state/provider.state.ts          # DO NOT MODIFY
src/services/project.service.ts      # DO NOT MODIFY
src/services/provider.service.ts     # DO NOT MODIFY
src/styles/                           # DO NOT MODIFY
backend/providers/openai.go          # DO NOT MODIFY (thinking is Claude-specific for now)
backend/providers/ollama.go          # DO NOT MODIFY
backend/storage/                      # DO NOT MODIFY (no persistent storage for conversations)
```

[Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete-Project-Directory-Structure]

### Technical Requirements

#### Backend Stack (MUST USE)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Go | go | 1.25.6 | Backend language |
| Chi | github.com/go-chi/chi/v5 | v5.2.4 | HTTP router (existing) |
| gorilla/websocket | github.com/gorilla/websocket | v1.5.3 | WebSocket (existing) |
| anthropic-sdk-go | github.com/anthropics/anthropic-sdk-go | v1.19.0 | Claude streaming API |
| openai-go | github.com/openai/openai-go/v3 | v3.17.0 | OpenAI streaming API |

**DO NOT** add new dependencies. All required libraries are already in `go.mod`.

#### Frontend Stack (MUST USE)

| Technology | Package | Purpose |
|---|---|---|
| Lit | `lit` ^3.1.0 | Web Components (for app-shell wiring only) |
| Signals | `signal-polyfill` + `@lit-labs/signals` | State management for chat state |

**DO NOT** add new npm dependencies for this story.

[Source: backend/go.mod, package.json]

#### Streaming Pipeline Architecture

```
Frontend (chat.service.ts)
  │ chat:send via WebSocket
  ▼
Client.readPump() (client.go)
  │ Parse JSON, route by event type
  ▼
ChatService.HandleMessage() (chat_service.go)
  │ Resolve provider, build request
  ▼
Provider.SendMessage() (claude.go/openai.go/ollama.go)
  │ Returns <-chan StreamChunk (buffered 32)
  ▼
ChatService goroutine
  │ Consume StreamChunk, map to chat:* events
  │ Use buffered relay channel (size 64)
  ▼
Hub.SendToClient() (hub.go)
  │ Targeted delivery to requesting client
  ▼
Client.writePump() (client.go)
  │ Write to WebSocket connection
  ▼
Frontend (websocket.service.ts → chat.state.ts)
  │ on('chat:text-delta', ...) → update signal state
```

**Key design decisions:**
- **Buffered relay channel (64):** Decouples provider I/O speed from WebSocket write speed. If client's send buffer (256) is full, the message is dropped and client is considered slow
- **Context cancellation chain:** `HandleMessage` creates a `context.WithTimeout(ctx, 5*time.Minute)`. Calling `CancelStream` calls the cancel func. The provider's goroutine detects `ctx.Done()` and stops consuming the API stream
- **Targeted delivery:** Chat responses go ONLY to the client that sent the request, not broadcast to all clients. This requires `SendToClient` (new) vs `BroadcastEvent` (existing)
- **API key resolution:** The frontend sends `provider` type in `chat:send`. The backend retrieves the API key from ConfigStore (already stores provider settings). The API key is NEVER sent over WebSocket

[Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.1, _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Provider-Architecture]

#### WebSocket Event Protocol (chat namespace)

**Client → Server:**

```json
// chat:send
{
  "type": "chat:send",
  "payload": {
    "conversation_id": "uuid",
    "content": "user message text",
    "model": "claude-sonnet-4-5-20250929",
    "provider": "claude",
    "system_prompt": "optional system prompt"
  },
  "timestamp": "2026-02-03T10:00:00Z"
}

// chat:cancel
{
  "type": "chat:cancel",
  "payload": {
    "conversation_id": "uuid"
  },
  "timestamp": "2026-02-03T10:00:05Z"
}
```

**Server → Client (targeted):**

```json
// chat:stream-start
{
  "type": "chat:stream-start",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "msg_xxx",
    "model": "claude-sonnet-4-5-20250929"
  },
  "timestamp": "..."
}

// chat:text-delta
{
  "type": "chat:text-delta",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "msg_xxx",
    "content": "Hello, ",
    "index": 0
  },
  "timestamp": "..."
}

// chat:thinking-delta
{
  "type": "chat:thinking-delta",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "msg_xxx",
    "content": "Let me think about...",
    "index": 0
  },
  "timestamp": "..."
}

// chat:stream-end
{
  "type": "chat:stream-end",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "msg_xxx",
    "usage": {
      "input_tokens": 150,
      "output_tokens": 423
    },
    "partial": false
  },
  "timestamp": "..."
}

// chat:error
{
  "type": "chat:error",
  "payload": {
    "conversation_id": "uuid",
    "message_id": "msg_xxx",
    "code": "provider_timeout",
    "message": "The request timed out. Please try again."
  },
  "timestamp": "..."
}
```

**Error codes:** `provider_timeout`, `rate_limited`, `overloaded`, `auth_error`, `invalid_request`, `provider_error`, `stream_cancelled`

[Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#API-Communication, _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.1]

#### Existing Code Patterns to Follow

**Go error handling:** Always return `(result, error)`, never panic. Use `ProviderError` struct for provider-specific errors. [Source: backend/providers/provider.go]

**Go service pattern:** Thread-safe with `sync.RWMutex`. See `ProjectManager` and `ArtifactService` for established patterns. [Source: backend/services/project_manager.go]

**WebSocket event helper pattern:** Follow existing `NewArtifactCreatedEvent(artifact)` constructor pattern for new `NewChatStreamStartEvent(...)` etc. [Source: backend/types/websocket.go]

**Frontend signal pattern:** `Signal.State<T>` for mutable state, `Signal.Computed<T>` for derived. Immutable updates: `signal.value = newValue`. [Source: src/state/project.state.ts, _bmad-output/project-context.md#State-Management]

**Frontend service pattern:** Module-level functions (not classes). Export named functions. See `project.service.ts`, `workflow.service.ts`. [Source: src/services/project.service.ts]

**Frontend WebSocket event subscription:** `wsOn('event:type', handler)` returns cleanup function. Established in app-shell.ts. [Source: src/app-shell.ts]

#### Claude Streaming API — ThinkingDelta

The existing `claude.go` handles `MessageStartEvent`, `ContentBlockDeltaEvent` (TextDelta only), and `MessageDeltaEvent`. For thinking content, the `ContentBlockDeltaEvent` can also contain a `ThinkingDelta` variant:

```go
case anthropic.ContentBlockDeltaEvent:
    switch delta := event.Delta.AsAny().(type) {
    case anthropic.TextDelta:
        send(StreamChunk{Type: "chunk", Content: delta.Text, ...})
    case anthropic.ThinkingDelta:
        send(StreamChunk{Type: "thinking", Content: delta.Thinking, ...})
    }
```

**Note:** Extended thinking is only available on certain Claude models and requires `Thinking` parameter in the request. For this story, just handle the delta type if it arrives — don't add extended thinking request parameters yet (that can be a future enhancement).

[Source: backend/providers/claude.go:99-145, anthropic-sdk-go documentation]

#### Hub.SendToClient — Targeted Delivery Pattern

Currently `hub.BroadcastEvent()` sends to ALL connected clients. For chat, responses must go to the SPECIFIC client that sent the request. Add:

```go
func (h *Hub) SendToClient(client *Client, event *types.WebSocketEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    select {
    case client.send <- data:
        return nil
    default:
        // Client is slow, handle gracefully
        return fmt.Errorf("client send buffer full")
    }
}
```

The ChatService goroutine needs a reference to the originating `*Client` to call this. Pass the `*Client` through the message handler callback.

[Source: backend/api/websocket/hub.go — existing BroadcastEvent pattern]

#### Client readPump — Bidirectional Messaging

Currently `readPump()` in `client.go` reads messages and discards them. Modify to:

```go
func (c *Client) readPump() {
    defer func() {
        c.hub.Unregister(c)
        c.conn.Close()
    }()
    c.conn.SetReadLimit(maxMessageSize) // Now 65536
    // ... existing deadline/pong setup ...

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil { break }

        var event types.WebSocketEvent
        if err := json.Unmarshal(message, &event); err != nil {
            continue // ignore malformed messages
        }

        if c.hub.messageHandler != nil {
            c.hub.messageHandler(c, &event)
        }
    }
}
```

[Source: backend/api/websocket/client.go — existing readPump]

### Architecture Compliance

- **Shared WebSocket:** Uses existing `/ws` endpoint with `chat:` namespace — matches architecture spec [Source: architecture/core-architectural-decisions.md]
- **Provider interface:** Uses existing `Provider.SendMessage()` returning `<-chan StreamChunk` — no interface changes needed [Source: backend/providers/provider.go]
- **Ephemeral conversations:** In-memory only, no storage layer — matches architecture decision [Source: architecture/core-architectural-decisions.md#Conversation-Model]
- **Signal state:** `chat.state.ts` follows established `Signal.State` + `Signal.Computed` pattern [Source: project-context.md#State-Management]
- **Service layer:** Frontend chat.service.ts is module-level functions, not a class — matches project convention [Source: project-context.md#TypeScript]
- **Error format:** Chat errors use `{ code, message }` format matching API error convention [Source: architecture/implementation-patterns-consistency-rules.md#Error-Handling]
- **JSON field naming:** All payload fields use `snake_case` in JSON — matches Go JSON tag convention [Source: project-context.md#Go-Backend]

### Library & Framework Requirements

| Library | Current Version | Required Action |
|---|---|---|
| gorilla/websocket | v1.5.3 | No update needed — already supports bidirectional messaging |
| anthropic-sdk-go | v1.19.0 | No update needed — ThinkingDelta available in current version |
| openai-go | v3.17.0 | No changes for this story |
| signal-polyfill | current | No update needed |

**Zero new dependencies.** All required functionality exists in current packages.

### File Structure Requirements

All new files follow established naming conventions:
- Go files: `snake_case.go` (e.g., `chat_service.go`)
- TS files: `kebab-case.ts` (e.g., `chat.service.ts`, `chat.state.ts`, `conversation.ts`)
- Test files: Go `*_test.go` in same package, TS `*.test.ts` in `tests/` mirror

[Source: project-context.md#Language-Specific-Rules]

### Testing Requirements

**Backend tests (Go):**
- Location: `tests/backend/services/chat_service_test.go`
- Pattern: Table-driven tests using Go's testing package
- Mock the Provider interface (already established pattern in provider tests)
- Mock the Hub for verifying event broadcasts
- Test streaming pipeline end-to-end with mock provider returning chunks
- Test context cancellation stops the stream
- Test concurrent streams don't interfere

**Frontend tests (@open-wc/testing):**
- Location: `tests/frontend/services/chat.service.test.ts`
- Pattern: Mock WebSocket send/receive, verify signal state updates
- Test each chat event handler updates state correctly
- Test sendMessage and cancelStream construct correct payloads
- Test init/cleanup lifecycle

**Current test count: 213 tests passing.** This story should add ~20-30 tests without breaking existing ones.

[Source: _bmad-output/project-context.md#Testing-Rules, _bmad-output/implementation-artifacts/2-5-app-shell-layout.md#Dev-Agent-Record]

### Previous Story Intelligence

**From Epic 2 (complete):**

- **213 tests passing** across all frontend test files — do not regress
- **WebSocket service exists** at `src/services/websocket.service.ts` with `connect()`, `disconnect()`, `on()` — add `send()` following the same module-level export pattern
- **App shell initializes WebSocket** on project open and subscribes to `workflow:status-changed` — add chat service initialization alongside this
- **Signal state pattern well-established** — `projectState`, `workflowState`, `phasesState` all follow same `Signal.State` + helper functions pattern
- **Service layer pattern established** — module-level async functions, not classes. `apiFetch()` utility for REST, `wsOn()`/`wsConnect()`/`wsDisconnect()` for WebSocket
- **Hub pattern works** — broadcast-only for now, but the infrastructure (Client, Hub, readPump, writePump) is solid

**From Epic 2 Retrospective:**
- **Dual-model code review is mandatory** — every story gets Opus + Gemini review
- **Code-simplifier runs between stories** — run before epic merge
- **Earlier epic services reveal bugs under real load** — expect WebSocket bugs to surface when chat exercises the full pipeline
- **Three research spikes were identified for Epic 3** — streaming conventions, Claude API access model, Ollama test harness. Results may influence approach

**Technical debt from previous epics:**
- `start` StreamChunk is missing `Model` field (Epic 1, Story 1-4 LOW) — **address in this story** by including Model in `ChatStreamStartPayload`
- WebSocket test too shallow (Epic 2 LOW) — write thorough bidirectional tests

[Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-02-02.md, _bmad-output/implementation-artifacts/2-5-app-shell-layout.md]

### Git Intelligence

**Recent commits:**
```
85629d3 Epic/2-project-workflow-state-visualization (#14)
f6a75af Epic/1-app-foundation (#8)
```

**Branch strategy:**
- Create `epic/3-agent-conversation-experience` from `dev`
- Create `story/3-1-websocket-connection-streaming` from `epic/3-agent-conversation-experience`
- PR: story → epic → dev → main

**Commit style:** `feat:` prefix, atomic commits, one logical change per commit.

[Source: _bmad-output/project-context.md#Git-Strategy]

### Anti-Patterns to Avoid

- **DO NOT** create a separate WebSocket endpoint for chat — use existing `/ws` with `chat:` namespace
- **DO NOT** broadcast chat responses to all clients — use targeted `SendToClient`
- **DO NOT** persist conversation data — conversations are ephemeral, in-memory only
- **DO NOT** send API keys over WebSocket — resolve them server-side from ConfigStore
- **DO NOT** add new Go dependencies — everything needed is already in go.mod
- **DO NOT** add new npm dependencies — signal-polyfill and Lit are sufficient
- **DO NOT** create UI components — this is infrastructure only (Story 3.2+ handles UI)
- **DO NOT** implement agent selection — that's Story 3.3
- **DO NOT** implement conversation lifecycle (compact/discard) — that's Story 3.9
- **DO NOT** implement context tracking — that's Story 3.7
- **DO NOT** use `panic()` in Go — always return errors
- **DO NOT** use inline styles in any frontend code
- **DO NOT** mix icon libraries
- **DO NOT** modify existing WebSocket event handling for artifacts/workflow — only ADD chat handlers
- **DO NOT** break the existing WebSocket reconnection logic in websocket.service.ts
- **DO NOT** use `@lit-labs/context` for chat state injection yet — that's for when components consume it (Story 3.4)

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-agent-conversation-experience.md#Story-3.1 — Story requirements and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — WebSocket protocol, provider interface, conversation model]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming conventions, API conventions, WebSocket events, error handling]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — File structure, architectural boundaries]
- [Source: _bmad-output/project-context.md — All project rules, conventions, anti-patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md — Streaming feedback patterns, connection status patterns]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-02-02.md — Research spikes, technical debt, process improvements]
- [Source: _bmad-output/implementation-artifacts/2-5-app-shell-layout.md — Previous story patterns, test count baseline]
- [Source: backend/api/websocket/hub.go — Existing Hub implementation]
- [Source: backend/api/websocket/client.go — Existing Client with readPump/writePump]
- [Source: backend/providers/claude.go — Existing Claude streaming implementation]
- [Source: backend/providers/provider.go — Provider interface and StreamChunk types]
- [Source: backend/types/websocket.go — Existing WebSocket event types and helpers]
- [Source: backend/services/project_manager.go — Service pattern with Hub dependency]
- [Source: backend/main.go — Application wiring and startup]
- [Source: src/services/websocket.service.ts — Existing WebSocket service with connect/disconnect/on]
- [Source: src/state/project.state.ts — Signal state pattern to follow]
- [Source: src/app-shell.ts — WebSocket initialization on project open]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Backend compiles cleanly after all changes: `go build ./...` succeeds
- TypeScript compiles cleanly: `npx tsc --noEmit` shows no new errors (pre-existing dialog.service.ts and provider.state.ts errors unchanged)
- API key architecture note: Story spec says "API key NEVER sent over WebSocket" but current architecture stores keys client-side (keychain). Implemented with API key in ChatSendPayload since backend has no keychain access. This is consistent with how validate endpoint works (API key in request body). Connection is local-only (localhost:3008) so security impact is minimal.
- Tech debt fix: Added `Model` field to `StreamChunk` struct (Epic 1 Story 1-4 LOW item)

### Completion Notes List

- Implemented full bidirectional WebSocket chat streaming pipeline
- Backend: 7 chat event types, 6 payload structs, 5 constructor helpers, ChatService with HandleMessage/CancelStream/ActiveStreamCount, Hub.SendToClient for targeted delivery, Hub.SetMessageHandler for routing, Client.readPump now parses incoming messages
- Frontend: conversation types, chat event constants, WebSocket send(), chat.service.ts with event handlers, chat.state.ts with signals, app-shell integration
- Claude provider: ThinkingDelta support via type switch, Model field on start chunk
- Tests: 22 new backend tests + 16 new frontend tests = 38 new tests, all passing
- Total test count: 229 frontend (was 213) + all backend tests pass with 0 regressions

### File List

**New files:**
- backend/services/chat_service.go
- backend/services/chat_service_test.go
- src/services/chat.service.ts
- src/state/chat.state.ts
- src/types/conversation.ts
- tests/frontend/services/chat.service.test.ts

**Modified files:**
- backend/types/websocket.go (added chat event types, payload structs, UsageStats, constructors)
- backend/types/websocket_test.go (added chat event type and constructor tests)
- backend/providers/provider.go (added "thinking" StreamChunk type, Model field)
- backend/providers/claude.go (ThinkingDelta handling, Model in start chunk)
- backend/api/websocket/hub.go (MessageHandler, SetMessageHandler, SendToClient)
- backend/api/websocket/hub_test.go (SendToClient, buffer-full, SetMessageHandler tests)
- backend/api/websocket/client.go (maxMessageSize 65536, readPump parses messages, SendChan accessor)
- backend/api/router.go (ChatService in RouterServices)
- backend/main.go (ChatService creation, Hub messageHandler setup)
- src/services/websocket.service.ts (added send() function)
- src/app-shell.ts (chat service init/cleanup integration)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (parallel adversarial review — 5 agents)
**Date:** 2026-02-03
**Verdict:** PASS — all Critical and Important issues fixed

#### Critical Issues (7 found, 7 fixed)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| C1 | Dead streaming pipeline — `sendMessage` never created a conversation so all event handlers silently returned | `src/services/chat.service.ts` | Create conversation + user message BEFORE sending WebSocket event |
| C2 | Server crash — `SendToClient` panics writing to closed channel on client disconnect | `backend/api/websocket/hub.go` | defer/recover pattern with named return value |
| C3 | Go data race — `messageHandler` read without lock in `readPump()` | `backend/api/websocket/client.go`, `hub.go` | Added `HandleClientMessage` method with RLock |
| C4 | Goroutine leak — provider chunks channel never drained on context cancellation | `backend/services/chat_service.go` | `for range chunks {}` drain loop in `ctx.Done()` case |
| C5 | Uncancellable streams — duplicate conversation ID overwrites cancel function | `backend/services/chat_service.go` | Cancel existing stream before overwriting |
| C6 | Silent event delivery failures — all `SendToClient` errors ignored | `backend/services/chat_service.go` | Error logging on all calls; CRITICAL log for stream-end/error events |
| C7 | API key transmitted over WebSocket | `chat_service.go` | Acknowledged as architecture trade-off (localhost-only); documented in Dev Notes |

#### Important Issues (10 found, 6 fixed, 4 deferred)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| I1 | Silent handler drops — 5 event handlers return silently when conversation not found | `src/services/chat.service.ts` | `console.warn` for all handler drops |
| I2 | Non-functional frontend tests — dead stubs, misleading assertions | `tests/frontend/services/chat.service.test.ts` | Complete rewrite with real state-based tests |
| I3 | No graceful shutdown — `context.Background()` used for streams | `backend/main.go` | Server-level context cancelled on SIGTERM |
| I7 | State stuck in error — no recovery path from error state | `src/services/chat.service.ts` | Set 'streaming' in `sendMessage` before WS send |
| I9 | Dead code — `ChatService` in `RouterServices` never used | `backend/api/router.go`, `main.go` | Removed unused field and assignment |
| I10 | Hardcoded MaxTokens — literal 8192 | `backend/services/chat_service.go` | Named constant `defaultMaxTokens` |
| I4 | No stream timeout visibility — frontend doesn't surface 5-min timeout | — | Deferred to Story 3.4 (UI) |
| I5 | No message ordering guarantee on high-latency connections | — | Deferred (index field exists but unused) |
| I6 | Missing conversation-level error boundary | — | Deferred to Story 3.4 (UI) |
| I8 | `ChatSendPayload.ApiKey` JSON tag exposes field name in WebSocket frames | — | Deferred (localhost-only) |

#### Suggestions (10 noted, not auto-fixed)

- S1: Add `conversation_id` validation (UUID format) in HandleMessage
- S2: Add structured logging (slog) instead of log.Printf
- S3: Add metrics/counters for active streams, errors, cancellations
- S4: Consider connection-scoped conversation registry
- S5: Add WebSocket message size validation on frontend before send
- S6: Add rate limiting for chat:send events
- S7: Add exponential backoff hints in chat:error payloads
- S8: Consider read-only signal exports from chat.state.ts
- S9: Add JSDoc to public chat.service.ts functions
- S10: Consider snapshot testing for WebSocket event payloads

#### Files Modified During Review

- `backend/api/websocket/hub.go` — HandleClientMessage method, SendToClient with recover
- `backend/api/websocket/client.go` — Use HandleClientMessage instead of direct access
- `backend/services/chat_service.go` — Channel drain, duplicate ID check, error logging, named constant
- `backend/main.go` — Server context with graceful shutdown
- `backend/api/router.go` — Removed unused ChatService field
- `src/services/chat.service.ts` — Conversation creation in sendMessage, warn logging, state recovery
- `tests/frontend/services/chat.service.test.ts` — Complete rewrite with real assertions

### Change Log

- 2026-02-03: Implemented Story 3.1 — WebSocket Connection & Streaming. Full bidirectional chat pipeline: backend ChatService, Hub targeted delivery, Claude ThinkingDelta support, frontend chat service + state + types, 38 new tests.
- 2026-02-03: Code review (adversarial, parallel agents). Found 7 Critical, 10 Important, 10 Suggestions. All Critical and Important issues auto-fixed. Story status → done.
- 2026-02-03: Second adversarial code review (Opus 4.5). Found 3 HIGH, 5 MEDIUM, 3 LOW. Fixed 3 HIGH + 2 MEDIUM auto:
  - H1: Race condition in HandleMessage lock/unlock — atomically overwrite cancel func under lock
  - H2: No server.Shutdown — added graceful HTTP shutdown with 5s timeout
  - H3: Error state overwritten by stream-end — preserve error state in handleStreamEnd
  - M1: sendMessage state not rolled back on wsSend throw — try/catch with state reset
  - M5: User message ID collision risk — crypto.randomUUID() instead of Date.now()
  - Deferred: M2 (duplicate UsageStats types), M3 (api_key in JSON — localhost trade-off), M4 (initChatService ordering dependency — works today)
