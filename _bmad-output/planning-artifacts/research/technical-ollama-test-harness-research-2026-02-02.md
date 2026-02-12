---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: 'Ollama integration test setup for streaming tests'
research_goals: 'Set up a working test harness using Ollama for real end-to-end streaming tests locally without API costs. Document the setup, model selection, and Go integration approach.'
user_name: 'Flow'
date: '2026-02-02'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical — Ollama Integration Test Setup for Streaming Tests

**Date:** 2026-02-02
**Author:** Flow
**Research Type:** Technical

---

## Research Overview

This research establishes a test harness using Ollama for end-to-end streaming tests in bmad-studio's Epic 3 (Agent Conversation Experience). The goal: run real LLM streaming tests locally with zero API costs, enabling confident development of the WebSocket streaming pipeline.

**Methodology:** Web research verified against official Ollama documentation, Go SDK source code, and CI/CD community patterns.

---

## Technical Research Scope Confirmation

**Research Topic:** Ollama integration test setup for streaming tests
**Research Goals:** Set up a working test harness using Ollama for real end-to-end streaming tests locally without API costs.

**Scope Confirmed:** 2026-02-02

---

## What is Ollama?

Ollama is an open-source tool for running LLMs locally. It wraps llama.cpp with a user-friendly CLI and REST API, supporting models like Llama 3.2, Mistral, Qwen, Gemma, Phi-3, and many others.

**Key characteristics for testing:**
- **Free** — No API costs, unlimited usage
- **Local** — No internet required after model download
- **API-first** — REST API at `http://localhost:11434` with streaming support
- **Multi-format** — OpenAI-compatible API AND Anthropic Messages API compatibility (v0.14.0+)
- **Lightweight** — Smallest models run on 4GB RAM

