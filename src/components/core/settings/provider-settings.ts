import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';

import type SlInput from '@shoelace-style/shoelace/dist/components/input/input.js';

import type { ProviderType, Model } from '../../../types/provider.js';
import {
  providersState,
  activeProviderState,
  selectedModelState,
  modelsState,
  validationState,
  trustLevelState,
  updateProviderConfig,
  setModelsForProvider,
  setValidationStatus,
} from '../../../state/provider.state.js';
import type { TrustLevel } from '../../../types/tool.js';
import {
  validateProvider,
  listModels,
  loadSettings,
  saveSettings,
  setApiKey,
  hasApiKey,
  friendlyValidationError,
} from '../../../services/provider.service.js';

@customElement('provider-settings')
export class ProviderSettings extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
    }

    .provider-form {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
      padding: var(--bmad-spacing-lg) 0;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-sm);
    }

    .field-row {
      display: flex;
      align-items: flex-end;
      gap: var(--bmad-spacing-md);
    }

    .field-row sl-input,
    .field-row sl-select {
      flex: 1;
    }

    .validation-status {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      min-height: 28px;
    }

    .status-message {
      font-size: var(--bmad-font-size-sm);
    }

    .status-message.success {
      color: var(--bmad-color-success);
    }

    .status-message.error {
      color: var(--bmad-color-error);
    }

    .default-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--bmad-spacing-md);
      background: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-md);
    }

    .default-label {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
    }

    .section-label {
      font-size: var(--bmad-font-size-sm);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    sl-tab-group {
      --indicator-color: var(--bmad-color-accent);
    }

    sl-tab-panel {
      padding: 0;
    }

    sl-divider {
      --spacing: var(--bmad-spacing-md);
    }

    .help-text {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-tertiary);
      line-height: var(--bmad-line-height-relaxed);
      margin-top: var(--bmad-spacing-xs);
    }

    .trust-description {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
      padding-left: var(--bmad-spacing-md);
      margin-top: 2px;
    }

    .model-filter {
      margin-bottom: var(--bmad-spacing-sm);
    }

    .model-option {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
    }

    .model-option sl-badge {
      font-size: 10px;
    }
  `;

  @state() _open = false;
  @state() _activeTab: ProviderType = 'claude';
  @state() _keySaved: Record<string, boolean> = {};
  @state() _ollamaEndpoint = 'http://localhost:11434';
  @state() _errors: Record<string, string> = {};
  @state() _showOnlyToolCapable = false;

  async open(): Promise<void> {
    this._open = true;
    await this._loadExistingSettings();
  }

  close(): void {
    this._open = false;
  }

  private async _loadExistingSettings(): Promise<void> {
    try {
      const settings = await loadSettings();
      activeProviderState.set((settings.default_provider || '') as ProviderType | '');
      selectedModelState.set(settings.default_model || '');
      this._ollamaEndpoint = settings.ollama_endpoint || 'http://localhost:11434';

      // Load trust level (default to 'guided' if not set)
      if (settings.trust_level) {
        trustLevelState.set(settings.trust_level);
      }

      if (settings.providers) {
        for (const [type, cfg] of Object.entries(settings.providers)) {
          updateProviderConfig(type as ProviderType, { enabled: cfg.enabled });
        }
      }

      // Check keychain for existing keys (don't load key values into UI)
      const keyChecks = (['claude', 'openai'] as ProviderType[]).map(async (type) => {
        const exists = await hasApiKey(type);
        if (exists) {
          this._keySaved = { ...this._keySaved, [type]: true };
          updateProviderConfig(type, { hasValidCredentials: true });
          this._fetchModels(type);
        }
      });
      await Promise.all(keyChecks);

      // Check Ollama connectivity using endpoint from settings (not keychain)
      if (this._ollamaEndpoint) {
        this._fetchModels('ollama');
      }
    } catch {
      // Settings not available yet — use defaults
    }
  }

  private _getInputValue(type: ProviderType): string {
    const input = this.shadowRoot?.querySelector<SlInput>(
      `sl-tab-panel[name="${type}"] sl-input`
    );
    return input?.value ?? '';
  }

  private async _handleValidate(type: ProviderType): Promise<void> {
    const key = type === 'ollama' ? this._ollamaEndpoint : this._getInputValue(type);
    if (!key) {
      this._errors = { ...this._errors, [type]: 'Please enter a value first' };
      return;
    }

    setValidationStatus(type, { loading: true, message: undefined });
    this._errors = { ...this._errors, [type]: '' };

    try {
      await validateProvider(type, key);
      setValidationStatus(type, { valid: true, loading: false, message: 'Valid' });
      updateProviderConfig(type, { hasValidCredentials: true });

      // Store the key securely
      if (type !== 'ollama') {
        await setApiKey(type, key);
        this._keySaved = { ...this._keySaved, [type]: true };
        // Clear the input after storing (don't retain key in DOM)
        const input = this.shadowRoot?.querySelector<SlInput>(
          `sl-tab-panel[name="${type}"] sl-input`
        );
        if (input) input.value = '';
      }

      // Fetch available models
      await this._fetchModels(type);
    } catch (err) {
      const message = friendlyValidationError(type, err);
      setValidationStatus(type, { valid: false, loading: false, message });
      updateProviderConfig(type, { hasValidCredentials: false });
    }
  }

  private async _fetchModels(type: ProviderType): Promise<void> {
    try {
      const models = await listModels(type);
      setModelsForProvider(type, models);
    } catch {
      // Models unavailable — not blocking
    }
  }

  private _handleKeyBlur(type: ProviderType): void {
    const key = this._getInputValue(type);
    if (!key && !this._keySaved[type]) {
      this._errors = { ...this._errors, [type]: 'API key is required' };
    }
  }

  private _handleKeyInput(type: ProviderType): void {
    if (this._errors[type]) {
      this._errors = { ...this._errors, [type]: '' };
    }
  }

  private _handleEndpointInput(value: string): void {
    this._ollamaEndpoint = value;
    if (this._errors['ollama']) {
      this._errors = { ...this._errors, ollama: '' };
    }
  }

  private _handleEndpointBlur(): void {
    if (!this._ollamaEndpoint) {
      this._errors = { ...this._errors, ollama: 'Endpoint URL is required' };
    }
  }

  private _handleModelSelect(modelId: string): void {
    selectedModelState.set(modelId);
    // Auto-persist model selection (AC2 — persist across restarts)
    this._persistSettings();
  }

  private async _handleSetDefault(type: ProviderType): Promise<void> {
    activeProviderState.set(type);

    const models = modelsState.get()[type];
    const currentModel = selectedModelState.get();
    const modelBelongsToProvider = models?.some(m => m.id === currentModel);
    let modelToSave = currentModel;
    if (!modelBelongsToProvider && models?.length) {
      modelToSave = models[0].id;
      selectedModelState.set(modelToSave);
    }

    await this._persistSettings();
  }

  private async _persistSettings(): Promise<void> {
    try {
      await saveSettings({
        default_provider: activeProviderState.get(),
        default_model: selectedModelState.get(),
        ollama_endpoint: this._ollamaEndpoint,
        trust_level: trustLevelState.get(),
        providers: Object.fromEntries(
          providersState.get().map(p => [
            p.type,
            { enabled: p.hasValidCredentials, endpoint: p.endpoint },
          ])
        ),
      });
    } catch {
      // Saving failed — state is still updated locally
    }
  }

  private _handleDialogClose(e: Event): void {
    if (e.target === e.currentTarget) {
      this._open = false;
    }
  }

  private _renderValidationStatus(type: ProviderType) {
    const status = validationState.get()[type];
    if (!status) return nothing;

    if (status.loading) {
      return html`<span class="status-message">Validating...</span>`;
    }
    if (status.valid) {
      return html`<sl-badge variant="success">Valid</sl-badge>`;
    }
    if (status.message) {
      return html`<span class="status-message error">${status.message}</span>`;
    }
    return nothing;
  }

  private _renderModelSelector(type: ProviderType) {
    let models: Model[] = modelsState.get()[type] ?? [];
    if (models.length === 0) return nothing;

    // Apply filter for Ollama if enabled
    const showFilter = type === 'ollama';
    if (showFilter && this._showOnlyToolCapable) {
      models = models.filter(m => m.supports_tools);
    }

    const current = selectedModelState.get();

    return html`
      <div class="field-group">
        <span class="section-label">Model</span>
        ${showFilter ? html`
          <sl-checkbox
            class="model-filter"
            ?checked=${this._showOnlyToolCapable}
            @sl-change=${(e: Event) => { this._showOnlyToolCapable = (e.target as HTMLInputElement).checked; }}
          >
            Show only tool-capable models
          </sl-checkbox>
        ` : nothing}
        <sl-select
          placeholder="Select a model"
          .value=${current}
          @sl-change=${(e: Event) => {
            this._handleModelSelect((e.target as HTMLSelectElement).value);
          }}
        >
          ${models.map(m => html`
            <sl-option value=${m.id}>
              <span class="model-option">
                ${m.name}
                ${m.supports_tools ? html`<sl-badge variant="success" pill>Tools</sl-badge>` : nothing}
              </span>
            </sl-option>
          `)}
        </sl-select>
      </div>
    `;
  }

  private _renderDefaultStatus(type: ProviderType) {
    const isDefault = activeProviderState.get() === type;
    const hasCredentials = providersState
      .get()
      .find(p => p.type === type)?.hasValidCredentials;

    return html`
      <div class="default-row">
        <span class="default-label">
          ${isDefault ? 'Default provider' : 'Set as default provider'}
        </span>
        ${isDefault
          ? html`<sl-badge variant="primary">Default</sl-badge>`
          : html`
              <sl-button
                size="small"
                ?disabled=${!hasCredentials}
                @click=${() => this._handleSetDefault(type)}
              >
                Set as Default
              </sl-button>
            `}
      </div>
    `;
  }

  private _renderApiKeyTab(type: 'claude' | 'openai') {
    const label = type === 'claude' ? 'Claude API Key' : 'OpenAI API Key';
    const placeholder = type === 'claude' ? 'sk-ant-...' : 'sk-...';
    const saved = this._keySaved[type];
    const helpText = saved
      ? 'Key saved. Enter a new key to replace it.'
      : type === 'claude' ? 'Your Anthropic API key' : 'Your OpenAI API key';
    const error = this._errors[type] || '';
    const status = validationState.get()[type];

    return html`
      <div class="provider-form">
        <div class="field-group">
          <div class="field-row">
            <sl-input
              label=${label}
              type="password"
              password-toggle
              clearable
              placeholder=${placeholder}
              help-text=${error || helpText}
              @sl-input=${() => this._handleKeyInput(type)}
              @sl-blur=${() => this._handleKeyBlur(type)}
            ></sl-input>
            <sl-button
              variant="primary"
              ?loading=${status?.loading}
              @click=${() => this._handleValidate(type)}
            >
              Validate
            </sl-button>
          </div>
          <div class="validation-status">
            ${this._renderValidationStatus(type)}
          </div>
        </div>

        <sl-divider></sl-divider>
        ${this._renderModelSelector(type)}
        ${this._renderDefaultStatus(type)}
      </div>
    `;
  }

  private _renderOllamaTab() {
    const error = this._errors['ollama'] || '';
    const status = validationState.get()['ollama'];

    return html`
      <div class="provider-form">
        <div class="field-group">
          <div class="field-row">
            <sl-input
              label="Ollama Endpoint"
              type="url"
              clearable
              placeholder="http://localhost:11434"
              help-text=${error || 'URL of your running Ollama instance'}
              .value=${this._ollamaEndpoint}
              @sl-input=${(e: Event) =>
                this._handleEndpointInput((e.target as SlInput).value)}
              @sl-blur=${() => this._handleEndpointBlur()}
            ></sl-input>
            <sl-button
              variant="primary"
              ?loading=${status?.loading}
              @click=${() => this._handleValidate('ollama')}
            >
              Validate
            </sl-button>
          </div>
          <div class="validation-status">
            ${this._renderValidationStatus('ollama')}
          </div>
        </div>

        <sl-divider></sl-divider>
        ${this._renderModelSelector('ollama')}
        ${this._renderDefaultStatus('ollama')}
      </div>
    `;
  }

  private _handleTrustLevelChange(value: string): void {
    const level = value as TrustLevel;
    trustLevelState.set(level);
    this._persistSettings();
  }

  private _renderExecutionTab() {
    const current = trustLevelState.get();
    return html`
      <div class="provider-form">
        <div class="field-group">
          <span class="section-label">Trust Level</span>
          <sl-select
            .value=${current}
            @sl-change=${(e: Event) => this._handleTrustLevelChange((e.target as HTMLSelectElement).value)}
          >
            <sl-option value="supervised">
              Supervised
              <span slot="suffix" class="trust-description">Confirm all tool executions</span>
            </sl-option>
            <sl-option value="guided">
              Guided (Recommended)
              <span slot="suffix" class="trust-description">Confirm dangerous tools only</span>
            </sl-option>
            <sl-option value="autonomous">
              Autonomous
              <span slot="suffix" class="trust-description">Execute all tools without confirmation</span>
            </sl-option>
          </sl-select>
          <span class="help-text">
            Controls when you're asked to approve tool executions during conversations.
          </span>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <sl-dialog
        label="Provider Settings"
        ?open=${this._open}
        @sl-request-close=${this._handleDialogClose}
      >
        <sl-tab-group
          @sl-tab-show=${(e: CustomEvent) => {
            this._activeTab = e.detail.name as ProviderType;
          }}
        >
          <sl-tab slot="nav" panel="claude">Claude</sl-tab>
          <sl-tab slot="nav" panel="openai">OpenAI</sl-tab>
          <sl-tab slot="nav" panel="ollama">Ollama</sl-tab>
          <sl-tab slot="nav" panel="execution">Execution</sl-tab>

          <sl-tab-panel name="claude">${this._renderApiKeyTab('claude')}</sl-tab-panel>
          <sl-tab-panel name="openai">${this._renderApiKeyTab('openai')}</sl-tab-panel>
          <sl-tab-panel name="ollama">${this._renderOllamaTab()}</sl-tab-panel>
          <sl-tab-panel name="execution">${this._renderExecutionTab()}</sl-tab-panel>
        </sl-tab-group>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'provider-settings': ProviderSettings;
  }
}
