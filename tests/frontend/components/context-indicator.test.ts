import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/context-indicator.ts';
import type { ContextIndicator } from '../../../src/components/core/chat/context-indicator.ts';

describe('ContextIndicator', () => {
  it('renders with role="meter" and correct aria attributes', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${45}></context-indicator>`
    );
    await el.updateComplete;

    const meter = el.shadowRoot!.querySelector('[role="meter"]');
    expect(meter).to.exist;
    expect(meter!.getAttribute('aria-valuenow')).to.equal('45');
    expect(meter!.getAttribute('aria-valuemin')).to.equal('0');
    expect(meter!.getAttribute('aria-valuemax')).to.equal('100');
    expect(meter!.getAttribute('aria-label')).to.equal('Context window usage');
  });

  it('displays bar with correct width percentage', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${73}></context-indicator>`
    );
    await el.updateComplete;

    const bar = el.shadowRoot!.querySelector('.bar') as HTMLElement;
    expect(bar).to.exist;
    expect(bar.style.width).to.equal('73%');
  });

  it('applies context--low class when percentage is 0-60', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${30}></context-indicator>`
    );
    await el.updateComplete;

    const wrapper = el.shadowRoot!.querySelector('.context--low');
    expect(wrapper).to.exist;
  });

  it('applies context--medium class when percentage is 60-80', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${70}></context-indicator>`
    );
    await el.updateComplete;

    const wrapper = el.shadowRoot!.querySelector('.context--medium');
    expect(wrapper).to.exist;
  });

  it('applies context--high class when percentage is 80-95', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${90}></context-indicator>`
    );
    await el.updateComplete;

    const wrapper = el.shadowRoot!.querySelector('.context--high');
    expect(wrapper).to.exist;
  });

  it('applies context--critical class when percentage is 95-100', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${98}></context-indicator>`
    );
    await el.updateComplete;

    const wrapper = el.shadowRoot!.querySelector('.context--critical');
    expect(wrapper).to.exist;
  });

  it('applies context--critical at exactly 95%', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${95}></context-indicator>`
    );
    await el.updateComplete;

    const wrapper = el.shadowRoot!.querySelector('.context--critical');
    expect(wrapper).to.exist;
  });

  it('tooltip is hidden by default', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${50} .modelName=${'claude-sonnet-4-5'}></context-indicator>`
    );
    await el.updateComplete;

    const tooltip = el.shadowRoot!.querySelector('.tooltip');
    expect(tooltip).to.be.null;
  });

  it('shows tooltip on hover with percentage and model name', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${73} .modelName=${'claude-sonnet-4-5'}></context-indicator>`
    );
    await el.updateComplete;

    // Simulate mouseenter
    const wrapper = el.shadowRoot!.querySelector('[class^="context--"]')!;
    wrapper.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;

    const tooltip = el.shadowRoot!.querySelector('.tooltip');
    expect(tooltip).to.exist;
    expect(tooltip!.textContent).to.equal('73% of claude-sonnet-4-5 context');
  });

  it('hides tooltip on mouseleave', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${73} .modelName=${'claude-sonnet-4-5'}></context-indicator>`
    );
    await el.updateComplete;

    // Hover then leave
    const wrapper = el.shadowRoot!.querySelector('[class^="context--"]')!;
    wrapper.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.tooltip')).to.exist;

    wrapper.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.tooltip')).to.be.null;
  });

  it('dispatches context-indicator-click event on click', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${50}></context-indicator>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('context-indicator-click', () => {
      eventFired = true;
    });

    const wrapper = el.shadowRoot!.querySelector('[class^="context--"]') as HTMLElement;
    wrapper.click();

    expect(eventFired).to.be.true;
  });

  it('bar has 0% width when percentage is 0', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${0}></context-indicator>`
    );
    await el.updateComplete;

    const bar = el.shadowRoot!.querySelector('.bar') as HTMLElement;
    expect(bar).to.exist;
    expect(bar.style.width).to.equal('0%');
  });

  it('clamps percentage at 100 (bar never exceeds 100% width)', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${150}></context-indicator>`
    );
    await el.updateComplete;

    const bar = el.shadowRoot!.querySelector('.bar') as HTMLElement;
    expect(bar.style.width).to.equal('100%');

    const meter = el.shadowRoot!.querySelector('[role="meter"]');
    expect(meter!.getAttribute('aria-valuenow')).to.equal('100');
  });

  it('clamps negative percentage to 0', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${-10}></context-indicator>`
    );
    await el.updateComplete;

    const bar = el.shadowRoot!.querySelector('.bar') as HTMLElement;
    expect(bar.style.width).to.equal('0%');

    const meter = el.shadowRoot!.querySelector('[role="meter"]');
    expect(meter!.getAttribute('aria-valuenow')).to.equal('0');
  });

  it('applies context--low at boundary value 59', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${59}></context-indicator>`
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.context--low')).to.exist;
  });

  it('applies context--medium at boundary value 60', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${60}></context-indicator>`
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.context--medium')).to.exist;
  });

  it('applies context--high at boundary value 80', async () => {
    const el = await fixture<ContextIndicator>(
      html`<context-indicator .percentage=${80}></context-indicator>`
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.context--high')).to.exist;
  });
});
