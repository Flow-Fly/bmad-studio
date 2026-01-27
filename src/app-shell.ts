import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--bmad-color-bg-primary);
      color: var(--bmad-color-text-primary);
    }

    .container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--bmad-spacing-lg);
    }

    h1 {
      font-size: var(--bmad-font-size-xl);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-accent);
    }
  `;

  render() {
    return html`
      <div class="container">
        <h1>BMAD Studio</h1>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
