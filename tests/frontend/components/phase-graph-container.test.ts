import { expect, fixture, html } from '@open-wc/testing';
import { PhaseGraphContainer } from '../../../src/components/core/phase-graph/phase-graph-container.ts';
import '../../../src/components/core/phase-graph/phase-node.ts';
import {
  phasesState,
  phasesLoadingState,
  updatePhasesState,
  clearPhasesState,
} from '../../../src/state/phases.state.ts';
import {
  workflowState,
  clearWorkflowState,
} from '../../../src/state/workflow.state.ts';
import type { PhasesResponse } from '../../../src/types/phases.ts';
import type { WorkflowStatus } from '../../../src/types/workflow.ts';

// Mock ResizeObserver to avoid loop errors in tests — stores callback for manual triggering
let resizeCallback: ResizeObserverCallback | null = null;
class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
  observe() { /* no-op in tests */ }
  unobserve() {}
  disconnect() { resizeCallback = null; }
}
(window as any).ResizeObserver = MockResizeObserver;

const mockPhasesResponse: PhasesResponse = {
  method_name: 'greenfield',
  track: 'bmm',
  field_type: 'software',
  description: 'Test method',
  phases: [
    {
      phase: 1,
      name: 'Analysis',
      required: true,
      optional: false,
      note: null,
      workflows: [
        {
          id: 'research',
          exec: null,
          required: false,
          optional: true,
          conditional: null,
          condition_type: null,
          agent: 'analyst',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Research',
        },
        {
          id: 'create-product-brief',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'analyst',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Product brief',
        },
      ],
    },
    {
      phase: 2,
      name: 'Planning',
      required: true,
      optional: false,
      note: null,
      workflows: [
        {
          id: 'prd',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'pm',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'PRD',
        },
      ],
    },
    {
      phase: 3,
      name: 'Solutioning',
      required: true,
      optional: false,
      note: null,
      workflows: [
        {
          id: 'create-architecture',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'architect',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Architecture',
        },
      ],
    },
    {
      phase: 4,
      name: 'Implementation',
      required: true,
      optional: false,
      note: null,
      workflows: [
        {
          id: 'sprint-planning',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'sm',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Sprint planning',
        },
        {
          id: 'create-story',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'sm',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Story creation',
        },
        {
          id: 'dev-story',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'dev',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Development',
        },
        {
          id: 'code-review',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'dev',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Code review',
        },
      ],
    },
  ],
};

const mockWorkflowStatus: WorkflowStatus = {
  current_phase: 2,
  current_phase_name: 'Planning',
  next_workflow_id: 'prd',
  next_workflow_agent: 'pm',
  phase_completion: [
    {
      phase_num: 1,
      name: 'Analysis',
      completed_count: 1,
      total_required: 1,
      percent_complete: 100,
    },
  ],
  workflow_statuses: {
    research: {
      workflow_id: 'research',
      status: 'skipped',
      artifact_path: null,
      is_complete: false,
      is_required: false,
      is_optional: true,
    },
    'create-product-brief': {
      workflow_id: 'create-product-brief',
      status: 'complete',
      artifact_path: 'brief.md',
      is_complete: true,
      is_required: true,
      is_optional: false,
    },
    prd: {
      workflow_id: 'prd',
      status: 'required',
      artifact_path: null,
      is_complete: false,
      is_required: true,
      is_optional: false,
    },
  },
};

beforeEach(() => {
  clearPhasesState();
  clearWorkflowState();
});

afterEach(() => {
  clearPhasesState();
  clearWorkflowState();
});

