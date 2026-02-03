import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import './conversation-block.js';
import './chat-input.js';
import '../navigation/agent-badge.js';
import type { ChatInput } from './chat-input.js';

import {
  activeConversations,
  setConversation,
} from '../../../state/chat.state.js';
import { activeProviderState, selectedModelState } from '../../../state/provider.state.js';
import { projectState } from '../../../state/project.state.js';
import { connectionState } from '../../../state/connection.state.js';
import {
  activeAgentId,
  agentConversations,
  getAgentConversationId,
  setAgentConversation,
} from '../../../state/agent.state.js';
import type { Conversation, Message } from '../../../types/conversation.js';

// Connection status labels (colors handled by CSS classes)
const STATUS_ICONS = {
  connected: { label: 'Connected' },
  connecting: { label: 'Connecting' },
  disconnected: { label: 'Disconnected' },
  error: { label: 'Connection error' },
} as const;

@customElement('chat-panel')
export class ChatPanel extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background-color: var(--bmad-color-bg-primary);
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-secondary);
      min-height: 36px;
    }

    .header-title {
      font-size: var(--bmad-font-size-sm);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-primary);
    }

    .connection-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--bmad-radius-full);
      flex-shrink: 0;
    }

    .connection-dot--connected {
      background-color: var(--bmad-color-success);
    }

    .connection-dot--connecting {
      background-color: var(--bmad-color-warning);
      animation: pulse-dot 1.5s ease-in-out infinite;
    }

    .connection-dot--disconnected {
      background-color: var(--bmad-color-warning);
    }

    .connection-dot--error {
      background-color: var(--bmad-color-error);
    }

    @keyframes pulse-dot {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }

    .message-area {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .message-list {
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: var(--bmad-spacing-xl);
      color: var(--bmad-color-text-muted);
      font-size: var(--bmad-font-size-md);
      text-align: center;
    }
  `;

  @query('chat-input') private _chatInput!: ChatInput;
  @state() private _conversationId = '';
  @state() private _userHasScrolled = false;
  private _lastAgentId: string | null = null;

  willUpdate(): void {
    // Ensure conversation exists before render (safe for state mutations in willUpdate)
    const project = projectState.get();
    const provider = activeProviderState.get();
    if (project && provider) {
      const currentAgentId = activeAgentId.get();

      // Detect agent switch
      if (currentAgentId !== this._lastAgentId) {
        this._lastAgentId = currentAgentId;

        if (currentAgentId) {
          // Check if agent has an existing conversation
          const existingConvId = getAgentConversationId(currentAgentId);
          if (existingConvId && activeConversations.get().has(existingConvId)) {
            this._conversationId = existingConvId;
            return;
          }
          // Agent has no conversation - create one
          this._conversationId = '';
        }
      }

      this._ensureConversation();
    }
  }

  updated(): void {
    if (!this._userHasScrolled) {
      this._scrollToBottom();
    }
  }

  private _ensureConversation(): string {
    if (this._conversationId) {
      const existing = activeConversations.get().get(this._conversationId);
      if (existing) return this._conversationId;
    }

    // Create new conversation
    const id = crypto.randomUUID();
    const provider = activeProviderState.get();
    const model = selectedModelState.get();
    const currentAgentId = activeAgentId.get();
    const conversation: Conversation = {
      id,
      messages: [],
      model: model || '',
      provider: provider || '',
      createdAt: Date.now(),
      agentId: currentAgentId ?? undefined,
    };
    setConversation(conversation);
    this._conversationId = id;

    // Register conversation mapping for the agent
    if (currentAgentId) {
      setAgentConversation(currentAgentId, id);
    }

    return id;
  }

  private _getMessages(): Message[] {
    if (!this._conversationId) return [];
    const conversation = activeConversations.get().get(this._conversationId);
    return conversation?.messages ?? [];
  }

  private _handleScroll(e: Event): void {
    const target = e.target as HTMLElement;
    const threshold = 50;
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    this._userHasScrolled = !atBottom;
  }

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      const area = this.shadowRoot?.querySelector('.message-area');
      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    });
  }

  private _handleRetry(): void {
    const messages = this._getMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        this._chatInput?.sendContent(messages[i].content);
        break;
      }
    }
  }

  private _renderConnectionStatus() {
    const status = connectionState.get();
    const config = STATUS_ICONS[status];

    return html`
      <span
        class="connection-dot connection-dot--${status}"
        title=${config.label}
        aria-label=${config.label}
      ></span>
    `;
  }

  render() {
    const project = projectState.get();
    const provider = activeProviderState.get();

    // Empty state: no project
    if (!project) {
      return html`
        <div class="empty-state">Open a project to start chatting</div>
      `;
    }

    // Empty state: no provider
    if (!provider) {
      return html`
        <div class="empty-state">Configure a provider in settings to start chatting</div>
      `;
    }

    const messages = this._getMessages();

    return html`
      <div class="panel-header">
        <agent-badge></agent-badge>
        ${this._renderConnectionStatus()}
      </div>
      <div
        class="message-area"
        role="log"
        aria-live="polite"
        @scroll=${this._handleScroll}
      >
        <div class="message-list">
          ${messages.length === 0
            ? html`<div class="empty-state">Start a conversation</div>`
            : messages.map(msg => html`
                <conversation-block
                  .message=${msg}
                  @retry-message=${this._handleRetry}
                ></conversation-block>
              `)
          }
        </div>
      </div>
      <chat-input .conversationId=${this._conversationId}></chat-input>
    `;
  }

  /** Delegates focus to the internal chat-input textarea */
  focusInput(): void {
    this._chatInput?.focusInput();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-panel': ChatPanel;
  }
}
