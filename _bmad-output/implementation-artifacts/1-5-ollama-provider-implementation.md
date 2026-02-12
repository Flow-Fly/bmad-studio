# Story 1.5: Ollama Provider Implementation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to configure a local Ollama endpoint**,
So that **I can use local models without cloud API costs** (FR19).

## Acceptance Criteria

1. **Given** Ollama is running locally, **When** OllamaProvider is instantiated with endpoint URL (default: localhost:11434), **Then** `ValidateCredentials()` returns nil if Ollama is reachable

2. **Given** Ollama is not running or unreachable, **When** `ValidateCredentials()` is called, **Then** it returns a descriptive user-friendly error indicating Ollama is not reachable

3. **Given** Ollama is running with local models installed, **When** `ListModels()` is called, **Then** it returns the models actually available in the local Ollama instance (dynamically fetched via `GET /api/tags`)

4. **Given** OllamaProvider is configured, **When** `SendMessage()` is called, **Then** it returns a channel that streams `StreamChunk` events in order (start -> chunk(s) -> end) using Ollama's NDJSON streaming chat API

5. **Given** the provider works without requiring an API key, **When** instantiated with only an endpoint URL, **Then** all operations work without API key validation

6. **Given** a provider error occurs, **When** the error is returned to the caller, **Then** it includes a user-friendly message (NFR8)

7. **Given** the implementation follows the same Provider interface patterns, **When** comparing code structure, **Then** streaming lifecycle, error handling, and type usage are consistent with Claude and OpenAI providers

## Tasks / Subtasks

