import { LitElement, html, css, nothing } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';

import './components/core/settings/provider-settings.js';
import type { ProviderSettings } from './components/core/settings/provider-settings.js';

import { projectState, projectLoadingState, bmadServicesAvailable$ } from './state/project.state.js';
import { openProject } from './services/project.service.js';
import { selectProjectFolder } from './services/dialog.service.js';
import { connect as wsConnect, disconnect as wsDisconnect } from './services/websocket.service.js';

@customElement('app-shell')
export class AppShell extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--bmad-color-bg-primary);
      color: var(--bmad-color-text-primary);
    }

    .toolbar {
      position: fixed;
      top: 0;
      right: 0;
      display: flex;
      gap: var(--bmad-spacing-sm);
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

    /* Empty state - no project loaded */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--bmad-spacing-lg);
      text-align: center;
    }

    .empty-state h1 {
      font-size: var(--bmad-font-size-2xl);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-accent);
      margin: 0 0 var(--bmad-spacing-sm) 0;
    }

    .empty-state p {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-secondary);
      margin: 0 0 var(--bmad-spacing-xl) 0;
    }

    /* Loading state */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: var(--bmad-spacing-lg);
    }

    .loading-state sl-spinner {
      font-size: var(--bmad-font-size-2xl);
    }

    .loading-state p {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-secondary);
    }

    /* Error state */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--bmad-spacing-lg);
      text-align: center;
    }

    .error-state h1 {
      font-size: var(--bmad-font-size-2xl);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-accent);
      margin: 0 0 var(--bmad-spacing-sm) 0;
    }

    sl-alert {
      max-width: 480px;
      margin-bottom: var(--bmad-spacing-xl);
    }

    .error-actions {
      display: flex;
      gap: var(--bmad-spacing-md);
    }

    /* Loaded state - project active */
    .loaded-state {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .header {
      display: flex;
      align-items: center;
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-secondary);
    }

    .project-name {
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-primary);
    }

    .bmad-badge {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-success);
      margin-left: var(--bmad-spacing-sm);
      padding: 2px var(--bmad-spacing-xs);
      border: 1px solid var(--bmad-color-success);
      border-radius: var(--bmad-radius-sm);
    }

    .main-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--bmad-color-text-secondary);
      font-size: var(--bmad-font-size-md);
    }
  `;

  @query('provider-settings') _settingsPanel!: ProviderSettings;

  private _openSettings(): void {
    this._settingsPanel.open();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsDisconnect();
  }

  private async _handleOpenProject(): Promise<void> {
    const folder = await selectProjectFolder();
    if (folder) {
      wsDisconnect();
      await openProject(folder);
      if (projectState.get()) {
        wsConnect();
      }
    }
  }

  render() {
    const loadState = projectLoadingState.get();
    const project = projectState.get();
    const bmadAvailable = bmadServicesAvailable$.get();

    return html`
      <div class="toolbar">
        ${project ? html`
          <sl-icon-button
            name="folder-open"
            label="Open Project"
            @click=${this._handleOpenProject}
          ></sl-icon-button>
        ` : nothing}
        <sl-icon-button
          name="gear"
          label="Settings"
          @click=${this._openSettings}
        ></sl-icon-button>
      </div>

      ${loadState.status === 'loading' ? this._renderLoading() : nothing}
      ${loadState.status === 'error' ? this._renderError(loadState.error ?? 'Unknown error', loadState.errorCode) : nothing}
      ${loadState.status === 'idle' && !project ? this._renderEmpty() : nothing}
      ${loadState.status === 'success' && project ? this._renderLoaded(project.projectName, bmadAvailable) : nothing}

      <provider-settings></provider-settings>
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty-state">
        <h1>BMAD Studio</h1>
        <p>Select a BMAD project folder to get started</p>
        <sl-button variant="primary" size="large" @click=${this._handleOpenProject}>
          Open Project
        </sl-button>
      </div>
    `;
  }

  private _renderLoading() {
    return html`
      <div class="loading-state">
        <sl-spinner></sl-spinner>
        <p>Loading project...</p>
      </div>
    `;
  }

  private _renderError(message: string, code?: string) {
    const isMissingBmad = code === 'bmad_not_found';
    return html`
      <div class="error-state">
        <h1>BMAD Studio</h1>
        <sl-alert variant="danger" open>
          <strong>${isMissingBmad ? 'No BMAD Configuration Found' : 'Error Opening Project'}</strong><br>
          ${message}
        </sl-alert>
        <div class="error-actions">
          <sl-button variant="primary" @click=${this._handleOpenProject}>
            Select Different Folder
          </sl-button>
        </div>
      </div>
    `;
  }

  private _renderLoaded(name: string, bmadAvailable: boolean) {
    return html`
      <div class="loaded-state">
        <div class="header">
          <span class="project-name">${name}</span>
          ${bmadAvailable ? html`<span class="bmad-badge">BMAD</span>` : nothing}
        </div>
        <div class="main-content">
          Project loaded — phase graph will appear here
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
