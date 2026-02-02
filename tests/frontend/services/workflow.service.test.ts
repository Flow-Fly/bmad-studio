import { expect } from '@open-wc/testing';
import { loadWorkflowStatus } from '../../../src/services/workflow.service.ts';
import {
  workflowState,
  workflowLoadingState,
  clearWorkflowState,
} from '../../../src/state/workflow.state.ts';
import type { WorkflowStatus } from '../../../src/types/workflow.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;

const mockStatusResponse: WorkflowStatus = {
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
  },
  story_statuses: {},
};

const defaultStatusResponse: WorkflowStatus = {
  current_phase: 1,
  current_phase_name: 'Analysis',
  next_workflow_id: 'create-product-brief',
  next_workflow_agent: 'analyst',
  phase_completion: [],
  workflow_statuses: {},
};

beforeEach(() => {
  clearWorkflowState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearWorkflowState();
});

describe('WorkflowService', () => {
  describe('loadWorkflowStatus', () => {
    it('sets loading state then updates workflow state on success', async () => {
      setupFetch(200, mockStatusResponse);

      await loadWorkflowStatus();

      const state = workflowState.get();
      expect(state).to.not.be.null;
      expect(state!.current_phase).to.equal(2);
      expect(state!.current_phase_name).to.equal('Planning');
      expect(state!.next_workflow_id).to.equal('create-architecture');

      const loadState = workflowLoadingState.get();
      expect(loadState.status).to.equal('success');
    });

    it('handles no-status-files case with default response', async () => {
      setupFetch(200, defaultStatusResponse);

      await loadWorkflowStatus();

      const state = workflowState.get();
      expect(state).to.not.be.null;
      expect(state!.current_phase).to.equal(1);
      expect(state!.phase_completion).to.have.length(0);
      expect(Object.keys(state!.workflow_statuses)).to.have.length(0);
    });

    it('sets error state on API failure', async () => {
      setupFetch(500, {
        error: { code: 'internal_error', message: 'Internal server error' },
      });

      await loadWorkflowStatus();

      expect(workflowState.get()).to.be.null;
      const loadState = workflowLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Internal server error');
    });

    it('sets error state on network failure', async () => {
      (globalThis as any).fetch = async () => {
        throw new Error('Failed to fetch');
      };

      await loadWorkflowStatus();

      expect(workflowState.get()).to.be.null;
      const loadState = workflowLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Failed to fetch');
    });

    it('does not crash when error has no message', async () => {
      (globalThis as any).fetch = async () => {
        throw 'string error';
      };

      await loadWorkflowStatus();

      const loadState = workflowLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.equal('Failed to load workflow status');
    });
  });
});
