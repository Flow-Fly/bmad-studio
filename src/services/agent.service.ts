import { apiFetch, API_BASE } from './api.service.js';
import type { AgentsResponse } from '../types/agent.js';
import type { Agent } from '../types/agent.js';
import { agentsState } from '../state/agent.state.js';

/** Validate that an agent object has the minimum required fields */
function isValidAgent(agent: unknown): agent is Agent {
  if (!agent || typeof agent !== 'object') return false;
  const a = agent as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.name === 'string' && typeof a.title === 'string';
}

export async function loadAgents(): Promise<void> {
  try {
    const response = await apiFetch<AgentsResponse>(`${API_BASE}/bmad/agents`);
    const agents = Array.isArray(response.agents)
      ? response.agents.filter(isValidAgent)
      : [];
    agentsState.set(agents);
  } catch (err) {
    console.warn('Failed to load agents:', err instanceof Error ? err.message : err);
    agentsState.set([]);
  }
}