_Confidence: High — official Ollama documentation_
_Sources: [Ollama GitHub](https://github.com/ollama/ollama), [Ollama Complete Guide (Collabnix)](https://collabnix.com/ollama-the-complete-guide-to-running-large-language-models-locally-in-2025/)_

---

## Model Selection for Testing

### Recommended Models (Smallest to Largest)

| Model | Size | RAM | Speed | Best For |
|---|---|---|---|---|
| **`qwen2.5:0.5b`** | 0.5B params | ~4 GB | Very fast | Smoke tests, CI pipelines |
| **`tinyllama`** | 1.1B params | ~4 GB | ~62 tok/s | Integration tests, fast iteration |
| **`gemma:2b`** | 2B params | ~4 GB | Fast (Flash Attention) | Better quality output |
| **`phi3:mini`** | 3.8B params | ~4-8 GB | ~18-20 tok/s | Best quality-to-size ratio |
| **`qwen3-coder`** | 7B+ | ~8-16 GB | Moderate | Coding-specific tests |

### Recommendation for bmad-studio

**Primary test model: `tinyllama`** — Best balance of speed (62 tok/s), small size (1.1B), and low resource needs (4GB RAM). Fast enough for rapid iteration during development.

**CI model: `qwen2.5:0.5b`** — Smallest available, loads fastest, minimal resource footprint for automated pipelines.

**Quality test model: `phi3:mini`** — When you need more coherent output to test rendering, markdown formatting, or longer responses.

```bash
# Pull test models
ollama pull tinyllama
ollama pull qwen2.5:0.5b
ollama pull phi3:mini
```

_Confidence: High — benchmarks verified across multiple sources_
_Sources: [Ollama Models List (Skywork)](https://skywork.ai/blog/llm/ollama-models-list-2025-100-models-compared/), [Choosing Ollama Models (Collabnix)](https://collabnix.com/choosing-ollama-models-the-complete-2025-guide-for-developers-and-enterprises/), [Best Models for 8GB RAM](https://localaimaster.com/blog/best-local-ai-models-8gb-ram)_

---

## Ollama API: Two Compatible Interfaces

### Native Ollama API

Ollama's native REST API uses NDJSON (Newline Delimited JSON) streaming:

**Endpoint:** `POST http://localhost:11434/api/chat`

```json
{
  "model": "tinyllama",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true
}
```

**Streaming response** (one JSON object per line):
```json
{"model":"tinyllama","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"tinyllama","message":{"role":"assistant","content":"!"},"done":false}
{"model":"tinyllama","message":{"role":"assistant","content":""},"done":true,"total_duration":123456}
```

### Anthropic Messages API Compatibility (v0.14.0+)

Ollama now supports the Anthropic Messages API format, enabling direct compatibility with Claude-targeting code:

**Endpoint:** `POST http://localhost:11434/v1/messages`

```bash
ANTHROPIC_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=ollama  # required but ignored
```

**Known issue (Jan 2026):** The `/v1/messages/count_tokens` endpoint is not supported and causes Ollama to become unresponsive (GitHub issue #13949). Avoid calling this endpoint in tests.

### OpenAI-Compatible API

**Endpoint:** `POST http://localhost:11434/v1/chat/completions`

Uses the standard OpenAI chat format. Useful if bmad-studio adds OpenAI provider support later.

_Confidence: High — official Ollama documentation_
_Sources: [Ollama Anthropic Compatibility](https://docs.ollama.com/api/anthropic-compatibility), [Ollama Blog - Claude Code](https://ollama.com/blog/claude), [Ollama Streaming Docs](https://docs.ollama.com/capabilities/streaming), [GitHub Issue #13949](https://github.com/ollama/ollama/issues/13949)_

---

## Go Integration

### Official Go Client (`github.com/ollama/ollama/api`)

The official Go package is maintained alongside Ollama itself. The Ollama CLI uses this package internally, making it the most reliable option.

```go
import "github.com/ollama/ollama/api"

// Create client (reads OLLAMA_HOST, defaults to localhost:11434)
client, err := api.ClientFromEnvironment()

// Streaming chat
req := &api.ChatRequest{
    Model:  "tinyllama",
    Messages: []api.Message{
        {Role: "user", Content: "Hello"},
    },
    Stream: new(bool), // set to true for streaming
}
*req.Stream = true

err = client.Chat(ctx, req, func(resp api.ChatResponse) error {
    // Called for each streaming chunk
    fmt.Print(resp.Message.Content)
    if resp.Done {
        fmt.Printf("\nTokens: %d\n", resp.EvalCount)
    }
    return nil
})
```

**Key API methods:**
- `client.Chat(ctx, req, streamFunc)` — Streaming chat with callback
- `client.Generate(ctx, req, streamFunc)` — Single-turn generation
- `client.List(ctx)` — List available models
- `client.Pull(ctx, req, progressFunc)` — Pull a model
- `client.Show(ctx, req)` — Model info

### Alternative: Anthropic SDK Against Ollama

Since Ollama supports the Anthropic Messages API, you can also use the official `anthropic-sdk-go` pointed at Ollama:

```go
// Set ANTHROPIC_BASE_URL=http://localhost:11434
// Set ANTHROPIC_API_KEY=ollama
client := anthropic.NewClient()
// Use exactly the same streaming code as for real Claude API
```

This means **the same provider code that talks to Claude can be tested against Ollama** with just an environment variable change. This is the strongest argument for the provider abstraction recommended in Spike 1.

_Confidence: High — official Go package verified_
_Sources: [Ollama Go client source](https://github.com/ollama/ollama/blob/main/api/client.go), [Ollama SDKs in Go (DEV)](https://dev.to/rosgluk/ollama-sdks-in-go-overview-and-code-examples-42n3), [Go Clients Comparison (glukhov.org)](https://www.glukhov.org/post/2025/10/using-ollama-in-go/)_

---

## Test Harness Design

### Two-Layer Testing Strategy

#### Layer 1: Mock Server Tests (Fast, No Ollama Required)

Use Go's `httptest.NewServer` to simulate Ollama's NDJSON streaming response. This is how Ollama's own codebase tests its client.

```go
func TestStreamingPipeline(t *testing.T) {
    // Mock Ollama server that streams NDJSON
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        flusher, ok := w.(http.Flusher)
        require.True(t, ok)

        w.Header().Set("Content-Type", "application/x-ndjson")

        responses := []api.ChatResponse{
            {Message: api.Message{Content: "Hello"}, Done: false},
            {Message: api.Message{Content: " world"}, Done: false},
            {Message: api.Message{Content: ""}, Done: true},
        }

        for _, resp := range responses {
            json.NewEncoder(w).Encode(resp)
            flusher.Flush()
        }
    }))
    defer ts.Close()

    // Test your streaming pipeline against the mock
    // ...
}
```

**When to use:** Unit tests, CI without GPU, fast feedback loop. Tests the pipeline logic without a real LLM.

#### Layer 2: Real Ollama Integration Tests (Slow, Requires Ollama)

Run actual Ollama with a small model for end-to-end streaming verification.

```go
//go:build integration

func TestRealOllamaStreaming(t *testing.T) {
    // Skip if Ollama isn't running
    client, err := api.ClientFromEnvironment()
    if err != nil {
        t.Skip("Ollama not available")
    }

    // Verify model is available
    models, err := client.List(context.Background())
    if err != nil || !hasModel(models, "tinyllama") {
        t.Skip("tinyllama model not pulled")
    }

    // Real streaming test
    var chunks []string
    req := &api.ChatRequest{
        Model:    "tinyllama",
        Messages: []api.Message{{Role: "user", Content: "Say hello in one word"}},
        Stream:   boolPtr(true),
    }

    err = client.Chat(context.Background(), req, func(resp api.ChatResponse) error {
        chunks = append(chunks, resp.Message.Content)
        return nil
    })

    require.NoError(t, err)
    require.True(t, len(chunks) > 0, "expected streaming chunks")
}
```

**When to use:** Local development, pre-merge validation, manual testing.

### Build Tags for Test Separation

```
tests/
├── backend/
│   ├── streaming_test.go          ← mock server tests (always run)
│   ├── ollama_integration_test.go ← real Ollama tests (build tag: integration)
│   └── testutil/
│       └── mock_llm.go            ← shared mock NDJSON server
```

Run mock tests (fast, CI):
```bash
go test ./...
```

Run integration tests (requires Ollama):
```bash
go test -tags=integration ./...
```

_Confidence: High — patterns from Ollama's own test suite_
_Sources: [Ollama client_test.go](https://github.com/ollama/ollama/blob/main/api/client_test.go), [Mokksy AI-Mocks Ollama](https://mokksy.dev/docs/ai-mocks/ollama/), [GitHub Issue #4196 - Mock Model](https://github.com/ollama/ollama/issues/4196)_

---

## CI/CD Integration

### GitHub Actions with Ollama

```yaml
# .github/workflows/test-streaming.yml
name: Streaming Integration Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go test ./...  # Mock tests only (no Ollama needed)

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - uses: ai-action/ollama-action@v1
        with:
          model: tinyllama
      - run: go test -tags=integration ./...
```

**Key considerations:**
- The `ai-action/ollama-action` GitHub Action handles installing Ollama and pulling the model
- Standard GitHub Actions runners have ~7GB RAM — sufficient for TinyLlama (1.1B)
- No GPU needed for small models — CPU inference is fast enough for integration tests
- For GPU-accelerated testing, use self-hosted runners with NVIDIA Container Toolkit

### Docker Approach (Alternative)

```bash
# Start Ollama in Docker
docker run -d --name ollama -p 11434:11434 ollama/ollama

# Pull test model
docker exec ollama ollama pull tinyllama

# Run tests
OLLAMA_HOST=http://localhost:11434 go test -tags=integration ./...
```

_Confidence: High — multiple verified CI patterns_
_Sources: [ai-action/ollama-action](https://github.com/ai-action/ollama-action), [CI for AI (Collabnix)](https://collabnix.com/ci-for-ai-running-ollama-llms-in-github-actions-with-open-source-tools/), [Running Ollama in GitHub Actions (Ema Suriano)](https://emasuriano.com/blog/2025-03-27-running-ollama-in-github-actions---automating-llm-workflows/), [LLM in CI Pipeline (DevOps Jeremy)](https://devopsjeremy.github.io/blog/2025/02/05/running-an-llm-in-a-ci-pipeline/)_

---

## Ollama as a Provider in bmad-studio

### Provider Interface Implementation

Ollama fits naturally into the provider abstraction from Spike 1:

```
OllamaProvider implements Provider
├── StreamChat(ctx, messages, options) → chan StreamEvent
│   Uses: api.ClientFromEnvironment() + client.Chat()
│   Translates: api.ChatResponse → StreamEvent
├── ListModels() → []Model
│   Uses: client.List()
└── ValidateConfig() → error
    Checks: Ollama running + model available
```

### Configuration in BMadConfigService

```yaml
# _bmad/bmm/config.yaml (or user settings)
providers:
  ollama:
    base_url: http://localhost:11434
    default_model: tinyllama
    # No API key needed
```

### Switching Between Claude and Ollama

The key architectural benefit: **same WebSocket streaming pipeline, different provider**. The ChatService doesn't care whether chunks come from Claude (via SSE) or Ollama (via NDJSON) — it translates both into `StreamEvent` and sends `chat:text-delta` WebSocket events.

```
                                  ┌── ClaudeProvider (SSE) ──► Claude API
ChatService → Provider interface ─┤
                                  └── OllamaProvider (NDJSON) ──► Ollama localhost
```

_Confidence: High — direct application of Spike 1 architecture_

---

## Local Development Setup Guide

### Quick Start (macOS)

```bash
# 1. Install Ollama
brew install ollama

# 2. Start Ollama server (runs in background)
ollama serve

# 3. Pull test model
ollama pull tinyllama

# 4. Verify it works
ollama run tinyllama "Hello, world"

# 5. Test API endpoint
curl http://localhost:11434/api/chat -d '{
  "model": "tinyllama",
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": true
}'
```

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | API server address |
| `OLLAMA_MODELS` | `~/.ollama/models` | Model storage path |
| `OLLAMA_KEEP_ALIVE` | `5m` | Model stays in memory after last request |
| `OLLAMA_DEBUG` | `0` | Enable debug logging |

### Keeping Model Loaded for Fast Tests

Set `OLLAMA_KEEP_ALIVE=-1` to keep the model in memory indefinitely during development. This eliminates model load time between test runs.

_Confidence: High — standard Ollama setup_
_Sources: [Ollama Docs](https://github.com/ollama/ollama), [Running LLMs Locally (Paradigma)](https://en.paradigmadigital.com/dev/running-llms-locally-getting-started-ollama/)_

---

## Recommendations Summary

| Decision | Recommendation | Rationale |
|---|---|---|
| **Test model** | `tinyllama` (dev), `qwen2.5:0.5b` (CI) | Fast, small, sufficient for streaming tests |
| **Go client** | Official `github.com/ollama/ollama/api` | Maintained with Ollama; callback-based streaming |
| **Test layers** | Mock NDJSON server + real Ollama (build tag) | Fast CI + real validation |
| **CI approach** | `ai-action/ollama-action` in GitHub Actions | Handles install + pull; no GPU needed for small models |
| **Provider integration** | Implement as `OllamaProvider` behind the provider interface | Same pipeline as Claude; swap via config |
| **Anthropic compat** | Use for testing Claude provider code against Ollama | Zero-cost end-to-end test of Claude streaming path |

### Success Criteria (from Epic 2 Retro)

- [x] Can run real end-to-end streaming test locally without API costs
- [x] Working test harness documented
- [x] Model selection and resource requirements documented
- [x] Go integration approach defined
- [x] CI/CD integration path identified
