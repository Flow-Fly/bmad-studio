import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/insights/attach-context-picker.ts';
import { insightsState } from '../../../src/state/insight.state.ts';
import type { Insight } from '../../../src/types/insight.ts';

const mockInsight: Insight = {
  id: 'ins-1',
  title: 'Test Insight',
  origin_context: 'Some context text here',
  extracted_idea: 'Extracted idea content',
  tags: ['test', 'mock'],
  highlight_colors_used: [],
  created_at: '2026-01-01T00:00:00Z',
  source_agent: 'analyst',
  status: 'fresh',
  used_in_count: 0,
};

beforeEach(() => {
  insightsState.set([]);
});

afterEach(() => {
  insightsState.set([]);
});

describe('attach-context-picker', () => {
  it('renders nothing when closed', async () => {
    const el = await fixture(
      html`<attach-context-picker></attach-context-picker>`
    );
    await el.updateComplete;

    // Should render nothing (display: contents with no children)
    const overlay = el.shadowRoot!.querySelector('.overlay');
    expect(overlay).to.not.exist;
  });

  it('opens as dialog when open=true', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true} .conversationId=${'conv-1'}></attach-context-picker>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('[role="dialog"]');
    expect(dialog).to.exist;
  });

  it('has role="dialog" with aria-label', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('[role="dialog"]');
    expect(dialog).to.exist;
    expect(dialog!.getAttribute('aria-label')).to.equal('Attach context to conversation');
    expect(dialog!.getAttribute('aria-modal')).to.equal('true');
  });

  it('renders three tabs', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    const tablist = el.shadowRoot!.querySelector('[role="tablist"]');
    expect(tablist).to.exist;

    const tabs = el.shadowRoot!.querySelectorAll('[role="tab"]');
    expect(tabs.length).to.equal(3);
    expect(tabs[0].textContent!.trim()).to.equal('Insights');
    expect(tabs[1].textContent!.trim()).to.equal('Project Files');
    expect(tabs[2].textContent!.trim()).to.equal('Upload');
  });

  it('has role="tablist" for tab navigation', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    const tablist = el.shadowRoot!.querySelector('[role="tablist"]');
    expect(tablist).to.exist;
  });

  it('shows insight items with cost badges', async () => {
    insightsState.set([mockInsight]);

    const el = await fixture(
      html`<attach-context-picker ?open=${true} .contextWindowSize=${200000}></attach-context-picker>`
    );
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.item');
    expect(items.length).to.equal(1);

    const title = items[0].querySelector('.item-title');
    expect(title!.textContent).to.equal('Test Insight');

    const badge = items[0].querySelector('.cost-badge');
    expect(badge).to.exist;
    expect(badge!.textContent).to.include('+');
    expect(badge!.textContent).to.include('%');
  });

  it('shows upload dropzone on Upload tab', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    // Click Upload tab
    const tabs = el.shadowRoot!.querySelectorAll('[role="tab"]');
    (tabs[2] as HTMLElement).click();
    await el.updateComplete;

    const dropzone = el.shadowRoot!.querySelector('.upload-zone');
    expect(dropzone).to.exist;
  });

  it('shows footer with selected count and projected percentage', async () => {
    const el = await fixture(
      html`<attach-context-picker
        ?open=${true}
        .currentContextPercent=${30}
        .contextWindowSize=${200000}
      ></attach-context-picker>`
    );
    await el.updateComplete;

    const stats = el.shadowRoot!.querySelector('.footer-stats');
    expect(stats).to.exist;
    expect(stats!.textContent).to.include('0 selected');
    expect(stats!.textContent).to.include('Current: 30%');
    expect(stats!.textContent).to.include('Projected: 30%');
  });

  it('shows warning when projected exceeds 80%', async () => {
    insightsState.set([{
      ...mockInsight,
      origin_context: 'x'.repeat(700000), // large content
      extracted_idea: 'y'.repeat(100000),
    }]);

    const el = await fixture(
      html`<attach-context-picker
        ?open=${true}
        .currentContextPercent=${70}
        .contextWindowSize=${200000}
      ></attach-context-picker>`
    );
    await el.updateComplete;

    // Select the large insight
    const items = el.shadowRoot!.querySelectorAll('.item');
    (items[0] as HTMLElement).click();
    await el.updateComplete;

    const warning = el.shadowRoot!.querySelector('.warning');
    expect(warning).to.exist;
    expect(warning!.textContent).to.include('80%');
  });

  it('dispatches context-attached event on Attach', async () => {
    insightsState.set([mockInsight]);

    const el = await fixture(
      html`<attach-context-picker
        ?open=${true}
        .conversationId=${'conv-1'}
        .contextWindowSize=${200000}
      ></attach-context-picker>`
    );
    await el.updateComplete;

    // Select an insight
    const items = el.shadowRoot!.querySelectorAll('.item');
    (items[0] as HTMLElement).click();
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('context-attached', () => { eventFired = true; });

    const attachBtn = el.shadowRoot!.querySelector<HTMLElement>('sl-button[variant="primary"]');
    attachBtn!.click();
    await el.updateComplete;

    expect(eventFired).to.be.true;
  });

  it('closes on Cancel', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    let closeFired = false;
    el.addEventListener('picker-close', () => { closeFired = true; });

    const cancelBtn = el.shadowRoot!.querySelector<HTMLElement>('sl-button:not([variant])');
    cancelBtn!.click();
    await el.updateComplete;

    expect(closeFired).to.be.true;
  });

  it('closes on Escape key', async () => {
    const el = await fixture(
      html`<attach-context-picker ?open=${true}></attach-context-picker>`
    );
    await el.updateComplete;

    let closeFired = false;
    el.addEventListener('picker-close', () => { closeFired = true; });

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(event);
    await el.updateComplete;

    expect(closeFired).to.be.true;
  });

  it('calculates cost percentage correctly', async () => {
    // 800 chars / 4 = 200 tokens. 200 / 200000 * 100 = 0.1% -> ceil -> 1%
    insightsState.set([{
      ...mockInsight,
      origin_context: 'a'.repeat(400),
      extracted_idea: 'b'.repeat(400),
    }]);

    const el = await fixture(
      html`<attach-context-picker
        ?open=${true}
        .contextWindowSize=${200000}
      ></attach-context-picker>`
    );
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('.cost-badge');
    expect(badge).to.exist;
    expect(badge!.textContent).to.include('+1%');
  });
});
