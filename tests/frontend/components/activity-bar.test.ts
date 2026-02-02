import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { ActivityBar } from '../../../src/components/core/layout/activity-bar.ts';

describe('ActivityBar', () => {
  it('renders with default activeSection of graph', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    expect(el).to.exist;
    expect(el).to.be.instanceOf(ActivityBar);
    expect(el.activeSection).to.equal('graph');
  });

  it('renders three section buttons with role="tab"', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    expect(buttons.length).to.equal(3);
  });

  it('sets aria-selected="true" on active section only', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="chat"></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    expect(buttons[0].getAttribute('aria-selected')).to.equal('false');
    expect(buttons[1].getAttribute('aria-selected')).to.equal('true');
    expect(buttons[2].getAttribute('aria-selected')).to.equal('false');
  });

  it('sets aria-selected="true" on graph when activeSection is graph', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="graph"></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    expect(buttons[0].getAttribute('aria-selected')).to.equal('true');
    expect(buttons[1].getAttribute('aria-selected')).to.equal('false');
    expect(buttons[2].getAttribute('aria-selected')).to.equal('false');
  });

  it('has nav element with role="tablist" and aria-orientation="vertical"', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('nav');
    expect(nav).to.exist;
    expect(nav!.getAttribute('role')).to.equal('tablist');
    expect(nav!.getAttribute('aria-orientation')).to.equal('vertical');
  });

  it('dispatches section-change event on click with correct section ID', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');

    setTimeout(() => (buttons[1] as HTMLButtonElement).click());
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('chat');
  });

  it('dispatches section-change for artifacts section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');

    setTimeout(() => (buttons[2] as HTMLButtonElement).click());
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('artifacts');
  });

  it('dispatches section-change for graph section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');

    setTimeout(() => (buttons[0] as HTMLButtonElement).click());
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('graph');
  });

  it('each button has aria-label matching section label', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    expect(buttons[0].getAttribute('aria-label')).to.equal('Phase Graph');
    expect(buttons[1].getAttribute('aria-label')).to.equal('Chat');
    expect(buttons[2].getAttribute('aria-label')).to.equal('Artifacts');
  });

  it('each button contains an SVG element', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    buttons.forEach((button) => {
      const svgEl = button.querySelector('svg');
      expect(svgEl).to.exist;
    });
  });

  it('each button is wrapped in sl-tooltip with correct content and placement', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar></activity-bar>`);
    await el.updateComplete;
    const tooltips = el.shadowRoot!.querySelectorAll('sl-tooltip');
    expect(tooltips.length).to.equal(3);
    expect(tooltips[0].getAttribute('content')).to.equal('Phase Graph');
    expect(tooltips[0].getAttribute('placement')).to.equal('right');
    expect(tooltips[1].getAttribute('content')).to.equal('Chat');
    expect(tooltips[1].getAttribute('placement')).to.equal('right');
    expect(tooltips[2].getAttribute('content')).to.equal('Artifacts');
    expect(tooltips[2].getAttribute('placement')).to.equal('right');
  });

  it('active section button is distinguished from inactive buttons', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="graph"></activity-bar>`);
    await el.updateComplete;
    const activeButton = el.shadowRoot!.querySelector('button[aria-selected="true"]');
    expect(activeButton).to.exist;
    const inactiveButtons = el.shadowRoot!.querySelectorAll('button[aria-selected="false"]');
    expect(inactiveButtons.length).to.equal(2);
  });

  // Roving tabindex tests (H3)
  it('active tab has tabindex="0" and inactive tabs have tabindex="-1"', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="chat"></activity-bar>`);
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('button[role="tab"]');
    expect(buttons[0].getAttribute('tabindex')).to.equal('-1');
    expect(buttons[1].getAttribute('tabindex')).to.equal('0');
    expect(buttons[2].getAttribute('tabindex')).to.equal('-1');
  });

  // Arrow key navigation tests (H4)
  it('ArrowDown moves to next section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="graph"></activity-bar>`);
    await el.updateComplete;

    const nav = el.shadowRoot!.querySelector('nav')!;
    setTimeout(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('chat');
  });

  it('ArrowUp moves to previous section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="chat"></activity-bar>`);
    await el.updateComplete;

    const nav = el.shadowRoot!.querySelector('nav')!;
    setTimeout(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('graph');
  });

  it('ArrowDown wraps from last to first', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="artifacts"></activity-bar>`);
    await el.updateComplete;

    const nav = el.shadowRoot!.querySelector('nav')!;
    setTimeout(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('graph');
  });

  it('Home moves to first section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="artifacts"></activity-bar>`);
    await el.updateComplete;

    const nav = el.shadowRoot!.querySelector('nav')!;
    setTimeout(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('graph');
  });

  it('End moves to last section', async () => {
    const el = await fixture<ActivityBar>(html`<activity-bar activeSection="graph"></activity-bar>`);
    await el.updateComplete;

    const nav = el.shadowRoot!.querySelector('nav')!;
    setTimeout(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    const event = await oneEvent(el, 'section-change') as CustomEvent;
    expect(event.detail.section).to.equal('artifacts');
  });
});
