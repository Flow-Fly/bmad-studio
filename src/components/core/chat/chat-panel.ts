import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import './conversation-block.js';
import './chat-input.js';

import {
  chatConnectionState,
  activeConversations,
  streamingConversationId,
  setConversation,
} from '../../../state/chat.state.js';
import { activeProviderState, selectedModelState } from '../../../state/provider.state.js';
import { projectState } from '../../../state/project.state.js';
import { connectionState } from '../../../state/connection.state.js';
import { sendMessage } from '../../../services/chat.service.js';
import type { Conversation, Message } from '../../../types/conversation.js';

// Connection status icons
const STATUS_ICONS = {
  connected: { color: 'var(--bmad-color-success)', label: 'Connected' },
  connecting: { color: 'var(--bmad-color-warning)', label: 'Connecting' },
  disconnected: { color: 'var(--bmad-color-warning)', label: 'Disconnected' },
  error: { color: 'var(--bmad-color-error)', label: 'Connection error' },
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

    .connection-dot--connecting {
      animation: pulse-dot 1.5s ease-in-out infinite;
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

  @state() private _conversationId = '';
  @state() private _userHasScrolled = false;

  private _scrollContainer: HTMLElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  updated(): void {
    // Auto-scroll on new messages if user hasn't scrolled up
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
    const conversation: Conversation = {
      id,
      messages: [],
      model: model || '',
      provider: provider || '',
      createdAt: Date.now(),
    };
    setConversation(conversation);
    this._conversationId = id;
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
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        // Re-send the last user message
        const provider = activeProviderState.get();
        const model = selectedModelState.get();
        if (provider && model && this._conversationId) {
          // Note: retry will need API key - this is handled by chat-input
          // For now, dispatch an event that chat-input can listen to
          this.dispatchEvent(new CustomEvent('retry-request', {
            detail: { content: messages[i].content },
            bubbles: true,
            composed: true,
          }));
        }
        break;
      }
    }
  }

  private _renderConnectionStatus() {
    const status = connectionState.get();
    const config = STATUS_ICONS[status];
    const isConnecting = status === 'connecting';

    return html`
      <span
        class="connection-dot ${isConnecting ? 'connection-dot--connecting' : ''}"
        style="background-color: ${config.color}"
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

    // Ensure we have a conversation
    const conversationId = this._ensureConversation();
    const messages = this._getMessages();

    return html`
      <div class="panel-header">
        <span class="header-title">Chat</span>
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
      <chat-input .conversationId=${conversationId}></chat-input>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-panel': ChatPanel;
  }
}
