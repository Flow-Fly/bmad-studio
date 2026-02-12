---
title: 'Tool Execution Layer — Frontend UI'
slug: 'tool-execution-frontend'
created: '2026-02-05'
status: 'review-complete'
stepsCompleted: [1, 2, 3, 4]
reviewCompleted: '2026-02-05'
reviewFindings:
  fixed:
    - 'H1: Added explicit pending case in tool-call-block status switch'
    - 'H2: Trust level now loaded at app startup via initProviderState()'
    - 'M2: Fixed SlCheckbox type cast in tool-confirm-modal'
    - 'M3: Added test files for tool-call-block and tool-confirm-modal components'
  deferred:
    - 'M1: Orphaned pending status (design observation, not a bug)'
    - 'L1: ThinkingBlock uses legacy field (intentional per comment)'
tech_stack: ['Lit', 'Vite', '@lit-labs/signals', 'Shoelace', 'TypeScript']
files_to_modify:
  - 'src/types/conversation.ts'
  - 'src/types/provider.ts'
  - 'src/state/chat.state.ts'
  - 'src/services/chat.service.ts'
  - 'src/components/core/chat/conversation-block.ts'
  - 'src/components/core/settings/provider-settings.ts'
  - 'backend/providers/provider.go'
  - 'backend/providers/ollama.go'
files_to_create:
  - 'src/components/core/chat/tool-call-block.ts'
  - 'src/components/core/chat/tool-confirm-modal.ts'
  - 'src/types/tool.ts'
code_patterns:
  - 'Web Components with LitElement + @customElement decorator'
  - 'Signal-based state: Signal.State<T> with SignalWatcher mixin'
  - 'Shoelace UI primitives (sl-dialog, sl-tab-group, sl-badge, sl-button)'
  - 'WebSocket pub/sub: wsOn(EVENT_TYPE, handler) returns cleanup function'
  - 'State mutations via helper functions that clone + update Map/arrays'
  - 'CSS custom properties for theming (--bmad-*)'
  - 'Immutable updates: signal.set(new Map(...old))'
test_patterns:
  - '@open-wc/testing fixtures for Lit components'
  - 'Mock WebSocket events for service tests'
  - 'Signal state assertions after handler calls'
---

# Tech-Spec: Tool Execution Layer — Frontend UI

**Created:** 2026-02-05

## Overview

### Problem Statement

The backend can now execute tools (file_read, file_write, bash, web_search) and streams tool events over WebSocket. The frontend has no way to display tool calls, collect user approval for dangerous operations, or configure trust level preferences. Users can't see what agents are doing or control execution permissions.

### Solution

Add frontend tool execution UI: `MessageBlock[]` union type for flexible content rendering, `tool-call-block` component with status/input/output display, trust level settings in provider dialog, inline + modal confirmation flow with session dismissal, and Ollama `supportsTools` badge with filter toggle.

### Scope

