import { fixture, html, expect } from '@open-wc/testing';
import '../../../src/components/core/insights/insight-panel.js';
import type { InsightPanel } from '../../../src/components/core/insights/insight-panel.js';
import type { Insight } from '../../../src/types/insight.js';
import { setInsights, clearInsightState, insightFilters } from '../../../src/state/insight.state.js';

function createMockInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'insight-1',
    title: 'Test Insight',
    origin_context: 'Origin context text',
    extracted_idea: 'Extracted idea text',
    tags: ['tag1'],
    highlight_colors_used: [],
    created_at: '2026-02-01T10:00:00Z',
    source_agent: 'Architect',
    status: 'fresh',
    used_in_count: 0,
    ...overrides,
  };
}

describe('insight-panel', () => {
  beforeEach(() => {
    clearInsightState();
  });

  it('renders list of insight cards', async () => {
    setInsights([
      createMockInsight({ id: 'i1', title: 'First' }),
      createMockInsight({ id: 'i2', title: 'Second' }),
    ]);

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect(cards.length).to.equal(2);
  });

  it('shows empty state when no insights', async () => {
    setInsights([]);
    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const empty = el.shadowRoot!.querySelector('.empty-state');
    expect(empty).to.exist;
    expect(empty!.textContent).to.include('No Insights yet');
  });

  it('shows filtered empty state when filters match nothing', async () => {
    setInsights([
      createMockInsight({ id: 'i1', status: 'archived' }),
    ]);
    // Default filters only show 'fresh' and 'used', so archived should not appear
    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const empty = el.shadowRoot!.querySelector('.empty-state');
    expect(empty).to.exist;
    expect(empty!.textContent).to.include('No Insights match your filters');
  });

  it('filters by status', async () => {
    setInsights([
      createMockInsight({ id: 'i1', status: 'fresh' }),
      createMockInsight({ id: 'i2', status: 'used' }),
      createMockInsight({ id: 'i3', status: 'archived' }),
    ]);

    // Set filter to only 'fresh'
    insightFilters.set({
      ...insightFilters.get(),
      status: ['fresh'],
    });

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect(cards.length).to.equal(1);
  });

  it('sorts by recency (default)', async () => {
    setInsights([
      createMockInsight({ id: 'i1', title: 'Older', created_at: '2026-01-01T00:00:00Z' }),
      createMockInsight({ id: 'i2', title: 'Newer', created_at: '2026-02-01T00:00:00Z' }),
    ]);

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect(cards.length).to.equal(2);
    // First card should be the newer one
    expect((cards[0] as any).insight.title).to.equal('Newer');
  });

  it('sorts by used count', async () => {
    setInsights([
      createMockInsight({ id: 'i1', title: 'Less Used', used_in_count: 1 }),
      createMockInsight({ id: 'i2', title: 'More Used', used_in_count: 5 }),
    ]);
    insightFilters.set({ ...insightFilters.get(), sortBy: 'used_count' });

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect((cards[0] as any).insight.title).to.equal('More Used');
  });

  it('sorts by title', async () => {
    setInsights([
      createMockInsight({ id: 'i1', title: 'Zebra' }),
      createMockInsight({ id: 'i2', title: 'Apple' }),
    ]);
    insightFilters.set({ ...insightFilters.get(), sortBy: 'title' });

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect((cards[0] as any).insight.title).to.equal('Apple');
  });

  it('filters by search query on title and tags', async () => {
    setInsights([
      createMockInsight({ id: 'i1', title: 'Provider Design', tags: ['arch'] }),
      createMockInsight({ id: 'i2', title: 'Sprint Plan', tags: ['sprint'] }),
    ]);
    insightFilters.set({ ...insightFilters.get(), searchQuery: 'provider' });

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('insight-card');
    expect(cards.length).to.equal(1);
    expect((cards[0] as any).insight.title).to.equal('Provider Design');
  });

  it('shows summary footer with counts', async () => {
    setInsights([
      createMockInsight({ id: 'i1', status: 'fresh' }),
      createMockInsight({ id: 'i2', status: 'used' }),
      createMockInsight({ id: 'i3', status: 'archived' }),
    ]);
    // Include all statuses in filter to render cards
    insightFilters.set({ ...insightFilters.get(), status: ['fresh', 'used', 'archived'] });

    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const footer = el.shadowRoot!.querySelector('.panel-footer');
    expect(footer).to.exist;
    expect(footer!.textContent).to.include('3 insights');
    expect(footer!.textContent).to.include('1 used');
    expect(footer!.textContent).to.include('1 archived');
  });

  it('has role="list" on card container', async () => {
    setInsights([createMockInsight()]);
    const el = await fixture<InsightPanel>(html`<insight-panel></insight-panel>`);
    await el.updateComplete;

    const list = el.shadowRoot!.querySelector('[role="list"]');
    expect(list).to.exist;
  });
});
