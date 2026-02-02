import { expect, fixture, html } from '@open-wc/testing';
import { PhaseNode } from '../../../src/components/core/phase-graph/phase-node.ts';
import type { PhaseGraphNode, NodeVisualState } from '../../../src/types/phases.ts';

function makeNode(overrides: Partial<PhaseGraphNode> = {}): PhaseGraphNode {
  return {
    workflow_id: 'create-product-brief',
    label: 'Product Brief',
    phase_num: 1,
    is_required: true,
    is_optional: false,
    is_conditional: false,
    agent: 'analyst',
    purpose: 'Product brief creation',
    status: 'required',
    is_current: false,
    dependencies_met: true,
    unmet_dependencies: [],
    ...overrides,
  };
}

describe('PhaseNode', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('phase-node')).to.equal(PhaseNode);
  });

  it('creates an element with shadow root', async () => {
    const el = await fixture<PhaseNode>(
      html`<phase-node .node=${makeNode()} .visualState=${'required'}></phase-node>`,
    );
    expect(el).to.exist;
    expect(el.shadowRoot).to.exist;
  });

  describe('visual states', () => {
    const states: NodeVisualState[] = [
      'current', 'complete', 'skipped', 'locked', 'conditional',
      'required', 'recommended', 'optional', 'not-started',
    ];

    for (const state of states) {
      it(`renders correct CSS class for ${state} state`, async () => {
        const el = await fixture<PhaseNode>(
          html`<phase-node .node=${makeNode()} .visualState=${state}></phase-node>`,
        );
        await el.updateComplete;
        const nodeDiv = el.shadowRoot!.querySelector('.node');
        expect(nodeDiv).to.exist;
        expect(nodeDiv!.classList.contains(`node--${state}`)).to.be.true;
      });
    }
  });

  describe('locked state', () => {
    it('renders aria-disabled="true" when locked', async () => {
      const node = makeNode({
        dependencies_met: false,
        unmet_dependencies: ['research'],
      });
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'locked'}></phase-node>`,
      );
      await el.updateComplete;
      const nodeDiv = el.shadowRoot!.querySelector('.node');
      expect(nodeDiv!.getAttribute('aria-disabled')).to.equal('true');
    });

    it('does not render aria-disabled when not locked', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'required'}></phase-node>`,
      );
      await el.updateComplete;
      const nodeDiv = el.shadowRoot!.querySelector('.node');
      expect(nodeDiv!.hasAttribute('aria-disabled')).to.be.false;
    });

    it('renders lock icon when locked', async () => {
      const node = makeNode({
        dependencies_met: false,
        unmet_dependencies: ['research'],
      });
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'locked'}></phase-node>`,
      );
      await el.updateComplete;
      // Lock icon has a rect element (unique to lock icon)
      const svgRect = el.shadowRoot!.querySelector('.node-icon svg rect');
      expect(svgRect).to.exist;
    });
  });

  describe('tooltip content', () => {
    it('shows workflow name and status for normal node', async () => {
      const node = makeNode({ agent: 'analyst', purpose: 'Product brief creation' });
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'required'}></phase-node>`,
      );
      await el.updateComplete;
      const tooltip = el.shadowRoot!.querySelector('sl-tooltip');
      expect(tooltip).to.exist;
      const content = tooltip!.getAttribute('content')!;
      expect(content).to.include('Product Brief');
      expect(content).to.include('Status: required');
      expect(content).to.include('Agent: analyst');
    });

    it('shows "Blocked by" info for locked node', async () => {
      const node = makeNode({
        dependencies_met: false,
        unmet_dependencies: ['create-architecture'],
      });
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'locked'}></phase-node>`,
      );
      await el.updateComplete;
      const tooltip = el.shadowRoot!.querySelector('sl-tooltip');
      const content = tooltip!.getAttribute('content')!;
      expect(content).to.include('Blocked by: Architecture');
    });

    it('shows purpose when available', async () => {
      const node = makeNode({ purpose: 'Research and discovery' });
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'required'}></phase-node>`,
      );
      await el.updateComplete;
      const tooltip = el.shadowRoot!.querySelector('sl-tooltip');
      const content = tooltip!.getAttribute('content')!;
      expect(content).to.include('Purpose: Research and discovery');
    });
  });

  describe('compact mode', () => {
    it('truncates label at 10 chars in compact mode', async () => {
      const node = makeNode({ label: 'Product Brief' }); // 13 chars
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'required'} compact></phase-node>`,
      );
      await el.updateComplete;
      const labelEl = el.shadowRoot!.querySelector('.node-label');
      expect(labelEl!.textContent!.length).to.be.at.most(10);
    });

    it('does not truncate short labels in compact mode', async () => {
      const node = makeNode({ label: 'Research' }); // 8 chars
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${node} .visualState=${'required'} compact></phase-node>`,
      );
      await el.updateComplete;
      const labelEl = el.shadowRoot!.querySelector('.node-label');
      expect(labelEl!.textContent!.trim()).to.equal('Research');
    });
  });

  describe('focus management', () => {
    it('sets tabindex="0" when focused=true', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'required'} .focused=${true}></phase-node>`,
      );
      await el.updateComplete;
      expect(el.tabIndex).to.equal(0);
    });

    it('sets tabindex="-1" when focused=false', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'required'} .focused=${false}></phase-node>`,
      );
      await el.updateComplete;
      expect(el.tabIndex).to.equal(-1);
    });
  });

  describe('icon rendering', () => {
    it('renders circle-dot icon for current state', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'current'}></phase-node>`,
      );
      await el.updateComplete;
      // circle-dot has two circle elements
      const circles = el.shadowRoot!.querySelectorAll('.node-icon svg circle');
      expect(circles.length).to.equal(2);
    });

    it('renders circle-check icon for complete state', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'complete'}></phase-node>`,
      );
      await el.updateComplete;
      // circle-check has one circle and one path
      const circle = el.shadowRoot!.querySelector('.node-icon svg circle');
      const path = el.shadowRoot!.querySelector('.node-icon svg path');
      expect(circle).to.exist;
      expect(path).to.exist;
    });

    it('renders lock icon for locked state', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode({ dependencies_met: false, unmet_dependencies: ['x'] })} .visualState=${'locked'}></phase-node>`,
      );
      await el.updateComplete;
      const rect = el.shadowRoot!.querySelector('.node-icon svg rect');
      expect(rect).to.exist;
    });

    it('renders circle icon for not-started state', async () => {
      const el = await fixture<PhaseNode>(
        html`<phase-node .node=${makeNode()} .visualState=${'not-started'}></phase-node>`,
      );
      await el.updateComplete;
      const circles = el.shadowRoot!.querySelectorAll('.node-icon svg circle');
      expect(circles.length).to.equal(1);
    });
  });
});
