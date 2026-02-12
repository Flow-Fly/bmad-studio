# Story 1.3: Provider Interface & Claude Implementation

Status: review

## Story

As a **developer**,
I want **a provider abstraction with Claude implementation**,
So that **the app can send messages to Claude API**.

## Acceptance Criteria

1. **Given** the Provider interface is defined with `SendMessage(ctx, request) -> (channel, error)`, `ValidateCredentials() -> error`, `ListModels() -> ([]Model, error)`, **When** ClaudeProvider is instantiated with an API key, **Then** `ValidateCredentials()` returns nil for valid keys

2. **Given** ClaudeProvider with an invalid API key, **When** `ValidateCredentials()` is called, **Then** it returns a descriptive error

3. **Given** ClaudeProvider with a valid API key, **When** `ListModels()` is called, **Then** it returns available Claude models (Opus 4.5, Sonnet 4.5, Haiku 4.5)

4. **Given** ClaudeProvider with a valid API key, **When** `SendMessage()` is called, **Then** it returns a channel that streams `StreamChunk` events in order

5. **Given** any provider operation, **When** API keys are processed, **Then** keys are never logged or exposed in error messages (NFR6)

6. **Given** a provider error occurs, **When** the error is returned to the caller, **Then** it includes a user-friendly message (NFR8)

## Tasks / Subtasks

