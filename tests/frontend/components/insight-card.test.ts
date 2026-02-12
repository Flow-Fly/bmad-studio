import { fixture, html, expect } from '@open-wc/testing';
import '../../../src/components/core/insights/insight-card.js';
import type { InsightCard } from '../../../src/components/core/insights/insight-card.js';
import type { Insight } from '../../../src/types/insight.js';

function createMockInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'test-insight-1',
    title: 'Test Insight Title',
    origin_context: 'Some origin context',
    extracted_idea: 'Some extracted idea content',
    tags: ['architecture', 'patterns'],
    highlight_colors_used: ['#ffeb3b', '#4caf50'],
    created_at: '2026-02-01T10:00:00Z',
    source_agent: 'Architect',
    status: 'fresh',
    used_in_count: 0,
    ...overrides,
  };
}

describe('insight-card', () => {
  it('renders collapsed card with title, agent, date, tags', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()}></insight-card>
    `);
    const title = el.shadowRoot!.querySelector('.title');
    expect(title).to.exist;
    expect(title!.textContent).to.include('Test Insight Title');

    const meta = el.shadowRoot!.querySelector('.meta');
    expect(meta!.textContent).to.include('Architect');

    const tags = el.shadowRoot!.querySelectorAll('sl-tag');
    expect(tags.length).to.equal(2);

    const preview = el.shadowRoot!.querySelector('.preview');
    expect(preview).to.exist;
  });

  it('shows solid dot for fresh status', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight({ status: 'fresh' })}></insight-card>
    `);
    const dot = el.shadowRoot!.querySelector('.status-dot--fresh');
    expect(dot).to.exist;
  });

  it('shows half dot and USED tag for used status', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight({ status: 'used', used_in_count: 3 })}></insight-card>
    `);
    const dot = el.shadowRoot!.querySelector('.status-dot--used');
    expect(dot).to.exist;

    const badge = el.shadowRoot!.querySelector('.used-badge');
    expect(badge).to.exist;
    expect(badge!.textContent).to.include('USED');
    expect(badge!.textContent).to.include('3');
  });

  it('shows dimmed styling for archived status', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight({ status: 'archived' })}></insight-card>
    `);
    await el.updateComplete;
    const dot = el.shadowRoot!.querySelector('.status-dot--archived');
    expect(dot).to.exist;
    expect(el.hasAttribute('archived')).to.be.true;
  });

  it('expands on click to show full content', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()}></insight-card>
    `);
    expect(el.expanded).to.be.false;
    expect(el.shadowRoot!.querySelector('.expanded-content')).to.be.null;

    const card = el.shadowRoot!.querySelector('.card')!;
    card.dispatchEvent(new Event('click'));
    await el.updateComplete;

    expect(el.expanded).to.be.true;
    expect(el.shadowRoot!.querySelector('.expanded-content')).to.exist;
  });

  it('renders markdown in expanded view via markdown-renderer', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()} .expanded=${true}></insight-card>
    `);
    const renderers = el.shadowRoot!.querySelectorAll('markdown-renderer');
    expect(renderers.length).to.be.greaterThan(0);
  });

  it('dispatches insight-inject event on Inject click', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()} .expanded=${true}></insight-card>
    `);
    let fired = false;
    el.addEventListener('insight-inject', ((e: CustomEvent) => {
      fired = true;
      expect(e.detail.insightId).to.equal('test-insight-1');
    }) as EventListener);

    const injectBtn = Array.from(el.shadowRoot!.querySelectorAll('.action-btn'))
      .find(btn => btn.textContent?.includes('Inject'));
    expect(injectBtn).to.exist;
    injectBtn!.dispatchEvent(new Event('click'));
    expect(fired).to.be.true;
  });

  it('dispatches insight-archive event on Archive click', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()} .expanded=${true}></insight-card>
    `);
    let fired = false;
    el.addEventListener('insight-archive', ((e: CustomEvent) => {
      fired = true;
      expect(e.detail.insightId).to.equal('test-insight-1');
    }) as EventListener);

    const archiveBtn = Array.from(el.shadowRoot!.querySelectorAll('.action-btn'))
      .find(btn => btn.textContent?.includes('Archive'));
    expect(archiveBtn).to.exist;
    archiveBtn!.dispatchEvent(new Event('click'));
    expect(fired).to.be.true;
  });

  it('dispatches insight-delete event on Delete click', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()} .expanded=${true}></insight-card>
    `);
    let fired = false;
    el.addEventListener('insight-delete', ((e: CustomEvent) => {
      fired = true;
      expect(e.detail.insightId).to.equal('test-insight-1');
    }) as EventListener);

    const deleteBtn = Array.from(el.shadowRoot!.querySelectorAll('.action-btn'))
      .find(btn => btn.textContent?.includes('Delete'));
    expect(deleteBtn).to.exist;
    deleteBtn!.dispatchEvent(new Event('click'));
    expect(fired).to.be.true;
  });

  it('has role="listitem" on card', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()}></insight-card>
    `);
    const card = el.shadowRoot!.querySelector('[role="listitem"]');
    expect(card).to.exist;
  });

  it('has aria-expanded attribute', async () => {
    const el = await fixture<InsightCard>(html`
      <insight-card .insight=${createMockInsight()}></insight-card>
    `);
    const card = el.shadowRoot!.querySelector('[aria-expanded]');
    expect(card).to.exist;
    expect(card!.getAttribute('aria-expanded')).to.equal('false');
  });
});
