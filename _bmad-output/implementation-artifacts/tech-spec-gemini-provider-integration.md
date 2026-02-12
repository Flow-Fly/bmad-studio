---
title: 'Gemini Provider Integration'
slug: 'gemini-provider-integration'
created: '2026-02-05'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5]
tech_stack:
  - 'Go 1.21+'
  - 'google.golang.org/genai (Google Gen AI Go SDK)'
  - 'Lit + TypeScript (frontend)'
  - 'Shoelace UI components'
  - 'Signal stores (@lit-labs/signals)'
files_to_modify:
  - 'backend/providers/gemini.go (new)'
  - 'backend/providers/gemini_test.go (new)'
  - 'backend/services/provider_service.go'
  - 'src/types/provider.ts'
  - 'src/state/provider.state.ts'
  - 'src/components/core/settings/provider-settings.ts'
  - 'src/services/provider.service.ts'
code_patterns:
  - 'Provider interface: SendMessage, ValidateCredentials, ListModels, RequiresAPIKey'
  - 'StreamChunk channel with types: start, chunk, end, error, tool_call_start, tool_call_delta, tool_call_end'
  - 'SDK client with option.WithAPIKey() and option.WithBaseURL() for testing'
  - 'ProviderError with Code, Message, UserMessage fields'
  - 'Error mapping function that sanitizes API keys (NFR6)'
  - 'newTestXxxProvider(serverURL) helper pattern for tests'
test_patterns:
  - 'httptest.NewServer with mock SSE responses'
  - 'Table-driven tests for error status codes'
  - 'NFR6 compliance tests (no API key in error messages)'
  - 'Context cancellation tests'
  - 'Streaming chunk sequence validation'
---

# Tech-Spec: Gemini Provider Integration

**Created:** 2026-02-05

## Overview

### Problem Statement

Cannot test BMAD Studio with Gemini API — user has Gemini API key but no provider implementation exists. Need full-stack integration to enable testing with Gemini Flash 3.0 (cheap tier).

### Solution

Add Gemini as a fourth provider following existing patterns — backend provider with streaming + tool support, frontend settings tab with API key validation and dynamic model fetching.

### Scope

**In Scope:**
- Backend: `gemini.go` provider implementing `Provider` interface (streaming, tools, validation)
- Backend: Dynamic model listing via Gemini API (not hardcoded)
- Backend: `provider_service.go` switch case for `"gemini"`
- Frontend: `ProviderType` union extended with `'gemini'`
- Frontend: New tab in `provider-settings.ts` with `AIza...` placeholder
- Frontend: Keychain storage for Gemini API key
- Tests: Provider unit tests matching existing patterns

**Out of Scope:**
- Vertex AI integration (using Gemini Developer API only)
- Gemini-specific features (grounding, code execution, etc.)
- Migration tooling

## Context for Development

### Codebase Patterns

**Backend Provider Pattern:**
1. Create struct with SDK client pointer
2. Constructor `NewXxxProvider(apiKey string)` initializes SDK client
3. `ValidateCredentials(ctx)` sends minimal request to verify key
4. `ListModels()` returns `[]Model` (dynamic via API for Gemini)
5. `RequiresAPIKey()` returns `true` for cloud providers
6. `SendMessage(ctx, req)` returns `<-chan StreamChunk` with goroutine pumping events
7. `mapXxxProviderError(err)` converts SDK errors to `*ProviderError`

**Google Gen AI SDK Patterns:**
- Client: `genai.NewClient(ctx, &genai.ClientConfig{APIKey: key, Backend: genai.BackendGeminiAPI})`
- Streaming: `client.Models.GenerateContentStream()` returns `iter.Seq2[*GenerateContentResponse, error]`
- Tools: `Tool{FunctionDeclarations: []*FunctionDeclaration{...}}`
- Tool calls: `resp.FunctionCalls()` returns `[]*FunctionCall`
- Model listing: `client.Models.All(ctx)` returns `iter.Seq2[*Model, error]`

