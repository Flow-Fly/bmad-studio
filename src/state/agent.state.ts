import { Signal } from 'signal-polyfill';
import type { Agent } from '../types/agent.js';

// Mutable state signals
export const agentsState = new Signal.State<Agent[]>([]);
export const activeAgentId = new Signal.State<string | null>(null);
export const agentConversations = new Signal.State<Map<string, string>>(new Map());

// Derived computed signal
export const activeAgent$ = new Signal.Computed<Agent | null>(() => {
  const agents = agentsState.get();
  const id = activeAgentId.get();
  if (!id) return null;
  return agents.find(a => a.id === id) ?? null;
});

// Helper functions
export function setActiveAgent(id: string): void {
  activeAgentId.set(id);
}

export function getAgentConversationId(agentId: string): string | undefined {
  return agentConversations.get().get(agentId);
}

export function setAgentConversation(agentId: string, conversationId: string): void {
  const map = new Map(agentConversations.get());
  map.set(agentId, conversationId);
  agentConversations.set(map);
}

export function clearAgentState(): void {
  agentsState.set([]);
  activeAgentId.set(null);
  agentConversations.set(new Map());
}
