import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/chat-panel.ts';
import {
  chatConnectionState,
  activeConversations,
  streamingConversationId,
  clearChatState,
  setConversation,
} from '../../../src/state/chat.state.ts';
import { activeProviderState, selectedModelState } from '../../../src/state/provider.state.ts';
import { projectState } from '../../../src/state/project.state.ts';
import { connectionState } from '../../../src/state/connection.state.ts';
import {
  agentsState,
  activeAgentId,
  agentConversations,
  clearAgentState,
  setActiveAgent,
  setAgentConversation,
  getAgentConversationId,
} from '../../../src/state/agent.state.ts';
import type { ProjectData } from '../../../src/types/project.ts';
import type { Conversation, Message } from '../../../src/types/conversation.ts';
import type { Agent } from '../../../src/types/agent.ts';

const mockAgents: Agent[] = [
  {
    id: 'analyst',
    name: 'Analyst',
    title: 'Business Analyst',
    icon: 'brain',
    frontmatter_name: 'Analyst Agent',
    description: 'Analyzes business requirements',
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

const mockProject: ProjectData = {
  projectName: 'test-project',
  projectRoot: '/path/to/test-project',
  bmadLoaded: true,
  services: {
    config: true,
    phases: true,
    agents: true,
    status: true,
    artifacts: true,
    watcher: true,
  },
};

// Stub fetch globally
beforeEach(() => {
  clearChatState();
  clearAgentState();
  projectState.set(mockProject);
  activeProviderState.set('claude');
  selectedModelState.set('claude-3-opus');
  connectionState.set('connected');
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
});

afterEach(() => {
  clearChatState();
  clearAgentState();
  projectState.set(null);
  activeProviderState.set('');
  selectedModelState.set('');
  connectionState.set('disconnected');
});

describe('ChatPanel', () => {
  it('renders empty state when no project open', async () => {
    projectState.set(null);
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
    expect(emptyState!.textContent).to.include('Open a project');
  });

  it('renders empty state when no provider configured', async () => {
    activeProviderState.set('');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
    expect(emptyState!.textContent).to.include('Configure a provider');
  });

  it('creates conversation on first render when project + provider available', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    // A conversation should have been created in state
    const conversations = activeConversations.get();
    expect(conversations.size).to.be.greaterThan(0);
  });

  it('renders panel header with agent-badge and connection status', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const header = el.shadowRoot!.querySelector('.panel-header');
    expect(header).to.exist;

    const agentBadge = el.shadowRoot!.querySelector('agent-badge');
    expect(agentBadge).to.exist;

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot).to.exist;
  });

  it('renders message list from conversation signals', async () => {
    // Set up conversation with messages
    const convId = 'test-conv';
    const conversation: Conversation = {
      id: convId,
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
      ],
      model: 'claude-3-opus',
      provider: 'claude',
      createdAt: Date.now(),
    };
    setConversation(conversation);

    const el = await fixture(html`<chat-panel></chat-panel>`);
    // Set conversation ID manually for test
    (el as any)._conversationId = convId;
    await el.updateComplete;

    const blocks = el.shadowRoot!.querySelectorAll('conversation-block');
    expect(blocks.length).to.equal(2);
  });

  it('renders chat-input at bottom', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const chatInput = el.shadowRoot!.querySelector('chat-input');
    expect(chatInput).to.exist;
  });

  it('message area has role=log and aria-live', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const messageArea = el.shadowRoot!.querySelector('.message-area');
    expect(messageArea!.getAttribute('role')).to.equal('log');
    expect(messageArea!.getAttribute('aria-live')).to.equal('polite');
  });

  it('shows "Start a conversation" when no messages', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    // Inside message-list, there should be an empty state
    const emptyStates = el.shadowRoot!.querySelectorAll('.empty-state');
    const messageEmptyState = Array.from(emptyStates).find(
      e => e.textContent?.includes('Start a conversation')
    );
    expect(messageEmptyState).to.exist;
  });

  it('connection dot shows connected state', async () => {
    connectionState.set('connected');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot).to.exist;
    expect(dot!.getAttribute('title')).to.equal('Connected');
  });

  it('connection dot shows connecting state with animation', async () => {
    connectionState.set('connecting');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot!.classList.contains('connection-dot--connecting')).to.be.true;
  });

  describe('agent-aware conversations', () => {
    it('renders agent-badge in header instead of static Chat title', async () => {
      agentsState.set(mockAgents);
      setActiveAgent('analyst');

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      const agentBadge = el.shadowRoot!.querySelector('agent-badge');
      expect(agentBadge).to.exist;

      // No static header-title should exist
      const title = el.shadowRoot!.querySelector('.header-title');
      expect(title).to.not.exist;
    });

    it('creates new conversation for agent with no existing conversation', async () => {
      agentsState.set(mockAgents);
      setActiveAgent('analyst');

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      // A conversation should exist
      const conversations = activeConversations.get();
      expect(conversations.size).to.be.greaterThan(0);

      // Agent should be mapped to a conversation
      const convId = getAgentConversationId('analyst');
      expect(convId).to.not.be.undefined;
      expect(conversations.has(convId!)).to.be.true;
    });

    it('sets agentId on newly created conversations', async () => {
      agentsState.set(mockAgents);
      setActiveAgent('dev');

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      const convId = getAgentConversationId('dev');
      expect(convId).to.not.be.undefined;
      const conv = activeConversations.get().get(convId!);
      expect(conv).to.exist;
      expect(conv!.agentId).to.equal('dev');
    });

    it('switches conversation when activeAgentId changes', async () => {
      agentsState.set(mockAgents);
      setActiveAgent('analyst');

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      const analystConvId = getAgentConversationId('analyst');
      expect(analystConvId).to.not.be.undefined;

      // Switch to dev agent
      setActiveAgent('dev');
      await el.updateComplete;

      const devConvId = getAgentConversationId('dev');
      expect(devConvId).to.not.be.undefined;

      // Both conversations should exist in state
      const conversations = activeConversations.get();
      expect(conversations.has(analystConvId!)).to.be.true;
      expect(conversations.has(devConvId!)).to.be.true;

      // They should be different conversations
      expect(analystConvId).to.not.equal(devConvId);
    });

    it('preserves existing conversation when switching back to agent', async () => {
      agentsState.set(mockAgents);
      setActiveAgent('analyst');

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      const analystConvId = getAgentConversationId('analyst');

      // Switch to dev
      setActiveAgent('dev');
      await el.updateComplete;

      // Switch back to analyst
      setActiveAgent('analyst');
      await el.updateComplete;

      // Should still use the same conversation id
      const currentConvId = (el as any)._conversationId;
      expect(currentConvId).to.equal(analystConvId);
    });

    it('works without agents loaded (fallback to generic conversation)', async () => {
      agentsState.set([]);
      activeAgentId.set(null);

      const el = await fixture(html`<chat-panel></chat-panel>`);
      await el.updateComplete;

      // Should still create a conversation without agent
      const conversations = activeConversations.get();
      expect(conversations.size).to.be.greaterThan(0);

      // The conversation should not have agentId
      const conv = conversations.values().next().value;
      expect(conv.agentId).to.be.undefined;
    });
  });
});