- [x] Task 1: Implement Ollama Provider (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 1.1: Create `backend/providers/ollama.go` implementing `Provider` interface
  - [x] 1.2: Define `OllamaProvider` struct with `baseURL string` and `httpClient *http.Client` fields
  - [x] 1.3: Constructor: `NewOllamaProvider(endpoint string) *OllamaProvider` - creates provider with given endpoint URL (default: `http://localhost:11434`)
  - [x] 1.4: Implement `ValidateCredentials(ctx)` - send `GET /api/tags` to check if Ollama is reachable; return user-friendly error if unreachable
  - [x] 1.5: Implement `ListModels()` - send `GET /api/tags` to Ollama, parse response, and map to `[]Model` with dynamic model discovery
  - [x] 1.6: Implement `SendMessage(ctx, req)` - send `POST /api/chat` with NDJSON streaming, read response line-by-line, decode each JSON line, map to `StreamChunk` types, send chunks on returned channel
  - [x] 1.7: Handle streaming lifecycle: emit `start` chunk (with generated MessageID), `chunk` for each content delta from NDJSON lines, `end` when `done: true` with usage stats from `prompt_eval_count` and `eval_count`
  - [x] 1.8: Implement `mapOllamaProviderError(err, statusCode)` for Ollama-specific error handling (connection refused, 404 model not found, 400 bad request, timeouts)
  - [x] 1.9: Handle system prompt by prepending a `{"role": "system", "content": "..."}` message to the messages array

- [x] Task 2: Register Ollama Provider in Factory (AC: #5, #7)
  - [x] 2.1: Update `backend/services/provider_service.go` - add `case "ollama"` to `GetProvider()` switch statement
  - [x] 2.2: Modify `GetProvider()` signature handling: Ollama uses endpoint URL instead of API key - the `apiKey` parameter serves as the endpoint URL for Ollama
  - [x] 2.3: Update the "Available providers" error message to include "ollama"
  - [x] 2.4: Update `ListProviderModels()` - Ollama needs a real endpoint (not empty string) for dynamic model listing; use default `http://localhost:11434` when empty

- [x] Task 3: Testing (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 3.1: Create `backend/providers/ollama_test.go` with unit tests following `claude_test.go` and `openai_test.go` patterns
  - [x] 3.2: Test `ValidateCredentials()` - Ollama reachable (200 response), unreachable (connection refused), timeout
  - [x] 3.3: Test `ListModels()` - verify dynamic model parsing from mock `/api/tags` response, verify empty model list handling
  - [x] 3.4: Test `SendMessage()` - test streaming NDJSON chunk sequence (start -> chunks -> end) using httptest mock server
  - [x] 3.5: Test error mapping - verify connection refused, 404, 400, and timeout errors map to correct ProviderError codes
  - [x] 3.6: Test system prompt handling - verify system messages included as first message in API requests
  - [x] 3.7: Test context cancellation - verify streaming stops when context is cancelled
  - [x] 3.8: Update `backend/services/provider_service_test.go` - add tests for `GetProvider("ollama", ...)` factory case
  - [x] 3.9: Update `backend/tests/api/providers_test.go` - add integration tests for Ollama provider type validation and model listing

## Dev Notes

### Critical Architecture Patterns

**This story implements the third and final provider following the patterns established in Stories 1.3 and 1.4. The implementation MUST follow the same structural patterns but with key differences: Ollama uses raw HTTP (no SDK), NDJSON streaming (not SSE), dynamic model listing (not hardcoded), and no API key.**

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

#### Streaming Chunk Protocol (MUST MATCH CLAUDE/OPENAI IMPLEMENTATION)

| StreamChunk Type | Maps to WS Event | Content |
|-----------------|-------------------|---------|
| `start` | `message:start` | `MessageID` (generated UUID) |
| `chunk` | `message:chunk` | `Content` (text delta), `Index` |
| `end` | `message:end` | `Usage` (input/output tokens from eval counts) |
| `error` | `message:error` | `Error` message |

[Source: backend/providers/claude.go, backend/providers/openai.go, architecture.md#WebSocket-Events]

### Key Differences from Claude/OpenAI Implementations

| Aspect | Claude (Story 1.3) | OpenAI (Story 1.4) | Ollama (This Story) |
|--------|-------------------|---------------------|---------------------|
| SDK | `anthropic-sdk-go` | `openai-go/v3` | **Raw `net/http`** (no SDK needed) |
| Authentication | API key (cloud) | API key (cloud) | **None** (local endpoint) |
| Streaming format | SSE events | SSE events | **NDJSON** (newline-delimited JSON) |
| Model list | Hardcoded | Hardcoded | **Dynamic** via `GET /api/tags` |
| Base URL | Fixed (Anthropic API) | Fixed (OpenAI API) | **Configurable** (default `localhost:11434`) |
| System prompt | Separate `System` field | `SystemMessage()` in array | **`"role": "system"` message** in array |
| Error type | `*anthropic.Error` | `*openai.Error` | **HTTP status codes** + connection errors |
| Usage stats | From message accumulator | From final chunk's `Usage` | **From `prompt_eval_count` + `eval_count`** in final NDJSON line |
| Message ID | From Anthropic's event | From OpenAI's `chatcmpl-*` ID | **Self-generated UUID** |

### Ollama REST API Reference

**Base URL:** `http://localhost:11434` (configurable via endpoint parameter)

#### Chat Endpoint: `POST /api/chat`

**Request:**
```json
{
  "model": "llama3.2",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}
```

**Streaming Response (NDJSON - one JSON object per line):**
```
{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"!"},"done":false}
{"model":"llama3.2","created_at":"2026-01-29T10:00:01Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","total_duration":1234567890,"load_duration":123456,"prompt_eval_count":15,"prompt_eval_duration":456789,"eval_count":25,"eval_duration":789012}
```

**Key points:**
- Each line is a complete JSON object
- `message.content` contains the incremental text delta per chunk
- Final line has `"done": true` with evaluation metrics
- `prompt_eval_count` = input tokens, `eval_count` = output tokens
- No MessageID from Ollama - generate one using UUID

#### List Models: `GET /api/tags`

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "modified_at": "2026-01-20T10:00:00Z",
      "size": 4700000000,
      "digest": "abc123...",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "8B",
        "quantization_level": "Q4_0"
      }
    }
  ]
}
```

**Model mapping to our `Model` type:**
- `ID` = model `name` field (e.g., "llama3.2:latest")
- `Name` = model `name` without tag (e.g., "llama3.2") or full name
- `Provider` = "ollama"
- `MaxTokens` = 0 (Ollama doesn't expose max tokens via API; use 0 to indicate "provider default")

### Implementation Details

#### OllamaProvider Struct

```go
type OllamaProvider struct {
    baseURL    string
    httpClient *http.Client
}

