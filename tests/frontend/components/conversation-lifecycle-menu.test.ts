import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/conversation-lifecycle-menu.ts';
import type { ConversationLifecycleMenu } from '../../../src/components/core/chat/conversation-lifecycle-menu.ts';

describe('ConversationLifecycleMenu', () => {
  it('renders 3 options when open and not forceAction', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    expect(items.length).to.equal(3);
  });

  it('hides "Keep Working" when forceAction is true', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true} .forceAction=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    expect(items.length).to.equal(2);

    const labels = Array.from(items).map(i => i.textContent?.trim());
    expect(labels).to.not.include('Keep Working');
    expect(labels).to.include('Compact into Insight');
    expect(labels).to.include('Discard');
  });

  it('dispatches lifecycle-keep on Keep Working click', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-keep', () => { eventFired = true; });

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    (items[0] as HTMLElement).click();

    expect(eventFired).to.be.true;
  });

  it('dispatches lifecycle-compact on Compact click', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-compact', () => { eventFired = true; });

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    (items[1] as HTMLElement).click();

    expect(eventFired).to.be.true;
  });

  it('dispatches lifecycle-discard on Discard click', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-discard', () => { eventFired = true; });

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    (items[2] as HTMLElement).click();

    expect(eventFired).to.be.true;
  });

  it('dispatches lifecycle-dismiss on Escape key', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('lifecycle-dismiss', () => { eventFired = true; });

    const menu = el.shadowRoot!.querySelector('[role="menu"]') as HTMLElement;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(eventFired).to.be.true;
  });

  it('has role="menu" on container', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const menu = el.shadowRoot!.querySelector('[role="menu"]');
    expect(menu).to.exist;
  });

  it('has role="menuitem" on each option', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');
    expect(items.length).to.equal(3);
  });

  it('renders nothing when not open', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const menu = el.shadowRoot!.querySelector('[role="menu"]');
    expect(menu).to.be.null;
  });

  it('navigates with arrow keys', async () => {
    const el = await fixture<ConversationLifecycleMenu>(
      html`<conversation-lifecycle-menu ?open=${true}></conversation-lifecycle-menu>`
    );
    await el.updateComplete;

    const menu = el.shadowRoot!.querySelector('[role="menu"]') as HTMLElement;
    const items = el.shadowRoot!.querySelectorAll('[role="menuitem"]');

    // Focus first item
    (items[0] as HTMLElement).focus();

    // ArrowDown should move to next item
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement).to.equal(items[1]);
  });
});
