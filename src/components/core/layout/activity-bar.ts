import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

interface SectionConfig {
  id: string;
  label: string;
  icon: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'graph', label: 'Phase Graph', icon: 'git-branch' },
  { id: 'chat', label: 'Chat', icon: 'message-square' },
  { id: 'artifacts', label: 'Artifacts', icon: 'file-text' },
];

// Lucide icon SVG element definitions: [tagName, attributes]
const ICONS: Record<string, Array<[string, Record<string, string>]>> = {
  'git-branch': [
    ['line', { x1: '6', y1: '3', x2: '6', y2: '15' }],
    ['circle', { cx: '18', cy: '6', r: '3' }],
    ['circle', { cx: '6', cy: '18', r: '3' }],
    ['path', { d: 'M18 9a9 9 0 0 1-9 9' }],
  ],
  'message-square': [
    ['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }],
  ],
  'file-text': [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['line', { x1: '10', y1: '9', x2: '16', y2: '9' }],
    ['line', { x1: '10', y1: '13', x2: '16', y2: '13' }],
    ['line', { x1: '10', y1: '17', x2: '16', y2: '17' }],
  ],
};

@customElement('activity-bar')
export class ActivityBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 48px;
      min-width: 48px;
      background-color: var(--bmad-color-bg-secondary);
      border-right: 1px solid var(--bmad-color-border-primary);
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs) 0;
    }

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 40px;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--bmad-color-text-secondary);
      border-left: 2px solid transparent;
      padding: 0;
      box-sizing: border-box;
    }

    button:hover {
      background-color: var(--bmad-color-bg-tertiary);
    }

    button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    button[aria-selected='true'] {
      border-left: 2px solid var(--bmad-color-accent);
      color: var(--bmad-color-accent);
    }

    .icon {
      width: 20px;
      height: 20px;
    }

    .icon svg {
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: String }) activeSection = 'graph';

  render() {
    return html`
      <nav role="tablist" aria-orientation="vertical" @keydown=${this._handleKeydown}>
        ${SECTIONS.map(section => html`
          <sl-tooltip content="${section.label}" placement="right">
            <button
              role="tab"
              tabindex="${section.id === this.activeSection ? '0' : '-1'}"
              aria-selected="${section.id === this.activeSection}"
              aria-label="${section.label}"
              @click=${() => this._handleClick(section.id)}
            >
              <span class="icon">${this._renderIcon(section.icon)}</span>
            </button>
          </sl-tooltip>
        `)}
      </nav>
    `;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    const currentIndex = SECTIONS.findIndex(s => s.id === this.activeSection);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % SECTIONS.length;
        break;
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = SECTIONS.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextSection = SECTIONS[nextIndex];
    this._handleClick(nextSection.id);

    this.updateComplete.then(() => {
      const buttons = this.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      buttons[nextIndex!]?.focus();
    });
  }

  private _handleClick(section: string): void {
    this.dispatchEvent(
      new CustomEvent('section-change', {
        detail: { section },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _renderIcon(name: string) {
    const elements = ICONS[name];
    if (!elements) return nothing;
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'circle': return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
            case 'path': return svg`<path d=${attrs.d} />`;
            case 'line': return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
            default: return nothing;
          }
        })}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'activity-bar': ActivityBar;
  }
}