func NewOllamaProvider(endpoint string) *OllamaProvider {
    if endpoint == "" {
        endpoint = "http://localhost:11434"
    }
    return &OllamaProvider{
        baseURL: endpoint,
        httpClient: &http.Client{
            Timeout: 0, // No timeout for streaming; context handles cancellation
        },
    }
}
```

**Important:** Use `http.Client` with `Timeout: 0` for streaming requests - the context parameter handles cancellation instead. For validation requests, use a separate `http.Client` with a reasonable timeout (e.g., 10s) or use `http.NewRequestWithContext`.

#### ValidateCredentials Approach

Unlike Claude/OpenAI which validate by sending a minimal chat request, Ollama just needs a connectivity check:

```go
func (p *OllamaProvider) ValidateCredentials(ctx context.Context) error {
    req, err := http.NewRequestWithContext(ctx, "GET", p.baseURL+"/api/tags", nil)
    if err != nil {
        return mapOllamaProviderError(err, 0)
    }
    resp, err := p.httpClient.Do(req)
    if err != nil {
        return mapOllamaProviderError(err, 0)
    }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return mapOllamaProviderError(nil, resp.StatusCode)
    }
    return nil
}
```

#### Dynamic Model Listing

Unlike Claude/OpenAI which use hardcoded model lists, Ollama discovers models dynamically:

```go
func (p *OllamaProvider) ListModels() ([]Model, error) {
    resp, err := p.httpClient.Get(p.baseURL + "/api/tags")
    // Parse response, map each model to our Model type
    // Handle empty list gracefully
}
```

**Response types to define locally in `ollama.go`:**
```go
type ollamaTagsResponse struct {
    Models []ollamaModelInfo `json:"models"`
}

type ollamaModelInfo struct {
    Name       string    `json:"name"`
    Model      string    `json:"model"`
    ModifiedAt string    `json:"modified_at"`
    Size       int64     `json:"size"`
}
```

#### NDJSON Streaming

The key difference from SSE-based providers. Use `bufio.Scanner` to read line by line:

```go
scanner := bufio.NewScanner(resp.Body)
for scanner.Scan() {
    line := scanner.Bytes()
    var chatResp ollamaChatResponse
    if err := json.Unmarshal(line, &chatResp); err != nil {
        continue // Skip malformed lines
    }
    // Map chatResp to StreamChunk and send on channel
    if chatResp.Done {
        // Send "end" chunk with usage stats
        break
    }
}
```

**Response types for streaming:**
```go
type ollamaChatResponse struct {
    Model             string        `json:"model"`
    CreatedAt         string        `json:"created_at"`
    Message           ollamaMessage `json:"message"`
    Done              bool          `json:"done"`
    DoneReason        string        `json:"done_reason,omitempty"`
    TotalDuration     int64         `json:"total_duration,omitempty"`
    LoadDuration      int64         `json:"load_duration,omitempty"`
    PromptEvalCount   int           `json:"prompt_eval_count,omitempty"`
    PromptEvalDuration int64        `json:"prompt_eval_duration,omitempty"`
    EvalCount         int           `json:"eval_count,omitempty"`
    EvalDuration      int64         `json:"eval_duration,omitempty"`
}

type ollamaMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}
```

**Usage mapping:**
- `prompt_eval_count` -> `UsageStats.InputTokens`
- `eval_count` -> `UsageStats.OutputTokens`

#### Message ID Generation

Ollama doesn't provide a message ID. Generate one:
```go
import "github.com/google/uuid"

messageID := fmt.Sprintf("ollama_%s", uuid.New().String())
```

Check if the project already uses a UUID package. The OpenAI provider uses the native completion ID from OpenAI's response. Claude uses the message ID from Anthropic's event. For Ollama, generate a UUID locally.

#### Error Mapping

```go
func mapOllamaProviderError(err error, statusCode int) *ProviderError {
    // Connection refused - Ollama not running
    if err != nil {
        if isConnectionRefused(err) {
            return &ProviderError{
                Code:        "connection_error",
                Message:     err.Error(),
                UserMessage: "Cannot connect to Ollama. Please ensure Ollama is running (ollama serve) and accessible.",
            }
        }
        if isTimeout(err) {
            return &ProviderError{
                Code:        "timeout",
                Message:     err.Error(),
                UserMessage: "Connection to Ollama timed out. Please check if Ollama is running.",
            }
        }
        return &ProviderError{
            Code:        "connection_error",
            Message:     err.Error(),
            UserMessage: "Failed to connect to Ollama. Please check your Ollama endpoint configuration.",
        }
    }
    // HTTP status code errors
    switch statusCode {
    case 404:
        return &ProviderError{
            Code:        "model_not_found",
            Message:     "model not found",
            UserMessage: "The requested model was not found. Please pull the model first (ollama pull <model>).",
        }
    case 400:
        return &ProviderError{
            Code:        "invalid_request",
            Message:     "invalid request",
            UserMessage: "The request was invalid. Please check your input and try again.",
        }
    default:
        return &ProviderError{
            Code:        "provider_error",
            Message:     fmt.Sprintf("Ollama error (status %d)", statusCode),
            UserMessage: "An error occurred communicating with Ollama. Please try again.",
        }
    }
}
```

**Connection error detection helpers:**
```go
func isConnectionRefused(err error) bool {
    // Check for net.OpError with "connection refused"
    var opErr *net.OpError
    if errors.As(err, &opErr) {
        return true
    }
    return strings.Contains(err.Error(), "connection refused")
}

