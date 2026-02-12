import { create } from 'zustand';
import type { Agent } from '../types/agent';

interface AgentState {
  agents: Agent[];
  activeAgentId: string | null;
  agentConversations: Record<string, string>;

  // Derived
  activeAgent: () => Agent | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setActiveAgent: (id: string) => void;
  getAgentConversationId: (agentId: string) => string | undefined;
  setAgentConversation: (agentId: string, conversationId: string) => void;
  clearAgentConversation: (agentId: string) => void;
  clearAgentState: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: null,
  agentConversations: {},

  activeAgent: () => {
    const { agents, activeAgentId } = get();
    if (!activeAgentId) return null;
    return agents.find(a => a.id === activeAgentId) ?? null;
  },

  setAgents: (agents) => set({ agents }),
  setActiveAgent: (id) => set({ activeAgentId: id }),

  getAgentConversationId: (agentId) => get().agentConversations[agentId],

  setAgentConversation: (agentId, conversationId) =>
    set(state => ({
      agentConversations: { ...state.agentConversations, [agentId]: conversationId },
    })),

  clearAgentConversation: (agentId) =>
    set(state => {
      const { [agentId]: _, ...rest } = state.agentConversations;
      return { agentConversations: rest };
    }),

  clearAgentState: () =>
    set({ agents: [], activeAgentId: null, agentConversations: {} }),
}));
