import { apiFetch, API_BASE } from './api.service.js';
import type { AgentsResponse } from '../types/agent.js';
import { agentsState } from '../state/agent.state.js';

export async function loadAgents(): Promise<void> {
  try {
    const response = await apiFetch<AgentsResponse>(`${API_BASE}/bmad/agents`);
    agentsState.set(response.agents ?? []);
  } catch (err) {
    console.warn('Failed to load agents:', err instanceof Error ? err.message : err);
    agentsState.set([]);
  }
}
