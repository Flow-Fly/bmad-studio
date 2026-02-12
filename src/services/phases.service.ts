import { apiFetch, API_BASE } from './api.service';
import type { PhasesResponse } from '../types/phases';
import { usePhasesStore } from '../stores/phases.store';

export async function loadPhases(): Promise<void> {
  usePhasesStore.getState().setLoadingState({ status: 'loading' });
  try {
    const phases = await apiFetch<PhasesResponse>(`${API_BASE}/bmad/phases`);
    usePhasesStore.getState().updatePhases(phases);
  } catch (err) {
    usePhasesStore.getState().setLoadingState({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load phase definitions',
    });
  }
}
