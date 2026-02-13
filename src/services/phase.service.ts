import { apiFetch, API_BASE } from './api.service';
import type { PhasesResponse } from '../types/phases';
import type { WorkflowStatus } from '../types/workflow';

export async function fetchPhases(): Promise<PhasesResponse> {
  return apiFetch<PhasesResponse>(`${API_BASE}/bmad/phases`);
}

export async function fetchWorkflowStatus(): Promise<WorkflowStatus> {
  return apiFetch<WorkflowStatus>(`${API_BASE}/bmad/status`);
}
