# Story 1.4: OpenAI Provider Implementation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **an OpenAI provider implementation**,
So that **users can use OpenAI models for conversations**.

## Acceptance Criteria

1. **Given** the Provider interface exists, **When** OpenAIProvider is instantiated with an API key, **Then** `ValidateCredentials()` returns nil for valid keys

2. **Given** OpenAIProvider with an invalid API key, **When** `ValidateCredentials()` is called, **Then** it returns a descriptive user-friendly error

3. **Given** OpenAIProvider with a valid API key, **When** `ListModels()` is called, **Then** it returns available OpenAI models (GPT-4o, GPT-4o mini, GPT-4.1, GPT-4.1 mini)

4. **Given** OpenAIProvider with a valid API key, **When** `SendMessage()` is called, **Then** it returns a channel that streams `StreamChunk` events in order (start -> chunk(s) -> end)

5. **Given** the implementation follows the same patterns as ClaudeProvider, **When** comparing code structure, **Then** error handling, streaming lifecycle, and type usage are consistent

6. **Given** any provider operation, **When** API keys are processed, **Then** keys are never logged or exposed in error messages (NFR6)

7. **Given** a provider error occurs, **When** the error is returned to the caller, **Then** it includes a user-friendly message (NFR8)

## Tasks / Subtasks