**In Scope:**
- `MessageBlock` union type (`TextBlock | ToolCallBlock | ThinkingBlock`) replacing flat `content` string
- `tool-call-block` component: name, input (collapsible), status (pending/running/success/error), output (truncated + expand)
- Chat state refactor to accumulate `MessageBlock[]` from stream events
- WebSocket handlers for `chat:tool-start`, `chat:tool-delta`, `chat:tool-result`, `chat:tool-confirm`
- Send `chat:tool-approve` on user confirmation
- Trust level settings: "Execution" tab in provider-settings dialog
- Confirmation UX: inline approve/deny + modal for dangerous tools
- Modal explains tool behavior ("rm deletes files, here we're deleting X because...")
- Session-dismissable confirmations (don't ask again this session)
- Ollama model selector: `[Tools]` badge, "Show only tool-capable" filter toggle
- Backend: add `supportsTools: bool` to Ollama model response

**Out of Scope:**
- Per-workflow tool permission declarations (uses global trust level for now)
- Context-aware loop budget / gas gauge tuning (future spec)
- MCP tool registration UI
- Tool execution history/audit log

## Context for Development

### Existing Type Signatures (Ground Truth)

**Message** (`src/types/conversation.ts:83-94`):
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  timestamp: number;
  isStreaming?: boolean;
  isPartial?: boolean;
  usage?: UsageStats;
  isContext?: boolean;
  contextLabel?: string;
}
```

**Conversation** (`src/types/conversation.ts:96-104`):
```typescript
export interface Conversation {
  id: string;
  agentId?: string;
  messages: Message[];
  highlights: Highlight[];
  createdAt: number;
  model: string;
  provider: string;
}
```

**Model - Backend** (`backend/providers/provider.go:62-67`):
```go
type Model struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Provider  string `json:"provider"`
    MaxTokens int    `json:"max_tokens"`
}
```

**Model - Frontend** (`src/types/provider.ts:10-15`):
```typescript
export interface Model {
  id: string;
  name: string;
  provider: string;
  max_tokens: number;
}
```

**Chat State Signals** (`src/state/chat.state.ts`):
```typescript
export const chatConnectionState = new Signal.State<ChatConnectionState>('idle');
export const activeConversations = new Signal.State<Map<string, Conversation>>(new Map());
export const streamingConversationId = new Signal.State<string | null>(null);
```

**WebSocket Handler Pattern** (`src/services/chat.service.ts:223-237`):
```typescript
export function initChatService(): () => void {
  const cleanups = [
    wsOn(CHAT_STREAM_START, handleStreamStart),
    wsOn(CHAT_TEXT_DELTA, handleTextDelta),
    wsOn(CHAT_THINKING_DELTA, handleThinkingDelta),
    wsOn(CHAT_STREAM_END, handleStreamEnd),
    wsOn(CHAT_ERROR, handleError),
  ];
  return () => { for (const cleanup of cleanups) cleanup(); };
}
```

### Codebase Patterns

**Component Pattern:**
- `@customElement('tag-name')` decorator registers Web Component
- `@state()` for internal reactive state
- `@property()` for external inputs from parent
- `SignalWatcher(LitElement)` mixin enables Signal reactivity
- CSS in static `styles` property using `css` tagged template

**State Update Pattern:**
```typescript
// Clone Map, mutate, set new reference
const map = new Map(activeConversations.get());
map.set(id, updatedConversation);
activeConversations.set(map);
```

**Event Handler Pattern:**
```typescript
function handleTextDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatTextDeltaPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg =>
    msg.id === payload.message_id
      ? { ...msg, content: msg.content + payload.content }
      : msg
  );
  setConversation({ ...conversation, messages });
}
```

**Provider Settings Tab Pattern** (`src/components/core/settings/provider-settings.ts`):
```typescript
<sl-tab-group>
  <sl-tab slot="nav" panel="claude">Claude</sl-tab>
  <sl-tab slot="nav" panel="openai">OpenAI</sl-tab>
  <sl-tab slot="nav" panel="ollama">Ollama</sl-tab>

  <sl-tab-panel name="claude">...</sl-tab-panel>
  <sl-tab-panel name="openai">...</sl-tab-panel>
  <sl-tab-panel name="ollama">...</sl-tab-panel>