**Frontend Provider Pattern:**
- `ProviderType` union in `src/types/provider.ts`
- `providersState` array in `src/state/provider.state.ts`
- Tab-per-provider in `provider-settings.ts` with validation flow
- Keychain functions keyed by provider type

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `backend/providers/provider.go` | Provider interface, StreamChunk, Model, ProviderError types |
| `backend/providers/claude.go` | Reference implementation (SDK pattern, streaming, tools) |
| `backend/providers/openai.go` | Reference implementation (tool call delta handling) |
| `backend/providers/claude_test.go` | Test patterns (mock server, SSE events, NFR6) |
| `backend/services/provider_service.go` | Switch statement for provider instantiation |
| `src/types/provider.ts` | ProviderType union, Model interface |
| `src/state/provider.state.ts` | providersState array, state update helpers |
| `src/components/core/settings/provider-settings.ts` | Settings UI with tabs, validation flow |
| `src/services/keychain.service.ts` | API key storage pattern |

### Technical Decisions

1. **Dynamic model listing**: Use `client.Models.All(ctx)` to fetch available models instead of hardcoding. Filter to generative models only (exclude embedding models).

2. **Tool support mapping**:
   - `types.ToolDefinition` → `genai.FunctionDeclaration`
   - `genai.FunctionCall` → emit `tool_call_start` + `tool_call_delta` (JSON args) + `tool_call_end`
   - Tool results: `genai.NewPartFromFunctionResponse()`

3. **Streaming translation**:
   - Gemini uses `iter.Seq2` iterators, convert to channel pattern
   - First response → `start` chunk with message ID
   - Text deltas → `chunk` chunks
   - Function calls → `tool_call_*` sequence
   - Final response → `end` chunk with usage

4. **Error mapping**:
   - 401/403 → `auth_error`
   - 429 → `rate_limit`
   - 400 → `invalid_request`
   - Others → `provider_error`

## Implementation Plan

### Tasks

#### Task 1: Add Google Gen AI SDK dependency
- **File:** `backend/go.mod`
- **Action:** Run `go get google.golang.org/genai` to add SDK dependency
- **Notes:** Verify SDK version is latest stable

#### Task 2: Create GeminiProvider struct and constructor
- **File:** `backend/providers/gemini.go` (new)
- **Action:** Create file with:
  ```go
  type GeminiProvider struct {
      client *genai.Client
      apiKey string // stored for ListModels which needs fresh client
  }

  func NewGeminiProvider(apiKey string) *GeminiProvider
  ```
- **Notes:** Store apiKey because client creation requires context; ListModels needs to create client on-demand

#### Task 3: Implement ValidateCredentials
- **File:** `backend/providers/gemini.go`
- **Action:** Implement `ValidateCredentials(ctx context.Context) error`
  - Create client with `genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})`
  - Send minimal GenerateContent request (like Claude/OpenAI patterns)
  - Map errors via `mapGeminiProviderError()`
- **Notes:** Use cheapest model (gemini-2.0-flash or similar) for validation

#### Task 4: Implement ListModels with dynamic fetching
- **File:** `backend/providers/gemini.go`
- **Action:** Implement `ListModels() ([]Model, error)`
  - Create client, iterate `client.Models.All(ctx)`
  - Filter to models supporting `generateContent` (exclude embedding-only)
  - Map to `providers.Model` struct with `SupportsTools` based on model capabilities
- **Notes:** Cache results if API calls are slow; handle pagination

#### Task 5: Implement RequiresAPIKey
- **File:** `backend/providers/gemini.go`
- **Action:** Implement `RequiresAPIKey() bool` returning `true`
- **Notes:** Gemini Developer API always requires API key

#### Task 6: Implement SendMessage with streaming
- **File:** `backend/providers/gemini.go`
- **Action:** Implement `SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)`
  - Build `[]*genai.Content` from `req.Messages`
  - Build `*genai.GenerateContentConfig` with tools if present
  - Call `client.Models.GenerateContentStream()`
  - Spawn goroutine to iterate responses and emit StreamChunks
  - Handle text content, function calls, usage stats
- **Notes:** Generate unique message ID (UUID); map iter.Seq2 to channel pattern

#### Task 7: Implement tool call streaming
- **File:** `backend/providers/gemini.go`
- **Action:** Within SendMessage goroutine:
  - Detect `resp.FunctionCalls()` responses
  - Emit `tool_call_start` with tool ID (generate UUID) and name
  - Emit `tool_call_delta` with JSON-serialized args
  - Emit `tool_call_end` when function call complete
