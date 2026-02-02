import { apiFetch, API_BASE } from './api.service.js';
import type { PhasesResponse } from '../types/phases.js';
import { phasesLoadingState, updatePhasesState } from '../state/phases.state.js';

export async function loadPhases(): Promise<void> {
  phasesLoadingState.set({ status: 'loading' });
  try {
    const phases = await apiFetch<PhasesResponse>(`${API_BASE}/bmad/phases`);
    updatePhasesState(phases);
  } catch (err) {
    phasesLoadingState.set({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load phase definitions',
    });
  }
}