</sl-tab-group>
```

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `src/types/conversation.ts` | Message, Conversation types, event constants | 1-104 |
| `src/types/provider.ts` | Model, ProviderType, AppSettings types | 1-35 |
| `src/state/chat.state.ts` | Chat signals and state helpers | 1-56 |
| `src/services/chat.service.ts` | WebSocket handlers for chat events | 1-237 |
| `src/services/websocket.service.ts` | `send()`, `on()` WebSocket functions | - |
| `src/components/core/chat/conversation-block.ts` | Message rendering component | 1-632 |
| `src/components/core/settings/provider-settings.ts` | Settings dialog with tabs | 1-472 |
| `backend/providers/provider.go` | Model struct definition | 62-67 |
| `backend/providers/ollama.go` | Ollama ListModels implementation | 84-102 |
| `backend/types/websocket.go` | Backend tool event payloads | - |

### Technical Decisions

- **MessageBlock union over Message extension:** Using discriminated union `MessageBlock = TextBlock | ToolCallBlock | ThinkingBlock` provides type safety and explicit handling for each block type. More flexible for future block types.
- **Blocks array replaces content string:** `Message.blocks: MessageBlock[]` replaces `Message.content: string`. Backward compat: migration helper converts old messages.
- **Session-scoped dismissal:** Store dismissed tool confirmations in `sessionDismissedTools: Signal.State<Set<string>>` — clears on page reload, not persisted.
- **Trust level in AppSettings:** Add `trustLevel: 'supervised' | 'guided' | 'autonomous'` to settings, default 'guided'.
- **Ollama supportsTools heuristic:** Backend checks model name against known tool-capable models (llama3.1, mistral, qwen2.5). Conservative — defaults to false.
- **Inline + Modal confirmation:** Inline buttons always shown for pending confirms. Modal triggered for dangerous tools (bash) with explanation text.

## Implementation Plan

### Tasks

#### Task 1: Backend — Add supportsTools to Model
Extend the backend Model struct and Ollama provider to indicate tool capability.

- [x] **1.1** Extend Model struct
  - File: `backend/providers/provider.go`
  - Action: Add `SupportsTools bool json:"supports_tools"` field to Model struct
  - Notes: Claude/OpenAI always return true (all models support tools). Ollama varies by model.

- [x] **1.2** Set SupportsTools for Claude/OpenAI
  - File: `backend/providers/claude.go`, `backend/providers/openai.go`
  - Action: In `claudeModels` and `openaiModels` slices, set `SupportsTools: true` for all models
  - Notes: All Claude and OpenAI models in our list support tools.

- [x] **1.3** Add Ollama tool-capable model detection
  - File: `backend/providers/ollama.go`
  - Action: In `ListModels()`, check model name against known tool-capable patterns and set `SupportsTools` accordingly:
    ```go
    func supportsTools(modelName string) bool {
        name := strings.ToLower(modelName)
        toolCapable := []string{"llama3.1", "llama3.2", "mistral", "qwen2.5", "granite3"}
        for _, prefix := range toolCapable {
            if strings.Contains(name, prefix) {
                return true
            }
        }
        return false
    }
    ```
  - Notes: Conservative — defaults to false. List based on Ollama docs for models with native tool support.

- [x] **1.4** Update backend tests
  - File: `backend/providers/provider_test.go`, `backend/providers/ollama_test.go`
  - Action: Add tests verifying SupportsTools is set correctly for each provider

#### Task 2: Frontend Types — Tool and MessageBlock definitions
Create the type foundation for tool execution UI.

- [x] **2.1** Create tool types file
  - File: `src/types/tool.ts` (NEW)
  - Action: Define:
    ```typescript
    export type ToolStatus = 'pending' | 'running' | 'success' | 'error';
    export type TrustLevel = 'supervised' | 'guided' | 'autonomous';

    export interface ToolCallBlock {
      type: 'tool';
      id: string;
      toolId: string;
      toolName: string;
      input: Record<string, unknown>;
      inputRaw: string;  // accumulated JSON string during streaming
      status: ToolStatus;
      output?: string;
      error?: string;
      startedAt: number;
      completedAt?: number;
    }

    export interface PendingToolConfirm {
      conversationId: string;
      messageId: string;
      toolId: string;
      toolName: string;
      input: Record<string, unknown>;
    }

    // Tool explanation hints for modal
    export const TOOL_HINTS: Record<string, string> = {
      bash: 'Executes a shell command on your system',
      file_write: 'Creates or overwrites a file',
      file_read: 'Reads contents of a file',
      web_search: 'Searches the web for information',
    };
    ```

- [x] **2.2** Add tool event constants and payloads
  - File: `src/types/conversation.ts`
  - Action: Add after existing event constants:
    ```typescript
    export const CHAT_TOOL_START = 'chat:tool-start';
    export const CHAT_TOOL_DELTA = 'chat:tool-delta';
    export const CHAT_TOOL_RESULT = 'chat:tool-result';
    export const CHAT_TOOL_CONFIRM = 'chat:tool-confirm';
    export const CHAT_TOOL_APPROVE = 'chat:tool-approve';

    export interface ChatToolStartPayload {
      conversation_id: string;
      message_id: string;
      tool_id: string;
      tool_name: string;
      input: Record<string, unknown>;
    }

    export interface ChatToolDeltaPayload {
      conversation_id: string;
      message_id: string;
      tool_id: string;
      chunk: string;
    }

    export interface ChatToolResultPayload {
      conversation_id: string;
      message_id: string;
      tool_id: string;
      status: 'success' | 'error';
      result: string;
      metadata?: Record<string, unknown>;
    }

    export interface ChatToolConfirmPayload {
      conversation_id: string;
      message_id: string;
      tool_id: string;
      tool_name: string;
      input: Record<string, unknown>;
    }
    ```

- [x] **2.3** Define MessageBlock union type
  - File: `src/types/conversation.ts`
  - Action: Add:
    ```typescript
    export interface TextBlock {
      type: 'text';
      id: string;
      content: string;
    }

    export interface ThinkingBlock {
      type: 'thinking';
      id: string;
      content: string;
    }

    export type MessageBlock = TextBlock | ThinkingBlock | ToolCallBlock;
    ```
  - Notes: Import `ToolCallBlock` from `./tool.ts`

- [x] **2.4** Extend Message interface with blocks
  - File: `src/types/conversation.ts`
  - Action: Add to Message interface:
    ```typescript
    export interface Message {
      // ... existing fields ...
      blocks?: MessageBlock[];  // New: replaces content for block-based messages
    }
    ```
  - Notes: `blocks` is optional for backward compat. Rendering logic checks blocks first, falls back to content.

- [x] **2.5** Extend Model interface with supportsTools
  - File: `src/types/provider.ts`
  - Action: Add to Model interface:
    ```typescript
    export interface Model {
      // ... existing fields ...
      supports_tools: boolean;
    }
    ```

- [x] **2.6** Extend AppSettings with trustLevel
  - File: `src/types/provider.ts`
  - Action: Add to AppSettings interface:
    ```typescript
    export interface AppSettings {
      // ... existing fields ...
      trust_level: TrustLevel;
    }
    ```
  - Notes: Import `TrustLevel` from `./tool.ts`

#### Task 3: State — Tool confirmation and session dismissal signals
Add state for tracking pending confirmations and session-dismissed tools.

- [x] **3.1** Add tool confirmation signals
  - File: `src/state/chat.state.ts`
  - Action: Add:
    ```typescript
    import type { PendingToolConfirm } from '../types/tool.js';

    export const pendingToolConfirm = new Signal.State<PendingToolConfirm | null>(null);
    export const sessionDismissedTools = new Signal.State<Set<string>>(new Set());

    export function dismissToolForSession(toolName: string): void {
      const current = sessionDismissedTools.get();
      sessionDismissedTools.set(new Set([...current, toolName]));
    }

    export function isToolDismissedForSession(toolName: string): boolean {
      return sessionDismissedTools.get().has(toolName);
    }

    export function clearPendingConfirm(): void {
      pendingToolConfirm.set(null);
    }
    ```

- [x] **3.2** Add trust level state
  - File: `src/state/provider.state.ts`
  - Action: Add:
    ```typescript
    import type { TrustLevel } from '../types/tool.js';

    export const trustLevelState = new Signal.State<TrustLevel>('guided');
    ```
  - Notes: Default to 'guided' (confirm dangerous tools only)

#### Task 4: Chat Service — Tool event handlers
Add WebSocket handlers for tool events and refactor message accumulation.

- [x] **4.1** Add tool event handlers
  - File: `src/services/chat.service.ts`
  - Action: Add handlers for each tool event:
    ```typescript
    function handleToolStart(event: WebSocketEvent): void {
      const payload = event.payload as ChatToolStartPayload;
      const conversation = getConversation(payload.conversation_id);
      if (!conversation) return;

      // Find the assistant message and add a tool block
      const messages = conversation.messages.map(msg => {
        if (msg.id !== payload.message_id) return msg;

        const toolBlock: ToolCallBlock = {
          type: 'tool',
          id: `block-${payload.tool_id}`,
          toolId: payload.tool_id,
          toolName: payload.tool_name,
          input: payload.input,
          inputRaw: JSON.stringify(payload.input),
          status: 'running',
          startedAt: Date.now(),
        };

        return {
          ...msg,
          blocks: [...(msg.blocks ?? []), toolBlock],
        };
      });
      setConversation({ ...conversation, messages });
    }

    function handleToolDelta(event: WebSocketEvent): void {
      const payload = event.payload as ChatToolDeltaPayload;
      const conversation = getConversation(payload.conversation_id);
      if (!conversation) return;

      const messages = conversation.messages.map(msg => {
        if (msg.id !== payload.message_id || !msg.blocks) return msg;

        const blocks = msg.blocks.map(block => {
          if (block.type !== 'tool' || block.toolId !== payload.tool_id) return block;
          return { ...block, inputRaw: block.inputRaw + payload.chunk };
        });

        return { ...msg, blocks };
      });
      setConversation({ ...conversation, messages });
    }

    function handleToolResult(event: WebSocketEvent): void {
      const payload = event.payload as ChatToolResultPayload;
      const conversation = getConversation(payload.conversation_id);
      if (!conversation) return;

      const messages = conversation.messages.map(msg => {
        if (msg.id !== payload.message_id || !msg.blocks) return msg;

        const blocks = msg.blocks.map(block => {
          if (block.type !== 'tool' || block.toolId !== payload.tool_id) return block;
          return {
            ...block,
            status: payload.status === 'success' ? 'success' : 'error',
            output: payload.status === 'success' ? payload.result : undefined,
            error: payload.status === 'error' ? payload.result : undefined,
            completedAt: Date.now(),
          } as ToolCallBlock;
        });

        return { ...msg, blocks };
      });
      setConversation({ ...conversation, messages });
    }

    function handleToolConfirm(event: WebSocketEvent): void {
      const payload = event.payload as ChatToolConfirmPayload;

      // Check if this tool is dismissed for session
      if (isToolDismissedForSession(payload.tool_name)) {
        // Auto-approve
        sendToolApprove(payload.tool_id, true);
        return;
      }

      // Set pending confirmation for UI
      pendingToolConfirm.set({
        conversationId: payload.conversation_id,
        messageId: payload.message_id,
        toolId: payload.tool_id,
        toolName: payload.tool_name,
        input: payload.input,
      });
    }
    ```

- [x] **4.2** Add sendToolApprove function
  - File: `src/services/chat.service.ts`
  - Action: Add:
    ```typescript
    export function sendToolApprove(toolId: string, approved: boolean): void {
      const event: WebSocketEvent = {
        type: CHAT_TOOL_APPROVE,
        payload: { tool_id: toolId, approved },
        timestamp: new Date().toISOString(),
      };
      wsSend(event);
      clearPendingConfirm();
    }
    ```

- [x] **4.3** Register tool handlers in initChatService
  - File: `src/services/chat.service.ts`
  - Action: Add to cleanups array:
    ```typescript
    wsOn(CHAT_TOOL_START, handleToolStart),
    wsOn(CHAT_TOOL_DELTA, handleToolDelta),
    wsOn(CHAT_TOOL_RESULT, handleToolResult),
    wsOn(CHAT_TOOL_CONFIRM, handleToolConfirm),
    ```

- [x] **4.4** Refactor handleTextDelta for blocks
  - File: `src/services/chat.service.ts`
  - Action: Update `handleTextDelta` to append to a TextBlock instead of content string:
    ```typescript
    function handleTextDelta(event: WebSocketEvent): void {
      const payload = event.payload as ChatTextDeltaPayload;
      const conversation = getConversation(payload.conversation_id);
      if (!conversation) return;

      const messages = conversation.messages.map(msg => {
        if (msg.id !== payload.message_id) return msg;

        // Find or create text block
        const blocks = msg.blocks ?? [];
        const lastBlock = blocks[blocks.length - 1];

        if (lastBlock?.type === 'text') {
          // Append to existing text block
          const updatedBlocks = blocks.map((b, i) =>
            i === blocks.length - 1 && b.type === 'text'
              ? { ...b, content: b.content + payload.content }
              : b
          );
          return { ...msg, blocks: updatedBlocks, content: msg.content + payload.content };
        } else {
          // Create new text block
          const newBlock: TextBlock = {
            type: 'text',
            id: `text-${payload.index}`,
            content: payload.content,
          };
          return { ...msg, blocks: [...blocks, newBlock], content: msg.content + payload.content };
        }
      });
      setConversation({ ...conversation, messages });
    }
    ```
  - Notes: Also updates `content` for backward compat with existing rendering.

- [x] **4.5** Refactor handleThinkingDelta for blocks
  - File: `src/services/chat.service.ts`
  - Action: Similar to text delta — accumulate into ThinkingBlock

#### Task 5: tool-call-block Component
Create the component that renders individual tool calls.

- [x] **5.1** Create tool-call-block component
  - File: `src/components/core/chat/tool-call-block.ts` (NEW)
  - Action: Create component with:
    - Props: `block: ToolCallBlock`, `conversationId: string`, `messageId: string`
    - Display: tool name, status indicator, collapsible input, collapsible output
    - Status styling: pending (gray), running (blue pulse), success (green), error (red)
    - Inline approve/deny buttons when status is 'pending' (from confirm event)
    - "Don't ask again this session" checkbox
  - Notes: Follow existing conversation-block patterns. Use Shoelace for buttons/badges.

- [x] **5.2** Add status icons and styling
  - File: `src/components/core/chat/tool-call-block.ts`
  - Action: Define Lucide icons for each status (loader for running, check for success, x for error)
  - Notes: Follow existing ICONS pattern from conversation-block.ts

#### Task 6: tool-confirm-modal Component
Create the modal dialog for dangerous tool confirmations.

- [x] **6.1** Create tool-confirm-modal component
  - File: `src/components/core/chat/tool-confirm-modal.ts` (NEW)
  - Action: Create Shoelace dialog component:
    - Watch `pendingToolConfirm` signal
    - Open when signal is non-null AND tool is dangerous (bash, file_write)
    - Display: tool name, input preview, explanation from TOOL_HINTS
    - Parse bash command to explain what it does (e.g., "rm deletes file X")
    - Buttons: Approve, Deny, "Don't ask again this session" checkbox
    - On approve: call `sendToolApprove(toolId, true)`, optionally `dismissToolForSession`
    - On deny: call `sendToolApprove(toolId, false)`

- [x] **6.2** Add bash command explanation logic
  - File: `src/components/core/chat/tool-confirm-modal.ts`
  - Action: Add helper to parse common bash commands and generate human-readable explanations:
    ```typescript
    function explainBashCommand(command: string): string {
      if (command.startsWith('rm ')) return `Delete files: ${command.replace('rm ', '')}`;
      if (command.startsWith('mv ')) return `Move/rename files`;
      if (command.startsWith('cp ')) return `Copy files`;
      // ... etc
      return `Execute: ${command.slice(0, 50)}${command.length > 50 ? '...' : ''}`;
    }
    ```

#### Task 7: conversation-block Refactor
Update conversation-block to render MessageBlocks.

- [x] **7.1** Import and render tool-call-block
  - File: `src/components/core/chat/conversation-block.ts`
  - Action:
    - Import `'./tool-call-block.js'`
    - In `_renderContent()`, check if `message.blocks` exists
    - If blocks exist, render each block by type instead of rendering content directly

- [x] **7.2** Update _renderContent for blocks
  - File: `src/components/core/chat/conversation-block.ts`
  - Action: Replace content rendering with block rendering:
    ```typescript
    private _renderContent() {
      const { message } = this;

      if (message.isStreaming && !message.content && !message.blocks?.length) {
        return this._renderTypingIndicator();
      }

      if (this._isError()) {
        return this._renderError();
      }

      // Render blocks if available
      if (message.blocks?.length) {
        return html`
          ${message.blocks.map(block => this._renderBlock(block))}
          ${message.isPartial ? html`<span class="partial-indicator">Response was interrupted</span>` : nothing}
        `;
      }

      // Fallback to content string (backward compat)
      return this._renderLegacyContent();
    }

    private _renderBlock(block: MessageBlock) {
      switch (block.type) {
        case 'text':
          return html`<markdown-renderer .content=${block.content}></markdown-renderer>`;
        case 'thinking':
          return this._renderThinkingBlock(block);
        case 'tool':
          return html`<tool-call-block
            .block=${block}
            .conversationId=${this.conversationId}
            .messageId=${this.message.id}
          ></tool-call-block>`;
      }
    }
    ```

#### Task 8: Provider Settings — Execution Tab
Add trust level settings to the provider dialog.

- [x] **8.1** Add Execution tab to provider-settings
  - File: `src/components/core/settings/provider-settings.ts`
  - Action: Add new tab after Ollama:
    ```typescript
    <sl-tab slot="nav" panel="execution">Execution</sl-tab>
    <sl-tab-panel name="execution">${this._renderExecutionTab()}</sl-tab-panel>
    ```

- [x] **8.2** Implement _renderExecutionTab
  - File: `src/components/core/settings/provider-settings.ts`
  - Action: Add method:
    ```typescript
    private _renderExecutionTab() {
      const current = trustLevelState.get();
      return html`
        <div class="provider-form">
          <div class="field-group">
            <span class="section-label">Trust Level</span>
            <sl-select
              .value=${current}
              @sl-change=${(e: Event) => this._handleTrustLevelChange((e.target as HTMLSelectElement).value)}
            >
              <sl-option value="supervised">
                Supervised — Confirm all tool executions
              </sl-option>
              <sl-option value="guided">
                Guided — Confirm dangerous tools only (recommended)
              </sl-option>
              <sl-option value="autonomous">
                Autonomous — Execute all tools without confirmation
              </sl-option>
            </sl-select>
            <span class="help-text">
              Controls when you're asked to approve tool executions.
            </span>
          </div>
        </div>
      `;
    }
    ```

- [x] **8.3** Handle trust level change and persist
  - File: `src/components/core/settings/provider-settings.ts`
  - Action: Add handler that updates state and persists to settings

#### Task 9: Ollama Model Selector Enhancements
Add supportsTools badge and filter toggle.

- [x] **9.1** Add [Tools] badge to model options
  - File: `src/components/core/settings/provider-settings.ts`
  - Action: In `_renderModelSelector`, conditionally show badge:
    ```typescript
    ${models.map(m => html`
      <sl-option value=${m.id}>
        ${m.name}
        ${m.supports_tools ? html`<sl-badge variant="success" pill>Tools</sl-badge>` : nothing}
      </sl-option>
    `)}
    ```

- [x] **9.2** Add filter toggle for Ollama tab
  - File: `src/components/core/settings/provider-settings.ts`
  - Action: Add state `_showOnlyToolCapable: boolean` and checkbox:
    ```typescript
    <sl-checkbox
      ?checked=${this._showOnlyToolCapable}
      @sl-change=${(e: Event) => { this._showOnlyToolCapable = (e.target as HTMLInputElement).checked; }}
    >
      Show only tool-capable models
    </sl-checkbox>
    ```
  - Filter models in render: `models.filter(m => !this._showOnlyToolCapable || m.supports_tools)`

#### Task 10: Integration — Wire up modal to app
Ensure the confirmation modal is rendered at the app level.

- [x] **10.1** Add tool-confirm-modal to app shell
  - File: `src/components/app-shell.ts` or equivalent root component
  - Action: Import and add `<tool-confirm-modal></tool-confirm-modal>` to the template
  - Notes: Modal watches `pendingToolConfirm` signal and opens automatically

### Acceptance Criteria

#### Types & State
- [x] AC-1: Given the backend returns a model with `supports_tools: true`, when the frontend parses it, then `Model.supports_tools` is correctly typed and accessible.
- [x] AC-2: Given a new conversation, when an assistant message streams in, then `message.blocks` contains TextBlock entries for text content.
- [x] AC-3: Given the app loads, when no settings exist, then `trustLevelState` defaults to 'guided'.

#### Tool Event Handling
- [x] AC-4: Given a `chat:tool-start` event, when received, then a ToolCallBlock with status 'running' is added to the message's blocks array.
- [x] AC-5: Given a `chat:tool-delta` event, when received, then the corresponding ToolCallBlock's `inputRaw` is appended with the chunk.
- [x] AC-6: Given a `chat:tool-result` event with status 'success', when received, then the ToolCallBlock's status becomes 'success' and output is populated.
- [x] AC-7: Given a `chat:tool-result` event with status 'error', when received, then the ToolCallBlock's status becomes 'error' and error message is populated.
- [x] AC-8: Given a `chat:tool-confirm` event for a session-dismissed tool, when received, then auto-approve is sent without showing UI.

#### Tool Call Block Component
- [x] AC-9: Given a ToolCallBlock with status 'running', when rendered, then it displays tool name with a loading indicator.
- [x] AC-10: Given a ToolCallBlock with status 'success', when rendered, then it displays a green checkmark and collapsible output.
- [x] AC-11: Given a ToolCallBlock with status 'error', when rendered, then it displays a red X and the error message.
- [x] AC-12: Given a ToolCallBlock with input `{"path": "/foo/bar.txt"}`, when input is expanded, then it displays formatted JSON.

#### Confirmation Flow
- [x] AC-13: Given trust level 'guided' and a `chat:tool-confirm` for 'bash', when received, then the confirmation modal opens.
- [x] AC-14: Given trust level 'guided' and a `chat:tool-confirm` for 'file_read', when received, then no modal opens (safe tool).
- [x] AC-15: Given trust level 'supervised' and any tool confirm, when received, then the modal opens.
- [x] AC-16: Given trust level 'autonomous' and any tool confirm, when received, then auto-approve is sent.
- [x] AC-17: Given the modal is open with bash command `rm -rf /tmp/test`, when displayed, then it shows "Delete files: -rf /tmp/test".
- [x] AC-18: Given user clicks "Approve" in modal, when clicked, then `chat:tool-approve` is sent with `approved: true`.
- [x] AC-19: Given user clicks "Deny" in modal, when clicked, then `chat:tool-approve` is sent with `approved: false`.
- [x] AC-20: Given user checks "Don't ask again" and approves, when a subsequent confirm for same tool arrives, then it auto-approves.

#### Settings UI
- [x] AC-21: Given the provider-settings dialog opens, when "Execution" tab is clicked, then trust level selector is displayed.
- [x] AC-22: Given user selects "Autonomous" trust level, when saved, then subsequent tool confirms auto-approve.

#### Ollama Model Selector
- [x] AC-23: Given Ollama models list includes `llama3.1:latest`, when displayed, then it shows `[Tools]` badge.
- [x] AC-24: Given Ollama models list includes `codellama:7b`, when displayed, then no badge is shown.
- [x] AC-25: Given "Show only tool-capable" is checked, when models are filtered, then only models with `supports_tools: true` appear.

## Additional Context

### Dependencies

- No new npm dependencies (Shoelace already available)
- No new Go dependencies
- Requires backend branch `story/3-12-tool-execution-backend` to be merged first

### Testing Strategy

- **Component tests:** `@open-wc/testing` fixtures for `tool-call-block`, `tool-confirm-modal`
  - Verify status styling for each ToolStatus value
  - Verify input/output collapse/expand behavior
  - Verify approve/deny button dispatch correct events
- **Service tests:** Mock WebSocket events, verify state updates
  - Each handler updates correct signal
  - Tool confirm respects session dismissal
  - Tool confirm respects trust level
- **State tests:** Verify signal mutations
  - `dismissToolForSession` adds to set
  - `clearPendingConfirm` resets to null
- **Integration:** Manual test with backend running
  - Trigger file_read tool call → verify block renders with output
  - Trigger bash tool call → verify confirm modal with explanation
  - Approve/deny and verify execution continues/stops

### Notes

- **Spec 1 complete:** Backend tool execution layer done (branch `story/3-12-tool-execution-backend`)
- **WebSocket events ready:** `chat:tool-start`, `chat:tool-delta`, `chat:tool-result`, `chat:tool-confirm`, `chat:tool-approve` implemented in backend
- **project-context.md updated:** Tool execution security rules and event payloads documented
- **JSON tags:** Backend uses `snake_case` (`conversation_id`), frontend types match this convention
- **Backward compatibility:** Existing messages without `blocks` still render via `content` string fallback
- **Future work:** Per-workflow tool permissions, context-aware loop budget, MCP tool UI