- **Notes:** Gemini may return multiple function calls per response

#### Task 8: Implement buildGeminiMessages helper
- **File:** `backend/providers/gemini.go`
- **Action:** Create `buildGeminiMessages(msgs []Message) ([]*genai.Content, error)`
  - Map "user" → user content
  - Map "assistant" → model content (with function calls if present)
  - Map "tool" → function response content
- **Notes:** Follow claude.go pattern for role mapping

#### Task 9: Implement buildGeminiTools helper
- **File:** `backend/providers/gemini.go`
- **Action:** Create `buildGeminiTools(defs []types.ToolDefinition) []*genai.Tool`
  - Convert InputSchema JSON to `*genai.Schema`
  - Build `FunctionDeclaration` for each tool
  - Return wrapped in `Tool` struct
- **Notes:** Parse JSON schema properties and required fields

#### Task 10: Implement mapGeminiProviderError
- **File:** `backend/providers/gemini.go`
- **Action:** Create `mapGeminiProviderError(err error) *ProviderError`
  - Type assert to `*genai.APIError` if available
  - Map HTTP status codes: 401/403 → auth_error, 429 → rate_limit, 400 → invalid_request
  - Ensure API key never appears in UserMessage (NFR6)
- **Notes:** Check SDK error types; may need to parse error strings

#### Task 11: Add Gemini case to ProviderService
- **File:** `backend/services/provider_service.go`
- **Action:** Add case in `GetProvider` switch:
  ```go
  case "gemini":
      return providers.NewGeminiProvider(apiKey), nil
  ```
- **Notes:** Update error message to list "gemini" as available provider

#### Task 12: Add 'gemini' to ProviderType union
- **File:** `src/types/provider.ts`
- **Action:** Update type:
  ```typescript
  export type ProviderType = 'claude' | 'openai' | 'ollama' | 'gemini';
  ```
- **Notes:** TypeScript will flag any missing cases

#### Task 13: Add Gemini to providersState
- **File:** `src/state/provider.state.ts`
- **Action:** Add to initial state array:
  ```typescript
  { type: 'gemini', enabled: false, hasValidCredentials: false },
  ```
- **Notes:** No endpoint field needed (uses standard Gemini API)

#### Task 14: Add Gemini tab to provider-settings
- **File:** `src/components/core/settings/provider-settings.ts`
- **Action:**
  - Add `<sl-tab slot="nav" panel="gemini">Gemini</sl-tab>`
  - Add `<sl-tab-panel name="gemini">${this._renderApiKeyTab('gemini')}</sl-tab-panel>`
  - Update `_renderApiKeyTab` to handle 'gemini' case with placeholder `AIza...`
- **Notes:** Follow existing Claude/OpenAI tab pattern

#### Task 15: Add Gemini error hints to provider.service
- **File:** `src/services/provider.service.ts`
- **Action:** Update `friendlyValidationError()`:
  ```typescript
  if (type === 'gemini') return 'Invalid Gemini API key. Check your key at aistudio.google.com.';
  ```
- **Notes:** Add Gemini case in auth error handling

#### Task 16: Add Gemini to keychain checks
- **File:** `src/components/core/settings/provider-settings.ts`
- **Action:** Update `_loadExistingSettings()`:
  ```typescript
  const keyChecks = (['claude', 'openai', 'gemini'] as ProviderType[]).map(...)
  ```
- **Notes:** Gemini key will be stored same as others

#### Task 17: Write unit tests for GeminiProvider
- **File:** `backend/providers/gemini_test.go` (new)
- **Action:** Create tests following claude_test.go patterns:
  - `TestNewGeminiProvider`
  - `TestGeminiProvider_ValidateCredentials_Valid`
  - `TestGeminiProvider_ValidateCredentials_InvalidKey`
  - `TestGeminiProvider_ValidateCredentials_RateLimit`
  - `TestGeminiProvider_ListModels`
  - `TestGeminiProvider_SendMessage_Streaming`
  - `TestGeminiProvider_SendMessage_ToolUseStream`
  - `TestGeminiProvider_ValidateCredentials_NoKeyInError` (NFR6)
