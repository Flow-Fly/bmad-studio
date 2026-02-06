import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Message, Highlight, HighlightColor, MessageBlock } from '../../../types/conversation.js';
import { HIGHLIGHT_COLORS } from '../../../types/conversation.js';
import { addHighlight } from '../../../state/chat.state.js';
import '../../shared/markdown-renderer.js';
import './highlight-popover.js';
import './tool-call-block.js';

// Semi-transparent tint colors for highlight overlays
const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: 'rgba(240, 192, 64, 0.3)',
  green: 'rgba(64, 192, 87, 0.3)',
  red: 'rgba(224, 82, 82, 0.3)',
  blue: 'rgba(74, 158, 255, 0.3)',
};

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
  'chevron-right': [
    ['path', { d: 'm9 18 6-6-6-6' }],
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

    /* Thinking section */
    .thinking-section {
      margin: var(--bmad-spacing-xs) 0;
    }

    .thinking-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: 0;
      border: none;
      background: none;
      color: var(--bmad-color-text-tertiary);
      font-size: var(--bmad-font-size-xs);
      cursor: pointer;
      transition: color var(--bmad-transition-fast);
    }

    .thinking-toggle:hover {
      color: var(--bmad-color-text-secondary);
    }

    .thinking-toggle:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
      border-radius: var(--bmad-radius-sm);
    }

    .thinking-toggle .icon {
      transition: transform 200ms ease;
    }

    .thinking-toggle--expanded .icon {
      transform: rotate(90deg);
    }

    .thinking-body {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      padding: 0 var(--bmad-spacing-md);
      margin-top: 0;
      background: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-md);
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
      transition: max-height 200ms ease, opacity 200ms ease, padding 200ms ease, margin-top 200ms ease;
    }

    .thinking-body--expanded {
      max-height: 2000px;
      overflow: visible;
      opacity: 1;
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      margin-top: var(--bmad-spacing-xs);
    }

    /* Highlight marks */
    .content {
      position: relative;
    }

    mark.text-highlight {
      border-radius: 2px;
      padding: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .copy-button {
        transition: none;
      }

      .typing-indicator span {
        animation: none;
        opacity: 0.6;
      }

      .thinking-toggle .icon {
        transition: none;
      }

      .thinking-body {
        transition: none;
      }
    }
  `;

  @property({ type: Object }) message!: Message;
  @property({ type: String }) conversationId = '';
  @property({ type: Array }) highlights: Highlight[] = [];
  @state() private _copied = false;
  @state() private _thinkingExpanded = false;
  @state() private _showPopover = false;
  @state() private _popoverX = 0;
  @state() private _popoverY = 0;

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

  private _handleLinkClick(e: CustomEvent<{ url: string }>): void {
    window.open(e.detail.url, '_blank');
  }

  private _handleRetry(): void {
    this.dispatchEvent(new CustomEvent('retry-message', {
      bubbles: true,
      composed: true,
    }));
  }

  private _handleThinkingToggle(): void {
    this._thinkingExpanded = !this._thinkingExpanded;
  }

  /**
   * Get the active text selection, checking shadow roots since
   * window.getSelection() doesn't see selections inside Shadow DOM.
   */
  private _getDeepSelection(): Selection | null {
    // Try window selection first (works for user-text without shadow DOM)
    const win = window.getSelection();
    if (win && !win.isCollapsed && win.rangeCount > 0) return win;

    // Check markdown-renderer shadow roots (Chromium-only API, fine for Tauri)
    const renderers = this.shadowRoot?.querySelectorAll('markdown-renderer');
    if (renderers) {
      for (const renderer of renderers) {
        const sel = (renderer.shadowRoot as any)?.getSelection?.() as Selection | null;
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) return sel;
      }
    }

    return null;
  }

  private _handleContentMouseUp(): void {
    // Do not show popover during streaming
    if (this.message.isStreaming) return;

    const selection = this._getDeepSelection();
    if (!selection) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    this._popoverX = rect.right;
    this._popoverY = rect.bottom + 4;
    this._showPopover = true;
  }

  private _handleHighlightSelect(e: CustomEvent<{ color: HighlightColor }>): void {
    const { color } = e.detail;
    const selection = this._getDeepSelection();
    if (!selection) {
      this._showPopover = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) {
      this._showPopover = false;
      return;
    }

    // Compute offset relative to the full message content text.
    // Since the selection may be inside a nested shadow root (markdown-renderer),
    // use the message content string to locate the selected text.
    const fullText = this.message.content;
    const startOffset = fullText.indexOf(selectedText);
    if (startOffset === -1) {
      this._showPopover = false;
      return;
    }
    const endOffset = startOffset + selectedText.length;

    const highlight: Highlight = {
      id: crypto.randomUUID(),
      messageId: this.message.id,
      startOffset,
      endOffset,
      color,
    };

    addHighlight(this.conversationId, highlight);
    selection.removeAllRanges();
    this._showPopover = false;
  }

  private _handleHighlightDismiss(): void {
    this._showPopover = false;
  }

  private _getMessageHighlights(): Highlight[] {
    if (!this.message || !this.highlights.length) return [];
    return this.highlights.filter(h => h.messageId === this.message.id);
  }

  private _renderHighlightedText(text: string, messageHighlights: Highlight[]) {
    if (!messageHighlights.length) {
      return html`${text}`;
    }

    // Sort highlights by startOffset
    const sorted = [...messageHighlights].sort((a, b) => a.startOffset - b.startOffset);

    const parts: unknown[] = [];
    let lastEnd = 0;

    for (const h of sorted) {
      const start = Math.max(h.startOffset, lastEnd);
      const end = Math.min(h.endOffset, text.length);
      if (start >= end) continue;

      // Add unhighlighted text before this highlight
      if (start > lastEnd) {
        parts.push(html`${text.slice(lastEnd, start)}`);
      }

      // Add highlighted text
      parts.push(html`<mark
        class="text-highlight"
        style="background-color: ${HIGHLIGHT_TINTS[h.color]}"
        aria-label="${HIGHLIGHT_COLORS[h.color]}"
      >${text.slice(start, end)}</mark>`);

      lastEnd = end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      parts.push(html`${text.slice(lastEnd)}`);
    }

    return parts;
  }

  private _renderThinkingSection() {
    const { message } = this;
    if (!message.thinkingContent || message.role !== 'assistant') return nothing;

    const expanded = this._thinkingExpanded;
    return html`
      <div class="thinking-section">
        <button
          class="thinking-toggle ${expanded ? 'thinking-toggle--expanded' : ''}"
          @click=${this._handleThinkingToggle}
          aria-expanded=${expanded}
          aria-controls="thinking-body"
        >
          ${this._renderIcon('chevron-right')}
          <span>${expanded ? 'Hide thinking' : 'Show thinking'}</span>
        </button>
        <div
          class="thinking-body ${expanded ? 'thinking-body--expanded' : ''}"
          id="thinking-body"
          role="region"
          aria-label="Agent thinking process"
        >
          <markdown-renderer
            .content=${message.thinkingContent}
            @link-click=${this._handleLinkClick}
          ></markdown-renderer>
        </div>
      </div>
    `;
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

  private _renderBlock(block: MessageBlock) {
    switch (block.type) {
      case 'text':
        return html`<markdown-renderer
          .content=${block.content}
          @link-click=${this._handleLinkClick}
        ></markdown-renderer>`;
      case 'thinking':
        // Thinking blocks are rendered via _renderThinkingSection using legacy thinkingContent
        return nothing;
      case 'tool':
        return html`<tool-call-block
          .block=${block}
          .conversationId=${this.conversationId}
          .messageId=${this.message.id}
        ></tool-call-block>`;
    }
  }

  private _renderContent() {
    const { message } = this;

    // Streaming with no content yet — show typing indicator
    if (message.isStreaming && !message.content && !message.blocks?.length) {
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

    // For assistant messages with blocks, render blocks
    if (message.role === 'assistant' && message.blocks?.length) {
      return html`
        ${this._renderThinkingSection()}
        <div class="content" @mouseup=${this._handleContentMouseUp}>
          ${message.blocks.map(block => this._renderBlock(block))}
        </div>
        ${message.isPartial ? html`<span class="partial-indicator">Response was interrupted</span>` : nothing}
      `;
    }

    // Fallback: render legacy content string
    const isUser = message.role === 'user';
    const messageHighlights = this._getMessageHighlights();

    return html`
      ${this._renderThinkingSection()}
      <div class="content" @mouseup=${this._handleContentMouseUp}>
        ${isUser
          ? html`<div class="user-text">${this._renderHighlightedText(message.content, messageHighlights)}</div>`
          : html`
              <markdown-renderer
                .content=${message.content}
                @link-click=${this._handleLinkClick}
              ></markdown-renderer>
            `
        }
      </div>
      ${message.isPartial ? html`<span class="partial-indicator">Response was interrupted</span>` : nothing}
    `;
  }

  render() {
    if (!this.message) return nothing;

    // Skip rendering injected context messages (invisible in chat UI)
    if (this.message.isContext) return nothing;

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
        <highlight-popover
          .x=${this._popoverX}
          .y=${this._popoverY}
          ?open=${this._showPopover}
          @highlight-select=${this._handleHighlightSelect}
          @highlight-dismiss=${this._handleHighlightDismiss}
        ></highlight-popover>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'conversation-block': ConversationBlock;
  }
}
