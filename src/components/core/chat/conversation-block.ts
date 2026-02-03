import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Message } from '../../../types/conversation.js';

// Lucide icon SVG definitions
const ICONS = {
  'alert-circle': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', y1: '8', x2: '12', y2: '12' }],
    ['line', { x1: '12', y1: '16', x2: '12.01', y2: '16' }],
  ],
  'refresh-cw': [
    ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
    ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }],
    ['path', { d: 'M3 21v-5h5' }],
  ],
  'copy': [
    ['rect', { x: '8', y: '8', width: '14', height: '14', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  'check': [
    ['path', { d: 'M20 6 9 17l-5-5' }],
  ],
} as const;

@customElement('conversation-block')
export class ConversationBlock extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .message {
      display: flex;
      flex-direction: column;
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      gap: var(--bmad-spacing-xs);
      position: relative;
    }

    .message--user {
      background-color: color-mix(in srgb, var(--bmad-color-accent) 8%, transparent);
    }

    .message--assistant {
      background-color: var(--bmad-color-bg-secondary);
    }

    .message--error {
      border-left: 3px solid var(--bmad-color-error);
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
    }

    .sender {
      font-size: var(--bmad-font-size-sm);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-secondary);
    }

    .timestamp {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
    }

    .content {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-primary);
      line-height: var(--bmad-line-height-normal);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: var(--bmad-spacing-xs) 0;
    }

    .typing-indicator span {
      width: 6px;
      height: 6px;
      border-radius: var(--bmad-radius-full);
      background-color: var(--bmad-color-text-tertiary);
      animation: typing-bounce 1.4s ease-in-out infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing-bounce {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    .partial-indicator {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-warning);
      font-style: italic;
    }

    .error-content {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-sm);
    }

    .error-text {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      color: var(--bmad-color-error);
      font-size: var(--bmad-font-size-sm);
    }

    .error-text .icon {
      flex-shrink: 0;
    }

    .retry-button {
      display: inline-flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-sm);
      background: none;
      color: var(--bmad-color-text-secondary);
      font-size: var(--bmad-font-size-sm);
      cursor: pointer;
      transition: all var(--bmad-transition-fast);
    }

    .retry-button:hover {
      background-color: var(--bmad-color-bg-tertiary);
      color: var(--bmad-color-text-primary);
      border-color: var(--bmad-color-text-tertiary);
    }

    .retry-button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .icon {
      width: 14px;
      height: 14px;
      display: inline-flex;
    }

    .icon svg {
      width: 100%;
      height: 100%;
    }

    .copy-button {
      position: absolute;
      top: var(--bmad-spacing-xs);
      right: var(--bmad-spacing-sm);
      display: inline-flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs);
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: var(--bmad-color-bg-elevated);
      color: var(--bmad-color-text-tertiary);
      cursor: pointer;
      opacity: 0;
      transition: opacity 200ms ease, color var(--bmad-transition-fast);
      font-size: var(--bmad-font-size-xs);
      line-height: 1;
    }

    .message:hover .copy-button,
    .copy-button:focus-visible {
      opacity: 1;
    }

    .copy-button:hover {
      color: var(--bmad-color-text-primary);
    }

    .copy-button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .copy-button--copied {
      color: var(--bmad-color-success);
    }

    .copied-text {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-success);
    }

    @media (prefers-reduced-motion: reduce) {
      .copy-button {
        transition: none;
      }

      .typing-indicator span {
        animation: none;
        opacity: 0.6;
      }
    }
  `;

  @property({ type: Object }) message!: Message;
  @state() private _copied = false;

  private _hasCopyableContent(): boolean {
    if (!this.message) return false;
    if (this.message.isStreaming && !this.message.content) return false;
    if (this._isError()) return false;
    return !!this.message.content;
  }

  private async _handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message.content);
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 1500);
    } catch {
      // Silent failure -- clipboard API unavailable
    }
  }

  private _formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Tech debt: error detection relies on message content prefix set by chat.service.ts handleError().
  // A dedicated error field on Message would be more robust (tracked for future story).
  private _isError(): boolean {
    return this.message.role === 'assistant' && this.message.content.startsWith('Error: ');
  }

  private _handleRetry(): void {
    this.dispatchEvent(new CustomEvent('retry-message', {
      bubbles: true,
      composed: true,
    }));
  }

  private _renderIcon(name: keyof typeof ICONS) {
    const elements = ICONS[name];
    if (!elements) return nothing;
    return html`
      <span class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${elements.map(([tag, attrs]) => {
            switch (tag) {
              case 'circle': return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
              case 'rect': return svg`<rect x=${attrs.x} y=${attrs.y} width=${attrs.width} height=${attrs.height} rx=${attrs.rx} ry=${attrs.ry} />`;
              case 'path': return svg`<path d=${attrs.d} />`;
              case 'line': return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
              default: return nothing;
            }
          })}
        </svg>
      </span>
    `;
  }

  private _renderTypingIndicator() {
    return html`
      <div class="typing-indicator" aria-label="Assistant is typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  }

  private _renderContent() {
    const { message } = this;

    // Streaming with no content yet — show typing indicator
    if (message.isStreaming && !message.content) {
      return this._renderTypingIndicator();
    }

    // Error state
    if (this._isError()) {
      const errorMessage = message.content.replace(/^Error:\s*/, '');
      return html`
        <div class="error-content">
          <div class="error-text">
            ${this._renderIcon('alert-circle')}
            <span>${errorMessage}</span>
          </div>
          <button class="retry-button" @click=${this._handleRetry} aria-label="Retry sending message">
            ${this._renderIcon('refresh-cw')}
            Retry
          </button>
        </div>
      `;
    }

    // Regular content (possibly still streaming)
    return html`
      <div class="content">${message.content}</div>
      ${message.isPartial ? html`<span class="partial-indicator">Response was interrupted</span>` : nothing}
    `;
  }

  render() {
    if (!this.message) return nothing;

    const isUser = this.message.role === 'user';
    const isError = this._isError();
    const senderLabel = isUser ? 'You' : 'Assistant';
    const ariaLabel = `${senderLabel} at ${this._formatTime(this.message.timestamp)}: ${this.message.content || 'typing'}`;

    const showCopy = this._hasCopyableContent();

    return html`
      <div
        class="message ${isUser ? 'message--user' : 'message--assistant'} ${isError ? 'message--error' : ''}"
        role="listitem"
        aria-label=${ariaLabel}
      >
        ${showCopy ? html`
          <button
            class="copy-button ${this._copied ? 'copy-button--copied' : ''}"
            @click=${this._handleCopy}
            aria-label=${this._copied ? 'Copied' : 'Copy message'}
          >
            ${this._copied
              ? html`${this._renderIcon('check')} <span class="copied-text">Copied!</span>`
              : this._renderIcon('copy')}
          </button>
        ` : nothing}
        <div class="message-header">
          <span class="sender">${senderLabel}</span>
          <span class="timestamp">${this._formatTime(this.message.timestamp)}</span>
        </div>
        ${this._renderContent()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'conversation-block': ConversationBlock;
  }
}
