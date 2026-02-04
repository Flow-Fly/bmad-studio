import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/discard-confirm-dialog.ts';
import type { DiscardConfirmDialog } from '../../../src/components/core/chat/discard-confirm-dialog.ts';

describe('DiscardConfirmDialog', () => {
  it('renders dialog with correct title when open', async () => {
    const el = await fixture<DiscardConfirmDialog>(
      html`<discard-confirm-dialog ?open=${true}></discard-confirm-dialog>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.exist;
    expect(dialog!.getAttribute('label')).to.equal('Discard conversation?');
  });

  it('renders dialog body text', async () => {
    const el = await fixture<DiscardConfirmDialog>(
      html`<discard-confirm-dialog ?open=${true}></discard-confirm-dialog>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.dialog-body');
    expect(body).to.exist;
    expect(body!.textContent).to.contain('This cannot be undone');
  });

  it('dispatches discard-confirmed on Discard click', async () => {
    const el = await fixture<DiscardConfirmDialog>(
      html`<discard-confirm-dialog ?open=${true}></discard-confirm-dialog>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('discard-confirmed', () => { eventFired = true; });

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    const discardBtn = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Discard'
    );
    expect(discardBtn).to.exist;
    discardBtn!.click();

    expect(eventFired).to.be.true;
  });

  it('dispatches discard-cancelled on Cancel click', async () => {
    const el = await fixture<DiscardConfirmDialog>(
      html`<discard-confirm-dialog ?open=${true}></discard-confirm-dialog>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('discard-cancelled', () => { eventFired = true; });

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    const cancelBtn = Array.from(buttons).find(
      b => b.textContent?.trim() === 'Cancel'
    );
    expect(cancelBtn).to.exist;
    cancelBtn!.click();

    expect(eventFired).to.be.true;
  });

  it('renders nothing when not open', async () => {
    const el = await fixture<DiscardConfirmDialog>(
      html`<discard-confirm-dialog></discard-confirm-dialog>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.be.null;
  });
});
