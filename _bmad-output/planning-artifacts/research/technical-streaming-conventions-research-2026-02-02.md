---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Streaming conventions for AI chat in desktop apps'
research_goals: 'Determine chat WebSocket approach for Epic 3 — same connection vs separate, chunk protocol, session scoping. Evaluate Automaker.app, T3Chat, and similar projects.'
user_name: 'Flow'
date: '2026-02-02'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical — Streaming Conventions for AI Chat in Desktop Apps

**Date:** 2026-02-02
**Author:** Flow
**Research Type:** Technical

---

## Research Overview

This technical research investigates streaming conventions for AI chat in desktop applications, specifically to inform Epic 3 (Agent Conversation Experience) of the bmad-studio project. The research evaluates reference projects (Automaker.app, T3Chat, Vercel AI SDK), analyzes the Claude API streaming protocol, assesses bmad-studio's existing WebSocket infrastructure, and produces architectural recommendations for the chat streaming pipeline.

**Methodology:** Web research with rigorous source verification across 40+ sources. Multi-source validation for critical claims. All recommendations verified against current (2025-2026) industry practice.

---

## Technical Research Scope Confirmation

**Research Topic:** Streaming conventions for AI chat in desktop apps
**Research Goals:** Determine chat WebSocket approach for Epic 3 — same connection vs separate, chunk protocol, session scoping. Evaluate Automaker.app, T3Chat, and similar projects.

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-02-02

## Technology Stack Analysis

### Reference Project Architectures

#### Automaker.app

Automaker is a monorepo (React + Vite + Electron frontend, Express + WebSocket backend) that uses the Claude Agent SDK for autonomous code generation. Key streaming decisions:

- **Protocol: WebSocket (not SSE)** — Bidirectional communication required because agents have full file system access, command execution, and need real-time control (stop/steer mid-execution)
- **Architecture:** Express server manages WebSocket connections; frontend monitors agent output in real-time on a Kanban board
- **Session Scoping:** Per-feature git worktrees provide isolation; each agent execution is scoped to a feature card
- **Why WebSocket:** The agentic use case demands server→client streaming AND client→server control signals (cancel, confirm tool calls)

