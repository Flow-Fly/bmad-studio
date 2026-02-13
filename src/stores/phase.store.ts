import { create } from 'zustand';
import type { PhasesResponse } from '../types/phases';
import type { WorkflowStatus } from '../types/workflow';
import { fetchPhases, fetchWorkflowStatus } from '../services/phase.service';

interface PhaseState {
  phases: PhasesResponse | null;
  workflowStatus: WorkflowStatus | null;
  loading: boolean;
  error: string | null;

  fetchPhaseData: () => Promise<void>;
  clearPhaseState: () => void;
}

export const usePhaseStore = create<PhaseState>((set) => ({
  phases: null,
  workflowStatus: null,
  loading: false,
  error: null,

  fetchPhaseData: async () => {
    set({ loading: true, error: null });
    try {
      const [phases, status] = await Promise.all([
        fetchPhases(),
        fetchWorkflowStatus(),
      ]);
      set({ phases, workflowStatus: status, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load phase data',
        loading: false,
      });
    }
  },

  clearPhaseState: () =>
    set({ phases: null, workflowStatus: null, loading: false, error: null }),
}));
