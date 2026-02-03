import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import {
  agentsState,
  activeAgentId,
  activeAgent$,
  agentConversations,
  setActiveAgent,
} from '../../../state/agent.state.js';
import { activeConversations } from '../../../state/chat.state.js';
import type { Agent } from '../../../types/agent.js';

// Lucide icon SVG element definitions: [tagName, attributes]
const ICONS: Record<string, Array<[string, Record<string, string>]>> = {
  'user': [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '12', cy: '7', r: '4' }],
  ],
  'bot': [
    ['path', { d: 'M12 8V4H8' }],
    ['rect', { x: '4', y: '8', width: '16', height: '12', rx: '2' }],
    ['path', { d: 'M2 14h2' }],
    ['path', { d: 'M20 14h2' }],
    ['path', { d: 'M15 13v2' }],
    ['path', { d: 'M9 13v2' }],
  ],
  'brain': [
    ['path', { d: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z' }],
    ['path', { d: 'M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z' }],
    ['path', { d: 'M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4' }],
    ['path', { d: 'M17.599 6.5a3 3 0 0 0 .399-1.375' }],
    ['path', { d: 'M6.003 5.125A3 3 0 0 0 6.401 6.5' }],
    ['path', { d: 'M3.477 10.896a4 4 0 0 1 .585-.396' }],
    ['path', { d: 'M19.938 10.5a4 4 0 0 1 .585.396' }],
    ['path', { d: 'M6 18a4 4 0 0 1-1.967-.516' }],
    ['path', { d: 'M19.967 17.484A4 4 0 0 1 18 18' }],
  ],
  'code': [
    ['path', { d: 'M16 18l6-6-6-6' }],
    ['path', { d: 'M8 6l-6 6 6 6' }],
  ],
  'palette': [
    ['circle', { cx: '13.5', cy: '6.5', r: '.5' }],
    ['circle', { cx: '17.5', cy: '10.5', r: '.5' }],
    ['circle', { cx: '8.5', cy: '7.5', r: '.5' }],
    ['circle', { cx: '6.5', cy: '12.5', r: '.5' }],
    ['path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z' }],
  ],
  'shield': [
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }],
  ],
  'clipboard-list': [
    ['rect', { x: '8', y: '2', width: '8', height: '4', rx: '1', ry: '1' }],
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
    ['path', { d: 'M12 11h4' }],
    ['path', { d: 'M12 16h4' }],
    ['line', { x1: '8', y1: '11', x2: '8.01', y2: '11' }],
    ['line', { x1: '8', y1: '16', x2: '8.01', y2: '16' }],
  ],
  'chevron-down': [
    ['path', { d: 'M6 9l6 6 6-6' }],
  ],
};

