import { expect, fixture, html } from '@open-wc/testing';
import { ProviderSettings } from '../../../src/components/core/settings/provider-settings.ts';
import {
  providersState,
  validationState,
  setValidationStatus,
  updateProviderConfig,
} from '../../../src/state/provider.state.ts';

// Stub fetch globally for component tests
beforeEach(() => {
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({
        default_provider: 'claude',
        default_model: '',
        ollama_endpoint: 'http://localhost:11434',
        providers: {
          claude: { enabled: false },
          openai: { enabled: false },
          ollama: { enabled: false },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  // Reset state between tests
  providersState.set([
    { type: 'claude', enabled: false, hasValidCredentials: false },
    { type: 'openai', enabled: false, hasValidCredentials: false },
    { type: 'ollama', enabled: false, hasValidCredentials: false, endpoint: 'http://localhost:11434' },
  ]);
  validationState.set({});
});

describe('ProviderSettings', () => {
  // --- Structural tests ---

  it('renders as a custom element', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    expect(el).to.exist;
    expect(el).to.be.instanceOf(ProviderSettings);
  });

  it('has shadow root with styles', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.be.greaterThan(0);
  });

  it('contains a dialog element', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.exist;
  });

  it('dialog has correct label', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog!.getAttribute('label')).to.equal('Provider Settings');
  });

  it('contains tab group with three provider tabs', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    const tabs = el.shadowRoot!.querySelectorAll('sl-tab');
    expect(tabs.length).to.equal(3);
  });

  it('has Claude, OpenAI, and Ollama tab panels', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    const panels = el.shadowRoot!.querySelectorAll('sl-tab-panel');
    expect(panels.length).to.equal(3);
    const panelNames = Array.from(panels).map(p => p.getAttribute('name'));
    expect(panelNames).to.include.members(['claude', 'openai', 'ollama']);
  });

  it('exposes open() and close() methods', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    expect(typeof el.open).to.equal('function');
    expect(typeof el.close).to.equal('function');
  });

  it('dialog is closed by default', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog!.hasAttribute('open')).to.be.false;
  });

  // --- Behavioral tests (M3 fix) ---

  it('does not store API key values in component state', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    // Component should track _keySaved (boolean) not _apiKeys (string)
    expect((el as any)._keySaved).to.exist;
    expect((el as any)._apiKeys).to.be.undefined;
  });

  it('shows validation success badge when validation state is valid', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    setValidationStatus('claude', { valid: true, loading: false, message: 'Valid' });
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('sl-badge[variant="success"]');
    expect(badge).to.exist;
  });

  it('shows error message when validation state has error', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    setValidationStatus('claude', { valid: false, loading: false, message: 'Invalid key' });
    await el.updateComplete;

    const errorMsg = el.shadowRoot!.querySelector('.status-message.error');
    expect(errorMsg).to.exist;
    expect(errorMsg!.textContent).to.equal('Invalid key');
  });

  it('shows loading text when validation is in progress', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    setValidationStatus('claude', { loading: true });
    await el.updateComplete;

    const loadingMsg = el.shadowRoot!.querySelector('.status-message');
    expect(loadingMsg).to.exist;
    expect(loadingMsg!.textContent).to.equal('Validating...');
  });

  it('disables Set as Default button when provider has no valid credentials', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;

    const buttons = el.shadowRoot!.querySelectorAll('sl-button[size="small"]');
    const defaultButton = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Set as Default'
    );
    expect(defaultButton).to.exist;
    expect(defaultButton!.hasAttribute('disabled')).to.be.true;
  });

  it('enables Set as Default button when provider has valid credentials', async () => {
    updateProviderConfig('claude', { hasValidCredentials: true });

    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;

    const buttons = el.shadowRoot!.querySelectorAll('sl-button[size="small"]');
    const defaultButton = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Set as Default'
    );
    expect(defaultButton).to.exist;
    expect(defaultButton!.hasAttribute('disabled')).to.be.false;
  });

  it('shows help text indicating key is saved when _keySaved is true', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    (el as any)._keySaved = { claude: true };
    await el.updateComplete;

    const claudePanel = el.shadowRoot!.querySelector('sl-tab-panel[name="claude"]');
    const input = claudePanel?.querySelector('sl-input');
    expect(input).to.exist;
    const helpText = input!.getAttribute('help-text');
    expect(helpText).to.include('Key saved');
  });

  it('contains Ollama endpoint input with URL type', async () => {
    const el = await fixture<ProviderSettings>(
      html`<provider-settings></provider-settings>`
    );
    await el.updateComplete;

    const ollamaPanel = el.shadowRoot!.querySelector('sl-tab-panel[name="ollama"]');
    const input = ollamaPanel?.querySelector('sl-input');
    expect(input).to.exist;
    expect(input!.getAttribute('type')).to.equal('url');
  });
});
