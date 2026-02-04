import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/context-full-modal.ts';
import type { ContextFullModal } from '../../../src/components/core/chat/context-full-modal.ts';

describe('ContextFullModal', () => {
  it('renders only Compact and Discard options (no Keep Working)', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal ?open=${true}></context-full-modal>`
    );
    await el.updateComplete;

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    const labels = Array.from(buttons).map(b => b.textContent?.trim());
    expect(labels).to.include('Compact into Insight');
    expect(labels).to.include('Discard');
    expect(labels).to.not.include('Keep Working');
  });

  it('renders dialog with correct title when open', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal ?open=${true}></context-full-modal>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.exist;
    expect(dialog!.getAttribute('label')).to.equal('Context window full');
  });

  it('dispatches lifecycle-compact on Compact click', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal ?open=${true}></context-full-modal>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-compact', () => { eventFired = true; });

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    const compactBtn = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Compact into Insight'
    );
    expect(compactBtn).to.exist;
    compactBtn!.click();

    expect(eventFired).to.be.true;
  });

  it('dispatches lifecycle-discard on Discard click', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal ?open=${true}></context-full-modal>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-discard', () => { eventFired = true; });

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    const discardBtn = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Discard'
    );
    expect(discardBtn).to.exist;
    discardBtn!.click();

    expect(eventFired).to.be.true;
  });

  it('renders nothing when not open', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal></context-full-modal>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.be.null;
  });

  it('has no-header-close attribute on dialog', async () => {
    const el = await fixture<ContextFullModal>(
      html`<context-full-modal ?open=${true}></context-full-modal>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.exist;
    expect(dialog!.hasAttribute('no-header-close')).to.be.true;
  });
});
