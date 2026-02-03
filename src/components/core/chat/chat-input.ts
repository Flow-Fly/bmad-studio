import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import { chatConnectionState } from '../../../state/chat.state.js';
import { activeProviderState, selectedModelState } from '../../../state/provider.state.js';
import { sendMessage } from '../../../services/chat.service.js';
import { getApiKey } from '../../../services/keychain.service.js';

// Lucide send icon
const SEND_ICON = [
  ['path', { d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' }],
  ['path', { d: 'M21.854 2.147 10.94 13.06' }],
] as const;

@customElement('chat-input')
export class ChatInput extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      border-top: 1px solid var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-primary);
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: var(--bmad-spacing-sm);
      background-color: var(--bmad-color-bg-tertiary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-sm);
      transition: border-color var(--bmad-transition-fast);
    }

    .input-wrapper:focus-within {
      border-color: var(--bmad-color-accent);
    }

    .input-wrapper--disabled {
      opacity: 0.7;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 0.7;
      }
      50% {
        opacity: 0.5;
      }
    }

    textarea {
      flex: 1;
      background: none;
      border: none;
      color: var(--bmad-color-text-primary);
      font-family: var(--bmad-font-family);
      font-size: var(--bmad-font-size-md);
      line-height: var(--bmad-line-height-normal);
      resize: none;
      outline: none;
      padding: 0;
      min-height: 21px;
      max-height: 126px; /* ~6 rows */
      overflow-y: auto;
    }

    textarea::placeholder {
      color: var(--bmad-color-text-muted);
    }

    .send-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: none;
      color: var(--bmad-color-accent);
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      transition: all var(--bmad-transition-fast);
    }

    .send-button:hover:not(:disabled) {
      background-color: color-mix(in srgb, var(--bmad-color-accent) 15%, transparent);
    }

    .send-button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .send-button:disabled {
      color: var(--bmad-color-text-muted);
      cursor: not-allowed;
    }

    .send-button .icon {
      width: 18px;
      height: 18px;
    }

    .send-button .icon svg {
      width: 100%;
      height: 100%;
    }

    .no-provider {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-muted);
      text-align: center;
      padding: var(--bmad-spacing-sm);
    }

    .error-message {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-error);
      padding: var(--bmad-spacing-xs) 0 0 0;
    }
  `;

  @query('textarea') private _textarea!: HTMLTextAreaElement;
  @state() private _error = '';

  /** The current conversation ID to send messages to */
  @state() conversationId = '';

  private _autoGrow(): void {
    const ta = this._textarea;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 126)}px`;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    // Cmd+Enter: always send
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      this._send();
      return;
    }

    // Enter without Shift: send (single-line mode)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
      return;
    }

    // Shift+Enter: insert newline (default behavior)
  }

  private async _send(): Promise<void> {
    const content = this._textarea?.value.trim();
    if (!content) return;

    const provider = activeProviderState.get();
    const model = selectedModelState.get();

    if (!provider || !model) {
      this._error = 'No provider configured. Check settings.';
      return;
    }

    if (!this.conversationId) return;

    // Retrieve API key
    let apiKey = '';
    if (provider !== 'ollama') {
      try {
        const key = await getApiKey(provider as 'claude' | 'openai');
        if (!key) {
          this._error = 'API key not found. Check provider settings.';
          return;
        }
        apiKey = key;
      } catch {
        this._error = 'API key not found. Check provider settings.';
        return;
      }
    }

    this._error = '';

    try {
      sendMessage(this.conversationId, content, model, provider, apiKey);
      this._textarea.value = '';
      this._autoGrow();
    } catch {
      this._error = 'Failed to send message. Check your connection.';
    }
  }

  private _renderSendIcon() {
    return html`
      <span class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${SEND_ICON.map(([tag, attrs]) => {
            if (tag === 'path') return svg`<path d=${attrs.d} />`;
            return nothing;
          })}
        </svg>
      </span>
    `;
  }

  render() {
    const provider = activeProviderState.get();
    const isStreaming = chatConnectionState.get() === 'streaming';
    const isDisabled = isStreaming;

    // No provider configured
    if (!provider) {
      return html`
        <div class="no-provider">Configure a provider in settings to start chatting</div>
      `;
    }

    return html`
      <div class="input-wrapper ${isDisabled ? 'input-wrapper--disabled' : ''}">
        <textarea
          rows="1"
          placeholder="Type a message..."
          ?disabled=${isDisabled}
          aria-label="Chat message input"
          role="textbox"
          aria-multiline="true"
          @keydown=${this._handleKeydown}
          @input=${this._autoGrow}
        ></textarea>
        <button
          class="send-button"
          ?disabled=${isDisabled}
          @click=${this._send}
          aria-label="Send message"
        >
          ${this._renderSendIcon()}
        </button>
      </div>
      ${this._error ? html`<div class="error-message">${this._error}</div>` : nothing}
    `;
  }

  /** Send specific content (used for retry from chat-panel) */
  async sendContent(content: string): Promise<void> {
    if (!content.trim()) return;
    const ta = this._textarea;
    if (ta) {
      ta.value = content;
    }
    await this._send();
  }

  /** Focus the textarea input */
  focusInput(): void {
    this._textarea?.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-input': ChatInput;
  }
}
