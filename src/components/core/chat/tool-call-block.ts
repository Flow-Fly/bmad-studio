import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ToolCallBlock } from '../../../types/tool.js';

// Lucide icon SVG definitions
const ICONS = {
  loader: [
    ['line', { x1: '12', y1: '2', x2: '12', y2: '6' }],
    ['line', { x1: '12', y1: '18', x2: '12', y2: '22' }],
    ['line', { x1: '4.93', y1: '4.93', x2: '7.76', y2: '7.76' }],
    ['line', { x1: '16.24', y1: '16.24', x2: '19.07', y2: '19.07' }],
    ['line', { x1: '2', y1: '12', x2: '6', y2: '12' }],
    ['line', { x1: '18', y1: '12', x2: '22', y2: '12' }],
    ['line', { x1: '4.93', y1: '19.07', x2: '7.76', y2: '16.24' }],
    ['line', { x1: '16.24', y1: '7.76', x2: '19.07', y2: '4.93' }],
  ],
  check: [
    ['path', { d: 'M20 6 9 17l-5-5' }],
  ],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  'chevron-right': [
    ['path', { d: 'm9 18 6-6-6-6' }],
  ],
  terminal: [
    ['polyline', { points: '4 17 10 11 4 5' }],
    ['line', { x1: '12', y1: '19', x2: '20', y2: '19' }],
  ],
  'file-text': [
    ['path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }],
    ['polyline', { points: '14 2 14 8 20 8' }],
    ['line', { x1: '16', y1: '13', x2: '8', y2: '13' }],
    ['line', { x1: '16', y1: '17', x2: '8', y2: '17' }],
    ['line', { x1: '10', y1: '9', x2: '8', y2: '9' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['path', { d: 'm21 21-4.35-4.35' }],
  ],
} as const;

// Tool icons mapping
const TOOL_ICONS: Record<string, keyof typeof ICONS> = {
  bash: 'terminal',
  file_read: 'file-text',
  file_write: 'file-text',
  web_search: 'search',
};

@customElement('tool-call-block')
export class ToolCallBlockComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: var(--bmad-spacing-sm) 0;
    }

    .tool-call {
      border: 1px solid var(--bmad-color-border-secondary);
      border-radius: var(--bmad-radius-md);
      background: var(--bmad-color-bg-tertiary);
      overflow: hidden;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      background: var(--bmad-color-bg-elevated);
      border-bottom: 1px solid var(--bmad-color-border-secondary);
    }

    .tool-icon {
      width: 16px;
      height: 16px;
      color: var(--bmad-color-text-tertiary);
    }

    .tool-icon svg {
      width: 100%;
      height: 100%;
    }

    .tool-name {
      font-size: var(--bmad-font-size-sm);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-primary);
      font-family: var(--bmad-font-family-mono);
    }

    .status-indicator {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
    }

    .status-icon {
      width: 14px;
      height: 14px;
    }

    .status-icon svg {
      width: 100%;
      height: 100%;
    }

    .status-icon--running {
      color: var(--bmad-color-accent);
      animation: spin 1s linear infinite;
    }

    .status-icon--success {
      color: var(--bmad-color-success);
    }

    .status-icon--error {
      color: var(--bmad-color-error);
    }

    .status-label {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .collapsible-section {
      border-top: 1px solid var(--bmad-color-border-secondary);
    }

    .collapsible-section:first-of-type {
      border-top: none;
    }

    .section-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-md);
      border: none;
      background: none;
      color: var(--bmad-color-text-tertiary);
      font-size: var(--bmad-font-size-xs);
      cursor: pointer;
      transition: color var(--bmad-transition-fast);
    }

    .section-toggle:hover {
      color: var(--bmad-color-text-secondary);
    }

    .section-toggle:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    .section-toggle .icon {
      width: 12px;
      height: 12px;
      transition: transform 200ms ease;
    }

    .section-toggle .icon svg {
      width: 100%;
      height: 100%;
    }

    .section-toggle--expanded .icon {
      transform: rotate(90deg);
    }

    .section-content {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-height 200ms ease, opacity 200ms ease;
    }

    .section-content--expanded {
      max-height: 500px;
      opacity: 1;
      overflow: auto;
    }

    .section-body {
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      font-family: var(--bmad-font-family-mono);
      font-size: var(--bmad-font-size-xs);
      line-height: var(--bmad-line-height-relaxed);
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--bmad-color-text-secondary);
      background: var(--bmad-color-bg-primary);
    }

    .error-output {
      color: var(--bmad-color-error);
    }

    @media (prefers-reduced-motion: reduce) {
      .status-icon--running {
        animation: none;
      }

      .section-toggle .icon {
        transition: none;
      }

      .section-content {
        transition: none;
      }
    }
  `;

  @property({ type: Object }) block!: ToolCallBlock;
  @property({ type: String }) conversationId = '';
  @property({ type: String }) messageId = '';

  @state() private _inputExpanded = false;
  @state() private _outputExpanded = false;

  private _formatInput(): string {
    try {
      return JSON.stringify(this.block.input, null, 2);
    } catch {
      return this.block.inputRaw;
    }
  }

  private _truncateOutput(output: string, maxLength = 500): string {
    if (output.length <= maxLength) return output;
    return output.slice(0, maxLength) + '\n... (truncated)';
  }

  private _renderIcon(name: keyof typeof ICONS) {
    const elements = ICONS[name];
    if (!elements) return nothing;
    return svg`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'circle': return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
            case 'path': return svg`<path d=${attrs.d} />`;
            case 'line': return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
            case 'polyline': return svg`<polyline points=${attrs.points} />`;
            default: return nothing;
          }
        })}
      </svg>
    `;
  }

  private _renderToolIcon() {
    const iconName = TOOL_ICONS[this.block.toolName] ?? 'terminal';
    return html`
      <span class="tool-icon">
        ${this._renderIcon(iconName)}
      </span>
    `;
  }

  private _renderStatusIndicator() {
    const { status } = this.block;
    let iconName: keyof typeof ICONS;
    let label: string;
    let iconClass: string;

    switch (status) {
      case 'pending':
        iconName = 'loader';
        label = 'Pending';
        iconClass = '';
        break;
      case 'running':
        iconName = 'loader';
        label = 'Running';
        iconClass = 'status-icon--running';
        break;
      case 'success':
        iconName = 'check';
        label = 'Complete';
        iconClass = 'status-icon--success';
        break;
      case 'error':
        iconName = 'x';
        label = 'Failed';
        iconClass = 'status-icon--error';
        break;
    }

    return html`
      <div class="status-indicator">
        <span class="status-icon ${iconClass}">
          ${this._renderIcon(iconName)}
        </span>
        <span class="status-label">${label}</span>
      </div>
    `;
  }

  private _renderInputSection() {
    const expanded = this._inputExpanded;
    return html`
      <div class="collapsible-section">
        <button
          class="section-toggle ${expanded ? 'section-toggle--expanded' : ''}"
          @click=${() => { this._inputExpanded = !this._inputExpanded; }}
          aria-expanded=${expanded}
        >
          <span class="icon">${this._renderIcon('chevron-right')}</span>
          <span>Input</span>
        </button>
        <div class="section-content ${expanded ? 'section-content--expanded' : ''}">
          <div class="section-body">${this._formatInput()}</div>
        </div>
      </div>
    `;
  }

  private _renderOutputSection() {
    const { status, output, error } = this.block;
    if (status === 'running' || status === 'pending') return nothing;

    const expanded = this._outputExpanded;
    const content = error || output || '';
    const isError = !!error;

    return html`
      <div class="collapsible-section">
        <button
          class="section-toggle ${expanded ? 'section-toggle--expanded' : ''}"
          @click=${() => { this._outputExpanded = !this._outputExpanded; }}
          aria-expanded=${expanded}
        >
          <span class="icon">${this._renderIcon('chevron-right')}</span>
          <span>${isError ? 'Error' : 'Output'}</span>
        </button>
        <div class="section-content ${expanded ? 'section-content--expanded' : ''}">
          <div class="section-body ${isError ? 'error-output' : ''}">${this._truncateOutput(content)}</div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.block) return nothing;

    return html`
      <div class="tool-call">
        <div class="tool-header">
          ${this._renderToolIcon()}
          <span class="tool-name">${this.block.toolName}</span>
          ${this._renderStatusIndicator()}
        </div>
        ${this._renderInputSection()}
        ${this._renderOutputSection()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tool-call-block': ToolCallBlockComponent;
  }
}
