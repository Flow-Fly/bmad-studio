import { LitElement, html, css } from 'lit';
import { customElement, property, queryAll } from 'lit/decorators.js';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../../types/conversation.js';

const COLORS: HighlightColor[] = ['yellow', 'green', 'red', 'blue'];

const COLOR_VALUES: Record<HighlightColor, string> = {
  yellow: '#f0c040',
  green: '#40c057',
  red: '#e05252',
  blue: '#4a9eff',
};

@customElement('highlight-popover')
export class HighlightPopover extends LitElement {
  static styles = css`
    :host {
      display: none;
      position: fixed;
      z-index: var(--bmad-z-dropdown);
    }

    :host([open]) {
      display: block;
    }

    .popover {
      display: flex;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs);
      background: var(--bmad-color-bg-elevated);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      box-shadow: var(--bmad-shadow-md);
    }

    .color-dot {
      width: 20px;
      height: 20px;
      border-radius: var(--bmad-radius-full);
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      transition: transform var(--bmad-transition-fast), border-color var(--bmad-transition-fast);
    }

    .color-dot:hover,
    .color-dot:focus-visible {
      transform: scale(1.2);
      border-color: var(--bmad-color-text-primary);
    }

    .color-dot:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .color-dot {
        transition: none;
      }
    }
  `;

  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  @property({ type: Boolean, reflect: true }) open = false;

  @queryAll('.color-dot') private _dots!: NodeListOf<HTMLButtonElement>;
  private _focusedIndex = 0;
  private _clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      if (this.open) {
        this._focusedIndex = 0;
        // Focus first dot after render
        requestAnimationFrame(() => {
          const dots = this._dots;
          if (dots.length > 0) {
            dots[0].focus();
          }
        });
        // Register click-outside listener
        this._clickOutsideHandler = (e: MouseEvent) => {
          if (!this.contains(e.target as Node)) {
            this._dismiss();
          }
        };
        // Delay to prevent the same click that opened the popover from closing it
        requestAnimationFrame(() => {
          document.addEventListener('mousedown', this._clickOutsideHandler!);
        });
      } else {
        // Clean up click-outside listener
        if (this._clickOutsideHandler) {
          document.removeEventListener('mousedown', this._clickOutsideHandler);
          this._clickOutsideHandler = null;
        }
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._clickOutsideHandler) {
      document.removeEventListener('mousedown', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
  }

  private _selectColor(color: HighlightColor): void {
    this.dispatchEvent(new CustomEvent('highlight-select', {
      bubbles: true,
      composed: true,
      detail: { color },
    }));
    this.open = false;
  }

  private _dismiss(): void {
    this.dispatchEvent(new CustomEvent('highlight-dismiss', {
      bubbles: true,
      composed: true,
    }));
    this.open = false;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    const dots = this._dots;
    if (!dots.length) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = (this._focusedIndex + 1) % dots.length;
        dots[this._focusedIndex].focus();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = (this._focusedIndex - 1 + dots.length) % dots.length;
        dots[this._focusedIndex].focus();
        break;
      case 'Enter':
        e.preventDefault();
        this._selectColor(COLORS[this._focusedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        this._dismiss();
        break;
    }
  }

  render() {
    // Clamp position to keep popover within viewport
    const clampedX = Math.min(this.x, window.innerWidth - 120);
    const clampedY = Math.min(this.y, window.innerHeight - 40);

    return html`
      <div
        class="popover"
        role="toolbar"
        aria-label="Highlight colors"
        style="left: ${clampedX}px; top: ${clampedY}px; position: fixed;"
        @keydown=${this._handleKeydown}
      >
        ${COLORS.map(color => html`
          <button
            class="color-dot"
            style="background-color: ${COLOR_VALUES[color]}"
            aria-label="Highlight as ${HIGHLIGHT_COLORS[color]}"
            tabindex="0"
            @click=${() => this._selectColor(color)}
          ></button>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'highlight-popover': HighlightPopover;
  }
}
