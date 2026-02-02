import { apiFetch, API_BASE } from './api.service.js';
import type { WorkflowStatus } from '../types/workflow.js';
import { workflowLoadingState, updateWorkflowState } from '../state/workflow.state.js';

export async function loadWorkflowStatus(): Promise<void> {
  workflowLoadingState.set({ status: 'loading' });
  try {
    const status = await apiFetch<WorkflowStatus>(`${API_BASE}/bmad/status`);
    updateWorkflowState(status);
  } catch (err) {
    workflowLoadingState.set({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load workflow status',
    });
  }
}
