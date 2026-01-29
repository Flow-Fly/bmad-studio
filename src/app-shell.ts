import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';

import './components/core/settings/provider-settings.js';
import type { ProviderSettings } from './components/core/settings/provider-settings.js';

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

    .toolbar {
      position: fixed;
      top: 0;
      right: 0;
      padding: var(--bmad-spacing-md);
      z-index: var(--bmad-z-sticky);
    }

    sl-icon-button {
      font-size: var(--bmad-font-size-xl);
      color: var(--bmad-color-text-secondary);
    }
    sl-icon-button:hover {
      color: var(--bmad-color-text-primary);
    }

    h1 {
      font-size: var(--bmad-font-size-xl);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-accent);
    }
  `;

  @query('provider-settings') _settingsPanel!: ProviderSettings;

  private _openSettings(): void {
    this._settingsPanel.open();
  }

  render() {
    return html`
      <div class="toolbar">
        <sl-icon-button
          name="gear"
          label="Settings"
          @click=${this._openSettings}
        ></sl-icon-button>
      </div>

      <div class="container">
        <h1>BMAD Studio</h1>
      </div>

      <provider-settings></provider-settings>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