func isTimeout(err error) bool {
    var netErr net.Error
    if errors.As(err, &netErr) {
        return netErr.Timeout()
    }
    return false
}
```

### Service Factory Update

In `backend/services/provider_service.go`, key differences for Ollama:

```go
func (s *ProviderService) GetProvider(providerType string, apiKey string) (providers.Provider, error) {
    switch providerType {
    case "claude":
        return providers.NewClaudeProvider(apiKey), nil
    case "openai":
        return providers.NewOpenAIProvider(apiKey), nil
    case "ollama":                                              // ADD THIS
        return providers.NewOllamaProvider(apiKey), nil         // apiKey serves as endpoint URL
    default:
        return nil, &providers.ProviderError{
            Code:        "unsupported_provider",
            Message:     fmt.Sprintf("provider type not supported: %s", providerType),
            UserMessage: fmt.Sprintf("Provider type '%s' is not supported. Available providers: claude, openai, ollama.", providerType),
        }
    }
}
```

**Important:** For Ollama, the `apiKey` parameter in the factory serves as the endpoint URL. This is pragmatic reuse of the existing API. The `ListProviderModels()` method passes empty string for `apiKey` - for Ollama, `NewOllamaProvider("")` should default to `http://localhost:11434`.

[Source: backend/services/provider_service.go]

### Project Structure Notes

**Files to Create:**

```
backend/
└── providers/
    ├── ollama.go                # CREATE: Ollama implementation (~250-300 lines)
    └── ollama_test.go           # CREATE: Ollama unit tests (~450-500 lines)
```

**Files to Modify:**

```
backend/
├── services/
│   ├── provider_service.go      # MODIFY: Add "ollama" case to GetProvider(), update ListProviderModels()
│   └── provider_service_test.go # MODIFY: Add tests for ollama provider type
└── tests/
    └── api/
        └── providers_test.go    # MODIFY: Add integration tests for ollama
```

**Files to NOT Touch:**

```
backend/
├── providers/
│   ├── provider.go              # DO NOT MODIFY - interface is stable
│   ├── claude.go                # DO NOT MODIFY - separate provider
│   ├── openai.go                # DO NOT MODIFY - separate provider
├── api/
│   ├── handlers/providers.go    # DO NOT MODIFY - handler is already provider-agnostic
│   └── router.go                # DO NOT MODIFY - routes are already provider-agnostic
├── go.mod                       # NO NEW DEPENDENCIES - using net/http only
└── main.go                      # DO NOT MODIFY - ProviderService already initialized
```

**Alignment with Architecture:**
- `backend/providers/ollama.go` matches `providers/ollama.go` in architecture structure
- No new routes needed - existing `POST /api/v1/providers/validate` and `GET /api/v1/providers/:type/models` already support any provider type
- Handler and router are already provider-agnostic via the ProviderService factory
- No new Go dependencies needed - uses only `net/http`, `bufio`, `encoding/json` from stdlib

