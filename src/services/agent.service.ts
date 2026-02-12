import { apiFetch, API_BASE } from './api.service';
import type { AgentsResponse, Agent } from '../types/agent';
import { useAgentStore } from '../stores/agent.store';

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
    useAgentStore.getState().setAgents(agents);
  } catch (err) {
    console.warn('Failed to load agents:', err instanceof Error ? err.message : err);
    useAgentStore.getState().setAgents([]);
  }
}