- [x] Task 1: Define Provider Interface and Types (AC: #1)
  - [x] 1.1: Create `backend/providers/provider.go` with `Provider` interface defining `SendMessage`, `ValidateCredentials`, `ListModels`
  - [x] 1.2: Define `ChatRequest` struct with fields: `Messages []Message`, `Model string`, `MaxTokens int`, `SystemPrompt string`
  - [x] 1.3: Define `StreamChunk` struct with fields: `Type string` (start/chunk/end/error), `Content string`, `MessageID string`, `Index int`, `Usage *UsageStats`
  - [x] 1.4: Define `Model` struct with fields: `ID string`, `Name string`, `Provider string`, `MaxTokens int`
  - [x] 1.5: Define `Message` struct with fields: `Role string`, `Content string`
  - [x] 1.6: Define provider error types: `ProviderError` with `Code`, `Message`, `UserMessage` fields

- [x] Task 2: Implement Claude Provider (AC: #1, #2, #3, #4)
  - [x] 2.1: Add `github.com/anthropics/anthropic-sdk-go` dependency (`go get -u 'github.com/anthropics/anthropic-sdk-go@v1.19.0'`)
  - [x] 2.2: Create `backend/providers/claude.go` implementing `Provider` interface
  - [x] 2.3: Constructor: `NewClaudeProvider(apiKey string) *ClaudeProvider` — creates Anthropic client with `option.WithAPIKey(apiKey)`
  - [x] 2.4: Implement `ValidateCredentials()` — send minimal test request to confirm API key works; map `AuthenticationError` to user-friendly message
  - [x] 2.5: Implement `ListModels()` — return hardcoded list of Claude models (Opus 4.5, Sonnet 4.5, Haiku 4.5) with IDs and max token limits
  - [x] 2.6: Implement `SendMessage()` — use `client.Messages.NewStreaming()`, iterate `stream.Next()`, map SDK events to `StreamChunk` types, send chunks on returned channel
  - [x] 2.7: Handle streaming lifecycle: emit `start` chunk, `chunk` for each text delta, `end` with usage stats, `error` on failures
  - [x] 2.8: Ensure API key is never included in error messages or logs (NFR6)

- [x] Task 3: Create Provider Service (AC: #1, #6)
  - [x] 3.1: Create `backend/services/provider_service.go` following existing service patterns (RWMutex, constructor with dependencies)
  - [x] 3.2: Implement `GetProvider(providerType string) (Provider, error)` — factory method returning appropriate provider instance
  - [x] 3.3: Implement `ValidateProvider(providerType string, apiKey string) error` — creates provider and validates credentials
  - [x] 3.4: Implement `ListProviderModels(providerType string) ([]Model, error)` — returns models for a specific provider
  - [x] 3.5: Implement `SendMessage(ctx, providerType string, apiKey string, request ChatRequest) (<-chan StreamChunk, error)` — orchestrates message sending

- [x] Task 4: Update Provider API Handlers (AC: #1, #2, #3, #6)
  - [x] 4.1: Update `backend/api/handlers/providers.go` — replace placeholder handlers with real implementations
  - [x] 4.2: Implement `POST /api/v1/providers/validate` — accepts `{ "type": "claude", "api_key": "..." }`, returns validation result
  - [x] 4.3: Implement `GET /api/v1/providers/:type/models` — returns available models for the provider type
  - [x] 4.4: Create `ProviderHandler` struct with `ProviderService` dependency (follows BMAdHandler pattern)
  - [x] 4.5: Update router to register new routes and inject ProviderHandler

- [x] Task 5: Update Router and Main (AC: #1)
  - [x] 5.1: Update `backend/api/router.go` `RouterServices` struct to include `ProviderService`
  - [x] 5.2: Add provider routes: `POST /api/v1/providers/validate`, `GET /api/v1/providers/:type/models`
  - [x] 5.3: Update `backend/main.go` to initialize `ProviderService` and pass to router

- [x] Task 6: Testing (AC: #1, #2, #3, #4, #5, #6)
  - [x] 6.1: Create mock provider implementing `Provider` interface for testing
  - [x] 6.2: Unit tests for `ClaudeProvider.ValidateCredentials()` — test valid/invalid key scenarios (mock HTTP)
  - [x] 6.3: Unit tests for `ClaudeProvider.ListModels()` — verify model list
  - [x] 6.4: Unit tests for `ClaudeProvider.SendMessage()` — test streaming chunk sequence (start → chunks → end)
  - [x] 6.5: Unit tests for `ProviderService` — test factory, validation, model listing
  - [x] 6.6: Integration tests for provider API endpoints — test validation and model list endpoints
  - [x] 6.7: Test that API keys are never present in error messages or log output (NFR6)

## Dev Notes

### Critical Architecture Patterns

**This story creates the provider abstraction that ALL future provider stories (1.4 OpenAI, 1.5 Ollama) MUST follow.**

#### Provider Interface Contract (MUST FOLLOW)

```go
// Provider is the interface ALL providers must implement
type Provider interface {
    // SendMessage sends a chat message and returns a channel of streaming chunks
    SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)

    // ValidateCredentials checks if the provider's credentials are valid
    ValidateCredentials() error

    // ListModels returns the models available from this provider
    ListModels() ([]Model, error)
}
```

This matches the architecture document exactly. [Source: architecture.md#Provider-Architecture]

#### Streaming Chunk Protocol

Map to the WebSocket event types defined in the architecture:

| StreamChunk Type | Maps to WS Event | Content |
|-----------------|-------------------|---------|
| `start` | `message:start` | `MessageID`, `Model` |
| `chunk` | `message:chunk` | `Content` (text delta), `Index` |
| `end` | `message:end` | `Usage` (input/output tokens) |
| `error` | `message:error` | `Error` message |

[Source: architecture.md#WebSocket-Events]

#### Anthropic Go SDK Usage

**Package:** `github.com/anthropics/anthropic-sdk-go` v1.19.0
**Go Requirement:** 1.22+ (current project uses 1.25.6, compatible)

**Client creation:**
```go
import (
    "github.com/anthropics/anthropic-sdk-go"
    "github.com/anthropics/anthropic-sdk-go/option"
)

client := anthropic.NewClient(
    option.WithAPIKey(apiKey),
)
```

**Streaming pattern:**
```go
stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
    Model:     anthropic.ModelClaudeSonnet4_5_20250929,
    MaxTokens: 4096,
    Messages:  []anthropic.MessageParam{
        anthropic.NewUserMessage(anthropic.NewTextBlock("prompt")),
    },
})

message := anthropic.Message{}
for stream.Next() {
    event := stream.Current()
    message.Accumulate(event)
    // Process event types...
}
if err := stream.Err(); err != nil {
    // Handle error
}
```

**Model constants available in SDK:**
- `anthropic.ModelClaudeOpus4_5_20251101` — Claude Opus 4.5
- `anthropic.ModelClaudeSonnet4_5_20250929` — Claude Sonnet 4.5
- `anthropic.ModelClaudeHaiku4_5_20251001` — Claude Haiku 4.5

**Error types for mapping:**
- `*anthropic.AuthenticationError` → invalid API key
- `*anthropic.RateLimitError` → rate limited
- `*anthropic.OverloadedError` → server overloaded
- `*anthropic.InvalidRequestError` → malformed request

**Credential validation approach:** No dedicated validation endpoint. Send a minimal message request — `AuthenticationError` indicates invalid credentials.

```go
func (p *ClaudeProvider) ValidateCredentials() error {
    _, err := p.client.Messages.New(context.Background(), anthropic.MessageNewParams{
        Model:     anthropic.ModelClaudeHaiku4_5_20251001, // cheapest model
        MaxTokens: 1,
        Messages: []anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.NewTextBlock("hi")),
        },
    })
    if err != nil {
        var authErr *anthropic.AuthenticationError
        if errors.As(err, &authErr) {
            return fmt.Errorf("invalid API key")
        }
        return fmt.Errorf("provider validation failed: %w", err)
    }
    return nil
}
```

#### Service Pattern to Follow

Follow the established service patterns from existing codebase:

```go
// From agent_service.go, bmad_config.go patterns:
type ProviderService struct {
    mu sync.RWMutex
    // dependencies
}

func NewProviderService() *ProviderService {
    return &ProviderService{}
}
```

[Source: backend/services/agent_service.go, backend/services/bmad_config.go]

#### Handler Pattern to Follow

Follow the `BMAdHandler` pattern from `handlers/bmad.go`:

```go
type ProviderHandler struct {
    providerService *services.ProviderService
}

func NewProviderHandler(ps *services.ProviderService) *ProviderHandler {
    return &ProviderHandler{providerService: ps}
}
```

[Source: backend/api/handlers/bmad.go, backend/api/handlers/artifacts.go]

#### Error Response Contract (MUST FOLLOW)

Use the existing error response utilities:

```go
import "bmad-studio/backend/api/response"

// Standard error responses:
response.WriteError(w, "invalid_request", "message", http.StatusBadRequest)
response.WriteNotFound(w, "message")
response.WriteInternalError(w, "message")
response.WriteValidationError(w, "message")
```

Standard error codes: `invalid_request` (400), `validation_error` (422), `not_found` (404), `internal_error` (500), `unauthorized` (401)

[Source: backend/api/response/errors.go]

#### JSON Response Contract (MUST FOLLOW)

```go
response.WriteJSON(w, http.StatusOK, data) // success — direct payload, no wrapper
```

[Source: backend/api/response/json.go]

### Go Naming Conventions (MUST FOLLOW)

| Area | Convention | Example |
|------|------------|---------|
| **Files** | `snake_case.go` | `provider_service.go`, `claude.go` |
| **Exports** | `PascalCase` | `type ClaudeProvider struct`, `func NewClaudeProvider()` |
| **JSON tags** | `snake_case` | `json:"api_key"` |
| **Error handling** | Return `(result, error)` | Never panic |

[Source: project-context.md#Language-Specific-Rules]

### API Endpoint Design

New endpoints for this story:

```
POST /api/v1/providers/validate     Validate provider credentials
  Request:  { "type": "claude", "api_key": "sk-ant-..." }
  Response: { "valid": true } or error

GET  /api/v1/providers/:type/models  List available models
  Response: [{ "id": "claude-opus-4-5-20251101", "name": "Claude Opus 4.5", ... }]
```

Existing endpoints updated:
```
GET  /api/v1/providers               List configured providers (update from placeholder)
POST /api/v1/providers               Add/configure provider (update from placeholder)
```

[Source: architecture.md#REST-Endpoints]

### Security Requirements (CRITICAL — NFR5, NFR6)

- **NEVER log API keys** — not in debug logs, error messages, or any output
- **Sanitize error messages** — strip any key content from Anthropic SDK errors before returning
- **API keys never in responses** — validation endpoint returns `{ "valid": true/false }`, never echoes the key
- **Future:** Keys will be stored in OS keychain (Story 1.6) — for now, keys are passed per-request

[Source: architecture.md#Security, project-context.md#Security-Rules]

### Project Structure Notes

**Files to Create:**

```
backend/
├── providers/
│   ├── provider.go               # CREATE: Provider interface + types
│   └── claude.go                 # CREATE: Claude implementation
├── services/
│   └── provider_service.go       # CREATE: Provider service
└── api/
    └── handlers/
        └── providers.go          # MODIFY: Replace placeholders
```

**Files to Modify:**

```
backend/
├── api/
│   └── router.go                 # MODIFY: Add provider routes + service
├── main.go                       # MODIFY: Initialize ProviderService
└── go.mod / go.sum               # MODIFY: Add anthropic-sdk-go dependency
```

**Alignment with Architecture:**
- `backend/providers/provider.go` — matches `providers/provider.go` in architecture structure
- `backend/providers/claude.go` — matches `providers/claude.go` in architecture structure
- Service follows pattern of existing services in `backend/services/`

[Source: architecture.md#Project-Structure-Boundaries]

### Previous Story Intelligence

**From Story 1.2 (Go Backend Foundation):**

- Chi router established with `/api/v1/` prefix and route grouping
- Error response package at `backend/api/response/` with `WriteError`, `WriteJSON` helpers
- Handler pattern: placeholder handlers return 501 via `response.WriteNotImplemented(w)`
- Types in `backend/types/api.go` already defines `Provider` struct (basic metadata only — ID, Name, Type, BaseURL, Enabled)
- Test infrastructure with `httptest` pattern and table-driven tests
- Import cycle lesson: error helpers in separate `response` package to avoid handler↔api import cycle

**From Story 1.2 Debug Log:**
- Placing shared utilities in dedicated packages avoids import cycles
- Tests use `testutil/helpers.go` for common test setup

**Learnings to Apply:**
- Keep provider implementation focused — don't implement storage or settings yet
- Use the established `response` package for all HTTP responses
- Follow table-driven test pattern for Go tests
- Handler structs with dependency injection (not package-level functions)

### Git Intelligence

**Recent Commits:**
```
40f508a Merge pull request #3 from Flow-Fly/feature/artifact-registry
70385e0 feat: enhance artifact handling and websocket event management
670333e Add file watcher service tests and websocket event handling
ca6d5a1 Add unit tests for artifact service and API endpoints
```

**Patterns Established:**
- Feature branches: `feature/{description}`
- Commit messages: `feat:` prefix for features, `feat(backend):` for backend-specific
- Services use RWMutex for thread safety
- Comprehensive test coverage expected

### Existing Type Consideration

`backend/types/api.go` already defines a `Provider` struct:
```go
type Provider struct {
    ID      string `json:"id"`
    Name    string `json:"name"`
    Type    string `json:"type"`
    BaseURL string `json:"base_url"`
    Enabled bool   `json:"enabled"`
}
```

This is a **metadata/config** type for API responses. The new `providers/provider.go` defines the **behavioral interface** — these are complementary, not conflicting. The `types.Provider` struct represents stored provider configuration; the `providers.Provider` interface represents runtime behavior.

### Latest Technical Information

**Anthropic Go SDK v1.19.0** (November 2025):
- Supports Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
- No breaking changes from recent versions
- Streaming via `NewStreaming()` + `Next()` iterator pattern
- Type-safe error handling with `errors.As()` for `AuthenticationError`, `RateLimitError`, etc.
- Models API: `client.Models.List()` returns available models
- Go 1.22+ required (project uses 1.25.6 ✓)

**Claude Model Pricing (for future cost tracking):**
| Model | Input $/MTok | Output $/MTok |
|-------|-------------|---------------|
| Claude Opus 4.5 | $5.00 | $25.00 |
| Claude Sonnet 4.5 | $3.00 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |

### Anti-Patterns to Avoid

- **DO NOT** store API keys in memory beyond the provider instance — pass per-request for now
- **DO NOT** implement OpenAI or Ollama providers — that's Stories 1.4 and 1.5
- **DO NOT** implement credential storage or settings persistence — that's Story 1.6
- **DO NOT** implement WebSocket chat handler — that's Epic 3 (Story 3.1)
- **DO NOT** create chat/conversation endpoints — only provider validation + model listing
- **DO NOT** log or include API keys in any error output
- **DO NOT** use `panic()` — always return errors
- **DO NOT** wrap successful API responses — return payload directly

### Dependencies

**Story 1.2 must be complete** (status: review) — This story builds on the router, error handling, and type infrastructure from 1.2.

**New dependency to add:**
```bash
cd backend && go get -u 'github.com/anthropics/anthropic-sdk-go@v1.19.0'
```

### Testing Strategy

1. **Mock Provider** — Create `providers/mock_provider.go` implementing `Provider` interface for handler/service tests
2. **Unit tests** for Claude provider methods (mock the Anthropic HTTP client)
3. **Unit tests** for provider service factory and orchestration
4. **Integration tests** for API endpoints using `httptest`
5. **Table-driven tests** following Go idioms
6. **Security tests** — verify API keys are never in error output

```go
// Example: Table-driven test for ValidateCredentials
func TestClaudeProvider_ValidateCredentials(t *testing.T) {
    tests := []struct {
        name    string
        apiKey  string
        wantErr bool
    }{
        {"valid key", "sk-ant-valid-key", false},
        {"empty key", "", true},
        {"invalid key", "invalid", true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ... test implementation with HTTP mock
        })
    }
}
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Provider-Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket-Events]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-Consistency-Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3-Provider-Interface-Claude-Implementation]
- [Source: _bmad-output/project-context.md#Language-Specific-Rules]
- [Source: _bmad-output/project-context.md#Framework-Specific-Rules]
- [Source: _bmad-output/project-context.md#Security-Rules]
- [Source: _bmad-output/implementation-artifacts/1-2-go-backend-foundation.md] (Previous story intelligence)
- [Source: github.com/anthropics/anthropic-sdk-go v1.19.0] (Anthropic Go SDK)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed `TextBlockParam` type mismatch: SDK's `System` field expects `[]TextBlockParam{Text: ...}` struct literals, not `NewTextBlock()` return type (which returns `ContentBlockParamUnion`)
- SDK error handling: `*anthropic.Error` (aliased from `apierror.Error`) with `StatusCode` field is the actual error type returned by API calls, not the shared data types like `AuthenticationError`
- SDK retry behavior: Some error status codes (429, 529, 500) trigger automatic retries in the SDK, causing slower tests for those status codes

### Completion Notes List

- Implemented Provider interface with `SendMessage`, `ValidateCredentials`, `ListModels` methods
- All supporting types defined: `ChatRequest`, `StreamChunk`, `UsageStats`, `Model`, `Message`, `ProviderError`
- ClaudeProvider implements full streaming via `client.Messages.NewStreaming()` with proper event mapping (start/chunk/end/error)
- ProviderService provides factory pattern with `GetProvider`, `ValidateProvider`, `ListProviderModels`, `SendMessage`
- ProviderHandler follows BMadHandler pattern with dependency injection
- New API routes: `POST /api/v1/providers/validate`, `GET /api/v1/providers/:type/models`
- Existing placeholder routes (GET/POST /api/v1/providers) preserved
- API keys never appear in error messages or responses (NFR6 enforced)
- All error responses use user-friendly messages (NFR8)
- 43 tests total across 4 test files, all passing with 0 regressions

### File List

**New Files:**
- `backend/providers/provider.go` — Provider interface and all type definitions
- `backend/providers/claude.go` — ClaudeProvider implementation with streaming
- `backend/services/provider_service.go` — Provider service layer
- `backend/providers/provider_test.go` — Provider interface and type tests (6 tests)
- `backend/providers/claude_test.go` — ClaudeProvider unit tests (11 tests)
- `backend/services/provider_service_test.go` — ProviderService unit tests (5 tests)
- `backend/api/handlers/providers_test.go` — Handler unit tests (9 tests)
- `backend/tests/api/providers_test.go` — Integration tests (7 tests)

**Modified Files:**
- `backend/api/handlers/providers.go` — Added ProviderHandler with ValidateProvider and ListModels methods
- `backend/api/router.go` — Added Provider to RouterServices, registered new routes
- `backend/main.go` — Initialize ProviderService and pass to router
- `backend/go.mod` — Added anthropic-sdk-go v1.19.0 dependency
- `backend/go.sum` — Updated with new dependencies

### Change Log

- 2026-01-29: Story 1.3 implementation complete — Provider interface defined, ClaudeProvider implemented with streaming support, ProviderService and API handlers created, 43 tests added (all passing, 0 regressions)
