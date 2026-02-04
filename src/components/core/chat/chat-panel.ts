import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { SignalWatcher } from '@lit-labs/signals';

import './conversation-block.js';
import './chat-input.js';
import './context-indicator.js';
import './conversation-lifecycle-menu.js';
import './discard-confirm-dialog.js';
import './context-full-modal.js';
import '../navigation/agent-badge.js';
import type { ChatInput } from './chat-input.js';

import {
  activeConversations,
  setConversation,
  removeConversation,
  getActiveConversationCount,
} from '../../../state/chat.state.js';
import { activeProviderState, selectedModelState } from '../../../state/provider.state.js';
import { projectState, projectName$ } from '../../../state/project.state.js';
import { connectionState } from '../../../state/connection.state.js';
import {
  activeAgentId,
  activeAgent$,
  agentConversations,
  getAgentConversationId,
  setAgentConversation,
  clearAgentConversation,
} from '../../../state/agent.state.js';
import type { Conversation, Message } from '../../../types/conversation.js';
import type { Insight } from '../../../types/insight.js';
import { createInsight } from '../../../services/insight.service.js';

// Lucide arrow-down icon SVG definition
const ARROW_DOWN_ICON = [
  ['path', { d: 'M12 5v14' }],
  ['path', { d: 'm19 12-7 7-7-7' }],
] as const;

// Lucide more-vertical icon SVG definition
const MORE_VERTICAL_ICON = [
  ['circle', { cx: '12', cy: '12', r: '1' }],
  ['circle', { cx: '12', cy: '5', r: '1' }],
  ['circle', { cx: '12', cy: '19', r: '1' }],
] as const;

// Connection status labels (colors handled by CSS classes)
const STATUS_ICONS = {
  connected: { label: 'Connected' },
  connecting: { label: 'Connecting' },
  disconnected: { label: 'Disconnected' },
  error: { label: 'Connection error' },
} as const;

