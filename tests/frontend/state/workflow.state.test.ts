import { expect } from '@open-wc/testing';
import {
  workflowState,
  workflowLoadingState,
  currentPhase$,
  phaseCompletions$,
  nextWorkflow$,
  updateWorkflowState,
  clearWorkflowState,
} from '../../../src/state/workflow.state.ts';
import type { WorkflowStatus } from '../../../src/types/workflow.ts';

const mockWorkflowStatus: WorkflowStatus = {
  current_phase: 2,
  current_phase_name: 'Planning',
  next_workflow_id: 'create-architecture',
  next_workflow_agent: 'architect',
  phase_completion: [
    {
      phase_num: 1,
      name: 'Analysis',
      completed_count: 2,
      total_required: 2,
      percent_complete: 100,
    },
    {
      phase_num: 2,
      name: 'Planning',
      completed_count: 1,
      total_required: 3,
      percent_complete: 33,
    },
  ],
  workflow_statuses: {
    'create-product-brief': {
      workflow_id: 'create-product-brief',
      status: 'complete',
      artifact_path: '_bmad-output/planning-artifacts/product-brief.md',
      is_complete: true,
      is_required: true,
      is_optional: false,
    },
    'create-architecture': {
      workflow_id: 'create-architecture',
      status: 'required',
      artifact_path: null,
      is_complete: false,
      is_required: true,
      is_optional: false,
    },
  },
  story_statuses: {
    '1-1-project-scaffolding': 'done',
  },
};

beforeEach(() => {
  clearWorkflowState();
});

describe('WorkflowState', () => {
  describe('initial state', () => {
    it('starts with null workflow state', () => {
      expect(workflowState.get()).to.be.null;
    });

    it('starts with idle loading state', () => {
      expect(workflowLoadingState.get().status).to.equal('idle');
    });
  });

  describe('derived signals', () => {
    it('currentPhase$ is null when no workflow state', () => {
      expect(currentPhase$.get()).to.be.null;
    });

    it('currentPhase$ returns phase info when state loaded', () => {
      updateWorkflowState(mockWorkflowStatus);
      const phase = currentPhase$.get();
      expect(phase).to.deep.equal({ num: 2, name: 'Planning' });
    });

    it('phaseCompletions$ is empty when no workflow state', () => {
      expect(phaseCompletions$.get()).to.deep.equal([]);
    });

    it('phaseCompletions$ returns phase array when state loaded', () => {
      updateWorkflowState(mockWorkflowStatus);
      const phases = phaseCompletions$.get();
      expect(phases).to.have.length(2);
      expect(phases[0].name).to.equal('Analysis');
      expect(phases[1].percent_complete).to.equal(33);
    });

    it('nextWorkflow$ is null when no workflow state', () => {
      expect(nextWorkflow$.get()).to.be.null;
    });

    it('nextWorkflow$ returns workflow info when state loaded', () => {
      updateWorkflowState(mockWorkflowStatus);
      const next = nextWorkflow$.get();
      expect(next).to.deep.equal({ id: 'create-architecture', agent: 'architect' });
    });

    it('nextWorkflow$ is null when no next workflow', () => {
      updateWorkflowState({
        ...mockWorkflowStatus,
        next_workflow_id: null,
        next_workflow_agent: null,
      });
      expect(nextWorkflow$.get()).to.be.null;
    });
  });

  describe('updateWorkflowState', () => {
    it('sets workflow state and sets loading to success', () => {
      workflowLoadingState.set({ status: 'loading' });
      updateWorkflowState(mockWorkflowStatus);

      expect(workflowState.get()).to.deep.equal(mockWorkflowStatus);
      expect(workflowLoadingState.get().status).to.equal('success');
    });
  });

  describe('clearWorkflowState', () => {
    it('resets to initial state', () => {
      updateWorkflowState(mockWorkflowStatus);
      clearWorkflowState();

      expect(workflowState.get()).to.be.null;
      expect(workflowLoadingState.get().status).to.equal('idle');
      expect(currentPhase$.get()).to.be.null;
    });
  });
});
