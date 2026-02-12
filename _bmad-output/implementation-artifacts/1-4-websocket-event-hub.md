# Story 1.4: WebSocket Event Hub

Status: review

## Story

As a developer,
I want the system to broadcast real-time events over WebSocket,
So that the frontend stays up-to-date without polling.

## Acceptance Criteria

1. **Given** the Go sidecar is running **When** a client connects to the WebSocket endpoint **Then** the hub registers the connection and sends a `connection:status` event with `{ "status": "connected" }` to that client only

2. **Given** a registered WebSocket connection **When** a server-side event occurs (project, stream, or artifact change) **Then** the hub broadcasts the event to all connected clients

3. **Given** a WebSocket connection drops **When** the client reconnects **Then** the hub registers the new connection and sends `connection:status` connected

4. **Given** multiple concurrent WebSocket connections **When** an event is broadcast **Then** all connected clients receive the event

## Tasks / Subtasks

- [x] Task 1: Add new event type constants and payload types for stream events (AC: #2)
  - [x] 1.1: Add constants `EventTypeStreamCreated`, `EventTypeStreamArchived`, `EventTypeStreamUpdated`, `EventTypeStreamPhaseChanged` to `backend/types/websocket.go`
  - [x] 1.2: Add `StreamCreatedPayload` struct with `projectId`, `streamId`, `name` fields (all `camelCase` JSON tags)
  - [x] 1.3: Add `StreamArchivedPayload` struct with `projectId`, `streamId`, `outcome` fields
  - [x] 1.4: Add `StreamUpdatedPayload` struct with `projectId`, `streamId`, `changes` fields
  - [x] 1.5: Add `StreamPhaseChangedPayload` struct with `projectId`, `streamId`, `phase`, `artifacts` fields
  - [x] 1.6: Add constructor functions `NewStreamCreatedEvent`, `NewStreamArchivedEvent`, `NewStreamUpdatedEvent`, `NewStreamPhaseChangedEvent`
  - [x] 1.7: Fix existing `ArtifactEventPayload` JSON tags from `snake_case` to `camelCase` (`phase_name` -> `phaseName`, `is_sharded` -> `isSharded`, `parent_id` -> `parentId`)

- [x] Task 2: Send `connection:status` on client connect (AC: #1, #3)
  - [x] 2.1: Modify `HandleWebSocket` in `backend/api/handlers/websocket.go` to send `connection:status` with `{ "status": "connected" }` to the newly connected client after registration
  - [x] 2.2: Use `hub.SendToClient(client, event)` (NOT broadcast) so only the connecting client receives it
  - [x] 2.3: Send the event after a brief delay or via goroutine to ensure the client's read/write pumps are started

- [x] Task 3: Write unit tests for new event types and payloads (AC: #1, #2)
  - [x] 3.1: Add tests in `backend/types/websocket_test.go` for each new constructor function
  - [x] 3.2: Verify JSON serialization uses `camelCase` for all new payload fields
  - [x] 3.3: Verify the fixed `ArtifactEventPayload` serializes with `camelCase` tags

- [x] Task 4: Write integration tests for connection:status on connect (AC: #1, #3, #4)
  - [x] 4.1: Add test in `backend/tests/api/websocket_test.go`: client connects and immediately receives `connection:status` event with `{ "status": "connected" }`
  - [x] 4.2: Add test: client disconnects and reconnects, receives `connection:status` on reconnect
  - [x] 4.3: Add test: multiple clients connect, each receives their own `connection:status` event
  - [x] 4.4: Add test: broadcast after connect delivers to all clients (extends existing test to verify connection:status came first)

## Dev Notes

### Architecture Constraints

- **JSON field naming:** ALL JSON response fields MUST use `camelCase`. The new stream event payloads must use `json:"projectId"`, `json:"streamId"` etc. No `snake_case`.
- **Event naming:** WebSocket event names use `namespace:kebab-case` format (e.g., `stream:phase-changed`, `connection:status`).
- **WebSocket protocol:** Events are server-to-client only (direction column in architecture docs). The `WebSocketEvent` envelope `{ type, payload, timestamp }` is already established.
- **gorilla/websocket v1.5.3:** Already in use. No version changes needed.

### Existing Code to Reuse (DO NOT RECREATE)

- **`backend/api/websocket/hub.go`** -- Hub with `Run()`, `Stop()`, `Broadcast()`, `BroadcastEvent()`, `SendToClient()`, `Register()`, `Unregister()`, `ClientCount()`, `IsRunning()`, `SetMessageHandler()`, `HandleClientMessage()`. ALL hub infrastructure is complete. Do NOT modify hub internals.
- **`backend/api/websocket/client.go`** -- Client with `readPump()`, `writePump()`, `Start()`, `SendChan()`, `NewClient()`. Client infrastructure is complete. Do NOT modify.
- **`backend/api/handlers/websocket.go`** -- `WebSocketHandler` with `HandleWebSocket()` that upgrades, registers client, and starts pumps. This is where `connection:status` send logic goes.
- **`backend/types/websocket.go`** -- `WebSocketEvent`, `NewWebSocketEvent()`, `ConnectionStatusPayload`, `EventTypeConnectionStatus`. The event envelope and connection:status type already exist.
- **`backend/api/router.go`** -- WebSocket endpoint is already wired at `/ws` via `wsHandler.HandleWebSocket`. No router changes needed.
- **`backend/main.go`** -- Hub is created, started (`go hub.Run()`), and stopped on shutdown. No `main.go` changes needed.
- **`backend/tests/api/websocket_test.go`** -- Existing integration tests for upgrade, broadcast, multi-client, disconnect, origin check. Extend these, do NOT rewrite them.

### What Needs to Change

| File | Change |
|------|--------|
| `backend/types/websocket.go` | ADD stream event constants, payload types, constructors. FIX `ArtifactEventPayload` `snake_case` tags. |
| `backend/api/handlers/websocket.go` | MODIFY `HandleWebSocket` to send `connection:status` to newly connected client. |
| `backend/types/websocket_test.go` | ADD tests for new constructors and JSON tag verification. |
| `backend/tests/api/websocket_test.go` | ADD integration tests for `connection:status` on connect, reconnect, multi-client. |

### Implementation Patterns

**Sending connection:status on connect:**

The `HandleWebSocket` method currently does:
```go
client := websocket.NewClient(h.hub, conn)
h.hub.Register(client)
client.Start()
```

After `client.Start()` launches the write pump goroutine, use a goroutine with a small delay to send `connection:status`:
```go
client.Start()

// Send connection:status to the newly connected client
go func() {
    // Brief delay to ensure write pump is ready
    time.Sleep(10 * time.Millisecond)
    event := types.NewWebSocketEvent(types.EventTypeConnectionStatus, &types.ConnectionStatusPayload{
        Status: "connected",
    })
    _ = h.hub.SendToClient(client, event)
}()
```

The `SendToClient` method is non-blocking (uses `select` with `default`) and handles disconnected clients gracefully.

**New payload struct pattern (follow existing):**
```go
type StreamCreatedPayload struct {
    ProjectID string `json:"projectId"`
    StreamID  string `json:"streamId"`
    Name      string `json:"name"`
}

func NewStreamCreatedEvent(projectID, streamID, name string) *WebSocketEvent {
    return NewWebSocketEvent(EventTypeStreamCreated, &StreamCreatedPayload{
        ProjectID: projectID,
        StreamID:  streamID,
        Name:      name,
    })
}
```

**ArtifactEventPayload fix -- change these JSON tags:**
```go
// BEFORE (wrong):
PhaseName string  `json:"phase_name"`
IsSharded bool    `json:"is_sharded"`
ParentID  *string `json:"parent_id,omitempty"`

// AFTER (correct):
PhaseName string  `json:"phaseName"`
IsSharded bool    `json:"isSharded"`
ParentID  *string `json:"parentId,omitempty"`
```

### Testing Notes

- **Integration tests:** Use `httptest.NewServer(router)` + `ws.Dialer{}` pattern (follow existing `TestWebSocketUpgrade` as reference).
- **Read with timeout:** Always `conn.SetReadDeadline(time.Now().Add(time.Second))` before `conn.ReadMessage()` in tests to prevent hanging.
- **JSON verification:** Unmarshal received messages and assert on `type` and `payload` fields.
- **Connection:status test:** After connecting, the FIRST message received should be `connection:status` with status `"connected"`. Then any broadcast messages follow.
- **Reconnect test:** Close the connection, wait for unregister, reconnect, verify new `connection:status` is received.

### What NOT to Build

- Do NOT implement client-to-server event handling for new event types -- these are all server-to-client events.
- Do NOT implement actual stream service integration (calling these broadcast functions when streams change) -- that is Epic 2 scope.
- Do NOT implement artifact watcher integration -- that is Epic 3 scope.
- Do NOT remove legacy chat event types (`chat:*`, `tool:*`) in this story -- they are still in use by the existing chat service. Cleanup is a separate concern.
- Do NOT modify the Hub, Client, or router -- infrastructure is complete. Only add types and modify the connection handler.

### Project Structure Notes

- All Go files use `snake_case.go` naming.
- Event type constants follow the `EventType{Namespace}{Action}` pattern (e.g., `EventTypeStreamCreated`).
- Constructor functions follow `New{EventName}Event(...)` pattern.
- Payload structs follow `{EventName}Payload` pattern.
- Test files colocate with source (`websocket_test.go` next to `websocket.go`).

### Previous Story Intelligence

**From Story 1.1 (Central Store):**
- Established `CentralStore`, `RegistryStore`, `WriteJSON`/`ReadJSON`, atomic write pattern
- Tests use `filepath.EvalSymlinks(t.TempDir())` for macOS compatibility

**From Story 1.2 (Project Registration):**
- `ProjectService` with `Register`, `Unregister`, `List`, `Get` -- future stories will call hub.BroadcastEvent after these operations
- `RegistryStore` and `ProjectStore` fully implemented

**From Story 1.3 (REST API):**
- All project REST endpoints implemented with `ProjectsHandler`
- Error mapping established (409, 400, 404, 500)
- Router wiring pattern with `NewProjectsHandler` injection
- Tests use `httptest.NewRecorder()` + `chi.NewRouteContext()` patterns

**From Git History:**
- Recent commits follow `feat:` prefix for new features
- Story 1.3 added `ErrCodeAlreadyExists` to response errors
- All tests pass in CI

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-central-store-project-registry-backend-foundation.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#WebSocket Events]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#WebSocket Events]
- [Source: _bmad-output/project-context.md#WebSocket Protocol]
- [Source: _bmad-output/project-context.md#JSON Convention (CRITICAL)]
- [Source: _bmad-output/project-context.md#Go (Backend)]
- [Source: _bmad-output/implementation-artifacts/1-3-project-management-rest-api.md]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A

### Completion Notes List

- Implemented all 4 stream event types (created, archived, updated, phase-changed) with camelCase JSON tags
- Fixed ArtifactEventPayload JSON tags from snake_case to camelCase for consistency
- Added connection:status event sent automatically to each client on connect via goroutine with 10ms delay
- All unit tests pass (constructor functions, JSON serialization verification)
- All integration tests pass (connection status on connect, reconnect, multi-client, broadcast after status)
- Updated existing integration tests to account for connection:status message being sent first

### File List

- backend/types/websocket.go
- backend/types/websocket_test.go
- backend/api/handlers/websocket.go
- backend/tests/api/websocket_test.go