- [x] Task 1: Add OpenAI Go SDK Dependency (AC: #5)
  - [x] 1.1: Run `cd backend && go get -u 'github.com/openai/openai-go/v3'` to add the official OpenAI Go SDK
  - [x] 1.2: Verify `go.mod` updated with `github.com/openai/openai-go/v3` dependency

- [x] Task 2: Implement OpenAI Provider (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1: Create `backend/providers/openai.go` implementing `Provider` interface
  - [x] 2.2: Define `OpenAIProvider` struct with `client *openai.Client` field
  - [x] 2.3: Constructor: `NewOpenAIProvider(apiKey string) *OpenAIProvider` - creates OpenAI client with `option.WithAPIKey(apiKey)`
  - [x] 2.4: Implement `ValidateCredentials(ctx)` - send minimal chat completion request to validate API key; map 401 errors to user-friendly message
  - [x] 2.5: Implement `ListModels()` - return hardcoded list of OpenAI models with IDs and max token limits (same pattern as Claude)
  - [x] 2.6: Implement `SendMessage(ctx, req)` - use `client.Chat.Completions.NewStreaming()`, iterate `stream.Next()`, map SDK events to `StreamChunk` types, send chunks on returned channel
  - [x] 2.7: Handle streaming lifecycle: emit `start` chunk, `chunk` for each text delta, `end` with usage stats, `error` on failures
  - [x] 2.8: Implement `mapProviderError(err)` for OpenAI-specific error codes (401, 429, 400, 500, etc.)
  - [x] 2.9: Ensure API key is never included in error messages or logs (NFR6)

- [x] Task 3: Register OpenAI Provider in Factory (AC: #5)
  - [x] 3.1: Update `backend/services/provider_service.go` - add `case "openai"` to `GetProvider()` switch statement
  - [x] 3.2: Update the "Available providers" error message to include "openai"

- [x] Task 4: Testing (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 4.1: Create `backend/providers/openai_test.go` with unit tests following `claude_test.go` patterns
  - [x] 4.2: Test `ValidateCredentials()` - valid key (200 response), invalid key (401), rate limited (429), server error (500)
  - [x] 4.3: Test `ListModels()` - verify model list contains expected models with correct fields
  - [x] 4.4: Test `SendMessage()` - test streaming chunk sequence (start -> chunks -> end) using httptest mock server
  - [x] 4.5: Test error mapping - verify all HTTP status codes map to correct ProviderError codes
  - [x] 4.6: Test API key security - verify keys never appear in error messages (NFR6)
  - [x] 4.7: Test system prompt handling - verify system messages included in API requests
  - [x] 4.8: Update `backend/services/provider_service_test.go` - add tests for `GetProvider("openai", ...)` factory case
  - [x] 4.9: Update `backend/tests/api/providers_test.go` - add integration tests for OpenAI provider type validation and model listing

## Dev Notes

### Critical Architecture Patterns

**This story implements the second provider following the patterns established in Story 1.3. The implementation MUST be structurally identical to ClaudeProvider.**

#### Provider Interface Contract (MUST FOLLOW EXACTLY)

```go
// From backend/providers/provider.go - DO NOT MODIFY
type Provider interface {
    SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)
    ValidateCredentials(ctx context.Context) error
    ListModels() ([]Model, error)
}
```

[Source: backend/providers/provider.go]

#### Existing Types to Reuse (DO NOT RECREATE)

All types are already defined in `backend/providers/provider.go`:
- `ChatRequest` - Messages, Model, MaxTokens, SystemPrompt
- `StreamChunk` - Type (start/chunk/end/error), Content, MessageID, Index, Usage
- `UsageStats` - InputTokens, OutputTokens
- `Model` - ID, Name, Provider, MaxTokens
- `Message` - Role, Content
- `ProviderError` - Code, Message, UserMessage (Error() returns UserMessage for security)

[Source: backend/providers/provider.go]

#### Streaming Chunk Protocol (MUST MATCH CLAUDE IMPLEMENTATION)

| StreamChunk Type | Maps to WS Event | Content |
|-----------------|-------------------|---------|
| `start` | `message:start` | `MessageID`, `Model` |
| `chunk` | `message:chunk` | `Content` (text delta), `Index` |
| `end` | `message:end` | `Usage` (input/output tokens) |
| `error` | `message:error` | `Error` message |

[Source: backend/providers/claude.go, architecture.md#WebSocket-Events]

### OpenAI Go SDK Usage

**Package:** `github.com/openai/openai-go/v3` (latest: v3.17.0)
**Go Requirement:** 1.22+ (project uses 1.25.6, compatible)

**IMPORTANT:** Use the official OpenAI Go SDK (`github.com/openai/openai-go/v3`), NOT the community `sashabaranov/go-openai` package.

**Client creation:**
```go
import (
    "github.com/openai/openai-go/v3"
    "github.com/openai/openai-go/v3/option"
)

client := openai.NewClient(
    option.WithAPIKey(apiKey),
)
```

**Streaming pattern (Chat Completions API):**
```go
stream := client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
    Model: openai.ChatModelGPT4o,
    Messages: []openai.ChatCompletionMessageParamUnion{
        openai.UserMessage("prompt"),
    },
})

acc := openai.ChatCompletionAccumulator{}
for stream.Next() {
    chunk := stream.Current()
    acc.AddChunk(chunk)

    // Extract text delta from chunk
    if len(chunk.Choices) > 0 {
        deltaContent := chunk.Choices[0].Delta.Content
        // Send as StreamChunk type "chunk"
    }

    // Usage only populated in final chunk
    if chunk.Usage.TotalTokens > 0 {
        // Send as StreamChunk type "end" with UsageStats
    }
}
if err := stream.Err(); err != nil {
    // Handle error - send StreamChunk type "error"
}
```

**Message construction helpers:**
```go
openai.SystemMessage("system prompt")     // System role
openai.UserMessage("user message")        // User role
openai.AssistantMessage("assistant reply") // Assistant role
```

**Error handling:**
```go
var apierr *openai.Error
if errors.As(err, &apierr) {
    statusCode := apierr.StatusCode
    // Map to ProviderError based on status code
}
```

**Model constants available in SDK:**
- `openai.ChatModelGPT4o` - GPT-4o (flagship)
- `openai.ChatModelGPT4oMini` - GPT-4o mini (cost-effective)
- `openai.ChatModelGPT4_1` or similar - GPT-4.1 (if available in SDK constants)
- Note: If specific constants are not available, use string literals matching the API model IDs

### Credential Validation Approach

Same pattern as ClaudeProvider - no dedicated validation endpoint. Send a minimal chat completion request:

```go
func (p *OpenAIProvider) ValidateCredentials(ctx context.Context) error {
    _, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
        Model: openai.ChatModelGPT4oMini, // cheapest model
        Messages: []openai.ChatCompletionMessageParamUnion{
            openai.UserMessage("hi"),
        },
        // MaxTokens: openai.Int(1), // minimize cost - check if SDK uses Int or Int64
    })
    if err != nil {
        return mapProviderError(err)
    }
    return nil
}
```

### Error Mapping (Must Follow Claude Pattern)

```go
func mapProviderError(err error) *ProviderError {
    var apierr *openai.Error
    if errors.As(err, &apierr) {
        switch apierr.StatusCode {
        case 401:
            return &ProviderError{
                Code:        "auth_error",
                Message:     err.Error(),
                UserMessage: "Invalid API key. Please check your OpenAI API key and try again.",
            }
        case 429:
            return &ProviderError{
                Code:        "rate_limit",
                Message:     err.Error(),
                UserMessage: "Rate limit reached. Please wait a moment and try again.",
            }
        case 400:
            return &ProviderError{
                Code:        "invalid_request",
                Message:     err.Error(),
                UserMessage: "The request was invalid. Please check your input and try again.",
            }
        default:
            return &ProviderError{
                Code:        "provider_error",
                Message:     err.Error(),
                UserMessage: "An error occurred while communicating with OpenAI. Please try again.",
            }
        }
    }
    return &ProviderError{
        Code:        "provider_error",
        Message:     err.Error(),
        UserMessage: "An unexpected error occurred. Please try again.",
    }
}
```

Compare with Claude error mapping in `backend/providers/claude.go:mapProviderError()` for consistency.

[Source: backend/providers/claude.go]

### OpenAI Models to Include

Hardcoded model list (same approach as Claude):

```go
var openaiModels = []Model{
    {ID: "gpt-4o", Name: "GPT-4o", Provider: "openai", MaxTokens: 16384},
    {ID: "gpt-4o-mini", Name: "GPT-4o mini", Provider: "openai", MaxTokens: 16384},
    {ID: "gpt-4.1", Name: "GPT-4.1", Provider: "openai", MaxTokens: 32768},
    {ID: "gpt-4.1-mini", Name: "GPT-4.1 mini", Provider: "openai", MaxTokens: 32768},
}
```

**OpenAI Model Pricing (for future cost tracking):**

| Model | Input $/MTok | Output $/MTok |
|-------|-------------|---------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| GPT-4.1 | $2.00 | $8.00 |
| GPT-4.1 mini | $0.40 | $1.60 |

### Service Factory Update

In `backend/services/provider_service.go`, the `GetProvider()` switch statement needs a new case:

```go
func (s *ProviderService) GetProvider(providerType string, apiKey string) (providers.Provider, error) {
    switch providerType {
    case "claude":
        return providers.NewClaudeProvider(apiKey), nil
    case "openai":                                        // ADD THIS
        return providers.NewOpenAIProvider(apiKey), nil    // ADD THIS
    default:
        return nil, &providers.ProviderError{
            Code:        "unsupported_provider",
            Message:     fmt.Sprintf("provider type not supported: %s", providerType),
            UserMessage: fmt.Sprintf("Provider type '%s' is not supported. Available providers: claude, openai.", providerType), // UPDATE THIS
        }
    }
}
```

[Source: backend/services/provider_service.go]

### Project Structure Notes

**Files to Create:**

```
backend/
└── providers/
    ├── openai.go                # CREATE: OpenAI implementation (~180-220 lines)
    └── openai_test.go           # CREATE: OpenAI unit tests (~400-450 lines)
```

**Files to Modify:**

```
backend/
├── services/
│   ├── provider_service.go      # MODIFY: Add "openai" case to GetProvider()
│   └── provider_service_test.go # MODIFY: Add tests for openai provider type
├── tests/
│   └── api/
│       └── providers_test.go    # MODIFY: Add integration tests for openai
├── go.mod                       # MODIFY: Add openai-go/v3 dependency
└── go.sum                       # MODIFY: Updated with new dependencies
```

**Files to NOT Touch:**

```
backend/
├── providers/
│   ├── provider.go              # DO NOT MODIFY - interface is stable
│   └── claude.go                # DO NOT MODIFY - separate provider
├── api/
│   ├── handlers/providers.go    # DO NOT MODIFY - handler is provider-agnostic
│   └── router.go                # DO NOT MODIFY - routes are provider-agnostic
└── main.go                      # DO NOT MODIFY - ProviderService already initialized
```

**Alignment with Architecture:**
- `backend/providers/openai.go` matches `providers/openai.go` in architecture structure
- No new routes needed - existing `POST /api/v1/providers/validate` and `GET /api/v1/providers/:type/models` already support any provider type
- Handler and router are already provider-agnostic via the ProviderService factory

[Source: architecture.md#Project-Structure-Boundaries]

### Previous Story Intelligence

**From Story 1.3 (Provider Interface & Claude Implementation):**

- Provider interface uses `ValidateCredentials(ctx context.Context)` - note the `ctx` parameter
- `ProviderError.Error()` returns `UserMessage` not `Message` - this is intentional for NFR6 security
- Claude's `SendMessage` uses a buffered channel with capacity 32: `make(chan StreamChunk, 32)`
- Streaming goroutine closes the channel when done: `defer close(ch)`
- Only "user" and "assistant" roles are supported - "system" role messages should use the `SystemPrompt` field of `ChatRequest` instead
- UUID generation for MessageID: use `fmt.Sprintf("msg_%s", uuid.New().String())` or similar
- SDK retries: Anthropic SDK auto-retries on 429/529/500 - check if OpenAI SDK does similar retry behavior (may affect test timing)

**From Story 1.3 Debug Log:**
- SDK type mismatches can cause compilation issues - carefully match SDK's expected types for message params
- The actual error type from API calls may differ from documented types - test against real SDK behavior
- System prompt handling: Claude uses a separate `System` field, OpenAI uses `SystemMessage()` helper in the messages array

[Source: _bmad-output/implementation-artifacts/1-3-provider-interface-claude-implementation.md]

### Git Intelligence

**Recent Commits:**
```
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
40f508a Merge pull request #3 from Flow-Fly/feature/artifact-registry
```

**Patterns Established:**
- Feature branches: `feature/{description}` (e.g., `feature/1-4-openai-provider`)
- Commit messages: `feat:` prefix for features
- Services use RWMutex for thread safety (not needed for OpenAIProvider itself - it's stateless like ClaudeProvider)
- Comprehensive test coverage expected

### Key Differences from Claude Implementation

| Aspect | Claude (Story 1.3) | OpenAI (This Story) |
|--------|-------------------|---------------------|
| SDK | `anthropic-sdk-go` v1.19.0 | `openai-go/v3` v3.17.0 |
| Client | `anthropic.NewClient(option.WithAPIKey(...))` | `openai.NewClient(option.WithAPIKey(...))` |
| Streaming | `client.Messages.NewStreaming(ctx, params)` | `client.Chat.Completions.NewStreaming(ctx, params)` |
| System prompt | Separate `System` field in params | `openai.SystemMessage(...)` in Messages array |
| Error type | `*anthropic.Error` with `.StatusCode` | `*openai.Error` with `.StatusCode` |
| Models API | Hardcoded list (no SDK list API used) | Hardcoded list (same approach) |
| Validation | Minimal request with Haiku | Minimal request with GPT-4o mini |
| Chunk access | Event-based accumulate pattern | `chunk.Choices[0].Delta.Content` |
| Usage stats | From message accumulator | From `chunk.Usage` in final chunk |

### Anti-Patterns to Avoid

- **DO NOT** modify the Provider interface in `provider.go` - it is stable
- **DO NOT** modify the Claude provider - it is a separate, completed implementation
- **DO NOT** implement Ollama provider - that's Story 1.5
- **DO NOT** implement credential storage or settings persistence - that's Story 1.6
- **DO NOT** implement WebSocket chat handler - that's Epic 3
- **DO NOT** log or include API keys in any error output (NFR6)
- **DO NOT** use `panic()` - always return errors
- **DO NOT** use the community `sashabaranov/go-openai` package - use official `openai/openai-go`
- **DO NOT** modify handlers or router - they are already provider-agnostic
- **DO NOT** wrap successful API responses - return payload directly
- **DO NOT** use the Responses API - use the Chat Completions API for consistency with the existing architecture

### Testing Strategy

Follow `claude_test.go` patterns exactly:

1. **Mock HTTP Server** - Use `httptest.NewServer` to mock OpenAI API responses
2. **Client with custom base URL** - Point the OpenAI client to the mock server using `option.WithBaseURL(server.URL)`
3. **Table-driven tests** - Follow Go idioms for all test cases
4. **Test categories:**
   - `TestOpenAIProvider_ValidateCredentials` - valid key (200), invalid key (401), rate limited (429), server error (500)
   - `TestOpenAIProvider_ListModels` - verify model list contents
   - `TestOpenAIProvider_SendMessage` - test full streaming lifecycle (start -> chunks -> end)
   - `TestOpenAIProvider_SendMessage_Error` - test error chunk emission
   - `TestOpenAIProvider_SendMessage_SystemPrompt` - verify system prompt in requests
   - `TestOpenAIProvider_ErrorMapping` - verify all status codes map correctly
   - `TestOpenAIProvider_APIKeySecurity` - verify keys never in error messages (NFR6)

**Mock SSE Response Format (OpenAI):**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

Compare with the Claude SSE mock format in `backend/providers/claude_test.go` for reference.

### Latest Technical Information

**OpenAI Go SDK v3.17.0** (January 2026):
- Official package: `github.com/openai/openai-go/v3`
- Requires Go 1.22+ (project uses 1.25.6)
- Uses `omitzero` semantics from Go 1.24+ `encoding/json`
- Chat Completions API fully supported alongside newer Responses API
- Streaming via `NewStreaming()` + `Next()` iterator pattern (same pattern as Anthropic SDK)
- Type-safe error handling with `*openai.Error` and `.StatusCode` field
- `ChatCompletionAccumulator` helper for streaming accumulation
- Message helpers: `SystemMessage()`, `UserMessage()`, `AssistantMessage()`

**Key API Differences from Claude:**
- OpenAI puts system messages IN the messages array (not a separate field)
- OpenAI streaming usage comes in the final chunk's `Usage` field
- OpenAI uses `Choices[0].Delta.Content` for text deltas (not event-based)
- OpenAI streaming ends with `data: [DONE]` sentinel

### References

- [Source: backend/providers/provider.go - Provider interface and types]
- [Source: backend/providers/claude.go - Reference implementation to follow]
- [Source: backend/providers/claude_test.go - Test patterns to follow]
- [Source: backend/services/provider_service.go - Factory to update]
- [Source: backend/api/handlers/providers.go - Handler is already provider-agnostic]
- [Source: _bmad-output/planning-artifacts/architecture.md#Provider-Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4-OpenAI-Provider-Implementation]
- [Source: _bmad-output/project-context.md#Language-Specific-Rules]
- [Source: _bmad-output/project-context.md#Security-Rules]
- [Source: _bmad-output/implementation-artifacts/1-3-provider-interface-claude-implementation.md - Previous story]
- [Source: github.com/openai/openai-go/v3 v3.17.0 - OpenAI Go SDK]
- [Source: https://platform.openai.com/docs/pricing - OpenAI pricing]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- OpenAI SDK v3 uses `param.Opt[int64]` for MaxTokens; `openai.Int(1)` helper used for validation request
- OpenAI streaming requires explicit `StreamOptions.IncludeUsage: openai.Bool(true)` to receive usage stats in final chunk (unlike Claude which uses accumulator)
- OpenAI SDK auto-retries on 429/500 status codes (similar to Anthropic SDK), causing some test timing overhead (~1.3s per retry test)
- System prompt is sent as first message via `openai.SystemMessage()` in the messages array, unlike Claude's separate `System` field
- MessageID uses OpenAI's native `chatcmpl-*` completion ID from the chunk, not a generated UUID
- Error mapping uses `mapOpenAIProviderError` (distinct function name from Claude's `mapProviderError`) to avoid name collision in the same package
- The existing integration test `TestIntegration_ProviderValidate_UnsupportedProvider` was testing `openai` as unsupported; updated to use `unsupported` provider type instead

### Completion Notes List

- Implemented `OpenAIProvider` in `backend/providers/openai.go` following identical patterns to `ClaudeProvider`
- All 4 OpenAI models hardcoded: GPT-4o, GPT-4o mini, GPT-4.1, GPT-4.1 mini using SDK constants
- Streaming uses `client.Chat.Completions.NewStreaming()` with `StreamOptions.IncludeUsage` enabled
- Error mapping covers 401, 429, 400, and default status codes; all errors use safe `UserMessage` (NFR6)
- Factory updated in `provider_service.go` with `case "openai"` and updated available providers message
- Comprehensive tests: 14 new unit tests in `openai_test.go`, 2 new service tests, 2 new integration tests
- Full test suite passes: all packages green, zero regressions
- No modifications to `provider.go`, `claude.go`, handlers, or router (all remain provider-agnostic)

### Change Log

- 2026-01-29: Implemented OpenAI provider (Story 1.4) - all tasks complete, all tests pass
- 2026-01-29: Code review (adversarial) - 8 issues found (3H/3M/2L), 5 fixed, 1 documented, 2 noted for future

### Senior Developer Review (AI)

**Reviewer:** Code Review Workflow (Adversarial)
**Date:** 2026-01-29
**Outcome:** Approved with fixes applied

**Issues Found: 8 total (3 High, 3 Medium, 2 Low)**

**Fixed (5):**
- [H2] StreamError test now asserts error/end chunk emission after disconnection
- [H3] Added context cancellation test (`TestOpenAIProvider_SendMessage_ContextCancellation`)
- [M1] Replaced fragile `r.Body.Read(buf)` with `io.ReadAll(r.Body)` in system prompt test
- [M3] Added `max_tokens` request body assertion in system prompt test
- [H1] Documented known stream initialization pattern (comment added, consistent with Claude)

**Noted (no action needed this story):**
- [M2] `ListModels()` error return never used - interface design from Story 1.3
- [L1] `start` chunk missing `Model` field per WS event spec - pre-existing gap from Story 1.3, address in Epic 3
- [L2] Asymmetric error mapper naming (`mapProviderError` vs `mapOpenAIProviderError`) - consider standardizing in Story 1.5

### File List

**New Files:**
- backend/providers/openai.go
- backend/providers/openai_test.go

**Modified Files:**
- backend/services/provider_service.go
- backend/services/provider_service_test.go
- backend/tests/api/providers_test.go
- backend/go.mod
- backend/go.sum
