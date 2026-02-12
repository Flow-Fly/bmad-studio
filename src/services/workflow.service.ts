import { apiFetch, API_BASE } from './api.service';
import type { WorkflowStatus } from '../types/workflow';
import { useWorkflowStore } from '../stores/workflow.store';

export async function loadWorkflowStatus(): Promise<void> {
  useWorkflowStore.getState().setLoadingState({ status: 'loading' });
  try {
    const status = await apiFetch<WorkflowStatus>(`${API_BASE}/bmad/status`);
    useWorkflowStore.getState().updateWorkflowStatus(status);
  } catch (err) {
    useWorkflowStore.getState().setLoadingState({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load workflow status',
    });
  }
}