describe('PhaseGraphContainer', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('phase-graph-container')).to.equal(PhaseGraphContainer);
  });

  it('creates an element with shadow root', async () => {
    const el = await fixture<PhaseGraphContainer>(
      html`<phase-graph-container></phase-graph-container>`,
    );
    expect(el).to.exist;
    expect(el.shadowRoot).to.exist;
  });

  describe('skeleton/loading state', () => {
    it('renders skeleton when phasesState is null', async () => {
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;
      const skeleton = el.shadowRoot!.querySelector('.skeleton-layout');
      expect(skeleton).to.exist;
      const columns = skeleton!.querySelectorAll('.skeleton-column');
      expect(columns.length).to.equal(4);
    });

    it('renders skeleton when workflowState is null', async () => {
      updatePhasesState(mockPhasesResponse);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;
      const skeleton = el.shadowRoot!.querySelector('.skeleton-layout');
      expect(skeleton).to.exist;
    });
  });

  describe('error state', () => {
    it('renders error message when phases fail to load', async () => {
      phasesLoadingState.set({ status: 'error', error: 'Network failed' });
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;
      const errorDiv = el.shadowRoot!.querySelector('.error-state');
      expect(errorDiv).to.exist;
      expect(errorDiv!.textContent).to.include('Network failed');
    });
  });

  describe('loaded state', () => {
    it('renders all four phase labels', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const labels = el.shadowRoot!.querySelectorAll('.phase-label');
      expect(labels.length).to.equal(4);
      const labelTexts = Array.from(labels).map(l => l.textContent!.trim());
      expect(labelTexts).to.include('Analysis');
      expect(labelTexts).to.include('Planning');
      expect(labelTexts).to.include('Solutioning');
      expect(labelTexts).to.include('Implementation');
    });

    it('renders phase-node elements within phase columns', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const phaseNodes = el.shadowRoot!.querySelectorAll('phase-node');
      expect(phaseNodes.length).to.be.greaterThan(0);

      // Non-dev-loop nodes: research, create-product-brief, prd, create-architecture, sprint-planning = 5
      // (create-story, dev-story, code-review are dev loop, not rendered as phase-node)
      expect(phaseNodes.length).to.equal(5);
    });

    it('renders SVG edges overlay', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const svgOverlay = el.shadowRoot!.querySelector('.edges-overlay');
      expect(svgOverlay).to.exist;
      expect(svgOverlay!.getAttribute('aria-hidden')).to.equal('true');
    });

    it('renders dev loop group for implementation phase inline (not as phase-node)', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const devLoop = el.shadowRoot!.querySelector('.dev-loop');
      expect(devLoop).to.exist;

      // Dev loop nodes should NOT be rendered as phase-node elements
      const devNodeIds = ['create-story', 'dev-story', 'code-review'];
      for (const id of devNodeIds) {
        const phaseNodeForDev = el.shadowRoot!.querySelector(`phase-node[data-workflow-id="${id}"]`);
        expect(phaseNodeForDev).to.be.null;
      }
    });

    it('highlights current phase column', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const currentPhase = el.shadowRoot!.querySelector('.current-phase');
      expect(currentPhase).to.exist;
    });

    it('passes data-workflow-id attribute to phase-node elements', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const phaseNodes = el.shadowRoot!.querySelectorAll('phase-node');
      for (const node of Array.from(phaseNodes)) {
        expect(node.getAttribute('data-workflow-id')).to.be.a('string');
        expect(node.getAttribute('data-workflow-id')!.length).to.be.greaterThan(0);
      }
    });
  });

  describe('compact mode', () => {
    it('uses abbreviated labels when width drops below 1280px', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      // Trigger compact mode via ResizeObserver callback
      if (resizeCallback) {
        resizeCallback(
          [{ contentRect: { width: 1000 } } as unknown as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      }
      await el.updateComplete;

      const graph = el.shadowRoot!.querySelector('.graph');
      expect(graph!.classList.contains('compact')).to.be.true;

      const labels = el.shadowRoot!.querySelectorAll('.phase-label');
      const labelTexts = Array.from(labels).map(l => l.textContent!.trim());
      expect(labelTexts).to.include('Anl');
      expect(labelTexts).to.include('Pln');
      expect(labelTexts).to.include('Sol');
      expect(labelTexts).to.include('Impl');
    });
  });

  describe('signal reactivity', () => {
    it('updates when workflowState changes', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      // Initially prd is current — verify phase-node exists
      const prdNode = el.shadowRoot!.querySelector('phase-node[data-workflow-id="prd"]');
      expect(prdNode).to.exist;

      // Update workflow state: prd is now complete, next is create-architecture
      workflowState.set({
        ...mockWorkflowStatus,
        current_phase: 3,
        current_phase_name: 'Solutioning',
        next_workflow_id: 'create-architecture',
        next_workflow_agent: 'architect',
        workflow_statuses: {
          ...mockWorkflowStatus.workflow_statuses,
          prd: {
            workflow_id: 'prd',
            status: 'complete',
            artifact_path: 'prd.md',
            is_complete: true,
            is_required: true,
            is_optional: false,
          },
        },
      });
      await el.updateComplete;

      // Verify phase-node elements still render after state change
      const phaseNodes = el.shadowRoot!.querySelectorAll('phase-node');
      expect(phaseNodes.length).to.be.greaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('has role="group" and aria-label on graph container', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const graph = el.shadowRoot!.querySelector('.graph');
      expect(graph).to.exist;
      expect(graph!.getAttribute('role')).to.equal('group');
      expect(graph!.getAttribute('aria-label')).to.equal('BMAD phase graph');
    });

    it('has role and aria-label on dev loop group', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const devLoop = el.shadowRoot!.querySelector('.dev-loop');
      expect(devLoop).to.exist;
      expect(devLoop!.getAttribute('role')).to.equal('group');
      expect(devLoop!.getAttribute('aria-label')).to.include('Development loop');
    });

    it('has aria-live region for announcements', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const liveRegion = el.shadowRoot!.querySelector('[aria-live="polite"]');
      expect(liveRegion).to.exist;
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus between phase-node elements with arrow keys', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const graph = el.shadowRoot!.querySelector('.graph')!;
      const phaseNodes = el.shadowRoot!.querySelectorAll('phase-node');
      expect(phaseNodes.length).to.be.greaterThan(0);

      // Focus first phase-node
      (phaseNodes[0] as HTMLElement).focus();
      await el.updateComplete;

      // Press ArrowDown — should move focus within same phase
      graph.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      await el.updateComplete;

      // Verify a phase-node has tabindex 0 (focused)
      const focusedNode = el.shadowRoot!.querySelector('phase-node[tabindex="0"]');
      expect(focusedNode).to.exist;
    });

    it('has correct initial tabindex management on phase-node elements', async () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);
      const el = await fixture<PhaseGraphContainer>(
        html`<phase-graph-container></phase-graph-container>`,
      );
      await el.updateComplete;

      const phaseNodes = el.shadowRoot!.querySelectorAll('phase-node');
      // All phase-node elements should have tabindex="-1" initially (no focused node)
      for (const node of Array.from(phaseNodes)) {
        expect(node.getAttribute('tabindex')).to.equal('-1');
      }
    });
  });
});
