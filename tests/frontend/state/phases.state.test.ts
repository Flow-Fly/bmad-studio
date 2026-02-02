import { expect } from '@open-wc/testing';
import {
  phasesState,
  phasesLoadingState,
  phaseGraphNodes$,
  phaseGraphEdges$,
  getNodeVisualState,
  updatePhasesState,
  clearPhasesState,
  formatWorkflowLabel,
} from '../../../src/state/phases.state.ts';
import {
  workflowState,
  clearWorkflowState,
} from '../../../src/state/workflow.state.ts';
import type { PhasesResponse } from '../../../src/types/phases.ts';
import type { WorkflowStatus } from '../../../src/types/workflow.ts';

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
          purpose: 'Research and discovery',
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
          purpose: 'Product brief creation',
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
          purpose: 'PRD creation',
        },
        {
          id: 'create-ux-design',
          exec: null,
          required: false,
          optional: true,
          conditional: 'if_has_ui',
          condition_type: null,
          agent: 'ux-designer',
          command: null,
          output: null,
          note: null,
          included_by: 'prd',
          purpose: 'UX design',
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
      artifact_path: '_bmad-output/planning-artifacts/product-brief.md',
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

describe('PhasesState', () => {
  describe('signal initialization', () => {
    it('initializes phasesState to null', () => {
      expect(phasesState.get()).to.be.null;
    });

    it('initializes phasesLoadingState to idle', () => {
      expect(phasesLoadingState.get().status).to.equal('idle');
    });
  });

  describe('updatePhasesState', () => {
    it('sets phases data and loading to success', () => {
      updatePhasesState(mockPhasesResponse);
      expect(phasesState.get()).to.deep.equal(mockPhasesResponse);
      expect(phasesLoadingState.get().status).to.equal('success');
    });
  });

  describe('clearPhasesState', () => {
    it('resets phases to null and loading to idle', () => {
      updatePhasesState(mockPhasesResponse);
      clearPhasesState();
      expect(phasesState.get()).to.be.null;
      expect(phasesLoadingState.get().status).to.equal('idle');
    });
  });

  describe('formatWorkflowLabel', () => {
    it('strips create- prefix', () => {
      expect(formatWorkflowLabel('create-product-brief')).to.equal('Product Brief');
    });

    it('strips dev- prefix', () => {
      expect(formatWorkflowLabel('dev-story')).to.equal('Story');
    });

    it('uppercases known tokens', () => {
      expect(formatWorkflowLabel('prd')).to.equal('PRD');
      expect(formatWorkflowLabel('create-ux-design')).to.equal('UX Design');
    });

    it('handles special case for check-implementation-readiness', () => {
      expect(formatWorkflowLabel('check-implementation-readiness')).to.equal('Readiness Check');
    });

    it('capitalizes simple words', () => {
      expect(formatWorkflowLabel('research')).to.equal('Research');
      expect(formatWorkflowLabel('code-review')).to.equal('Code Review');
    });
  });

  describe('phaseGraphNodes$', () => {
    it('returns empty array when phasesState is null', () => {
      workflowState.set(mockWorkflowStatus);
      expect(phaseGraphNodes$.get()).to.deep.equal([]);
    });

    it('returns empty array when workflowState is null', () => {
      updatePhasesState(mockPhasesResponse);
      expect(phaseGraphNodes$.get()).to.deep.equal([]);
    });

    it('returns empty array when both sources are null', () => {
      expect(phaseGraphNodes$.get()).to.deep.equal([]);
    });

    it('produces correct nodes merging phases with workflow status', () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);

      const nodes = phaseGraphNodes$.get();
      expect(nodes).to.have.length(4);

      // research — skipped
      expect(nodes[0].workflow_id).to.equal('research');
      expect(nodes[0].phase_num).to.equal(1);
      expect(nodes[0].status).to.equal('skipped');
      expect(nodes[0].is_current).to.be.false;
      expect(nodes[0].is_optional).to.be.true;

      // create-product-brief — complete
      expect(nodes[1].workflow_id).to.equal('create-product-brief');
      expect(nodes[1].status).to.equal('complete');
      expect(nodes[1].is_current).to.be.false;
      expect(nodes[1].is_required).to.be.true;

      // prd — required, current
      expect(nodes[2].workflow_id).to.equal('prd');
      expect(nodes[2].status).to.equal('required');
      expect(nodes[2].is_current).to.be.true;

      // create-ux-design — not in workflow_statuses, defaults to not_started
      expect(nodes[3].workflow_id).to.equal('create-ux-design');
      expect(nodes[3].status).to.equal('not_started');
      expect(nodes[3].is_conditional).to.be.true;
      expect(nodes[3].included_by).to.equal('prd');
    });

    it('defaults unknown workflows to not_started status', () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set({
        ...mockWorkflowStatus,
        workflow_statuses: {},
      });

      const nodes = phaseGraphNodes$.get();
      for (const node of nodes) {
        expect(node.status).to.equal('not_started');
      }
    });

    it('sets is_current by matching next_workflow_id', () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set({
        ...mockWorkflowStatus,
        next_workflow_id: 'create-product-brief',
      });

      const nodes = phaseGraphNodes$.get();
      const currentNodes = nodes.filter(n => n.is_current);
      expect(currentNodes).to.have.length(1);
      expect(currentNodes[0].workflow_id).to.equal('create-product-brief');
    });

    it('sets human-readable labels via formatWorkflowLabel', () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);

      const nodes = phaseGraphNodes$.get();
      expect(nodes[0].label).to.equal('Research');
      expect(nodes[1].label).to.equal('Product Brief');
      expect(nodes[2].label).to.equal('PRD');
      expect(nodes[3].label).to.equal('UX Design');
    });

    it('populates purpose field from workflow response', () => {
      updatePhasesState(mockPhasesResponse);
      workflowState.set(mockWorkflowStatus);

      const nodes = phaseGraphNodes$.get();
      expect(nodes[0].purpose).to.equal('Research and discovery');
      expect(nodes[1].purpose).to.equal('Product brief creation');
      expect(nodes[2].purpose).to.equal('PRD creation');
    });

    describe('dependencies_met computation', () => {
      it('first workflow in first phase has dependencies_met: true', () => {
        updatePhasesState(mockPhasesResponse);
        workflowState.set({
          ...mockWorkflowStatus,
          workflow_statuses: {},
        });

        const nodes = phaseGraphNodes$.get();
        // research is optional, not required — no required deps to check
        expect(nodes[0].dependencies_met).to.be.true;
        // create-product-brief is first required in phase 1 — no prior phase
        expect(nodes[1].dependencies_met).to.be.true;
      });

      it('cross-phase dep: prd depends on create-product-brief being complete', () => {
        updatePhasesState(mockPhasesResponse);

        // create-product-brief NOT complete
        workflowState.set({
          ...mockWorkflowStatus,
          workflow_statuses: {
            'create-product-brief': {
              workflow_id: 'create-product-brief',
              status: 'required',
              artifact_path: null,
              is_complete: false,
              is_required: true,
              is_optional: false,
            },
          },
        });

        const nodes = phaseGraphNodes$.get();
        const prdNode = nodes.find(n => n.workflow_id === 'prd')!;
        expect(prdNode.dependencies_met).to.be.false;
        expect(prdNode.unmet_dependencies).to.include('create-product-brief');
      });

      it('cross-phase dep: prd dependencies_met when predecessor is complete', () => {
        updatePhasesState(mockPhasesResponse);
        workflowState.set(mockWorkflowStatus); // create-product-brief is complete

        const nodes = phaseGraphNodes$.get();
        const prdNode = nodes.find(n => n.workflow_id === 'prd')!;
        expect(prdNode.dependencies_met).to.be.true;
        expect(prdNode.unmet_dependencies).to.deep.equal([]);
      });

      it('cross-phase dep: prd dependencies_met when predecessor is skipped', () => {
        updatePhasesState(mockPhasesResponse);
        workflowState.set({
          ...mockWorkflowStatus,
          workflow_statuses: {
            ...mockWorkflowStatus.workflow_statuses,
            'create-product-brief': {
              workflow_id: 'create-product-brief',
              status: 'skipped',
              artifact_path: null,
              is_complete: false,
              is_required: true,
              is_optional: false,
            },
          },
        });

        const nodes = phaseGraphNodes$.get();
        const prdNode = nodes.find(n => n.workflow_id === 'prd')!;
        expect(prdNode.dependencies_met).to.be.true;
      });

      it('included_by dep: create-ux-design blocked when prd not complete', () => {
        updatePhasesState(mockPhasesResponse);
        workflowState.set({
          ...mockWorkflowStatus,
          workflow_statuses: {
            ...mockWorkflowStatus.workflow_statuses,
            prd: {
              workflow_id: 'prd',
              status: 'required',
              artifact_path: null,
              is_complete: false,
              is_required: true,
              is_optional: false,
            },
          },
        });

        const nodes = phaseGraphNodes$.get();
        const uxNode = nodes.find(n => n.workflow_id === 'create-ux-design')!;
        expect(uxNode.dependencies_met).to.be.false;
        expect(uxNode.unmet_dependencies).to.include('prd');
      });

      it('unmet_dependencies populates with IDs of incomplete prerequisites', () => {
        updatePhasesState(mockPhasesResponse);
        workflowState.set({
          ...mockWorkflowStatus,
          workflow_statuses: {
            'create-product-brief': {
              workflow_id: 'create-product-brief',
              status: 'not_started',
              artifact_path: null,
              is_complete: false,
              is_required: true,
              is_optional: false,
            },
          },
        });

        const nodes = phaseGraphNodes$.get();
        const prdNode = nodes.find(n => n.workflow_id === 'prd')!;
        expect(prdNode.unmet_dependencies).to.deep.equal(['create-product-brief']);
      });
    });
  });

  describe('phaseGraphEdges$', () => {
    it('returns empty array when phasesState is null', () => {
      expect(phaseGraphEdges$.get()).to.deep.equal([]);
    });

    it('computes within-phase sequential edges for required workflows', () => {
      updatePhasesState(mockPhasesResponse);
      const edges = phaseGraphEdges$.get();

      // Phase 1 has only one required workflow (create-product-brief),
      // research is optional, so no within-phase edge for phase 1
      const phase1Edges = edges.filter(
        e => e.from === 'research' && e.to === 'create-product-brief',
      );
      expect(phase1Edges).to.have.length(0);
    });

    it('computes cross-phase sequential edges', () => {
      updatePhasesState(mockPhasesResponse);
      const edges = phaseGraphEdges$.get();

      // Last required in phase 1 (create-product-brief) -> first required in phase 2 (prd)
      const crossPhaseEdge = edges.find(
        e => e.from === 'create-product-brief' && e.to === 'prd',
      );
      expect(crossPhaseEdge).to.exist;
      expect(crossPhaseEdge!.is_optional).to.be.false;
    });

    it('computes included_by edges', () => {
      updatePhasesState(mockPhasesResponse);
      const edges = phaseGraphEdges$.get();

      const includedByEdge = edges.find(
        e => e.from === 'prd' && e.to === 'create-ux-design',
      );
      expect(includedByEdge).to.exist;
      expect(includedByEdge!.is_optional).to.be.true;
    });

    it('marks optional/conditional edges correctly', () => {
      updatePhasesState(mockPhasesResponse);
      const edges = phaseGraphEdges$.get();

      const uxEdge = edges.find(e => e.to === 'create-ux-design');
      expect(uxEdge).to.exist;
      expect(uxEdge!.is_optional).to.be.true;
    });
  });

  describe('getNodeVisualState', () => {
    it('returns current when isCurrent is true regardless of status', () => {
      expect(getNodeVisualState('not_started', true)).to.equal('current');
      expect(getNodeVisualState('complete', true)).to.equal('current');
      expect(getNodeVisualState('required', true)).to.equal('current');
    });

    it('returns complete when status is complete', () => {
      expect(getNodeVisualState('complete', false)).to.equal('complete');
    });

    it('returns skipped when status is skipped', () => {
      expect(getNodeVisualState('skipped', false)).to.equal('skipped');
    });

    it('returns locked when dependenciesMet is false', () => {
      expect(getNodeVisualState('required', false, false)).to.equal('locked');
      expect(getNodeVisualState('not_started', false, false)).to.equal('locked');
    });

    it('returns conditional when status is conditional', () => {
      expect(getNodeVisualState('conditional', false)).to.equal('conditional');
    });

    it('returns required when status is required', () => {
      expect(getNodeVisualState('required', false)).to.equal('required');
    });

    it('returns recommended when status is recommended', () => {
      expect(getNodeVisualState('recommended', false)).to.equal('recommended');
    });

    it('returns optional when status is optional', () => {
      expect(getNodeVisualState('optional', false)).to.equal('optional');
    });

    it('returns not-started for not_started status', () => {
      expect(getNodeVisualState('not_started', false)).to.equal('not-started');
    });

    it('follows precedence: current > complete > skipped > locked > conditional > required > recommended > optional > not-started', () => {
      // current beats everything
      expect(getNodeVisualState('complete', true)).to.equal('current');
      // complete beats locked
      expect(getNodeVisualState('complete', false, false)).to.equal('complete');
      // skipped beats locked
      expect(getNodeVisualState('skipped', false, false)).to.equal('skipped');
      // locked beats required
      expect(getNodeVisualState('required', false, false)).to.equal('locked');
      // locked beats conditional
      expect(getNodeVisualState('conditional', false, false)).to.equal('locked');
    });

    it('defaults dependenciesMet to true (backward compatible)', () => {
      expect(getNodeVisualState('required', false)).to.equal('required');
    });
  });
});