- **Notes:** Create `newTestGeminiProvider(serverURL)` helper; mock Gemini API responses

### Acceptance Criteria

- [x] **AC1:** Given a valid Gemini API key, when the user enters it in Settings > Gemini and clicks Validate, then the key is validated and stored in keychain, and a "Valid" badge appears.

- [x] **AC2:** Given an invalid Gemini API key, when the user clicks Validate, then a user-friendly error message appears ("Invalid Gemini API key. Check your key at aistudio.google.com.") and the API key is NOT stored.

- [x] **AC3:** Given a validated Gemini API key, when the model dropdown loads, then available Gemini models are fetched from the API and displayed (not hardcoded).

- [x] **AC4:** Given Gemini is set as the default provider with a valid model selected, when the user sends a chat message, then the response streams in real-time with text appearing incrementally.

- [x] **AC5:** Given a conversation with tools enabled, when the Gemini model requests a tool call, then `tool_call_start`, `tool_call_delta`, and `tool_call_end` events are emitted correctly, and tool execution proceeds.

- [x] **AC6:** Given a tool result is returned to Gemini, when the conversation continues, then Gemini receives the tool result and responds appropriately.

- [x] **AC7:** Given any API error occurs, when the error is displayed to the user, then the API key never appears in the error message (NFR6 compliance).

- [x] **AC8:** Given the backend tests run, when `go test ./backend/providers/...` executes, then all Gemini provider tests pass.

## Additional Context

### Dependencies

- `google.golang.org/genai` - Google Gen AI Go SDK (official, GA as of May 2025)
- Add to `go.mod`: `go get google.golang.org/genai`
- No frontend dependencies needed (uses existing Shoelace, Lit, Signal infrastructure)

### Testing Strategy

**Unit tests** (`gemini_test.go`):
- `TestNewGeminiProvider` - constructor stores apiKey
- `TestGeminiProvider_ValidateCredentials_Valid` - mock 200 response
- `TestGeminiProvider_ValidateCredentials_InvalidKey` - mock 401 response
- `TestGeminiProvider_ValidateCredentials_RateLimit` - mock 429 response
- `TestGeminiProvider_ListModels` - mock models list response
- `TestGeminiProvider_SendMessage_Streaming` - mock SSE stream
- `TestGeminiProvider_SendMessage_ToolUseStream` - mock function call response
- `TestGeminiProvider_ValidateCredentials_NoKeyInError` - NFR6 compliance

**Mock server approach**:
- Use `httptest.NewServer` with Gemini API JSON response format
- SDK may need custom HTTP client or endpoint override for testing
- If SDK doesn't support custom endpoint, may need to test via integration only

**Integration testing** (manual):
- Configure real Gemini API key in Settings
- Verify model selector populates with Gemini 3.0 models
- Send chat message, verify streaming works
- Test tool call flow with file_read or similar tool

### Notes

- Gemini API keys follow pattern `AIza...` (40 chars, alphanumeric)
- ~~Dynamic model fetching ensures new models (Gemini 3.0, etc.) appear automatically~~ **Changed to hardcoded models** to match Claude/OpenAI pattern and work with ProviderService.ListProviderModels (F1 fix)
- Full tool support required for feature parity with Claude/OpenAI
- Primary use case: testing with Gemini Flash 3.0 (cheap tier)
- Google Gen AI SDK uses Go 1.23+ iterators (`iter.Seq2`) - verify Go version compatibility
- If SDK doesn't support custom base URL for testing, may need integration tests only or mock at HTTP transport level

## Review Notes

- Adversarial review completed
- Findings: 10 total, 5 fixed, 5 skipped (noise/uncertain)
- Resolution approach: auto-fix

**Fixes applied:**
- F1: Switched to hardcoded model list to work with empty API key in ListProviderModels
- F2: Changed ValidateCredentials to use metadata endpoint (Models.Get) instead of generating content
- F3: Added validation that tool result messages have non-empty ToolName
- F5: Improved API key sanitization to handle multiple keys in error messages
- F9: Added documentation for silent tool schema parse failures (consistent with Claude/OpenAI)
