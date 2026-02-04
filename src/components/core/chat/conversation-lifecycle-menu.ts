import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, queryAll } from 'lit/decorators.js';

@customElement('conversation-lifecycle-menu')
export class ConversationLifecycleMenu extends LitElement {
  static styles = css`
    :host {
      display: none;
      position: absolute;
      z-index: var(--bmad-z-dropdown, 100);
    }

    :host([open]) {
      display: block;
    }

    .menu {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      background: var(--bmad-color-bg-elevated);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      box-shadow: var(--bmad-shadow-md);
      padding: var(--bmad-spacing-xs) 0;
      overflow: hidden;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      border: none;
      background: none;
      color: var(--bmad-color-text-primary);
      font-size: var(--bmad-font-size-sm);
      font-family: var(--bmad-font-family);
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: background-color var(--bmad-transition-fast);
    }

    .menu-item:hover,
    .menu-item:focus-visible {
      background-color: var(--bmad-color-bg-tertiary);
    }

    .menu-item:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    .menu-item--danger {
      color: var(--bmad-color-error);
    }

    .menu-item--danger:hover,
    .menu-item--danger:focus-visible {
      background-color: color-mix(in srgb, var(--bmad-color-error) 10%, transparent);
    }

    @media (prefers-reduced-motion: reduce) {
      .menu-item {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) forceAction = false;
  @queryAll('.menu-item') private _menuItems!: NodeListOf<HTMLButtonElement>;

  private _focusIndex = 0;

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('open') && this.open) {
      this._focusIndex = 0;
      requestAnimationFrame(() => {
        const items = this._menuItems;
        if (items.length > 0) {
          items[0].focus();
        }
      });
    }
  }

  private _handleKeydown(e: KeyboardEvent): void {
    const items = Array.from(this._menuItems);
    if (!items.length) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        this._focusIndex = (this._focusIndex + 1) % items.length;
        items[this._focusIndex].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        this._focusIndex = (this._focusIndex - 1 + items.length) % items.length;
        items[this._focusIndex].focus();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this._dismiss();
        break;
      }
    }
  }

  private _keepWorking(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-keep', {
      bubbles: true,
      composed: true,
    }));
  }

  private _compact(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-compact', {
      bubbles: true,
      composed: true,
    }));
  }

  private _discard(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-discard', {
      bubbles: true,
      composed: true,
    }));
  }

  private _dismiss(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-dismiss', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="menu" role="menu" aria-label="Conversation actions" @keydown=${this._handleKeydown}>
        ${!this.forceAction ? html`
          <button class="menu-item" role="menuitem" tabindex="0" @click=${this._keepWorking}>
            Keep Working
          </button>
        ` : nothing}
        <button class="menu-item" role="menuitem" tabindex="0" @click=${this._compact}>
          Compact into Insight
        </button>
        <button class="menu-item menu-item--danger" role="menuitem" tabindex="0" @click=${this._discard}>
          Discard
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'conversation-lifecycle-menu': ConversationLifecycleMenu;
  }
}
