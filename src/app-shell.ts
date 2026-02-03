import { LitElement, html, css, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
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
import { connect as wsConnect, disconnect as wsDisconnect, on as wsOn } from './services/websocket.service.js';
import { loadWorkflowStatus } from './services/workflow.service.js';
import { clearWorkflowState } from './state/workflow.state.js';
import { loadPhases } from './services/phases.service.js';
import { clearPhasesState } from './state/phases.state.js';
import { initChatService } from './services/chat.service.js';
import { clearChatState } from './state/chat.state.js';

import './components/core/phase-graph/phase-graph-container.js';
import './components/core/layout/activity-bar.js';
import './components/core/chat/chat-panel.js';

@customElement('app-shell')
export class AppShell extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--bmad-color-bg-primary);
      color: var(--bmad-color-text-primary);
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
      flex-direction: row;
      min-height: 100vh;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
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

    .header-actions {
      display: flex;
      gap: var(--bmad-spacing-sm);
      margin-left: auto;
    }

    .content-area {
      flex: 1;
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--bmad-color-text-muted);
      font-size: var(--bmad-font-size-md);
    }
  `;

  @query('provider-settings') _settingsPanel!: ProviderSettings;
  @state() _activeSection = 'graph';

  private _wsUnsubscribe: (() => void) | null = null;
  private _chatCleanup: (() => void) | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _boundKeyHandler = this._handleKeydown.bind(this);

  private _openSettings(): void {
    this._settingsPanel.open();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._boundKeyHandler);
    this._cleanupWorkflow();
    wsDisconnect();
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (!e.metaKey) return;
    if (projectLoadingState.get().status !== 'success') return;
    const sectionMap: Record<string, string> = { '1': 'graph', '2': 'chat', '3': 'artifacts' };
    const section = sectionMap[e.key];
    if (section) {
      e.preventDefault();
      this._activeSection = section;
      this.updateComplete.then(async () => {
        const contentArea = this.shadowRoot!.querySelector('.content-area');
        // Focus the chat-input textarea when switching to chat section
        if (section === 'chat') {
          const chatPanel = contentArea?.querySelector('chat-panel') as any;
          if (chatPanel && 'updateComplete' in chatPanel) {
            await chatPanel.updateComplete;
            chatPanel.focusInput?.();
            return;
          }
        }
        const target = contentArea?.querySelector('phase-graph-container') as HTMLElement
          ?? contentArea?.querySelector('.placeholder') as HTMLElement;
        if (target && 'updateComplete' in target) {
          await (target as any).updateComplete;
        }
        target?.focus();
      });
    }
  }

  private _handleSectionChange(e: CustomEvent): void {
    this._activeSection = e.detail.section;
  }

  private _setupWorkflowSubscription(): void {
    this._cleanupWorkflow();
    this._wsUnsubscribe = wsOn('workflow:status-changed', () => {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        loadWorkflowStatus();
      }, 300);
    });
    this._chatCleanup = initChatService();
    loadWorkflowStatus();
    loadPhases();
  }

  private _cleanupWorkflow(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._wsUnsubscribe) {
      this._wsUnsubscribe();
      this._wsUnsubscribe = null;
    }
    if (this._chatCleanup) {
      this._chatCleanup();
      this._chatCleanup = null;
    }
    clearWorkflowState();
    clearPhasesState();
    clearChatState();
  }

  private async _handleOpenProject(): Promise<void> {
    const folder = await selectProjectFolder();
    if (folder) {
      this._cleanupWorkflow();
      wsDisconnect();
      await openProject(folder);
      if (projectState.get()) {
        wsConnect();
        this._setupWorkflowSubscription();
      }
    }
  }

  render() {
    const loadState = projectLoadingState.get();
    const project = projectState.get();
    const bmadAvailable = bmadServicesAvailable$.get();

    return html`
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

  private _renderContent() {
    switch (this._activeSection) {
      case 'graph':
        return html`<phase-graph-container tabindex="-1"></phase-graph-container>`;
      case 'chat':
        return html`<chat-panel tabindex="-1"></chat-panel>`;
      case 'artifacts':
        return html`<div class="placeholder" tabindex="-1">Artifacts panel (Epic 6)</div>`;
      default:
        return html`<phase-graph-container tabindex="-1"></phase-graph-container>`;
    }
  }

  private _renderLoaded(name: string, bmadAvailable: boolean) {
    return html`
      <div class="loaded-state">
        <activity-bar
          .activeSection=${this._activeSection}
          @section-change=${this._handleSectionChange}
        ></activity-bar>
        <div class="main-area">
          <div class="header">
            <span class="project-name">${name}</span>
            ${bmadAvailable ? html`<span class="bmad-badge">BMAD</span>` : nothing}
            <div class="header-actions">
              <sl-icon-button
                name="folder2-open"
                label="Open Project"
                @click=${this._handleOpenProject}
              ></sl-icon-button>
              <sl-icon-button
                name="gear"
                label="Settings"
                @click=${this._openSettings}
              ></sl-icon-button>
            </div>
          </div>
          <div class="content-area">
            ${this._renderContent()}
          </div>
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
