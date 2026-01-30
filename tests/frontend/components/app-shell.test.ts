import { expect, fixture, html } from '@open-wc/testing';
import { AppShell } from '../../../src/app-shell.ts';

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
});

describe('AppShell', () => {
  it('renders with default values', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    expect(el).to.exist;
    expect(el).to.be.instanceOf(AppShell);
  });

  it('displays the BMAD Studio title', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const h1 = el.shadowRoot!.querySelector('h1');
    expect(h1).to.exist;
    expect(h1!.textContent).to.equal('BMAD Studio');
  });

  it('contains the app container', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const container = el.shadowRoot!.querySelector('.container');
    expect(container).to.exist;
  });

  it('uses semantic heading element for title', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const h1 = el.shadowRoot!.querySelector('h1');
    expect(h1).to.exist;
    expect(h1!.tagName.toLowerCase()).to.equal('h1');
  });

  it('has shadow root with styles attached', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.be.greaterThan(0);
  });

  it('contains a settings icon button', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const iconButton = el.shadowRoot!.querySelector('sl-icon-button');
    expect(iconButton).to.exist;
    expect(iconButton!.getAttribute('name')).to.equal('gear');
  });

  it('contains the provider-settings component', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const settings = el.shadowRoot!.querySelector('provider-settings');
    expect(settings).to.exist;
  });

  it('has a toolbar with the settings button', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector('.toolbar');
    expect(toolbar).to.exist;
    const button = toolbar!.querySelector('sl-icon-button');
    expect(button).to.exist;
  });
});
