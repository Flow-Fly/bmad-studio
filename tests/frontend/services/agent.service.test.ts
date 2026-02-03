import { expect } from '@open-wc/testing';
import { loadAgents } from '../../../src/services/agent.service.ts';
import { agentsState, clearAgentState } from '../../../src/state/agent.state.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearAgentState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAgentState();
});

describe('AgentService', () => {
  describe('loadAgents', () => {
    it('fetches from correct endpoint and sets agentsState', async () => {
      const mockAgents = [
        {
          id: 'analyst',
          name: 'Analyst',
          title: 'Business Analyst',
          icon: 'brain',
          frontmatter_name: 'Analyst Agent',
          description: 'Analyzes requirements',
          persona: { role: 'analyst', identity: 'Expert', communication_style: 'professional' },
          menu_items: [],
          workflows: [],
        },
        {
          id: 'dev',
          name: 'Dev',
          title: 'Developer',
          icon: 'code',
          frontmatter_name: 'Dev Agent',
          description: 'Writes code',
          persona: { role: 'developer', identity: 'Senior', communication_style: 'technical' },
          menu_items: [],
          workflows: [],
        },
      ];

      let capturedUrl = '';
      (globalThis as any).fetch = async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify({ agents: mockAgents }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      await loadAgents();

      expect(capturedUrl).to.equal('/api/v1/bmad/agents');
      const agents = agentsState.get();
      expect(agents).to.have.length(2);
      expect(agents[0].id).to.equal('analyst');
      expect(agents[1].id).to.equal('dev');
    });

    it('handles empty agents array', async () => {
      setupFetch(200, { agents: [] });

      await loadAgents();

      const agents = agentsState.get();
      expect(agents).to.deep.equal([]);
    });

    it('handles API error gracefully and sets empty array', async () => {
      setupFetch(500, {
        error: { code: 'internal_error', message: 'Server error' },
      });

      await loadAgents();

      const agents = agentsState.get();
      expect(agents).to.deep.equal([]);
    });

    it('handles network failure gracefully', async () => {
      (globalThis as any).fetch = async () => {
        throw new Error('Failed to fetch');
      };

      await loadAgents();

      const agents = agentsState.get();
      expect(agents).to.deep.equal([]);
    });

    it('handles response with null agents field', async () => {
      setupFetch(200, { agents: null });

      await loadAgents();

      const agents = agentsState.get();
      expect(agents).to.deep.equal([]);
    });

    it('parses agent data with all fields correctly', async () => {
      const fullAgent = {
        id: 'pm',
        name: 'PM',
        title: 'Product Manager',
        icon: 'clipboard-list',
        frontmatter_name: 'PM Agent',
        description: 'Manages product',
        persona: {
          role: 'product_manager',
          identity: 'Expert PM',
          communication_style: 'concise',
        },
        menu_items: [{ cmd: '/plan', label: 'Plan', workflow: null, exec: null }],
        workflows: ['workflow-1', 'workflow-2'],
      };

      setupFetch(200, { agents: [fullAgent] });

      await loadAgents();

      const agents = agentsState.get();
      expect(agents).to.have.length(1);
      expect(agents[0].persona.role).to.equal('product_manager');
      expect(agents[0].menu_items).to.have.length(1);
      expect(agents[0].workflows).to.deep.equal(['workflow-1', 'workflow-2']);
    });
  });
});