[Source: architecture.md#Project-Structure-Boundaries]

### Previous Story Intelligence

**From Story 1.4 (OpenAI Provider Implementation):**

- Provider interface uses `ValidateCredentials(ctx context.Context)` - note the `ctx` parameter
- `ProviderError.Error()` returns `UserMessage` not `Message` - intentional for NFR6 security
- Both Claude and OpenAI use buffered channels with capacity 32: `make(chan StreamChunk, 32)` - follow same pattern
- Streaming goroutines use `defer close(ch)` - must follow
- Both providers use a `send()` helper function that checks `ctx.Done()` - follow same pattern
- Error mapper function naming: Claude uses `mapProviderError`, OpenAI uses `mapOpenAIProviderError` - for Ollama use `mapOllamaProviderError` (standardize naming)
- Context cancellation test added in Story 1.4 review - include for Ollama too

**From Story 1.4 Code Review:**
- [L2] Asymmetric error mapper naming - noted for standardization. Use `mapOllamaProviderError` consistently
- [L1] `start` chunk missing `Model` field per WS event spec - pre-existing gap, don't fix here (address in Epic 3)
- [M2] `ListModels()` error return never used - interface design, keep consistent

**From Story 1.4 Debug Log:**
- SDK type mismatches can cause compilation issues - not applicable for Ollama (raw HTTP, no SDK)
- System prompt handling: OpenAI uses `SystemMessage()` helper in messages array; Ollama also uses messages array with `role: "system"` - similar approach
- MessageID: OpenAI uses native completion ID, Claude uses event ID - Ollama has none, must generate UUID

[Source: _bmad-output/implementation-artifacts/1-4-openai-provider-implementation.md]

### Git Intelligence

**Recent Commits:**
```
ad36313 Merge pull request #5 from Flow-Fly:feature/1-4-openai-provider
6fb8ce6 feat: Add OpenAI provider integration and tests
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
```

**Patterns Established:**
- Feature branches: `feature/{description}` (e.g., `feature/1-5-ollama-provider`)
- Commit messages: `feat:` prefix for features
- All provider implementations include comprehensive test suites
- No modifications to `provider.go` interface, handlers, or router for new providers
- Factory pattern in `provider_service.go` is the only integration point

**Files recently created/modified:**
- `backend/providers/openai.go` (227 lines) - reference for structure
- `backend/providers/openai_test.go` (514 lines) - reference for tests
- `backend/services/provider_service.go` - factory with claude + openai cases

### Latest Technical Information

**Ollama API (January 2026):**
- Default endpoint: `http://localhost:11434`
- Chat API: `POST /api/chat` with NDJSON streaming (default: `stream: true`)
- List models: `GET /api/tags` returns all locally pulled models
- No authentication required - runs locally
- System prompts sent as first message with `role: "system"` in messages array
- Token usage available in final NDJSON line: `prompt_eval_count` (input), `eval_count` (output)
- Connection check: `GET /api/tags` (200 OK means Ollama is running)
- Error codes: 400 (bad request), 404 (model not found), connection refused (not running)
- No SDK needed - standard `net/http` + `encoding/json` + `bufio` sufficient
- Models are dynamic (user pulls them locally) - must fetch at runtime, not hardcode

**No new Go dependencies needed.** This implementation uses only Go standard library packages:
- `net/http` - HTTP client
- `encoding/json` - JSON encoding/decoding
- `bufio` - Line-by-line reading of NDJSON
- `fmt`, `errors`, `net`, `strings`, `context` - Standard utilities
- UUID generation: Check if project already has a UUID dependency; if not, use simple timestamp-based ID

### Anti-Patterns to Avoid

- **DO NOT** modify the Provider interface in `provider.go` - it is stable
- **DO NOT** modify the Claude or OpenAI providers - they are separate, completed implementations
- **DO NOT** implement credential storage or settings persistence - that's Story 1.6
- **DO NOT** implement WebSocket chat handler - that's Epic 3
- **DO NOT** implement offline mode detection - that's Epic 7 (Story 7.2)
- **DO NOT** log endpoint URLs that might reveal internal network topology
- **DO NOT** use `panic()` - always return errors
- **DO NOT** add external Ollama SDK dependencies - use Go standard library (`net/http`, `encoding/json`, `bufio`)
- **DO NOT** hardcode model lists - Ollama models are dynamic and must be fetched at runtime
- **DO NOT** modify handlers or router - they are already provider-agnostic
- **DO NOT** wrap successful API responses - return payload directly
- **DO NOT** set a timeout on the main HTTP client (streaming needs unlimited time) - use context cancellation instead
- **DO NOT** use the `/api/generate` endpoint - use `/api/chat` for multi-turn conversations

### Testing Strategy

Follow `claude_test.go` and `openai_test.go` patterns, adapted for raw HTTP:

1. **Mock HTTP Server** - Use `httptest.NewServer` to mock Ollama API responses
2. **NDJSON Response Mocking** - Write mock responses as newline-delimited JSON (NOT SSE format)
3. **Table-driven tests** - Follow Go idioms for all test cases
4. **Test categories:**
   - `TestOllamaProvider_ValidateCredentials` - reachable (200 from `/api/tags`), unreachable (connection refused), timeout
   - `TestOllamaProvider_ListModels` - parse model list from mock `/api/tags`, empty list, error response
   - `TestOllamaProvider_SendMessage` - test full NDJSON streaming lifecycle (start -> chunks -> end)
   - `TestOllamaProvider_SendMessage_Error` - test error chunk emission on HTTP errors
   - `TestOllamaProvider_SendMessage_SystemPrompt` - verify system prompt sent as first message
   - `TestOllamaProvider_SendMessage_ContextCancellation` - verify streaming stops on context cancel
   - `TestOllamaProvider_ErrorMapping` - verify all error types map correctly

**Mock NDJSON Response Format (Ollama):**
```
{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":" world"},"done":false}
{"model":"llama3.2","created_at":"2026-01-29T10:00:01Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":5}
```

Compare with Claude SSE mock in `backend/providers/claude_test.go` and OpenAI SSE mock in `backend/providers/openai_test.go`.

### References

- [Source: backend/providers/provider.go - Provider interface and types]
- [Source: backend/providers/claude.go - Reference implementation #1]
- [Source: backend/providers/openai.go - Reference implementation #2]
- [Source: backend/providers/claude_test.go - Test patterns reference #1]
- [Source: backend/providers/openai_test.go - Test patterns reference #2]
- [Source: backend/services/provider_service.go - Factory to update]
- [Source: backend/api/handlers/providers.go - Handler is already provider-agnostic]
- [Source: _bmad-output/planning-artifacts/architecture.md#Provider-Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5-Ollama-Provider-Implementation]
- [Source: _bmad-output/project-context.md#Language-Specific-Rules]
- [Source: _bmad-output/implementation-artifacts/1-4-openai-provider-implementation.md - Previous story]
- [Source: https://github.com/ollama/ollama/blob/main/docs/api.md - Ollama API docs]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered. Implementation was straightforward following established provider patterns.

### Completion Notes List

- Implemented `OllamaProvider` in `backend/providers/ollama.go` (~270 lines) following the Provider interface contract exactly as specified
- Used raw `net/http` + `bufio` + `encoding/json` from Go stdlib - no new dependencies added
- NDJSON streaming via `bufio.Scanner` reads response line-by-line, maps to `StreamChunk` types
- Dynamic model listing via `GET /api/tags` - models are fetched at runtime, not hardcoded
- Message ID generated using `crypto/rand` (hex-encoded 16 bytes) prefixed with `ollama_` - no UUID dependency needed
- `ValidateCredentials` uses lightweight `GET /api/tags` connectivity check instead of a chat request
- System prompt prepended as first message with `role: "system"` in the messages array
- Error mapping covers: connection refused, timeout, 404 model not found, 400 bad request, generic server errors
- All error user messages mention "Ollama" for clarity; no endpoint URLs exposed in user-facing errors (NFR6)
- Streaming follows same patterns as Claude/OpenAI: buffered channel (32), `send()` helper with ctx.Done() check, `defer close(ch)`
- Factory updated in `provider_service.go` - `apiKey` parameter serves as endpoint URL for Ollama
- 18 unit tests + 3 factory tests + 2 integration tests added - all passing
- Full regression suite passes (all existing provider, service, handler, API, and type tests)

### Change Log

- 2026-01-29: Implemented Ollama provider (Tasks 1-3), all ACs satisfied, all tests passing
- 2026-01-29: Code review completed — 5 issues fixed (2H, 3M), 2 LOW deferred
  - [H1] Fixed: Added 10s context timeout to `ListModels()` to prevent indefinite hangs
  - [H2] Fixed: Added `isConnectionRefused()` helper for differentiated error messages
  - [M1] Fixed: `generateOllamaMessageID()` now handles `crypto/rand.Read` errors with time-based fallback
  - [M2] Fixed: Removed `"system"` from allowed input message roles to match Claude/OpenAI consistency
  - [M3] Fixed: Added `TestOllamaProvider_ListModels_MalformedJSON` test for JSON decode error path
  - [L1] Deferred: `isTimeout()` naming — low risk, revisit if more providers need it
  - [L2] Deferred: Service test for Ollama ListModels has no assertions — acceptable given dynamic model dependency

### File List

**Created:**
- backend/providers/ollama.go
- backend/providers/ollama_test.go

**Modified:**
- backend/services/provider_service.go
- backend/services/provider_service_test.go
- backend/tests/api/providers_test.go