// Known model context window sizes (tokens). Model.max_tokens in the backend
// represents max output tokens, not the context window capacity.
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-5-20251101': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'claude-haiku-4-5-20251001': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

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

    .message-area-wrapper {
      position: relative;
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
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

    .scroll-to-bottom {
      position: absolute;
      bottom: var(--bmad-spacing-sm);
      right: var(--bmad-spacing-lg);
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-full);
      background: var(--bmad-color-bg-elevated);
      color: var(--bmad-color-text-secondary);
      cursor: pointer;
      box-shadow: var(--bmad-shadow-sm);
      z-index: 50;
      opacity: 1;
      transition: opacity 200ms ease-out, color var(--bmad-transition-fast);
    }

    .scroll-to-bottom:hover {
      color: var(--bmad-color-text-primary);
    }

    .scroll-to-bottom:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .scroll-to-bottom .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
    }

    .scroll-to-bottom .icon svg {
      width: 100%;
      height: 100%;
    }

    .header-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      position: relative;
    }

    .menu-trigger {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: none;
      color: var(--bmad-color-text-tertiary);
      cursor: pointer;
      padding: 0;
      transition: all var(--bmad-transition-fast);
    }

    .menu-trigger:hover {
      background-color: var(--bmad-color-bg-tertiary);
      color: var(--bmad-color-text-primary);
    }

    .menu-trigger:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .menu-trigger .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
    }

    .menu-trigger .icon svg {
      width: 100%;
      height: 100%;
    }

    conversation-lifecycle-menu {
      top: 100%;
      right: 0;
      margin-top: var(--bmad-spacing-xs);
    }

    @media (prefers-reduced-motion: reduce) {
      .scroll-to-bottom,
      .menu-trigger {
        transition: none;
      }
    }
  `;

  @query('chat-input') private _chatInput!: ChatInput;
  @state() private _conversationId = '';
  @state() private _userHasScrolled = false;
  @state() private _showLifecycleMenu = false;
  @state() private _showDiscardConfirm = false;
  @state() private _showContextFullModal = false;
  private _lastAgentId: string | null = null;
  private _lastMessageCount = 0;
  private _contextFullShown = false;
  private _beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (getActiveConversationCount() > 1) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
  }

  willUpdate(): void {
    // Ensure conversation exists before render (safe for state mutations in willUpdate)
    const project = projectState.get();
    const provider = activeProviderState.get();
    if (project && provider) {
      const currentAgentId = activeAgentId.get();

      // Detect agent switch
      if (currentAgentId !== this._lastAgentId) {
        const previousAgentId = this._lastAgentId;
        this._lastAgentId = currentAgentId;

        if (currentAgentId) {
          // Check if agent has an existing conversation
          const existingConvId = getAgentConversationId(currentAgentId);
          if (existingConvId && activeConversations.get().has(existingConvId)) {
            this._conversationId = existingConvId;
            return;
          }

          // Migrate orphaned conversation: if switching from null (no agent) to
          // a real agent and a conversation already exists without an agent,
          // adopt it rather than creating a new blank one.
          if (previousAgentId === null && this._conversationId) {
            const orphan = activeConversations.get().get(this._conversationId);
            if (orphan && !orphan.agentId) {
              const migrated: Conversation = { ...orphan, agentId: currentAgentId };
              setConversation(migrated);
              setAgentConversation(currentAgentId, this._conversationId);
              return;
            }
          }

          // Agent has no conversation - create one
          this._conversationId = '';
        }
      }

      this._ensureConversation();
    }
  }

  updated(): void {
    const messages = this._getMessages();
    const currentCount = messages.length;

    // Scroll to bottom when new messages appear or streaming content updates
    if (!this._userHasScrolled) {
      this._scrollToBottom();
    }

    this._lastMessageCount = currentCount;

    // Check if context is full and show modal (only once per conversation)
    const pct = this._getContextPercentage();
    if (pct >= 100 && !this._contextFullShown) {
      this._contextFullShown = true;
      this._showContextFullModal = true;
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
      highlights: [],
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

  private _scrollToBottomAndReset(): void {
    this._userHasScrolled = false;
    this._scrollToBottom();
  }

  private _renderArrowDownIcon() {
    return html`
      <span class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${ARROW_DOWN_ICON.map(([, attrs]) => svg`<path d=${attrs.d} />`)}
        </svg>
      </span>
    `;
  }

  private _getContextPercentage(): number {
    if (!this._conversationId) return 0;
    const conversation = activeConversations.get().get(this._conversationId);
    if (!conversation || conversation.messages.length === 0) return 0;

    const totalTokens = conversation.messages.reduce((sum, msg) => {
      if (msg.usage) {
        return sum + msg.usage.input_tokens + msg.usage.output_tokens;
      }
      return sum;
    }, 0);

    if (totalTokens === 0) return 0;

    const model = selectedModelState.get();
    if (!model) return 0;

    const contextWindow = MODEL_CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW;
    return Math.min(100, Math.round((totalTokens / contextWindow) * 100));
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

  private _handleLifecycleMenuToggle(): void {
    this._showLifecycleMenu = !this._showLifecycleMenu;
  }

  private _handleContextIndicatorClick(): void {
    this._showLifecycleMenu = !this._showLifecycleMenu;
  }

  private _handleLifecycleKeep(): void {
    this._showLifecycleMenu = false;
  }

  private async _handleLifecycleCompact(): Promise<void> {
    this._showLifecycleMenu = false;
    this._showContextFullModal = false;

    const conversation = activeConversations.get().get(this._conversationId);
    if (!conversation) return;

    const firstUserMsg = conversation.messages.find(m => m.role === 'user');
    const agent = activeAgent$.get();

    const insight: Insight = {
      id: crypto.randomUUID(),
      title: firstUserMsg?.content.slice(0, 100) || 'Untitled conversation',
      originContext: '',
      extractedIdea: '',
      tags: [],
      highlightColorsUsed: [...new Set(conversation.highlights.map(h => h.color))],
      createdAt: new Date().toISOString(),
      sourceAgent: agent?.name || 'Unknown',
      status: 'fresh',
      usedInCount: 0,
    };

    const projectId = projectName$.get();
    if (projectId) {
      try {
        await createInsight(projectId, insight);
      } catch (err) {
        console.error('Failed to create insight:', err);
      }
    }

    this._clearCurrentConversation();
  }

  private _handleLifecycleDiscard(): void {
    this._showLifecycleMenu = false;
    this._showContextFullModal = false;
    this._showDiscardConfirm = true;
  }

  private _handleLifecycleDismiss(): void {
    this._showLifecycleMenu = false;
  }

  private _handleDiscardConfirmed(): void {
    this._showDiscardConfirm = false;
    this._clearCurrentConversation();
  }

  private _handleDiscardCancelled(): void {
    this._showDiscardConfirm = false;
  }

  private _clearCurrentConversation(): void {
    const conversation = activeConversations.get().get(this._conversationId);
    const agentId = conversation?.agentId;

    removeConversation(this._conversationId);
    if (agentId) {
      clearAgentConversation(agentId);
    }

    this._conversationId = '';
    this._contextFullShown = false;
  }

  private _renderMoreVerticalIcon() {
    return html`
      <span class="icon">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
          ${MORE_VERTICAL_ICON.map(([, attrs]) =>
            svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`
          )}
        </svg>
      </span>
    `;
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
    const conversation = this._conversationId
      ? activeConversations.get().get(this._conversationId)
      : undefined;
    const highlights = conversation?.highlights ?? [];

    return html`
      <div class="panel-header">
        <agent-badge></agent-badge>
        ${this._renderConnectionStatus()}
        ${messages.length > 0 ? html`
          <div class="header-actions">
            <button
              class="menu-trigger"
              @click=${this._handleLifecycleMenuToggle}
              aria-label="Conversation actions"
              aria-haspopup="menu"
              aria-expanded=${this._showLifecycleMenu}
            >
              ${this._renderMoreVerticalIcon()}
            </button>
            <conversation-lifecycle-menu
              ?open=${this._showLifecycleMenu}
              .forceAction=${this._getContextPercentage() >= 100}
              @lifecycle-keep=${this._handleLifecycleKeep}
              @lifecycle-compact=${this._handleLifecycleCompact}
              @lifecycle-discard=${this._handleLifecycleDiscard}
              @lifecycle-dismiss=${this._handleLifecycleDismiss}
            ></conversation-lifecycle-menu>
          </div>
        ` : nothing}
      </div>
      <div class="message-area-wrapper">
        <div
          class="message-area"
          role="log"
          aria-live="polite"
          @scroll=${this._handleScroll}
        >
          <div class="message-list">
            ${messages.length === 0
              ? html`<div class="empty-state">Start a conversation</div>`
              : repeat(messages, msg => msg.id, msg => html`
                  <conversation-block
                    .message=${msg}
                    .conversationId=${this._conversationId}
                    .highlights=${highlights}
                    @retry-message=${this._handleRetry}
                  ></conversation-block>
                `)
            }
          </div>
        </div>
        ${this._userHasScrolled ? html`
          <button
            class="scroll-to-bottom"
            @click=${this._scrollToBottomAndReset}
            aria-label="Scroll to latest message"
          >
            ${this._renderArrowDownIcon()}
          </button>
        ` : nothing}
      </div>
      ${messages.length > 0 ? html`
        <context-indicator
          .percentage=${this._getContextPercentage()}
          .modelName=${selectedModelState.get() || ''}
          @context-indicator-click=${this._handleContextIndicatorClick}
        ></context-indicator>
      ` : nothing}
      <chat-input .conversationId=${this._conversationId}></chat-input>
      <discard-confirm-dialog
        ?open=${this._showDiscardConfirm}
        @discard-confirmed=${this._handleDiscardConfirmed}
        @discard-cancelled=${this._handleDiscardCancelled}
      ></discard-confirm-dialog>
      <context-full-modal
        ?open=${this._showContextFullModal}
        @lifecycle-compact=${this._handleLifecycleCompact}
        @lifecycle-discard=${this._handleLifecycleDiscard}
      ></context-full-modal>
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
