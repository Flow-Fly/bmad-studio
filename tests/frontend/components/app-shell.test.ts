import { expect, fixture, html } from '@open-wc/testing';
import { AppShell } from '../../../src/app-shell.ts';

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
    // Verify h1 is used for main title (accessibility best practice)
    const h1 = el.shadowRoot!.querySelector('h1');
    expect(h1).to.exist;
    expect(h1!.tagName.toLowerCase()).to.equal('h1');
  });

  it('has shadow root with styles attached', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    // Verify component has shadow DOM with adopted stylesheets (Lit pattern)
    expect(el.shadowRoot).to.exist;
    // Lit components use adoptedStyleSheets for styles
    expect(el.shadowRoot!.adoptedStyleSheets.length).to.be.greaterThan(0);
  });
});