@customElement('agent-badge')
export class AgentBadge extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }

    .badge {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      background: none;
      border: 1px solid transparent;
      border-radius: var(--bmad-radius-md);
      cursor: pointer;
      color: var(--bmad-color-text-primary);
      font-size: var(--bmad-font-size-sm);
      font-family: inherit;
      line-height: var(--bmad-line-height-tight);
      transition: background-color var(--bmad-transition-fast),
                  border-color var(--bmad-transition-fast);
    }

    .badge:hover {
      background-color: var(--bmad-color-bg-tertiary);
      border-color: var(--bmad-color-border-primary);
    }

    .badge:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    .badge-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .badge-icon svg {
      width: 100%;
      height: 100%;
    }

    .badge-name {
      font-weight: var(--bmad-font-weight-medium);
      white-space: nowrap;
    }

    .badge-title {
      color: var(--bmad-color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }

    .badge-chevron {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      color: var(--bmad-color-text-secondary);
      transition: transform 200ms ease-out;
    }

    .badge-chevron svg {
      width: 100%;
      height: 100%;
    }

    :host([open]) .badge-chevron {
      transform: rotate(180deg);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 280px;
      max-height: 400px;
      overflow-y: auto;
      background-color: var(--bmad-color-bg-elevated);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      box-shadow: var(--bmad-shadow-md);
      z-index: var(--bmad-z-dropdown);
      padding: var(--bmad-spacing-xs) 0;
      animation: dropdown-open 200ms ease-out;
    }

    @keyframes dropdown-open {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .agent-item {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      width: 100%;
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--bmad-color-text-primary);
      font-size: var(--bmad-font-size-sm);
      font-family: inherit;
      text-align: left;
      transition: background-color var(--bmad-transition-fast);
      box-sizing: border-box;
    }

    .agent-item:hover,
    .agent-item:focus-visible {
      background-color: var(--bmad-color-bg-tertiary);
    }

    .agent-item:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    .agent-item[aria-selected='true'] {
      background-color: var(--bmad-color-bg-tertiary);
      border-left: 2px solid var(--bmad-color-accent);
    }

    .agent-item-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .agent-item-icon svg {
      width: 100%;
      height: 100%;
    }

    .agent-item-info {
      flex: 1;
      min-width: 0;
    }

    .agent-item-name {
      font-weight: var(--bmad-font-weight-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .agent-item-title {
      color: var(--bmad-color-text-secondary);
      font-size: var(--bmad-font-size-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--bmad-radius-full);
      flex-shrink: 0;
    }

    .status-dot--active {
      background-color: var(--bmad-color-accent);
    }

    .status-dot--inactive {
      background-color: transparent;
      border: 1.5px solid var(--bmad-color-text-muted);
    }

    @media (prefers-reduced-motion: reduce) {
      .dropdown {
        animation: none;
      }

      .badge-chevron {
        transition: none;
      }

      .badge {
        transition: none;
      }

      .agent-item {
        transition: none;
      }
    }
  `;

  @state() private _open = false;
  @state() private _focusedIndex = -1;

  private _handleBadgeClick(): void {
    this._toggleDropdown();
  }

  private _toggleDropdown(): void {
    this._open = !this._open;
    if (this._open) {
      this._focusedIndex = -1;
      // Reflect attribute for CSS
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  private _closeDropdown(): void {
    this._open = false;
    this._focusedIndex = -1;
    this.removeAttribute('open');
  }

  private _handleBadgeKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this._open) {
        this._open = true;
        this.setAttribute('open', '');
        this._focusedIndex = 0;
        this._focusItem(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._closeDropdown();
    }
  }

  private _handleDropdownKeydown(e: KeyboardEvent): void {
    const agents = agentsState.get();
    if (agents.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (this._focusedIndex + 1) % agents.length;
        this._focusedIndex = next;
        this._focusItem(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = (this._focusedIndex - 1 + agents.length) % agents.length;
        this._focusedIndex = prev;
        this._focusItem(prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (this._focusedIndex >= 0 && this._focusedIndex < agents.length) {
          this._selectAgent(agents[this._focusedIndex]);
        }
        break;
      }
      case 'Escape':
      case 'Tab': {
        e.preventDefault();
        this._closeDropdown();
        this._focusBadge();
        break;
      }
    }
  }

  private _focusItem(index: number): void {
    this.updateComplete.then(() => {
      const items = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.agent-item');
      items?.[index]?.focus();
    });
  }

  private _focusBadge(): void {
    this.updateComplete.then(() => {
      const badge = this.shadowRoot?.querySelector<HTMLButtonElement>('.badge');
      badge?.focus();
    });
  }

  private _selectAgent(agent: Agent): void {
    setActiveAgent(agent.id);
    this.dispatchEvent(new CustomEvent('agent-change', {
      detail: { agentId: agent.id },
      bubbles: true,
      composed: true,
    }));
    this._closeDropdown();
    this._focusBadge();
  }

  private _handleFocusout(e: FocusEvent): void {
    // Close if focus moves outside the component
    // Skip during async focus transitions (e.g., keyboard-initiated dropdown open)
    if (this._open) {
      requestAnimationFrame(() => {
        if (!this._open) return;
        const active = this.shadowRoot?.activeElement;
        if (active) return; // Focus is still within shadow DOM
        // Check light DOM as well
        if (this.contains(document.activeElement)) return;
        this._closeDropdown();
      });
      return;
    }
    const related = e.relatedTarget as Node | null;
    if (related && this.shadowRoot?.contains(related)) return;
    if (related && this.contains(related as Element)) return;
    this._closeDropdown();
  }

  private _hasActiveConversation(agentId: string): boolean {
    const convId = agentConversations.get().get(agentId);
    if (!convId) return false;
    return activeConversations.get().has(convId);
  }

  private _renderIcon(name: string) {
    const elements = ICONS[name];
    if (!elements) {
      // Fallback to generic user icon for unknown icon names
      const fallback = ICONS['user']!;
      return this._renderSvgElements(fallback);
    }
    return this._renderSvgElements(elements);
  }

  private _renderSvgElements(elements: Array<[string, Record<string, string>]>) {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'circle': return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
            case 'path': return svg`<path d=${attrs.d} />`;
            case 'line': return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
            case 'rect': return svg`<rect x=${attrs.x} y=${attrs.y} width=${attrs.width} height=${attrs.height} rx=${attrs.rx || '0'} ry=${attrs.ry || '0'} />`;
            default: return nothing;
          }
        })}
      </svg>
    `;
  }

  render() {
    const agent = activeAgent$.get();
    const agents = agentsState.get();
    const currentAgentId = activeAgentId.get();

    // Fallback when no agents loaded
    if (agents.length === 0) {
      return html`<span class="badge-name">Chat</span>`;
    }

    return html`
      <button
        class="badge"
        role="combobox"
        aria-expanded=${this._open}
        aria-haspopup="listbox"
        aria-label="Select BMAD agent"
        aria-activedescendant=${this._open && this._focusedIndex >= 0 && agents[this._focusedIndex]
          ? `agent-option-${agents[this._focusedIndex].id}`
          : nothing}
        @click=${this._handleBadgeClick}
        @keydown=${this._handleBadgeKeydown}
        @focusout=${this._handleFocusout}
      >
        ${agent ? html`
          <span class="badge-icon">${this._renderIcon(agent.icon)}</span>
          <span class="badge-name">${agent.name}</span>
          <span class="badge-title">${agent.title}</span>
        ` : html`
          <span class="badge-name">Chat</span>
        `}
        <span class="badge-chevron">${this._renderIcon('chevron-down')}</span>
      </button>

      ${this._open ? html`
        <div
          class="dropdown"
          role="listbox"
          aria-label="Select BMAD agent"
          @keydown=${this._handleDropdownKeydown}
          @focusout=${this._handleFocusout}
        >
          ${agents.map((a, index) => html`
            <button
              id="agent-option-${a.id}"
              class="agent-item"
              role="option"
              aria-selected=${a.id === currentAgentId}
              tabindex=${index === this._focusedIndex ? '0' : '-1'}
              @click=${() => this._selectAgent(a)}
            >
              <span class="agent-item-icon">${this._renderIcon(a.icon)}</span>
              <span class="agent-item-info">
                <span class="agent-item-name">${a.name}</span>
                <span class="agent-item-title">${a.title}</span>
              </span>
              <span class="status-dot ${this._hasActiveConversation(a.id) ? 'status-dot--active' : 'status-dot--inactive'}"
                title=${this._hasActiveConversation(a.id) ? 'Active conversation' : 'No conversation'}
              ></span>
            </button>
          `)}
        </div>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'agent-badge': AgentBadge;
  }
}