_Confidence: High — verified from GitHub repo structure and README_
_Source: [GitHub - AutoMaker-Org/automaker](https://github.com/AutoMaker-Org/automaker)_

#### T3Chat (t3.chat)

T3Chat by Theo Browne is a multi-model AI chat platform (Claude, OpenAI, DeepSeek, Gemini) with a local-first architecture. Key findings:

- **Architecture:** Local-first with IndexedDB for client-side storage; uses Dexy for data handling
- **Multi-Model:** Users switch between LLM providers seamlessly in one interface
- **Not open-source** — internal streaming architecture undocumented publicly
- **Open-source clones exist:** [thom-chat](https://github.com/TGlide/thom-chat) (Convex-based) and [Praashh/t3.chat](https://github.com/Praashh/t3.chat) provide reference implementations
- **Inference from architecture:** Local-first approach suggests the client manages conversation state and issues streaming requests per-message rather than maintaining a persistent connection for chat state

_Confidence: Medium — product-level details confirmed; internal streaming protocol inferred from architecture_
_Sources: [T3 Chat - YC](https://www.ycombinator.com/companies/t3-chat), [How I Built T3 Chat in 5 Days](https://verved.ai/blog/how-i-built-t3-chat-in-5-days), [thom-chat](https://github.com/TGlide/thom-chat)_

#### Vercel AI SDK (Industry Standard Reference)

The Vercel AI SDK (v5/v6, 2025) has become the de facto standard for AI chat streaming in the JavaScript ecosystem:

- **Protocol: SSE-based** with header `x-vercel-ai-ui-message-stream: v1`
- **Chunk Protocol:** Typed start/delta/end pattern with unique IDs per content block:
  - `text-start` / `text-delta` / `text-end` — text content streaming
  - `reasoning-start` / `reasoning-delta` / `reasoning-end` — thinking/reasoning blocks
  - `tool-input-start` / `tool-input-delta` / `tool-input-available` — tool call parameters
  - `tool-output-available` — tool execution results
  - `start-step` / `finish-step` — LLM API call boundaries
  - `source-url` / `source-document` — citation references
  - `error` — error messages
- **Typed Messages:** `UIMessage` vs `ModelMessage` separation for persistence and type safety
- **Framework Support:** React, Vue, Svelte; framework-agnostic `AbstractChat` class
- **Key Innovation:** Decoupled state model integrates with external stores (Zustand, Redux)
- **Streamdown:** Open-source Markdown renderer purpose-built for AI streaming output

_Confidence: High — official documentation verified_
_Sources: [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol), [AI SDK 6 Announcement](https://vercel.com/blog/ai-sdk-6), [Vercel Chat SDK](https://vercel.com/blog/introducing-chat-sdk), [Streamdown](https://vercel.com/changelog/introducing-streamdown)_

#### Claude API (Anthropic) — Native Streaming Format

The Claude Messages API uses SSE with a structured event hierarchy:

- **Event Flow:**
  ```
  message_start
  ├── content_block_start (index 0)
  │   ├── content_block_delta (text_delta / thinking_delta)
  │   └── content_block_stop
  ├── content_block_start (index 1)
  │   ├── content_block_delta
  │   └── content_block_stop
  ├── message_delta (usage stats)
  └── message_stop
  ```
- **Content Types:** text, tool_use (partial JSON deltas), thinking (with signature verification)
- **Fine-Grained Tool Streaming:** Beta feature (2025-05) streams tool parameters without buffering
- **Health:** `ping` events for keep-alive; `overloaded_error` for backpressure
- **Key for bmad-studio:** The Go backend must parse this SSE format from the Claude API and relay it to the frontend — either as raw SSE passthrough or translated into a bmad-studio internal protocol

_Confidence: High — official Anthropic documentation_
_Sources: [Claude API Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)_

### Streaming Protocol Comparison

| Dimension | SSE | WebSocket | HTTP Streaming (fetch + ReadableStream) |
|---|---|---|---|
| **Direction** | Server → Client only | Bidirectional | Server → Client only |
| **Transport** | HTTP/1.1+ (upgrades well with HTTP/2) | Dedicated TCP connection via upgrade | Standard HTTP request |
| **Browser API** | `EventSource` (auto-reconnect built-in) | `WebSocket` | `fetch()` + `ReadableStream` |
| **Custom Headers** | Not supported by EventSource | Via initial handshake | Full HTTP header support |
| **POST Bodies** | Not supported by EventSource | Via messages after connect | Full HTTP body support |
| **Proxy Compatibility** | Excellent (standard HTTP) | Problematic (upgrade handshake blocked by many proxies) | Excellent |
| **Auto-Reconnect** | Built-in browser behavior | Manual implementation required | Manual implementation required |
| **Memory (per connection)** | ~70 KiB | ~70 KiB (but persistent) | Request-scoped only |
| **Best For** | Token-by-token LLM output, simple chat | Agent control, multi-tab sync, binary data | Custom headers, POST-based streaming |

_Sources: [SSE's Comeback (portalZINE)](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/), [SSE vs WebSockets for AI Chat (sniki.dev)](https://www.sniki.dev/posts/sse-vs-websockets-for-ai-chat/), [Streaming AI Responses Comparison (Medium)](https://medium.com/@pranavprakash4777/streaming-ai-responses-with-websockets-sse-and-grpc-which-one-wins-a481cab403d3)_

### Tauri-Specific Considerations

bmad-studio is a Tauri 2.0 desktop app (Rust backend + web frontend). Tauri offers three streaming mechanisms:

1. **Tauri Channels API** — Fast, ordered data delivery from Rust to frontend. Used internally for download progress, child process output, and WebSocket messages. Primary recommended mechanism for streaming.
2. **Official WebSocket Plugin** (`@tauri-apps/plugin-websocket`) — Rust-backed WebSocket client exposed to JavaScript. Requires explicit capability permissions.
3. **Tauri Events** — Event-based communication between Rust and frontend. NextChat (Tauri-based AI chat) uses this pattern: Tauri events for chunk delivery + TransformStream for frontend stream handling.

**Key Insight:** In Tauri desktop apps, the "server" is the Rust backend running locally. The WebSocket connection is localhost-only (`ws://localhost:PORT/ws`), eliminating proxy/firewall concerns that favor SSE in web deployments. This removes one of SSE's key advantages over WebSocket.

_Confidence: High — official Tauri documentation_
_Sources: [Tauri WebSocket Plugin](https://v2.tauri.app/plugin/websocket/), [Tauri Calling Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/), [NextChat Desktop (DeepWiki)](https://deepwiki.com/ChatGPTNextWeb/NextChat/6-desktop-application)_

### Industry Trends (2025–2026)

**SSE Resurgence for Web AI Chat:**
- OpenAI's streaming API built on SSE principles, legitimizing SSE for AI chat
- HTTP/2 multiplexing eliminated the old "6 connection limit" argument against SSE
- Simpler infrastructure: no protocol upgrade, works through all proxies, auto-reconnect
- Security benefit: no persistent open sockets, fewer attack vectors

**WebSocket for Agentic / Complex Use Cases:**
- Liveblocks moved AI agents from HTTP to WebSockets for: multi-tab persistence, server-initiated updates, confirmation flow coordination
- Render recommends WebSocket for bidirectional control (stop-generation, tool confirmation)
- As copilots added tool calls, confirmation flows, and resumable streams, HTTP streaming "started to break"

**Hybrid Approaches Emerging:**
- SSE for LLM token streaming + WebSocket for control signals
- Some teams use SSE for non-critical updates + WebSocket for critical bidirectional communication
- Vercel AI SDK uses SSE for streaming but provides framework hooks for cancellation via separate HTTP requests

_Sources: [Liveblocks - WebSockets for AI Agents](https://liveblocks.io/blog/why-we-built-our-ai-agents-on-websockets-instead-of-http), [Render - Real-Time AI Chat Infrastructure](https://render.com/articles/real-time-ai-chat-websockets-infrastructure), [SSE Comeback (portalZINE)](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/)_

### bmad-studio Existing WebSocket Infrastructure

The current codebase (Epic 2) already has a mature WebSocket system:

- **Server:** Go + gorilla/websocket, Hub pattern (register/unregister/broadcast channels), goroutine-based event loop
- **Client:** TypeScript `websocket.service.ts` with exponential backoff reconnection (1s → 30s, ±20% jitter)
- **Protocol:** JSON events with `{ type, payload, timestamp }` structure
- **Current Events:** `artifact:created/updated/deleted`, `workflow:status-changed`, `connection:status`
- **Direction:** Broadcast-only (server → client). `readPump()` exists but incoming messages are not processed
- **Session Scope:** Single Hub instance per Go process; clients registered/unregistered on connect/disconnect
- **Trigger Pattern:** File system changes → FileWatcherService → Hub.BroadcastEvent() → all clients

**Key Insight:** The existing WebSocket is a **notification channel** — events notify the frontend to re-fetch data via REST API. The client does not send meaningful messages to the server. Epic 3's chat streaming will need to extend this to support bidirectional communication (user messages → server, LLM tokens → client).

### Technology Adoption Trends

| Pattern | Adoption | Relevance to bmad-studio |
|---|---|---|
| SSE for LLM streaming (web) | Dominant in web apps | Less relevant — Tauri desktop eliminates proxy concerns |
| WebSocket for agentic chat | Growing rapidly (Automaker, Liveblocks) | High — bmad-studio already has WebSocket infra |
| Vercel AI SDK stream protocol | Industry standard for JS ecosystem | Medium — protocol design patterns applicable even if SDK not used directly |
| Local-first architecture (T3Chat) | Emerging for chat apps | Medium — desktop app naturally stores state locally |
| Typed message protocol (start/delta/end) | Standard across all major SDKs | High — should adopt for bmad-studio chunk protocol |
| Hybrid SSE + WebSocket | Niche but growing | Low — single protocol simpler for desktop app |

_Sources: [AI System Design Patterns 2026](https://zenvanriel.nl/ai-engineer-blog/ai-system-design-patterns-2026/), [AI Agent Chat: WebSocket vs SSE](https://www.kscerbiakas.lt/ai-agent-progress-chat-websocket-server-sent-events/)_

## Integration Patterns Analysis

### API Design: Backend-to-Frontend Streaming

The core integration question for bmad-studio is: **How should the Go backend expose LLM streaming to the Lit frontend?**

Three viable patterns emerge from the research:

#### Pattern A: Extend Existing WebSocket (Recommended)

Reuse the existing gorilla/websocket Hub to carry chat messages alongside workflow events. The client sends a `chat:send` message; the server streams `chat:chunk` messages back.

**Pros:**
- Single connection — already established, already has reconnection, already has ping/pong
- Bidirectional — client can send messages AND control signals (cancel, confirm tool calls)
- Matches Automaker and Liveblocks patterns for agentic chat
- No proxy/firewall concerns (localhost desktop app)

**Cons:**
- Mixes notification events and high-throughput streaming on one connection
- Need to implement message routing/dispatching in the Hub

#### Pattern B: Separate SSE Endpoint for Chat Streaming

Add a `POST /api/v1/chat/stream` SSE endpoint. Frontend sends the message via POST, receives streamed response as SSE. WebSocket remains for notifications only.

**Pros:**
- Clean separation of concerns
- Matches Claude/OpenAI API native SSE format (simpler relay)
- Each stream is request-scoped (no session state on server)

**Cons:**
- Cannot send cancel signal on SSE (needs separate `POST /api/v1/chat/cancel`)
- Two transport mechanisms to maintain
- SSE's `EventSource` API doesn't support POST or custom headers (would need `fetch` + `ReadableStream` instead)

#### Pattern C: Dedicated Chat WebSocket

Open a second WebSocket connection (`/ws/chat`) specifically for chat streaming, separate from the notification WebSocket (`/ws`).

**Pros:**
- Clean isolation from notification traffic
- Can tune buffer sizes and timeouts independently
- Session-scoped connection lifecycle

**Cons:**
- Two WebSocket connections to manage
- Duplicated reconnection logic
- Extra complexity for marginal benefit in a desktop app

**Recommendation:** **Pattern A** — extend the existing WebSocket. In a single-user desktop app, there's no scalability pressure that would justify separating transports. The existing Hub pattern can be extended with message type routing. This matches what Automaker does.

_Confidence: High — consistent with Automaker (WebSocket), Liveblocks (WebSocket for agents), and the desktop app context_
_Sources: [Liveblocks - WebSockets for AI Agents](https://liveblocks.io/blog/why-we-built-our-ai-agents-on-websockets-instead-of-http), [Render - Real-Time AI Chat](https://render.com/articles/real-time-ai-chat-websockets-infrastructure), [NLP Cloud - Go SSE Streaming](https://nlpcloud.com/how-to-develop-a-token-streaming-ui-for-your-llm-with-go-fastapi-and-js.html)_

### WebSocket Message Protocol Design for Chat

Based on the Vercel AI SDK, Claude API, and OpenAI Realtime API patterns, here is a proposed chunk protocol for bmad-studio:

#### Client → Server Messages

| Message Type | Payload | Purpose |
|---|---|---|
| `chat:send` | `{ conversationId, message, model, provider }` | Send user message, initiate LLM stream |
| `chat:cancel` | `{ conversationId }` | Abort in-progress LLM stream |
| `chat:resend` | `{ conversationId, messageId }` | Retry a failed message |

#### Server → Client Messages (Streaming)

| Message Type | Payload | Purpose |
|---|---|---|
| `chat:stream-start` | `{ conversationId, messageId, model }` | LLM response beginning |
| `chat:text-delta` | `{ conversationId, messageId, delta }` | Token-by-token text chunk |
| `chat:thinking-delta` | `{ conversationId, messageId, delta }` | Extended thinking content (Claude) |
| `chat:tool-start` | `{ conversationId, messageId, toolName, toolId }` | Tool call beginning |
| `chat:tool-delta` | `{ conversationId, messageId, toolId, delta }` | Tool input parameter streaming |
| `chat:tool-end` | `{ conversationId, messageId, toolId, input }` | Tool call complete with parsed input |
| `chat:stream-end` | `{ conversationId, messageId, usage }` | LLM response complete with token counts |
| `chat:error` | `{ conversationId, messageId?, code, message }` | Error during streaming |

#### Design Principles (from industry patterns)

1. **Namespace prefix** (`chat:`) — separates chat events from existing `artifact:` and `workflow:` events on the shared WebSocket
2. **Conversation-scoped** — every message carries `conversationId` for routing and state management
3. **start/delta/end pattern** — matches Vercel AI SDK and Claude API conventions for structured streaming
4. **Separate thinking content** — Claude's extended thinking is a distinct content type; rendering it separately is a UX pattern seen across AI chat apps
5. **Usage stats at end** — token counts in `stream-end` enables cost tracking per message

_Confidence: High — protocol design synthesized from Vercel AI SDK, Claude API, and OpenAI Realtime patterns_
_Sources: [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol), [Claude API Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [OpenAI Realtime WebSocket](https://platform.openai.com/docs/guides/realtime-websocket), [Vercel AI SDK WebSocket Discussion](https://github.com/vercel/ai/discussions/5607)_

### LLM Provider Abstraction Layer

bmad-studio needs a Go-side abstraction to stream from multiple LLM providers (Claude, OpenAI, Ollama) through a unified interface. The industry pattern is a **Factory + Interface** approach:

#### Go Interface Pattern (from go-llm, LibreChat)

```
Provider Interface
├── StreamChat(ctx, messages, options) → chan StreamEvent
├── ListModels() → []Model
└── ValidateConfig() → error

StreamEvent
├── Type: "text" | "thinking" | "tool_call" | "usage" | "error" | "done"
├── Delta: string
└── Metadata: map[string]any
```

**Key design decisions from reference projects:**

| Decision | LibreChat Pattern | go-llm Pattern | Recommendation for bmad-studio |
|---|---|---|---|
| **Abstraction** | BaseClient class, Factory pattern | Interface + channel-based streaming | Go interface with `chan StreamEvent` |
| **Provider selection** | Runtime config (`librechat.yaml`) | Constructor injection | Config-driven (already have `BMadConfigService`) |
| **Token counting** | Per-provider implementation | SDK-level | Per-provider, exposed in `stream-end` |
| **Error handling** | Provider-specific mapping | Typed errors | Map to unified error codes |
| **Rate limiting** | Middleware | Per-provider | Defer — single-user desktop app |

**Existing bmad-studio provider infrastructure:** Epic 1 already implemented a Claude provider (`backend/services/providers/`) with streaming support. Epic 3 extends this to relay streaming through WebSocket rather than just returning complete responses.

_Confidence: High — established patterns across multiple open-source projects_
_Sources: [go-llm](https://github.com/inercia/go-llm), [LibreChat Architecture](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994), [llm-sdk](https://github.com/hoangvvo/llm-sdk), [Rust multi_llm crate](https://docs.rs/multi-llm)_

### Session & Conversation State Management

#### Where to Store Conversation State

| Approach | Used By | Fit for bmad-studio |
|---|---|---|
| **Server-side (DB)** | LibreChat (MongoDB), ChatGPT | Overkill for desktop — single user, local app |
| **Client-side (IndexedDB)** | T3Chat | Good fit — desktop app, local-first |
| **File-based** | Many Tauri apps | Good fit — aligns with BMAD's file-based artifact system |
| **Hybrid** | Most production apps | Optimal — files for persistence, in-memory for active session |

**Recommendation:** File-based persistence (JSON/YAML in the BMAD output folder) + in-memory working state on the Go backend during active streaming. This aligns with:
- BMAD's existing artifact file system pattern
- The FileWatcherService already monitoring the output folder
- Desktop app simplicity (no database required)

#### Session Scoping

- **One active conversation per project** at a time (simplest for v1)
- Conversation ID = unique identifier linking messages
- Go backend holds the active conversation context in memory for the current streaming session
- On project close, conversation state is flushed to file

_Confidence: Medium-High — recommendation synthesized; specific implementation depends on Epic 3 story requirements_
_Sources: [LibreChat Architecture](https://gist.github.com/ChakshuGautam/fca45e48a362b6057b5e67145b82a994), [Stateful vs Stateless Agents](https://tacnode.io/post/stateful-vs-stateless-ai-agents-practical-architecture-guide-for-developers), [AI Chatbot Architecture (enjo.ai)](https://www.enjo.ai/post/ai-chatbot-guide)_

### Error Handling & Resilience

#### Streaming Error Patterns

| Error Scenario | Handling Pattern | Source |
|---|---|---|
| **LLM API timeout** | Send `chat:error` with code `provider_timeout`; client shows partial response + retry button | Render, LibreChat |
| **LLM API rate limit** | Send `chat:error` with code `rate_limited`; include retry-after hint | Claude API (429 + `retry-after`) |
| **LLM overloaded** | Send `chat:error` with code `overloaded`; client shows queue position or retry | Claude API (`overloaded_error` in stream) |
| **WebSocket disconnect mid-stream** | Client reconnects with exponential backoff; server detects client gone via ping/pong failure | Already implemented in bmad-studio |
| **User cancels** | Client sends `chat:cancel`; server calls `context.Cancel()` on the LLM HTTP request | Vercel AI SDK `AbortController` pattern |
| **Malformed response** | Server catches JSON parse error; sends `chat:error` with partial content | LibreChat error mapping |

#### Connection Health (Already in Place)

bmad-studio's existing WebSocket infrastructure already handles:
- Ping/pong at 54s intervals (90% of 60s pong timeout)
- Exponential backoff reconnection (1s → 30s, ±20% jitter)
- Slow client detection (auto-disconnect if send buffer fills)

**Gap for Epic 3:** Stream resumption after reconnect. If the WebSocket drops mid-stream, the client needs to either:
- Re-request the message (simplest — server re-generates)
- Resume from last received delta (complex — requires server-side buffering)

**Recommendation:** Re-request approach for v1. Resumption is a v2 optimization.

_Confidence: High — error patterns well-documented across all reference projects_
_Sources: [WebSocket Error Handling (VideoSDK)](https://www.videosdk.live/developer-hub/websocket/websocket-onerror), [WebSocket Ping/Pong (VideoSDK)](https://www.videosdk.live/developer-hub/websocket/ping-pong-frame-websocket), [Claude API Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)_

### Integration Security

#### API Key Management for LLM Providers

| Concern | Pattern | Notes |
|---|---|---|
| **Storage** | OS keychain (macOS Keychain, Windows Credential Manager) or encrypted local file | Tauri provides `tauri-plugin-stronghold` for secure storage |
| **Transmission** | Keys never leave the Go backend; frontend sends provider selection, backend attaches credentials | Already the pattern in bmad-studio |
| **Rotation** | User-managed (settings UI) | No server-side rotation needed for desktop app |
| **Multi-provider** | Store per-provider keys in config | Extend existing BMadConfigService |

**Key principle:** In a desktop app, the user owns their API keys. The Go backend holds them in memory after loading from secure storage; the frontend never sees raw keys.

_Confidence: High — standard desktop app security pattern_
_Sources: [Tauri Security](https://v2.tauri.app/develop/calling-frontend/), [WebSocket Security Best Practices (VideoSDK)](https://www.videosdk.live/developer-hub/websocket/websocket-streaming)_

## Architectural Patterns and Design

### Streaming Relay Pipeline Architecture

The core architectural challenge for bmad-studio Epic 3 is building a **streaming relay pipeline**: the Go backend receives SSE tokens from LLM provider APIs and relays them as WebSocket events to the Lit frontend.

#### Pipeline Stages (Go Goroutines)

```
┌──────────────┐    ┌───────────────────┐    ┌──────────────────┐    ┌──────────────┐
│  Frontend     │    │  Hub / Router     │    │  Chat Service    │    │  Provider    │
│  (Lit/WS)     │◄──►│  (message dispatch)│◄──►│  (orchestration) │◄──►│  (SSE client)│
└──────────────┘    └───────────────────┘    └──────────────────┘    └──────────────┘
      ▲                     │                         │                      │
      │                     │                         │                      ▼
      │              routes by type:            manages:              connects to:
      │              - chat:* → ChatService     - conversation ctx    - Claude API
      │              - artifact:* → broadcast   - streaming state     - OpenAI API
      │              - workflow:* → broadcast    - cancel handling     - Ollama API
      │                                         - message assembly
      └─────────── WebSocket (bidirectional, single connection) ──────────────┘
```

**Each stage is a goroutine connected by channels, following the Go pipeline pattern:**

1. **Provider Stage** — Opens HTTP SSE connection to LLM API; reads `event: content_block_delta` frames; sends `StreamEvent` structs to a channel. Uses `context.WithCancel` for user-initiated abort.

2. **Chat Service Stage** — Reads from the provider channel; translates provider-specific events into bmad-studio `chat:*` WebSocket events; manages conversation state; handles errors. Writes assembled events to the Hub.

3. **Hub / Router Stage** — Extended from the existing Hub. Routes incoming client messages by type prefix (`chat:` → ChatService, existing events remain broadcast-only). Sends outgoing events to the appropriate client(s).

4. **Frontend Stage** — WebSocket client receives `chat:*` events; signal-based state layer accumulates deltas; components re-render incrementally.

**Cancellation flow:**

```
User clicks "Stop" → frontend sends { type: "chat:cancel", payload: { conversationId } }
  → Hub routes to ChatService
    → ChatService calls cancel() on the context.Context
      → Provider stage's ctx.Done() fires
        → HTTP request to LLM API is cancelled
          → Provider closes channel
            → ChatService sends chat:stream-end (partial)
              → Frontend renders partial response
```

_Confidence: High — composed from established Go pipeline patterns and existing bmad-studio architecture_
_Sources: [Go Pipelines (go.dev)](https://go.dev/blog/pipelines), [Go Context Cancellation (go.dev)](https://go.dev/blog/context), [Go Concurrency Patterns 2025](https://cristiancurteanu.com/7-powerful-golang-concurrency-patterns-that-will-transform-your-code-in-2025/), [Mastering Go Pipelines (DEV)](https://dev.to/jones_charles_ad50858dbc0/mastering-go-concurrency-patterns-pipelines-broadcasting-and-cancellation-1j36)_

### WebSocket Multiplexing: Shared Connection Design

The single WebSocket carries multiple "namespaces" of messages. The architecture uses **application-level message routing** (JSON `type` field prefix) rather than protocol-level multiplexing.

#### Message Routing Table

| Prefix | Direction | Handler | Priority |
|---|---|---|---|
| `chat:send` / `chat:cancel` / `chat:resend` | Client → Server | ChatService | High (user interaction) |
| `chat:stream-start` / `chat:text-delta` / `chat:thinking-delta` / `chat:tool-*` / `chat:stream-end` / `chat:error` | Server → Client | Targeted (per conversation) | High (streaming) |
| `artifact:created` / `artifact:updated` / `artifact:deleted` | Server → Client | Broadcast (all clients) | Normal |
| `workflow:status-changed` | Server → Client | Broadcast (all clients) | Normal |
| `connection:status` | Server → Client | Broadcast (all clients) | Low |

**Design decisions:**

1. **No need for IETF WebSocket multiplexing extension** — Application-level routing via JSON `type` field is simpler and sufficient for a desktop app with one user
2. **No need for HTTP/2 WebSocket multiplexing** — Single connection handles the throughput; no contention between namespaces in practice
3. **Priority handling** — Chat deltas should be sent immediately (no buffering); artifact/workflow events can tolerate the existing 100ms debounce
4. **Hub extension** — The Hub's `readPump()` (currently unused) becomes the client→server message dispatcher

_Confidence: High — application-level routing is the standard pattern for multiplexed WebSocket_
_Sources: [WebSocket Architecture Best Practices (Ably)](https://ably.com/topic/websocket-architecture-best-practices), [WebSocket Design Patterns (websockets docs)](https://websockets.readthedocs.io/en/stable/howto/patterns.html), [IETF WebSocket Multiplexing Draft](https://datatracker.ietf.org/doc/html/draft-ietf-hybi-websocket-multiplexing-01)_

### Go Backend Concurrency Design

The streaming pipeline leverages Go's native concurrency primitives:

#### Channel and Context Patterns

| Concern | Pattern | Rationale |
|---|---|---|
| **Provider → ChatService** | `chan StreamEvent` (buffered, size 64) | Decouples provider HTTP I/O from WebSocket I/O; buffer absorbs burst tokens |
| **Cancellation** | `context.WithCancel(ctx)` passed to provider | Single cancel() call tears down entire pipeline |
| **Timeout** | `context.WithTimeout(ctx, 5*time.Minute)` | Prevents runaway LLM requests from hanging indefinitely |
| **Channel ownership** | Provider goroutine creates and closes the channel | Sender closes channel (Go best practice); ChatService reads until close |
| **Error propagation** | `StreamEvent` with `Type: "error"` sent on the channel | Errors flow through the same pipeline as data — no side channels |
| **Goroutine lifecycle** | One goroutine per active stream; exits on channel close or ctx.Done() | No goroutine leaks — every goroutine has a termination path |

**Key safeguard:** Buffered channels prevent goroutine leaks when the frontend disconnects mid-stream. If the client goes away, the Hub detects it via ping/pong failure, the ChatService cancels the context, and the provider goroutine exits cleanly.

_Confidence: High — standard Go concurrency patterns, well-documented_
_Sources: [Go Context (go.dev)](https://go.dev/blog/context), [Context WithCancel (Sling Academy)](https://www.slingacademy.com/article/how-to-use-the-context-withcancel-pattern-effectively-in-go/), [Go Channel Patterns (DEV)](https://dev.to/b0r/go-channel-patterns-cancellation-k09)_

### Conversation Data Architecture

#### Message Storage Format

Conversations are persisted as JSON files in the BMAD output folder, aligning with the existing artifact pattern:

```
_bmad-output/
├── conversations/
│   ├── conv-2026-02-02-abc123.json    ← one file per conversation
│   └── conv-2026-02-01-def456.json
├── planning-artifacts/
└── implementation-artifacts/
```

#### Conversation File Structure (Proposed)

```json
{
  "id": "conv-2026-02-02-abc123",
  "projectRoot": "/path/to/project",
  "createdAt": "2026-02-02T10:30:00Z",
  "updatedAt": "2026-02-02T11:45:00Z",
  "model": "claude-sonnet-4-20250514",
  "provider": "claude",
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "Explain the phase graph component",
      "timestamp": "2026-02-02T10:30:00Z"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "The phase graph component...",
      "thinking": "Let me analyze the phase-graph-container...",
      "model": "claude-sonnet-4-20250514",
      "usage": { "inputTokens": 1250, "outputTokens": 834 },
      "timestamp": "2026-02-02T10:30:05Z"
    }
  ]
}
```

**Design decisions:**

1. **One file per conversation** — Simple, no database needed, easy to inspect/debug
2. **Complete messages only** — Deltas are accumulated in memory; only the final assembled message is persisted
3. **Thinking content stored separately** — Enables UI toggle for showing/hiding reasoning
4. **Usage per message** — Enables token cost tracking at message granularity
5. **No streaming state persisted** — If the app crashes mid-stream, the partial response is lost; user retries. Simplest for v1.

_Confidence: Medium-High — synthesized from T3Chat local-first approach, BMAD artifact patterns, and desktop app constraints_
_Sources: [Local-First AI with Tauri (ElectricSQL)](https://electric-sql.com/blog/2024/02/05/local-first-ai-with-tauri-postgres-pgvector-llama), [Local-First AI Blueprint (Medium)](https://medium.com/@Musbell008/a-technical-blueprint-for-local-first-ai-with-rust-and-tauri-b9211352bc0e), [Building Desktop Apps with Tauri 2025](https://www.plutenium.com/blog/building-desktop-apps-with-rust-and-tauri)_

### Desktop-Specific Architectural Considerations

| Concern | Web App Pattern | bmad-studio Desktop Pattern |
|---|---|---|
| **Transport** | SSE (proxy-friendly) | WebSocket (localhost, no proxy concerns) |
| **Connection count** | Many concurrent users | Single user, single connection |
| **State persistence** | Database (PostgreSQL, MongoDB) | Local files (JSON in output folder) |
| **API key security** | Server-side vault, env vars | Go backend in-memory; user-managed keys |
| **Scaling** | Horizontal (load balancer, replicas) | N/A — single process, single user |
| **Reconnection** | Critical (network instability) | Still important (process restart, app wake from sleep) |
| **Binary protocol** | Sometimes (performance at scale) | JSON text (debuggability > performance) |
| **Session management** | Auth tokens, server sessions | Implicit — one user, one project at a time |

**Key insight from the research:** Many patterns recommended for web AI chat apps (load balancing, connection pooling, database-backed sessions, CDN edge caching) are irrelevant for a Tauri desktop app. The architecture can be significantly simpler while still following the same streaming conventions.

_Confidence: High — derived from Tauri vs Electron analysis and bmad-studio constraints_
_Sources: [Tauri vs Electron (DoltHub)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/), [Tauri vs Electron (RaftLabs)](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/), [How Tauri Rewires AI DX (Medium)](https://medium.com/@hadiyolworld007/how-tauri-is-rewiring-the-ai-developer-experience-ab30b78812f3)_

## Implementation Approaches and Technology Adoption

### Go Backend Implementation

#### Hub Extension for Bidirectional Messaging

The existing gorilla/websocket Hub needs two changes for Epic 3:

1. **Activate `readPump()` message processing** — Currently `readPump()` reads incoming messages but discards them. Add a message dispatcher that routes by `type` prefix:

```
readPump() → parse JSON → extract "type" field
  → if "chat:*" → send to ChatService via channel
  → if unknown → log and ignore
```

2. **Targeted send (per-client)** — Currently the Hub only broadcasts to all clients. Add a `SendTo(client, event)` method for chat messages that should go to the requesting client only (not broadcast).

**Library:** Continue using `gorilla/websocket` — it's the industry standard for Go WebSocket, well-tested, and already integrated in bmad-studio.

_Confidence: High — extends existing, working infrastructure_
_Sources: [gorilla/websocket Hub example](https://github.com/gorilla/websocket/blob/main/examples/chat/hub.go), [Go WebSocket Guide (OneUptime)](https://oneuptime.com/blog/post/2026-01-07-go-websocket-gorilla/view), [Scalable Go WebSocket (Leapcell)](https://leapcell.io/blog/building-a-scalable-go-websocket-service-for-thousands-of-concurrent-connections)_

#### SSE Client for Claude API

The Go backend needs to consume Claude's SSE streaming API. Three viable approaches:

| Approach | Library | Pros | Cons |
|---|---|---|---|
| **Official SDK** | [`anthropics/anthropic-sdk-go`](https://github.com/anthropics/anthropic-sdk-go) | Best maintained; handles SSE internally; `stream.Next()` iterator | Adds SDK dependency; may lag behind API features |
| **SSE parser library** | [`tmaxmax/go-sse`](https://github.com/tmaxmax/go-sse) | Lightweight; `sse.Read()` on any `resp.Body`; Go 1.23 iterators | Need to handle Claude-specific event types manually |
| **Raw `net/http`** | `bufio.Scanner` on `resp.Body` | Zero dependencies; full control | Most boilerplate; must parse `event:` / `data:` lines |

**Recommendation:** Use the **official Anthropic Go SDK** (`anthropic-sdk-go`). bmad-studio Epic 1 likely already set up some Claude provider code. The official SDK handles SSE parsing, error mapping, and provides typed event structs (`ContentBlockDeltaEvent`, `TextDelta`, etc.). This avoids reimplementing the SSE parser.

For **Ollama** (local testing) and **OpenAI** (future provider), use their respective Go SDKs or a lightweight SSE parser since their streaming formats differ.

_Confidence: High — official SDK is the standard approach_
_Sources: [anthropic-sdk-go](https://github.com/anthropics/anthropic-sdk-go), [tmaxmax/go-sse](https://github.com/tmaxmax/go-sse), [jclem/sseparser](https://pkg.go.dev/github.com/jclem/sseparser), [LLM Streaming Chatbot with Go](https://wejick.wordpress.com/2023/06/24/making-an-llm-based-streaming-chatbot-with-go-and-websocket/)_

### Frontend Implementation (Lit)

#### Signal-Based Chat State

bmad-studio already uses Lit signals (`@lit-labs/signals`) and the `SignalWatcher` mixin for workflow state. The chat state should follow the same pattern:

```
chatState signals:
├── conversations$     — Signal<Conversation[]>  (list of conversations)
├── activeConversation$ — Signal<Conversation | null>  (current conversation)
├── streamingMessage$   — Signal<StreamingMessage | null>  (in-progress response)
├── isStreaming$        — Signal<boolean>  (streaming in progress)
└── chatError$          — Signal<ChatError | null>  (last error)
```

**Key pattern:** The `streamingMessage$` signal accumulates `chat:text-delta` events. The `watch()` directive in the chat component binds to this signal, enabling **pinpoint DOM updates** — only the streaming text region re-renders, not the entire conversation.

_Confidence: High — extends existing signal pattern in bmad-studio_
_Sources: [Lit Signals (lit.dev)](https://lit.dev/blog/2024-10-08-signals/), [Lit Cheat Sheet](https://lit.dev/articles/lit-cheat-sheet/)_

#### Streaming Markdown Rendering

AI responses contain Markdown that arrives token-by-token. Two options:

| Approach | Library | Notes |
|---|---|---|
| **Streaming Markdown parser** | `streaming-markdown`, NLUX | Handles stateful incremental parsing (e.g., bold mid-chunk). Purpose-built for AI streaming. |
| **Vercel Streamdown** | `@vercel/streamdown` | Open-source, powers Vercel's AI Elements. Drop-in Markdown renderer for streaming. |
| **Re-parse on each delta** | `marked` / `markdown-it` | Simple: concatenate deltas, re-parse full text. Works but less efficient for long responses. |

**Recommendation:** Start with re-parse approach (simplest for v1) using whichever Markdown library is already in the project. If performance is an issue for long responses, adopt a streaming-aware parser like Streamdown.

_Confidence: Medium-High — streaming Markdown is well-understood; choice depends on performance needs_
_Sources: [Streamdown (Vercel)](https://vercel.com/changelog/introducing-streamdown), [Streaming Markdown rendering](https://raw.githubusercontent.com/miklevin/MikeLev.in/main/_posts/2025-03-24-websockets-stream-incremental-markdown.md)_

### Testing Strategy

#### Backend Testing

| Test Type | Approach | Tools |
|---|---|---|
| **Unit: ChatService** | Mock provider channel; verify WebSocket events emitted | Go standard `testing` |
| **Unit: Provider** | Mock HTTP responses with SSE format; verify `StreamEvent` channel output | `net/http/httptest` |
| **Unit: Hub routing** | Send client messages; verify routing to ChatService | `posener/wstest` or `httptest` |
| **Integration: Full pipeline** | Start `httptest` server with mock LLM; connect WebSocket client; send `chat:send`; verify streamed response | `gorilla/websocket` client + `httptest` |
| **Integration: Real Ollama** | Run actual Ollama locally; verify end-to-end streaming | Ollama + Go test (Research Spike 3) |

**Key pattern from research:** Don't mock WebSocket connections themselves — use `httptest.NewServer` with a real WebSocket handler. This catches bugs that mocking would hide.

#### Frontend Testing

| Test Type | Approach | Tools |
|---|---|---|
| **Unit: chat state** | Emit mock WebSocket events; verify signal state updates | Vitest + existing test patterns |
| **Unit: chat components** | Render with mock state; verify DOM output | Vitest + `@open-wc/testing` |
| **Integration: WebSocket** | Mock WebSocket with `jest-websocket-mock` or MSW 2.0; verify message flow | Vitest + mock library |

_Confidence: High — extends existing bmad-studio test patterns (213 tests already passing)_
_Sources: [posener/wstest](https://github.com/posener/wstest), [Learn Go with Tests - WebSockets](https://quii.gitbook.io/learn-go-with-tests/build-an-application/websockets), [WebSocket Testing Strategies](https://www.thegreenreport.blog/articles/websocket-testing-essentials-strategies-and-code-for-real-time-apps/websocket-testing-essentials-strategies-and-code-for-real-time-apps.html), [MSW WebSocket mocking](https://mswjs.io/docs/websocket/)_

### Risk Assessment and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Gorilla/websocket Hub lock contention** under high-throughput chat streaming + concurrent artifact events | Low | Medium | Hub already uses `sync.RWMutex` and buffered channels. Single-user desktop app won't hit contention limits. Monitor if streaming latency appears. |
| **Claude API breaking changes** in streaming format | Low | High | Use official SDK (`anthropic-sdk-go`) which tracks API changes. Pin SDK version. |
| **Lit signal performance** with very long conversations (hundreds of messages) | Medium | Medium | Virtualize the message list (render only visible messages). Signal `watch()` directive prevents full re-renders. |
| **Streaming Markdown edge cases** (code blocks mid-chunk, nested formatting) | Medium | Low | Start with full re-parse approach. Streaming parser is a v2 optimization. |
| **WebSocket disconnect during long LLM response** | Medium | Low | Existing reconnection handles it. Re-request approach for v1 (lost partial response). |
| **Provider abstraction doesn't fit all LLM APIs** | Low | Medium | Start with Claude-only in Story 3.1. Abstract when adding second provider. Don't over-engineer upfront. |

## Technical Research Recommendations

### Implementation Roadmap (Mapping to Epic 3 Stories)

| Epic 3 Story | Key Research Finding | Implementation Approach |
|---|---|---|
| **3.1 — WebSocket Streaming Protocol** | Extend existing Hub with `chat:*` namespace routing; activate `readPump()` dispatcher | Pattern A (shared WebSocket); Go pipeline with `chan StreamEvent` + `context.WithCancel` |
| **3.2 — Chat Service** | Provider abstraction via Go interface; SSE relay pipeline | Official `anthropic-sdk-go` for Claude; goroutine pipeline: Provider → ChatService → Hub |
| **3.3 — Agent Selection** | Multi-provider config extends `BMadConfigService` | Config-driven provider selection; model list populated per-provider |
| **3.4 — Chat Panel** | Signal-based state with `watch()` for streaming; incremental rendering | `streamingMessage$` signal accumulates deltas; `watch()` directive for pinpoint DOM updates |
| **3.5 — Markdown Renderer** | Re-parse approach for v1; streaming-aware parser as v2 optimization | Use existing Markdown library; concatenate deltas and re-parse on each delta |
| **3.6 — Thinking Content Display** | Claude `thinking_delta` is a separate content type; UI toggle pattern | Separate `chat:thinking-delta` WebSocket event; collapsible thinking section in chat panel |

### Technology Stack Recommendations

| Component | Recommendation | Rationale |
|---|---|---|
| **WebSocket** | Continue with gorilla/websocket (same connection) | Already integrated; extend, don't replace |
| **Claude SSE client** | Official `anthropic-sdk-go` | Best maintained; typed events; SSE parsing built-in |
| **Ollama client** | Official Go SDK or raw HTTP + SSE parser | Spike 3 will determine (OpenAI-compatible API) |
| **Frontend state** | Lit signals (`@lit-labs/signals`) + `SignalWatcher` mixin | Already the pattern; extend for chat state |
| **Markdown rendering** | Existing library + full re-parse (v1) | Simplest; upgrade to streaming parser if needed |
| **Conversation persistence** | JSON files in `_bmad-output/conversations/` | Aligns with BMAD artifact pattern; no DB |
| **Testing (backend)** | `httptest` + real WebSocket handler | Don't mock WebSocket; catch real bugs |
| **Testing (frontend)** | Vitest + existing patterns + mock WebSocket events | Extends 213 existing tests |

### Key Architectural Decisions Summary

| Decision | Choice | Confidence | Rationale |
|---|---|---|---|
| Same WebSocket vs separate connection | **Same connection** (Pattern A) | High | Desktop app; single user; existing infra; matches Automaker pattern |
| SSE vs WebSocket for frontend transport | **WebSocket** | High | Desktop app eliminates SSE advantages; bidirectional needed for cancel |
| Chunk protocol | **Typed start/delta/end with `chat:` namespace** | High | Industry standard (Vercel AI SDK, Claude API) |
| Conversation persistence | **File-based (JSON)** | Medium-High | Aligns with BMAD patterns; no DB overhead |
| Provider abstraction | **Go interface with `chan StreamEvent`** | High | Idiomatic Go; extensible; matches go-llm pattern |
| Markdown rendering | **Full re-parse (v1)** | Medium | Simplest; streaming parser is v2 if needed |
| Stream resumption | **Re-request (v1)** | Medium | Simplest; server-side buffering is v2 if needed |

### Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| First token latency | < 500ms from user send to first `chat:text-delta` rendered | Manual testing + logging |
| Cancel responsiveness | < 200ms from "Stop" click to stream termination | Manual testing |
| Test coverage | Maintain 0 regressions; add ~50+ tests for streaming | CI test count tracking |
| WebSocket stability | No disconnects during normal streaming | Manual testing across stories |
| Multi-provider readiness | Provider interface supports Claude + Ollama by end of Epic 3 | Story 3.3 acceptance criteria |
