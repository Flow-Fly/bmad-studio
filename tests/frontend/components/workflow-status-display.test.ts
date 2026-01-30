import { expect, fixture, html } from '@open-wc/testing';
import { WorkflowStatusDisplay } from '../../../src/components/core/workflow/workflow-status-display.ts';
import {
  workflowLoadingState,
  clearWorkflowState,
  updateWorkflowState,
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

afterEach(() => {
  clearWorkflowState();
});

describe('WorkflowStatusDisplay', () => {
  it('renders with default values', async () => {
    const el = await fixture<WorkflowStatusDisplay>(
      html`<workflow-status-display></workflow-status-display>`
    );
    expect(el).to.exist;
    expect(el).to.be.instanceOf(WorkflowStatusDisplay);
  });

  describe('empty state', () => {
    it('shows empty state when no workflow status', async () => {
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const emptyState = el.shadowRoot!.querySelector('.empty-state');
      expect(emptyState).to.exist;
    });

    it('displays explanation text in empty state', async () => {
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const emptyState = el.shadowRoot!.querySelector('.empty-state');
      expect(emptyState!.textContent).to.include('No workflow status available');
    });
  });

  describe('loading state', () => {
    it('shows skeleton layout when loading', async () => {
      workflowLoadingState.set({ status: 'loading' });
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const skeleton = el.shadowRoot!.querySelector('.skeleton-layout');
      expect(skeleton).to.exist;
    });

    it('does not show empty state when loading', async () => {
      workflowLoadingState.set({ status: 'loading' });
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const emptyState = el.shadowRoot!.querySelector('.empty-state');
      expect(emptyState).to.be.null;
    });
  });

  describe('error state', () => {
    it('shows error message when load fails', async () => {
      workflowLoadingState.set({ status: 'error', error: 'Connection failed' });
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const errorState = el.shadowRoot!.querySelector('.error-state');
      expect(errorState).to.exist;
      expect(errorState!.textContent).to.include('Connection failed');
    });
  });

  describe('loaded state', () => {
    it('renders phase completion rows', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const phaseRows = el.shadowRoot!.querySelectorAll('.phase-row');
      expect(phaseRows.length).to.equal(2);
    });

    it('displays current phase info', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const summary = el.shadowRoot!.querySelector('.status-summary');
      expect(summary).to.exist;
      expect(summary!.textContent).to.include('Planning');
    });

    it('shows phase names in completion rows', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const phaseNames = el.shadowRoot!.querySelectorAll('.phase-name');
      expect(phaseNames[0].textContent).to.include('Analysis');
      expect(phaseNames[1].textContent).to.include('Planning');
    });

    it('renders progress bars for each phase', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const progressBars = el.shadowRoot!.querySelectorAll('sl-progress-bar');
      expect(progressBars.length).to.equal(2);
    });

    it('shows next recommended workflow', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const summary = el.shadowRoot!.querySelector('.status-summary');
      expect(summary!.textContent).to.include('create-architecture');
    });

    it('renders workflow items with status badges', async () => {
      updateWorkflowState(mockWorkflowStatus);
      const el = await fixture<WorkflowStatusDisplay>(
        html`<workflow-status-display></workflow-status-display>`
      );
      await el.updateComplete;
      const badges = el.shadowRoot!.querySelectorAll('sl-badge');
      expect(badges.length).to.be.greaterThan(0);
    });
  });
});
