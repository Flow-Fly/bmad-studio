import { expect } from '@open-wc/testing';
import {
  agentsState,
  activeAgentId,
  agentConversations,
  activeAgent$,
  setActiveAgent,
  getAgentConversationId,
  setAgentConversation,
  clearAgentState,
} from '../../../src/state/agent.state.ts';
import type { Agent } from '../../../src/types/agent.ts';

const mockAgent1: Agent = {
  id: 'analyst',
  name: 'Analyst',
  title: 'Business Analyst',
  icon: 'brain',
  frontmatter_name: 'Analyst Agent',
  description: 'Analyzes business requirements',
  persona: {
    role: 'analyst',
    identity: 'Business analyst expert',
    communication_style: 'professional',
  },
  menu_items: [],
  workflows: [],
};

const mockAgent2: Agent = {
  id: 'dev',
  name: 'Dev',
  title: 'Developer',
  icon: 'code',
  frontmatter_name: 'Dev Agent',
  description: 'Implements code',
  persona: {
    role: 'developer',
    identity: 'Senior developer',
    communication_style: 'technical',
  },
  menu_items: [],
  workflows: [],
};

beforeEach(() => {
  clearAgentState();
});

describe('AgentState', () => {
  describe('initial state', () => {
    it('agentsState initializes to empty array', () => {
      expect(agentsState.get()).to.deep.equal([]);
    });

    it('activeAgentId initializes to null', () => {
      expect(activeAgentId.get()).to.be.null;
    });

    it('agentConversations initializes to empty map', () => {
      const map = agentConversations.get();
      expect(map.size).to.equal(0);
    });

    it('activeAgent$ returns null when no active agent', () => {
      expect(activeAgent$.get()).to.be.null;
    });
  });

  describe('setActiveAgent', () => {
    it('updates activeAgentId signal', () => {
      setActiveAgent('analyst');
      expect(activeAgentId.get()).to.equal('analyst');
    });

    it('activeAgent$ computed returns correct agent', () => {
      agentsState.set([mockAgent1, mockAgent2]);
      setActiveAgent('analyst');
      const agent = activeAgent$.get();
      expect(agent).to.not.be.null;
      expect(agent!.id).to.equal('analyst');
      expect(agent!.name).to.equal('Analyst');
    });

    it('activeAgent$ returns null for unknown agent id', () => {
      agentsState.set([mockAgent1]);
      setActiveAgent('unknown');
      expect(activeAgent$.get()).to.be.null;
    });
  });

  describe('getAgentConversationId', () => {
    it('returns undefined when agent has no conversation', () => {
      expect(getAgentConversationId('analyst')).to.be.undefined;
    });

    it('returns correct conversation ID after mapping', () => {
      setAgentConversation('analyst', 'conv-1');
      expect(getAgentConversationId('analyst')).to.equal('conv-1');
    });
  });

  describe('setAgentConversation', () => {
    it('maps agent to conversation', () => {
      setAgentConversation('analyst', 'conv-1');
      const map = agentConversations.get();
      expect(map.get('analyst')).to.equal('conv-1');
    });

    it('supports multiple agent-conversation mappings', () => {
      setAgentConversation('analyst', 'conv-1');
      setAgentConversation('dev', 'conv-2');
      const map = agentConversations.get();
      expect(map.get('analyst')).to.equal('conv-1');
      expect(map.get('dev')).to.equal('conv-2');
    });

    it('overwrites previous mapping for same agent', () => {
      setAgentConversation('analyst', 'conv-1');
      setAgentConversation('analyst', 'conv-2');
      expect(getAgentConversationId('analyst')).to.equal('conv-2');
    });
  });

  describe('clearAgentState', () => {
    it('resets all signals to initial values', () => {
      agentsState.set([mockAgent1, mockAgent2]);
      setActiveAgent('analyst');
      setAgentConversation('analyst', 'conv-1');

      clearAgentState();

      expect(agentsState.get()).to.deep.equal([]);
      expect(activeAgentId.get()).to.be.null;
      expect(agentConversations.get().size).to.equal(0);
      expect(activeAgent$.get()).to.be.null;
    });
  });
});
