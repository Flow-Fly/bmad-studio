import { Signal } from 'signal-polyfill';
import type { LoadingState } from '../types/project.js';
import type { WorkflowStatus, PhaseCompletionStatus } from '../types/workflow.js';

export const workflowState = new Signal.State<WorkflowStatus | null>(null);
export const workflowLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

export const currentPhase$ = new Signal.Computed(() => {
  const ws = workflowState.get();
  if (!ws) return null;
  return { num: ws.current_phase, name: ws.current_phase_name };
});

export const phaseCompletions$ = new Signal.Computed<PhaseCompletionStatus[]>(() => {
  const ws = workflowState.get();
  if (!ws) return [];
  return ws.phase_completion;
});

export const nextWorkflow$ = new Signal.Computed<{ id: string; agent: string } | null>(() => {
  const ws = workflowState.get();
  if (!ws || !ws.next_workflow_id || !ws.next_workflow_agent) return null;
  return { id: ws.next_workflow_id, agent: ws.next_workflow_agent };
});

export function updateWorkflowState(status: WorkflowStatus): void {
  workflowState.set(status);
  workflowLoadingState.set({ status: 'idle' });
}

export function clearWorkflowState(): void {
  workflowState.set(null);
  workflowLoadingState.set({ status: 'idle' });
}
