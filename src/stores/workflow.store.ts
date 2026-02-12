import { create } from 'zustand';
import type { LoadingState } from '../types/project';
import type { WorkflowStatus, PhaseCompletionStatus } from '../types/workflow';

interface WorkflowState {
  workflowStatus: WorkflowStatus | null;
  loadingState: LoadingState;

  // Derived
  currentPhase: () => { num: number; name: string } | null;
  phaseCompletions: () => PhaseCompletionStatus[];
  nextWorkflow: () => { id: string; agent: string } | null;

  // Actions
  updateWorkflowStatus: (status: WorkflowStatus) => void;
  setLoadingState: (state: LoadingState) => void;
  clearWorkflowState: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowStatus: null,
  loadingState: { status: 'idle' },

  currentPhase: () => {
    const ws = get().workflowStatus;
    if (!ws) return null;
    return { num: ws.current_phase, name: ws.current_phase_name };
  },

  phaseCompletions: () => {
    const ws = get().workflowStatus;
    if (!ws) return [];
    return ws.phase_completion;
  },

  nextWorkflow: () => {
    const ws = get().workflowStatus;
    if (!ws || !ws.next_workflow_id || !ws.next_workflow_agent) return null;
    return { id: ws.next_workflow_id, agent: ws.next_workflow_agent };
  },

  updateWorkflowStatus: (status) =>
    set({ workflowStatus: status, loadingState: { status: 'success' } }),

  setLoadingState: (loadingState) => set({ loadingState }),

  clearWorkflowState: () =>
    set({ workflowStatus: null, loadingState: { status: 'idle' } }),
}));
