import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/highlight-popover.ts';
import type { HighlightPopover } from '../../../src/components/core/chat/highlight-popover.ts';

describe('HighlightPopover', () => {
  it('renders 4 color dots when open', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    const dots = el.shadowRoot!.querySelectorAll('.color-dot');
    expect(dots.length).to.equal(4);
  });

  it('is hidden when open is false', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover></highlight-popover>`
    );
    await el.updateComplete;

    // :host { display: none } when not open
    const style = getComputedStyle(el);
    expect(style.display).to.equal('none');
  });

  it('is visible when open is true', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    const style = getComputedStyle(el);
    expect(style.display).to.not.equal('none');
  });

  it('dispatches highlight-select with correct color on dot click', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    let selectedColor = '';
    el.addEventListener('highlight-select', ((e: CustomEvent) => {
      selectedColor = e.detail.color;
    }) as EventListener);

    const dots = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.color-dot');
    // Click the second dot (green)
    dots[1].click();

    expect(selectedColor).to.equal('green');
  });

  it('dispatches highlight-dismiss on Escape key', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    let dismissed = false;
    el.addEventListener('highlight-dismiss', () => {
      dismissed = true;
    });

    const popover = el.shadowRoot!.querySelector('.popover')!;
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(dismissed).to.be.true;
  });

  it('each dot has correct aria-label', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    const dots = el.shadowRoot!.querySelectorAll('.color-dot');
    expect(dots[0].getAttribute('aria-label')).to.equal('Highlight as important');
    expect(dots[1].getAttribute('aria-label')).to.equal('Highlight as keep');
    expect(dots[2].getAttribute('aria-label')).to.equal('Highlight as disagree');
    expect(dots[3].getAttribute('aria-label')).to.equal('Highlight as question');
  });

  it('arrow keys move focus between dots', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;
    // Wait for focus to be set
    await new Promise(resolve => requestAnimationFrame(resolve));

    const popover = el.shadowRoot!.querySelector('.popover')!;
    const dots = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.color-dot');

    // First dot should be focused initially
    expect(el.shadowRoot!.activeElement).to.equal(dots[0]);

    // Press ArrowRight to move to second dot
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.shadowRoot!.activeElement).to.equal(dots[1]);

    // Press ArrowLeft to move back to first dot
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.shadowRoot!.activeElement).to.equal(dots[0]);
  });

  it('Enter key selects the focused dot', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;
    await new Promise(resolve => requestAnimationFrame(resolve));

    let selectedColor = '';
    el.addEventListener('highlight-select', ((e: CustomEvent) => {
      selectedColor = e.detail.color;
    }) as EventListener);

    const popover = el.shadowRoot!.querySelector('.popover')!;

    // Move to second dot, then press Enter
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(selectedColor).to.equal('green');
  });

  it('positions at specified x, y coordinates', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover .x=${150} .y=${200} open></highlight-popover>`
    );
    await el.updateComplete;

    const popover = el.shadowRoot!.querySelector<HTMLElement>('.popover')!;
    expect(popover.style.left).to.equal('150px');
    expect(popover.style.top).to.equal('200px');
  });

  it('has role="toolbar" on the popover container', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    const popover = el.shadowRoot!.querySelector('.popover');
    expect(popover!.getAttribute('role')).to.equal('toolbar');
    expect(popover!.getAttribute('aria-label')).to.equal('Highlight colors');
  });

  it('closes after selecting a color', async () => {
    const el = await fixture<HighlightPopover>(
      html`<highlight-popover open></highlight-popover>`
    );
    await el.updateComplete;

    const dots = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.color-dot');
    dots[0].click();
    await el.updateComplete;

    expect(el.open).to.be.false;
  });
});
