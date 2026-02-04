import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type ContextLevel = 'low' | 'medium' | 'high' | 'critical';

@customElement('context-indicator')
export class ContextIndicator extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-lg);
      cursor: pointer;
      position: relative;
    }

    .track {
      height: 2px;
      background: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-full);
      position: relative;
      overflow: hidden;
      transition: height 300ms ease;
    }

    .bar {
      height: 100%;
      border-radius: var(--bmad-radius-full);
      transition: width 300ms ease, background-color 300ms ease;
    }

    /* Level: low (0-60%) */
    .context--low .bar {
      background-color: var(--bmad-color-accent);
    }

    /* Level: medium (60-80%) */
    .context--medium .track {
      height: 3px;
    }

    .context--medium .bar {
      background-color: var(--bmad-color-warning);
    }

    /* Level: high (80-95%) */
    .context--high .track {
      height: 4px;
    }

    .context--high .bar {
      background-color: #f0883e;
    }

    /* Level: critical (95-100%) */
    .context--critical .track {
      height: 4px;
    }

    .context--critical .bar {
      background-color: var(--bmad-color-error);
      animation: pulse-bar 2s ease-in-out infinite;
    }

    @keyframes pulse-bar {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .tooltip {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      background: var(--bmad-color-bg-elevated);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-sm);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
      white-space: nowrap;
      pointer-events: none;
      z-index: 50;
    }

    @media (prefers-reduced-motion: reduce) {
      .track,
      .bar {
        transition: none;
      }

      .context--critical .bar {
        animation: none;
      }
    }
  `;

  @property({ type: Number }) percentage = 0;
  @property({ type: String }) modelName = '';
  @state() private _hovered = false;

  private _getLevel(): ContextLevel {
    const pct = this.percentage;
    if (pct >= 95) return 'critical';
    if (pct >= 80) return 'high';
    if (pct >= 60) return 'medium';
    return 'low';
  }

  private _handleClick(): void {
    this.dispatchEvent(new CustomEvent('context-indicator-click', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const level = this._getLevel();
    const clampedPct = Math.min(100, Math.max(0, this.percentage));

    return html`
      <div
        class="context--${level}"
        @mouseenter=${() => { this._hovered = true; }}
        @mouseleave=${() => { this._hovered = false; }}
        @click=${this._handleClick}
      >
        <div
          class="track"
          role="meter"
          aria-valuenow=${clampedPct}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Context window usage"
        >
          <div class="bar" style="width: ${clampedPct}%"></div>
        </div>
        ${this._hovered ? html`
          <div class="tooltip">${clampedPct}% of ${this.modelName} context</div>
        ` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'context-indicator': ContextIndicator;
  }
}
